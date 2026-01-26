import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds, useForeground } from 'react-native-google-mobile-ads';

// 실제 광고 단위 ID (프로덕션 배포 시 교체 필요)
// 테스트용: TestIds.BANNER ('ca-app-pub-3940256099942544/6300978111')
const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-3940256099942544/6300978111'; // TODO: 실제 Ad Unit ID로 교체

interface AdBannerProps {
  style?: any;
}

export function AdBanner({ style }: AdBannerProps) {
  const [adLoaded, setAdLoaded] = useState(false);

  // iOS/Android 네이티브에서만 동작 (웹에서는 렌더링 안 함)
  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          setAdLoaded(true);
        }}
        onAdFailedToLoad={(error) => {
          console.error('Ad failed to load: ', error);
          setAdLoaded(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 10,
  },
});