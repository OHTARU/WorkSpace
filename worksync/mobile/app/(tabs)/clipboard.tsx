import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscription } from '../../src/hooks/useSubscription';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const { width: screenWidth } = Dimensions.get('window');

interface ClipboardItem {
  id: string;
  content: string;
  content_type: string;
  source_device: string | null;
  is_pinned: boolean;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  file_size: number | null;
}

function VideoPlayer({ uri, style }: { uri: string; style: any }) {
  const player = useVideoPlayer(uri, player => {
    player.loop = false;
  });

  return (
    <VideoView
      style={style}
      player={player}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function ClipboardScreen() {
  const [clipboards, setClipboards] = useState<ClipboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const { user } = useAuth();
  const { checkLimit } = useSubscription();

  useEffect(() => {
    fetchClipboards();

    // Realtime 구독
    const channel = supabase
      .channel('clipboards-mobile')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clipboards',
        filter: `user_id=eq.${user?.id}`,
      }, () => {
        fetchClipboards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchClipboards = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('clipboards')
      .select('*')
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('오류', '목록을 불러오는데 실패했습니다.');
    } else {
      // Signed URL 생성 (에러 핸들링 포함)
      try {
        const signedData = await Promise.all((data || []).map(async (item) => {
          if (item.media_url && (item.content_type === 'image' || item.content_type === 'video')) {
            try {
              const { data: signed, error: signedError } = await supabase.storage
                .from('clipboard-media')
                .createSignedUrl(item.media_url, 3600);

              if (signedError) {
                console.error('Failed to create signed URL:', signedError);
                return { ...item, original_path: item.media_url };
              }

              if (signed) {
                return { ...item, original_path: item.media_url, media_url: signed.signedUrl };
              }
            } catch (urlError) {
              console.error('Error creating signed URL for item:', urlError);
              return { ...item, original_path: item.media_url };
            }
          }
          return { ...item, original_path: item.media_url };
        }));
        setClipboards(signedData);
      } catch (signedUrlError) {
        console.error('Failed to process signed URLs:', signedUrlError);
        // 실패 시에도 원본 데이터는 표시
        const fallbackData = (data || []).map(item => ({ ...item, original_path: item.media_url }));
        setClipboards(fallbackData);
        Alert.alert('경고', '일부 미디어를 불러오는데 실패했습니다.');
      }
    }
    setLoading(false);
    setRefreshing(false);
  };

  const pickMedia = async () => {
    // 권한 요청
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return;
    }

    // 미디어 선택
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // 파일 크기 확인
      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
        Alert.alert('오류', '파일 크기는 10MB를 초과할 수 없습니다.');
        return;
      }

      await uploadMedia(asset);
    }
  };

  const takePhoto = async () => {
    // 카메라 권한 요청
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadMedia(result.assets[0]);
    }
  };

  const uploadMedia = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user) return;

    // 구독 제한 체크
    const limit = checkLimit('clipboards');
    if (!limit.allowed) {
      Alert.alert(
        '한도 도달',
        `클립보드 저장 한도(${limit.limit}개)에 도달했습니다.\n\n웹사이트에서 플랜을 관리할 수 있습니다.`,
        [{ text: '확인', style: 'cancel' }]
      );
      return;
    }

    setUploading(true);
    try {
      const isVideo = asset.type === 'video';
      const fileExt = asset.uri.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const contentType = isVideo
        ? `video/${fileExt === 'mov' ? 'quicktime' : fileExt}`
        : `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

      // 파일을 base64로 읽기 (React Native에서 blob 문제 해결)
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // base64를 ArrayBuffer로 변환
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('clipboard-media')
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // DB에 저장 (Public URL 대신 경로 저장)
      const { error: dbError } = await supabase.from('clipboards').insert({
        user_id: user.id,
        content: isVideo ? '동영상' : '이미지',
        content_type: isVideo ? 'video' : 'image',
        source_device: 'mobile',
        media_url: fileName, // 경로 저장
        media_type: contentType,
        file_size: asset.fileSize || arrayBuffer.byteLength,
      });

      if (dbError) {
        throw dbError;
      }

      Alert.alert('완료', '미디어가 업로드되었습니다!');
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('오류', error.message || '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = async (content: string) => {
    await Clipboard.setStringAsync(content);
    Alert.alert('복사됨', '클립보드에 복사되었습니다.');
  };

  const togglePin = async (id: string, currentState: boolean) => {
    await supabase
      .from('clipboards')
      .update({ is_pinned: !currentState })
      .eq('id', id);
  };

  const deleteItem = async (item: ClipboardItem) => {
    Alert.alert('삭제', '이 항목을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          // 미디어가 있으면 Storage에서도 삭제
          const path = (item as any).original_path || item.media_url;
          if (path) {
             const storagePath = path.includes('/clipboard-media/') 
                ? path.split('/clipboard-media/')[1] 
                : path;
            
            await supabase.storage.from('clipboard-media').remove([storagePath]);
          }
          await supabase.from('clipboards').delete().eq('id', item.id);
        },
      },
    ]);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const saveMedia = async (item: ClipboardItem) => {
    if (!item.media_url) return;

    setSaving(item.id);
    try {
      // 갤러리 접근 권한 확인
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '갤러리에 저장하려면 접근 권한이 필요합니다.');
        setSaving(null);
        return;
      }

      // 파일 확장자 결정 (MIME 타입 우선, 없으면 URL에서 추출)
      let ext = 'jpg';
      if (item.media_type) {
        if (item.media_type.includes('video')) {
          ext = item.media_type.includes('quicktime') ? 'mov' : 'mp4';
        } else if (item.media_type.includes('image')) {
          if (item.media_type.includes('png')) ext = 'png';
          else if (item.media_type.includes('gif')) ext = 'gif';
          else if (item.media_type.includes('webp')) ext = 'webp';
          else ext = 'jpg';
        }
      } else {
        const urlParts = item.media_url.split('.');
        const urlExt = urlParts[urlParts.length - 1].split('?')[0];
        if (urlExt && urlExt.length < 5) ext = urlExt; // 길이가 너무 길면 확장자가 아닐 수 있음
      }

      const fileName = `worksync_${Date.now()}.${ext}`;
      // Android에서는 cacheDirectory에서 바로 MediaLibrary로 이동 시 문제가 발생할 수 있어 documentDirectory 사용
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // 파일 다운로드
      const downloadResult = await FileSystem.downloadAsync(
        item.media_url,
        fileUri
      );

      if (downloadResult.status !== 200) {
        throw new Error(`다운로드에 실패했습니다. (Status: ${downloadResult.status})`);
      }

      // 파일 존재 확인
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('파일을 저장할 수 없습니다.');
      }

      // 갤러리에 저장
      await MediaLibrary.createAssetAsync(downloadResult.uri);
      
      Alert.alert('완료', '갤러리에 저장되었습니다.');

      // 임시 파일 삭제
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('오류', error.message || '저장에 실패했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const showMediaOptions = () => {
    Alert.alert('미디어 추가', '어떤 방법으로 추가할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '갤러리에서 선택', onPress: pickMedia },
      { text: '카메라로 촬영', onPress: takePhoto },
    ]);
  };

  const renderItem = ({ item }: { item: ClipboardItem }) => {
    const isMedia = item.content_type === 'image' || item.content_type === 'video';

    return (
      <TouchableOpacity
        style={[styles.card, item.is_pinned && styles.cardPinned]}
        onPress={() => !isMedia && copyToClipboard(item.content)}
        onLongPress={() => deleteItem(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badges}>
            <View style={[
              styles.typeBadge,
              isMedia && styles.mediaBadge
            ]}>
              <Ionicons
                name={
                  item.content_type === 'image' ? 'image' :
                  item.content_type === 'video' ? 'videocam' :
                  'document-text'
                }
                size={12}
                color={isMedia ? '#fff' : '#6B7280'}
                style={{ marginRight: 4 }}
              />
              <Text style={[
                styles.typeBadgeText,
                isMedia && styles.mediaBadgeText
              ]}>
                {item.content_type === 'image' ? '이미지' :
                 item.content_type === 'video' ? '동영상' :
                 item.content_type}
              </Text>
            </View>
            {item.file_size && (
              <Text style={styles.fileSize}>{formatFileSize(item.file_size)}</Text>
            )}
            {item.source_device && (
              <View style={styles.deviceBadge}>
                <Ionicons
                  name={item.source_device === 'pc' ? 'desktop' : 'phone-portrait'}
                  size={12}
                  color="#6B7280"
                />
                <Text style={styles.deviceText}>
                  {item.source_device === 'pc' ? 'PC' : '모바일'}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => togglePin(item.id, item.is_pinned)}>
            <Ionicons
              name={item.is_pinned ? 'pin' : 'pin-outline'}
              size={20}
              color={item.is_pinned ? '#3B82F6' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>

        {/* 미디어 콘텐츠 */}
        {isMedia && item.media_url ? (
          <View style={styles.mediaContainer}>
            {item.content_type === 'image' ? (
              <Image
                source={item.media_url}
                style={styles.mediaImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <VideoPlayer
                uri={item.media_url}
                style={styles.mediaVideo}
              />
            )}
          </View>
        ) : (
          <Text
            style={[styles.content, item.content_type === 'code' && styles.contentCode]}
            numberOfLines={5}
          >
            {item.content}
          </Text>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleString('ko-KR')}
          </Text>
          {isMedia ? (
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => saveMedia(item)}
              disabled={saving === item.id}
            >
              {saving === item.id ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color="#10B981" />
                  <Text style={styles.saveText}>저장</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => copyToClipboard(item.content)}
            >
              <Ionicons name="copy-outline" size={16} color="#3B82F6" />
              <Text style={styles.copyText}>복사</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ marginTop: 8 }}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 업로드 중 오버레이 */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingBox}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.uploadingText}>업로드 중...</Text>
          </View>
        </View>
      )}

      <FlashList
        data={clipboards}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={250}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchClipboards();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>클립보드가 비어있습니다</Text>
            <Text style={styles.emptySubtext}>아래 버튼으로 미디어를 추가하세요</Text>
          </View>
        }
      />

      {/* 미디어 추가 FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={showMediaOptions}
        disabled={uploading}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardPinned: {
    borderColor: '#3B82F6',
    borderWidth: 1,
    backgroundColor: '#EFF6FF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mediaBadge: {
    backgroundColor: '#3B82F6',
  },
  typeBadgeText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  mediaBadgeText: {
    color: '#fff',
  },
  fileSize: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  deviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deviceText: {
    fontSize: 11,
    color: '#6B7280',
  },
  content: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  contentCode: {
    fontFamily: 'monospace',
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderRadius: 8,
  },
  mediaContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  mediaImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  mediaVideo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  uploadingBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#374151',
  },
});
