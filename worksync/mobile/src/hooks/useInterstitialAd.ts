import { useEffect, useState, useCallback } from 'react';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useSubscription } from './useSubscription';

// 실제 광고 단위 ID (나중에 교체 필요)
const INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-5539584331662815/xxxxxxxxxx';

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : INTERSTITIAL_AD_UNIT_ID;

export function useInterstitialAd() {
  const { isPro } = useSubscription();
  const [ad, setAd] = useState<InterstitialAd | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Pro 유저는 광고 로드 안 함
    if (isPro) {
      setAd(null);
      setLoaded(false);
      return;
    }

    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubscribeLoaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        setLoaded(true);
      }
    );

    const unsubscribeClosed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        setLoaded(false);
        // 광고가 닫히면 다음 광고 로드
        interstitial.load();
      }
    );

    interstitial.load();
    setAd(interstitial);

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
    };
  }, [isPro]);

  const showAd = useCallback(() => {
    if (isPro) return;
    
    if (loaded && ad) {
      ad.show();
    } else {
      console.log('Interstitial ad not loaded yet');
    }
  }, [isPro, loaded, ad]);

  return { showAd, isLoaded: loaded };
}
