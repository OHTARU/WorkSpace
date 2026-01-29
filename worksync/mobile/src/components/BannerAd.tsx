import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd as GoogleBannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useSubscription } from '../hooks/useSubscription';

// 실제 광고 단위 ID
const BANNER_AD_UNIT_ID = 'ca-app-pub-5539584331662815/6944659513';

// 개발 환경에서는 테스트 ID 사용
const adUnitId = __DEV__ ? TestIds.BANNER : BANNER_AD_UNIT_ID;

interface BannerAdProps {
  size?: 'banner' | 'largeBanner' | 'mediumRectangle';
}

export function BannerAd({ size = 'banner' }: BannerAdProps) {
  const [loaded, setLoaded] = useState(false);
  const { isPro } = useSubscription();

  // 구독자(Pro/Business)에게는 광고를 표시하지 않음
  if (isPro) {
    return null;
  }

  const getBannerSize = () => {
    switch (size) {
      case 'largeBanner':
        return BannerAdSize.LARGE_BANNER;
      case 'mediumRectangle':
        return BannerAdSize.MEDIUM_RECTANGLE;
      default:
        return BannerAdSize.BANNER;
    }
  };

  return (
    <View style={styles.container}>
      <GoogleBannerAd
        unitId={adUnitId}
        size={getBannerSize()}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={(error) => {
          console.log('Ad failed to load:', error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
