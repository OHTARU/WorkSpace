'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { sanitizeUrl } from '@/utils/sanitize';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';
import { Plus, Trash2, ExternalLink, Check } from 'lucide-react';
import { SkeletonUrlItem, SkeletonList } from '@/components/Skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';
import { logger } from '@/lib/logger';
import type { Url } from '@shared/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function UrlsPage() {
  const [urls, setUrls] = useState<Url[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const supabase = createClient();
  const pagination = usePagination({ initialPageSize: 20 });

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

  // URL 목록 조회 (페이지네이션 적용)
  const fetchUrls = useCallback(async () => {
    if (!userId) return;

    setLoading(true);

    // 먼저 총 개수 조회
    const { count, error: countError } = await supabase
      .from('urls')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      toast.error('URL 목록을 불러오는데 실패했습니다.');
      setLoading(false);
      return;
    }

    pagination.setTotalCount(count || 0);

    // 페이지네이션으로 데이터 조회
    const { data, error } = await supabase
      .from('urls')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1);

    if (error) {
      toast.error('URL 목록을 불러오는데 실패했습니다.');
    } else {
      setUrls(data || []);
    }
    setLoading(false);
  }, [userId, pagination.offset, pagination.pageSize]);

  // userId나 페이지가 변경되면 데이터 조회
  useEffect(() => {
    if (userId) {
      fetchUrls();
    }
  }, [userId, pagination.page, pagination.pageSize]);

  // Realtime 구독 (에러 핸들링 포함)
  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel;

    const setupRealtime = () => {
      channel = supabase
        .channel('urls-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'urls',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          // INSERT: 첫 페이지에 있으면 목록에 추가
          if (payload.eventType === 'INSERT' && pagination.page === 1) {
            const newItem = payload.new as Url;
            setUrls((prev) => {
              // 이미 있으면 무시 (낙관적 업데이트로 이미 추가됨)
              if (prev.some((u) => u.id === newItem.id)) return prev;
              // 페이지 크기 초과하면 마지막 항목 제거
              const updated = [newItem, ...prev];
              if (updated.length > pagination.pageSize) {
                updated.pop();
              }
              return updated;
            });
            pagination.setTotalCount((prev) => prev + 1);
          }

          // UPDATE: 현재 목록에 있으면 업데이트
          if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as Url;
            setUrls((prev) =>
              prev.map((u) => (u.id === updatedItem.id ? updatedItem : u))
            );
          }

          // DELETE: 현재 목록에서 제거
          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setUrls((prev) => prev.filter((u) => u.id !== deletedId));
            pagination.setTotalCount((prev) => Math.max(0, prev - 1));
          }
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            logger.log('Realtime connected');
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            logger.error('Realtime subscription error:', err);
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
  }, [userId, pagination.page, pagination.pageSize]);

  const addUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim() || !userId) return;

    // URL 검증 및 SSRF 방어
    const urlToSave = sanitizeUrl(newUrl.trim());
    if (!urlToSave) {
      toast.error('유효하지 않은 URL입니다. 내부 네트워크 주소는 저장할 수 없습니다.');
      return;
    }

    const titleToSave = newTitle.trim() || null;

    // 낙관적 업데이트 (첫 페이지일 때만)
    const tempId = crypto.randomUUID();
    if (pagination.page === 1) {
      const newUrlItem: Url = {
        id: tempId,
        user_id: userId,
        url: urlToSave,
        title: titleToSave,
        description: null,
        favicon_url: null,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUrls((prev) => {
        const updated = [newUrlItem, ...prev];
        if (updated.length > pagination.pageSize) {
          updated.pop();
        }
        return updated;
      });
    }
    setNewUrl('');
    setNewTitle('');

    const { data, error } = await supabase.from('urls').insert({
      user_id: userId,
      url: urlToSave,
      title: titleToSave,
    }).select().single();

    if (error) {
      toast.error('URL 추가에 실패했습니다.');
      if (pagination.page === 1) {
        setUrls((prev) => prev.filter((u) => u.id !== tempId));
      }
    } else {
      if (pagination.page === 1) {
        setUrls((prev) => prev.map((u) => (u.id === tempId ? data : u)));
      }
      pagination.setTotalCount((prev) => prev + 1);
      toast.success('URL이 추가되었습니다!');
    }
  };

  const confirmDelete = (id: string, title: string) => {
    setDeleteTarget({ id, title });
  };

  const deleteUrl = async () => {
    if (!deleteTarget) return;

    const { id } = deleteTarget;
    // 낙관적 업데이트
    const deletedUrl = urls.find((u) => u.id === id);
    setUrls((prev) => prev.filter((u) => u.id !== id));
    setDeleteTarget(null);

    const { error } = await supabase.from('urls').delete().eq('id', id);

    if (error) {
      toast.error('삭제에 실패했습니다.');
      if (deletedUrl) setUrls((prev) => [...prev, deletedUrl]);
    } else {
      pagination.setTotalCount((prev) => Math.max(0, prev - 1));
      toast.success('삭제되었습니다.');
    }
  };

  const toggleRead = async (id: string, currentState: boolean) => {
    // 낙관적 업데이트
    setUrls((prev) =>
      prev.map((u) => (u.id === id ? { ...u, is_read: !currentState } : u))
    );

    const { error } = await supabase
      .from('urls')
      .update({ is_read: !currentState })
      .eq('id', id);

    if (error) {
      toast.error('상태 변경에 실패했습니다.');
      setUrls((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_read: currentState } : u))
      );
    }
  };

  if (loading && urls.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8">URL 동기화</h1>
        <div className="card mb-6 h-[72px] animate-pulse bg-gray-100" />
        <SkeletonList count={5}>
          <SkeletonUrlItem />
        </SkeletonList>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">URL 동기화</h1>

      {/* URL 추가 폼 */}
      <form onSubmit={addUrl} className="card mb-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="input"
              placeholder="URL 입력 (예: google.com)"
              required
            />
          </div>
          <div className="w-48">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="input"
              placeholder="제목 (선택)"
            />
          </div>
          <button type="submit" className="btn btn-primary flex items-center gap-2">
            <Plus size={20} />
            추가
          </button>
        </div>
      </form>

      {/* URL 목록 */}
      <div className="space-y-3">
        {urls.length === 0 ? (
          <div className="card text-center text-gray-500">
            저장된 URL이 없습니다. 위에서 URL을 추가해보세요.
          </div>
        ) : (
          urls.map((url) => (
            <div
              key={url.id}
              className={`card flex items-center gap-4 ${url.is_read ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => toggleRead(url.id, url.is_read)}
                className={`p-2 rounded-lg border ${
                  url.is_read
                    ? 'bg-green-100 border-green-300 text-green-600'
                    : 'border-gray-300 text-gray-400 hover:bg-gray-100'
                }`}
                aria-label={url.is_read ? '읽지 않음으로 표시' : '읽음으로 표시'}
              >
                <Check size={20} />
              </button>

              <div className="flex-1 min-w-0">
                <h3 className={`font-medium ${url.is_read ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {url.title || url.url}
                </h3>
                {url.title && (
                  <p className="text-sm text-gray-500 truncate">{url.url}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(url.created_at).toLocaleString('ko-KR')}
                </p>
              </div>

              <div className="flex gap-2">
                <a
                  href={url.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"
                  aria-label="새 탭에서 열기"
                >
                  <ExternalLink size={20} />
                </a>
                <button
                  onClick={() => confirmDelete(url.id, url.title || url.url)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  aria-label="삭제"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))
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
        onConfirm={deleteUrl}
        title="URL 삭제"
        message={`"${deleteTarget?.title}"을(를) 삭제하시겠습니까?`}
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
      />
    </div>
  );
}
