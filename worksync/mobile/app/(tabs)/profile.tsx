import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  Platform,
  Linking,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSubscription } from '../../src/hooks/useSubscription';
import { logger } from '../../src/utils/logger';

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useAuth();
  const { plan, isPro, usage } = useSubscription();
  const router = useRouter();

  // 개발자 모드 상태
  const [devModeCount, setDevModeCount] = useState(0);
  const [isDevMode, setIsDevMode] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Profile fetch error:', error);
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 데이터(비밀번호, URL, Todo, 클립보드 등)가 즉시 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계정 삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { error } = await supabase.functions.invoke('delete-account');
              if (error) throw error;
              
              await signOut();
              Alert.alert('완료', '계정이 삭제되었습니다.');
              router.replace('/(auth)/login');
            } catch (error: any) {
              Alert.alert('오류', '계정 삭제에 실패했습니다. 고객센터에 문의해주세요.');
              console.error(error);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReset = () => {
    Alert.alert(
      '캐시 삭제 및 초기화',
      '앱의 모든 로컬 데이터를 삭제하고 다시 로그인하시겠습니까? 동기화 문제가 발생할 때 유용합니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '초기화',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleDevModeTap = () => {
    if (isDevMode) return;
    
    setDevModeCount(prev => prev + 1);
    if (devModeCount + 1 >= 5) {
      setIsDevMode(true);
      Alert.alert('개발자 모드', '개발자 모드가 활성화되었습니다.');
    }
  };

  const openLogViewer = () => {
    setLogs(logger.getLogs());
    setShowLogModal(true);
  };

  const sendLogs = () => {
    const logContent = logger.exportLogs();
    const subject = `[WorkSync Log] ${profile?.email || 'User'}`;
    const url = `mailto:dusckd4948@naver.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(logContent)}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('알림', '이메일 앱을 찾을 수 없습니다.');
      }
    });
  };

  const renderUsageItem = (icon: string, label: string, featureKey: string) => {
    const current = usage[featureKey]?.current_count || 0;
    const limit = plan?.limits[featureKey as keyof typeof plan.limits] || 0;
    const isUnlimited = limit === -1 || isPro;

    return (
      <View style={styles.usageItem}>
        <View style={styles.usageIcon}>
          <Ionicons name={icon as any} size={18} color="#6B7280" />
        </View>
        <Text style={styles.usageLabel}>{label}</Text>
        <Text style={styles.usageValue}>
          {current} {isUnlimited ? '' : `/ ${limit}`}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color="#fff" />
        </View>
        <Text style={styles.name}>{profile?.display_name || '사용자'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>구독 및 사용량</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="sparkles-outline" size={20} color={isPro ? "#8B5CF6" : "#6B7280"} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>현재 플랜</Text>
              <Text style={[styles.infoValue, isPro && { color: "#8B5CF6", fontWeight: "700" }]}>
                {plan?.display_name || 'Free'}
              </Text>
            </View>
          </View>

          <View style={styles.usageDivider} />
          
          <View style={styles.usageGrid}>
            {renderUsageItem('link-outline', 'URL', 'urls')}
            {renderUsageItem('lock-closed-outline', '비밀번호', 'passwords')}
            {renderUsageItem('checkbox-outline', '프로젝트', 'projects')}
            {renderUsageItem('clipboard-outline', '클립보드', 'clipboards')}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>계정 정보</Text>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>이메일</Text>
              <Text style={styles.infoValue}>{profile?.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>가입일</Text>
              <Text style={styles.infoValue}>
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString('ko-KR')
                  : '-'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 정보</Text>

        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.infoRow} 
            activeOpacity={1} 
            onPress={handleDevModeTap}
          >
            <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>버전</Text>
              <Text style={styles.infoValue}>1.0.1 (Build 2)</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {isDevMode && (
        <TouchableOpacity style={styles.devButton} onPress={openLogViewer}>
          <Ionicons name="bug-outline" size={20} color="#fff" />
          <Text style={styles.devButtonText}>로그 뷰어 열기</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>로그아웃</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.resetButton} onPress={handleDeleteAccount}>
        <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
        <Text style={[styles.resetText, { color: '#9CA3AF' }]}>회원 탈퇴</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
        <Ionicons name="refresh-outline" size={18} color="#6B7280" />
        <Text style={styles.resetText}>캐시 삭제 및 초기화</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        WorkSync - PC와 모바일을 연결합니다
      </Text>

      {/* 로그 뷰어 모달 */}
      <Modal visible={showLogModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>시스템 로그</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={sendLogs} style={styles.headerBtn}>
                <Ionicons name="mail-outline" size={24} color="#3B82F6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowLogModal(false)} style={styles.headerBtn}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={logs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View style={[styles.logItem, item.level === 'error' && styles.logError]}>
                <Text style={styles.logTime}>{item.timestamp.split('T')[1].slice(0, -1)}</Text>
                <Text style={[styles.logLevel, 
                  item.level === 'error' ? { color: '#EF4444' } : 
                  item.level === 'warn' ? { color: '#F59E0B' } : { color: '#10B981' }
                ]}>[{item.level.toUpperCase()}]</Text>
                <Text style={styles.logMsg}>{item.message}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: 16 }}
          />
        </View>
      </Modal>
    </ScrollView>
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
  header: {
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    paddingVertical: 32,
    paddingTop: 48,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  email: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    marginTop: 2,
  },
  upgradeBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upgradeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  usageDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  usageGrid: {
    padding: 16,
    gap: 12,
  },
  usageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  usageIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageLabel: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginLeft: 48,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 8,
    gap: 6,
  },
  resetText: {
    fontSize: 13,
    color: '#6B7280',
    textDecorationLine: 'underline',
  },
  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4B5563',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  devButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  headerBtn: {
    padding: 4,
  },
  logItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logError: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    borderRadius: 4,
  },
  logTime: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  logLevel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  logMsg: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#374151',
  },
});