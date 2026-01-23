import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';

interface Url {
  id: string;
  url: string;
  title: string | null;
  is_read: boolean;
  created_at: string;
}

export default function UrlsScreen() {
  const [urls, setUrls] = useState<Url[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchUrls();

    // Realtime 구독
    const channel = supabase
      .channel('urls-mobile')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'urls',
        filter: `user_id=eq.${user?.id}`,
      }, () => {
        fetchUrls();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchUrls = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('urls')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('오류', '목록을 불러오는데 실패했습니다.');
    } else {
      setUrls(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const toggleReadStatus = async (id: string, currentStatus: boolean) => {
    await supabase.from('urls').update({ is_read: !currentStatus }).eq('id', id);
  };

  const openUrl = async (url: string, id: string) => {
    // 읽음 표시
    await supabase.from('urls').update({ is_read: true }).eq('id', id);

    // 브라우저로 열기
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('오류', '이 URL을 열 수 없습니다.');
    }
  };

  const copyToClipboard = async (url: string) => {
    await Clipboard.setStringAsync(url);
    Alert.alert('복사됨', 'URL이 클립보드에 복사되었습니다.');
  };

  const deleteUrl = async (id: string) => {
    Alert.alert('삭제', '이 URL을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('urls').delete().eq('id', id);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Url }) => (
    <View style={[styles.card, item.is_read && styles.cardRead]}>
      <TouchableOpacity
        style={styles.checkButton}
        onPress={() => toggleReadStatus(item.id, item.is_read)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={item.is_read ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={item.is_read ? '#10B981' : '#9CA3AF'}
        />
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => openUrl(item.url, item.id)}
        onLongPress={() => deleteUrl(item.id)}
      >
        <Text style={[styles.title, item.is_read && styles.titleRead]} numberOfLines={1}>
          {item.title || item.url}
        </Text>
        {item.title && (
          <Text style={styles.url} numberOfLines={1}>
            {item.url}
          </Text>
        )}
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleString('ko-KR')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.copyButton}
        onPress={() => copyToClipboard(item.url)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="copy-outline" size={20} color="#6B7280" />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={urls}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchUrls();
          }} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="link" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>저장된 URL이 없습니다</Text>
            <Text style={styles.emptySubtext}>PC에서 URL을 추가해보세요</Text>
          </View>
        }
      />
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
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardRead: {
    backgroundColor: '#F9FAFB',
  },
  checkButton: {
    padding: 8,
    marginRight: 4,
  },
  cardContent: {
    flex: 1,
    paddingVertical: 4,
  },
  copyButton: {
    padding: 8,
    marginLeft: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  titleRead: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  url: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
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
});
