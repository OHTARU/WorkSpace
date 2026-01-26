'use client';

import React, { useEffect } from 'react';

/**
 * Google AdSense 배너 컴포넌트
 * 실제 사용 시 data-ad-client와 data-ad-slot 값을 본인의 AdSense 정보로 변경해야 합니다.
 */
export function AdSenseBanner() {
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
    <div className="w-full overflow-hidden flex flex-col items-center justify-center p-2 bg-gray-50 border border-gray-100 rounded-lg mt-2">
      <div className="text-[10px] text-gray-400 mb-1 w-full text-center">ADVERTISEMENT</div>
      {/* 
        개발/테스트 중에는 아래 플레이스홀더가 보입니다.
        실제 운영 시에는 아래 주석을 해제하고 placeholder를 제거하세요.
      */}
      <div className="w-full h-[200px] bg-gray-200 flex items-center justify-center text-gray-500 text-xs text-center p-2 rounded">
        Google AdSense<br/>영역
      </div>

      {/* 
      <ins className="adsbygoogle"
           style={{ display: 'block', width: '100%' }}
           data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" 
           data-ad-slot="YYYYYYYYYY"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      */}
    </div>
  );
}
