import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopColor: '#E5E7EB',
            paddingTop: 8,
            paddingBottom: 8,
            height: 60,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
          headerStyle: {
            backgroundColor: '#3B82F6',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="urls"
          options={{
            title: 'URL',
            headerTitle: 'URL 동기화',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="link" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="passwords"
          options={{
            title: '비밀번호',
            headerTitle: '비밀번호 관리',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="lock-closed" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="todos"
          options={{
            title: 'To-Do',
            headerTitle: 'To-Do 리스트',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="checkbox" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="clipboard"
          options={{
            title: '클립보드',
            headerTitle: '클립보드 동기화',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="clipboard" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '프로필',
            headerTitle: '프로필',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
