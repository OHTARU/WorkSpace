'use client';

import { Sparkles, Check } from 'lucide-react';

export default function SubscriptionPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          구독 서비스 준비 중
        </h1>
        <p className="text-gray-600 text-lg">
          더 나은 서비스를 위해 프리미엄 플랜을 준비하고 있습니다.<br />
          현재는 베타 기간으로 모든 기능을 무료로 이용하실 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
        {/* Free Plan (Current) */}
        <div className="card border-2 border-blue-500 shadow-lg relative bg-blue-50/50">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
              현재 이용 중
            </span>
          </div>
          
          <div className="text-center mb-6 mt-2">
            <h3 className="text-xl font-bold text-gray-900">Beta Free</h3>
            <p className="text-sm text-gray-500 mt-1">모든 기능 무료 제공</p>
            <div className="mt-4">
              <span className="text-4xl font-bold text-gray-900">₩0</span>
              <span className="text-gray-500">/월</span>
            </div>
          </div>

          <ul className="space-y-4 mb-6">
            <li className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-blue-100 text-blue-600">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-gray-700">무제한 URL 저장</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-blue-100 text-blue-600">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-gray-700">강력한 비밀번호 암호화</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-blue-100 text-blue-600">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-gray-700">실시간 웹-모바일 동기화</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-blue-100 text-blue-600">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-gray-700">스마트 할 일 관리</span>
            </li>
          </ul>

          <button className="btn btn-primary w-full" disabled>
            이용 중
          </button>
        </div>

        {/* Pro Plan (Coming Soon) */}
        <div className="card opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
          <div className="text-center mb-6 mt-2">
            <h3 className="text-xl font-bold text-gray-900">Pro (준비 중)</h3>
            <p className="text-sm text-gray-500 mt-1">전문가를 위한 기능</p>
            <div className="mt-4">
              <span className="text-4xl font-bold text-gray-900">-</span>
              <span className="text-gray-500">/월</span>
            </div>
          </div>

          <ul className="space-y-4 mb-6">
            <li className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-gray-100 text-gray-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-gray-500">대용량 파일 공유</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-gray-100 text-gray-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-gray-500">고급 보안 옵션</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-gray-100 text-gray-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-gray-500">팀 협업 기능</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-1 rounded-full bg-gray-100 text-gray-500">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-gray-500">우선 고객 지원</span>
            </li>
          </ul>

          <button className="btn btn-secondary w-full" disabled>
            오픈 예정
          </button>
        </div>
      </div>
    </div>
  );
}
