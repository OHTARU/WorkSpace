'use client';

import React, { useEffect } from 'react';

interface AdSenseBannerProps {
  slotId?: string;
  className?: string;
}

/**
 * Google AdSense 배너 컴포넌트
 * 실제 사용 시 data-ad-client와 data-ad-slot 값을 본인의 AdSense 정보로 변경해야 합니다.
 */
export function AdSenseBanner({ slotId = "YOUR_AD_SLOT_ID_HERE", className = "" }: AdSenseBannerProps) {
  useEffect(() => {
    try {
      // AdSense 스크립트 로드 트리거
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense load error:', err);
    }
  }, []);

  return (
    <div className={`w-full overflow-hidden flex flex-col items-center justify-center p-2 bg-gray-50 border border-gray-100 rounded-lg mt-2 ${className}`}>
      <div className="text-[10px] text-gray-400 mb-1 w-full text-center">ADVERTISEMENT</div>
      
      <ins className="adsbygoogle"
           style={{ display: 'block', width: '100%' }}
           data-ad-client="ca-pub-5539584331662815" 
           data-ad-slot={slotId}
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
    </div>
  );
}
