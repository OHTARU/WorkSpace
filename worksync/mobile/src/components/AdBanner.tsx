import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : Platform.select({
      ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy', // 실제 iOS 광고 단위 ID로 교체 필요
      android: 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz', // 실제 Android 광고 단위 ID로 교체 필요
      default: TestIds.BANNER,
    });

export function AdBanner() {
  const [error, setError] = useState<boolean>(false);

  if (error) {
    return null;
  }

  return (
    <View style={{ alignItems: 'center', marginVertical: 10 }}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(err) => {
          console.error('Ad failed to load', err);
          setError(true);
        }}
      />
    </View>
  );
}
