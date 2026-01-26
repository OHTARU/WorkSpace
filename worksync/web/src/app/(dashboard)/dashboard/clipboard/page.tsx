'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Copy, Pin, PinOff, Monitor, Upload, Image as ImageIcon, Video, Download } from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { useSubscription } from '@/hooks/useSubscription';
import { Pagination } from '@/components/Pagination';
import { SkeletonClipboardItem, SkeletonList } from '@/components/Skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { UsageWarningBanner } from '@/components/subscription/UsageWarningBanner';
import toast from 'react-hot-toast';
import { validateFileAsync, formatFileSize } from '@/utils/fileValidation';
import { logger } from '@/lib/logger';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Clipboard {
  id: string;
  user_id: string;
  content: string;
  content_type: string;
  source_device: string | null;
  is_pinned: boolean;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  file_size: number | null;
}

/** Clipboard with original_path for signed URL handling */
interface ClipboardWithPath extends Clipboard {
  original_path?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm'
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm'];

export default function ClipboardPage() {
  const [clipboards, setClipboards] = useState<ClipboardWithPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [contentType, setContentType] = useState('text');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClipboardWithPath | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [limitInfo, setLimitInfo] = useState({ current: 0, limit: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const pagination = usePagination({ initialPageSize: 20 });
  const { checkLimit, isFree } = useSubscription();

  // 사용자 확인
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    checkUser();
  }, []);

  // userId나 페이지가 변경되면 데이터 조회
  useEffect(() => {
    if (userId) {
      fetchClipboards();
    }
  }, [userId, pagination.page, pagination.pageSize]);

  // Realtime 구독 (에러 핸들링 포함)
  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupRealtime = () => {
      channel = supabase
        .channel('clipboards-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'clipboards',
          filter: `user_id=eq.${userId}`,
        }, () => {
          fetchClipboards();
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            logger.log('Clipboards realtime connected');
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.error('Clipboards realtime subscription error:', err);
            // 재연결 시도
            setTimeout(() => {
              supabase.removeChannel(channel);
              setupRealtime();
            }, 5000);
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  const fetchClipboards = async () => {
    if (!userId) return;

    setLoading(true);

    // 먼저 총 개수 조회
    const { count, error: countError } = await supabase
      .from('clipboards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      toast.error('클립보드 목록을 불러오는데 실패했습니다.');
      setLoading(false);
      return;
    }

    pagination.setTotalCount(count || 0);

    // 페이지네이션으로 데이터 조회
    const { data, error } = await supabase
      .from('clipboards')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

    if (error) {
      toast.error('클립보드 목록을 불러오는데 실패했습니다.');
    } else {
      // Signed URL 생성 (에러 핸들링 포함)
      try {
        const signedData = await Promise.all((data || []).map(async (item) => {
          if (item.media_url && (item.content_type === 'image' || item.content_type === 'video')) {
            try {
              const { data: signed, error: signedError } = await supabase.storage
                .from('clipboard-media')
                .createSignedUrl(item.media_url, 3600); // 1시간 유효

              if (signedError) {
                logger.error('Failed to create signed URL:', signedError);
                return { ...item, original_path: item.media_url };
              }

              if (signed) {
                return { ...item, original_path: item.media_url, media_url: signed.signedUrl };
              }
            } catch (urlError) {
              logger.error('Error creating signed URL for item:', urlError);
              return { ...item, original_path: item.media_url };
            }
          }
          return { ...item, original_path: item.media_url };
        }));
        setClipboards(signedData);
      } catch (signedUrlError) {
        logger.error('Failed to process signed URLs:', signedUrlError);
        // 실패 시에도 원본 데이터는 표시
        const fallbackData = (data || []).map(item => ({ ...item, original_path: item.media_url }));
        setClipboards(fallbackData);
        toast.error('일부 미디어를 불러오는데 실패했습니다.');
      }
    }
    setLoading(false);
  };

  const addClipboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || !userId) return;

    // 구독 제한 체크
    const limit = checkLimit('clipboards');
    if (!limit.allowed) {
      setLimitInfo({ current: limit.current, limit: limit.limit });
      setShowUpgradeModal(true);
      return;
    }

    const { error } = await supabase.from('clipboards').insert({
      user_id: userId,
      content: newContent.trim(),
      content_type: contentType,
      source_device: 'pc',
    });

    if (error) {
      toast.error('클립보드 추가에 실패했습니다.');
    } else {
      toast.success('클립보드에 추가되었습니다!');
      setNewContent('');
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // 파일 검증 (Magic Bytes 포함 - 파일 위조 방지)
    const validation = await validateFileAsync(file, {
      maxSizeBytes: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_TYPES,
      allowedExtensions: ALLOWED_EXTENSIONS,
      validateMagicBytes: true,
    });

    if (!validation.valid) {
      toast.error(validation.error || '파일을 업로드할 수 없습니다.');
      return;
    }

    await uploadMedia(file);
  };

  const uploadMedia = async (file: File) => {
    if (!userId) return;

    // 구독 제한 체크
    const limit = checkLimit('clipboards');
    if (!limit.allowed) {
      setLimitInfo({ current: limit.current, limit: limit.limit });
      setShowUpgradeModal(true);
      return;
    }

    setUploading(true);
    try {
      const isVideo = file.type.startsWith('video/');
      const fileExt = file.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('clipboard-media')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // DB에 저장 (Public URL 대신 파일 경로 저장)
      const { error: dbError } = await supabase.from('clipboards').insert({
        user_id: userId,
        content: isVideo ? '동영상' : '이미지',
        content_type: isVideo ? 'video' : 'image',
        source_device: 'pc',
        media_url: fileName, // 경로 저장
        media_type: file.type,
        file_size: file.size,
      });

      if (dbError) {
        throw dbError;
      }

      toast.success('미디어가 업로드되었습니다!');
    } catch (error) {
      logger.error('Upload error:', error);
      const message = error instanceof Error ? error.message : '업로드에 실패했습니다.';
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const confirmDelete = (clip: Clipboard) => {
    setDeleteTarget(clip);
  };

  const deleteClipboard = async () => {
    if (!deleteTarget) return;

    const clip = deleteTarget;
    setDeleteTarget(null);

    try {
      // 1. Storage에서 먼저 삭제 (미디어가 있는 경우)
      const path = clip.original_path || clip.media_url;

      if (path) {
        const storagePath = path.includes('/clipboard-media/')
          ? path.split('/clipboard-media/')[1]
          : path;

        const { error: storageError } = await supabase.storage
          .from('clipboard-media')
          .remove([storagePath]);

        if (storageError) {
          logger.error('Storage delete failed:', storageError);
          // Storage 삭제 실패해도 계속 진행 (고아 파일 정리는 나중에)
        }
      }

      // 2. DB 레코드 삭제
      const { error } = await supabase.from('clipboards').delete().eq('id', clip.id);

      if (error) {
        throw error;
      }

      toast.success('삭제되었습니다.');
    } catch (error) {
      logger.error('Delete failed:', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const togglePin = async (id: string, currentState: boolean) => {
    const { error } = await supabase
      .from('clipboards')
      .update({ is_pinned: !currentState })
      .eq('id', id);

    if (error) {
      toast.error('핀 상태 변경에 실패했습니다.');
    }
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('클립보드에 복사되었습니다!');
    } catch {
      toast.error('복사에 실패했습니다.');
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setNewContent(text);
        toast.success('클립보드에서 붙여넣기 되었습니다!');
      }
    } catch {
      toast.error('클립보드 접근 권한이 필요합니다.');
    }
  };

  const downloadMedia = async (clip: Clipboard) => {
    if (!clip.media_url) return;

    try {
      toast.loading('다운로드 중...', { id: 'download' });

      const response = await fetch(clip.media_url);

      // 응답 상태 검증
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();

      // blob 크기 검증
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      // 파일명 생성
      const urlParts = clip.media_url.split('.');
      const ext = urlParts[urlParts.length - 1].split('?')[0] || 'jpg';
      const fileName = `worksync_${Date.now()}.${ext}`;

      // 다운로드 링크 생성
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('다운로드 완료!', { id: 'download' });
    } catch (error) {
      logger.error('Download error:', error);
      toast.error('다운로드에 실패했습니다.', { id: 'download' });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8">클립보드 동기화</h1>
        <div className="card mb-6 h-[180px] animate-pulse bg-gray-100" />
        <div className="card mb-6 h-[160px] animate-pulse bg-gray-100" />
        <SkeletonList count={4}>
          <SkeletonClipboardItem />
        </SkeletonList>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">클립보드 동기화</h1>

      {/* 사용량 경고 배너 */}
      {isFree && (
        <UsageWarningBanner
          feature="clipboards"
          current={checkLimit('clipboards').current}
          limit={checkLimit('clipboards').limit}
        />
      )}

      {/* 클립보드 추가 폼 */}
      <form onSubmit={addClipboard} className="card mb-6">
        <div className="space-y-4">
          <div className="flex gap-4">
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="input w-32"
            >
              <option value="text">텍스트</option>
              <option value="url">URL</option>
              <option value="code">코드</option>
            </select>
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="btn btn-secondary"
            >
              클립보드에서 붙여넣기
            </button>
          </div>

          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="input min-h-[100px]"
            placeholder="모바일에서 사용할 텍스트를 입력하세요..."
            required
          />

          <button type="submit" className="btn btn-primary flex items-center gap-2">
            <Plus size={20} />
            추가
          </button>
        </div>
      </form>

      {/* 미디어 업로드 영역 */}
      <div
        className={`card mb-6 border-2 border-dashed transition-colors ${
          dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center py-8">
          <div className="flex items-center gap-4 mb-4">
            <ImageIcon className="w-10 h-10 text-gray-400" />
            <Video className="w-10 h-10 text-gray-400" />
          </div>
          <p className="text-gray-600 mb-2">
            {uploading ? '업로드 중...' : '이미지나 동영상을 드래그하거나 클릭하여 업로드'}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            최대 10MB • JPG, PNG, GIF, WebP, MP4, MOV, WebM
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            id="media-upload"
          />
          <label
            htmlFor="media-upload"
            className="btn btn-secondary flex items-center gap-2 cursor-pointer"
          >
            <Upload size={18} />
            파일 선택
          </label>
        </div>
      </div>

      {/* 클립보드 목록 */}
      <div className="space-y-3">
        {clipboards.length === 0 ? (
          <div className="card text-center text-gray-500">
            저장된 클립보드가 없습니다. 텍스트나 미디어를 추가하면 모바일에서 바로 확인할 수 있습니다.
          </div>
        ) : (
          clipboards.map((clip) => {
            const isMedia = clip.content_type === 'image' || clip.content_type === 'video';

            return (
              <div
                key={clip.id}
                className={`card ${clip.is_pinned ? 'border-primary-300 bg-primary-50/50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                        isMedia ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {clip.content_type === 'image' && <ImageIcon size={12} />}
                        {clip.content_type === 'video' && <Video size={12} />}
                        {clip.content_type === 'image' ? '이미지' :
                         clip.content_type === 'video' ? '동영상' :
                         clip.content_type}
                      </span>
                      {clip.file_size && (
                        <span className="text-xs text-gray-400">
                          {formatFileSize(clip.file_size)}
                        </span>
                      )}
                      {clip.source_device && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Monitor size={12} />
                          {clip.source_device === 'pc' ? 'PC' : '모바일'}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {new Date(clip.created_at).toLocaleString('ko-KR')}
                      </span>
                    </div>

                    {/* 미디어 콘텐츠 */}
                    {isMedia && clip.media_url ? (
                      <div className="mt-2 mb-2">
                        {clip.content_type === 'image' ? (
                          <img
                            src={clip.media_url}
                            alt="클립보드 이미지"
                            className="max-w-md max-h-64 rounded-lg object-contain bg-gray-100"
                          />
                        ) : (
                          <video
                            src={clip.media_url}
                            controls
                            className="max-w-md max-h-64 rounded-lg bg-black"
                          />
                        )}
                      </div>
                    ) : (
                      <pre
                        className={`whitespace-pre-wrap break-words text-sm ${
                          clip.content_type === 'code'
                            ? 'font-mono bg-gray-100 p-3 rounded-lg'
                            : 'text-gray-700'
                        }`}
                      >
                        {clip.content}
                      </pre>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => togglePin(clip.id, clip.is_pinned)}
                      className={`p-2 rounded-lg ${
                        clip.is_pinned
                          ? 'text-primary-600 bg-primary-100'
                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                      }`}
                      title={clip.is_pinned ? '핀 해제' : '핀 고정'}
                      aria-label={clip.is_pinned ? '핀 해제' : '핀 고정'}
                    >
                      {clip.is_pinned ? <PinOff size={18} /> : <Pin size={18} />}
                    </button>

                    {isMedia ? (
                      <button
                        onClick={() => downloadMedia(clip)}
                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                        title="다운로드"
                        aria-label="다운로드"
                      >
                        <Download size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => copyToClipboard(clip.content)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="복사"
                        aria-label="복사"
                      >
                        <Copy size={18} />
                      </button>
                    )}

                    <button
                      onClick={() => confirmDelete(clip)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="삭제"
                      aria-label="삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 페이지네이션 */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteClipboard}
        title="클립보드 삭제"
        message={`이 ${deleteTarget?.content_type === 'image' ? '이미지' : deleteTarget?.content_type === 'video' ? '동영상' : '클립보드 항목'}을(를) 삭제하시겠습니까?`}
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
      />

      {/* 업그레이드 모달 */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="clipboards"
        current={limitInfo.current}
        limit={limitInfo.limit}
      />
    </div>
  );
}
