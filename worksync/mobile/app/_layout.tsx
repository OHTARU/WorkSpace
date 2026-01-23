import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import { decode, encode } from 'base-64';

// Base64 polyfill for React Native
if (!global.btoa) {
  global.btoa = encode;
}
if (!global.atob) {
  global.atob = decode;
}

// TextEncoder/TextDecoder polyfill
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = require('text-encoding').TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = require('text-encoding').TextDecoder;
}

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

export default function RootLayout() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="dark" />
        {isConnected === false && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={16} color="#fff" />
            <Text style={styles.offlineText}>오프라인 상태입니다. 변경사항이 저장되지 않을 수 있습니다.</Text>
          </View>
        )}
        <Slot />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    backgroundColor: '#EF4444',
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  offlineText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
