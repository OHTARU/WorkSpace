'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import Link from 'next/link';

interface UpgradePromptProps {
  feature: string;
  currentUsage: number;
  limit: number;
  onDismiss?: () => void;
}

export function UpgradePrompt({
  feature,
  currentUsage,
  limit,
  onDismiss,
}: UpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const percentage = Math.round((currentUsage / limit) * 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = currentUsage >= limit;

  const featureNames: Record<string, string> = {
    urls: 'URL',
    passwords: '비밀번호',
    projects: '프로젝트',
    clipboards: '클립보드',
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={`rounded-lg p-4 mb-4 ${
        isAtLimit
          ? 'bg-red-50 border border-red-200'
          : isNearLimit
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-blue-50 border border-blue-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Sparkles
            className={`w-5 h-5 mt-0.5 ${
              isAtLimit
                ? 'text-red-500'
                : isNearLimit
                  ? 'text-yellow-500'
                  : 'text-blue-500'
            }`}
          />
          <div>
            <p
              className={`font-medium ${
                isAtLimit
                  ? 'text-red-800'
                  : isNearLimit
                    ? 'text-yellow-800'
                    : 'text-blue-800'
              }`}
            >
              {isAtLimit
                ? `${featureNames[feature]} 저장 한도에 도달했습니다`
                : `${featureNames[feature]} 저장 한도의 ${percentage}%를 사용 중입니다`}
            </p>
            <p
              className={`text-sm mt-1 ${
                isAtLimit
                  ? 'text-red-600'
                  : isNearLimit
                    ? 'text-yellow-600'
                    : 'text-blue-600'
              }`}
            >
              {currentUsage} / {limit}개 사용 중 &middot; Pro로 업그레이드하면
              무제한으로 이용할 수 있습니다.
            </p>
            <Link
              href="/dashboard/subscription"
              className={`inline-flex items-center gap-1 mt-2 text-sm font-medium ${
                isAtLimit
                  ? 'text-red-700 hover:text-red-800'
                  : isNearLimit
                    ? 'text-yellow-700 hover:text-yellow-800'
                    : 'text-blue-700 hover:text-blue-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Pro로 업그레이드
            </Link>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
