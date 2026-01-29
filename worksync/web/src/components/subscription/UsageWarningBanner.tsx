'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

interface UsageWarningBannerProps {
  feature: string;
  current: number;
  limit: number;
  threshold?: number;
}

const FEATURE_LABELS: Record<string, string> = {
  urls: 'URL',
  passwords: '비밀번호',
  projects: '프로젝트',
  todos: '할일',
  clipboards: '클립보드',
};

export function UsageWarningBanner({
  feature,
  current,
  limit,
  threshold = 80,
}: UsageWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (limit === -1 || dismissed) return null;

  const percentage = !limit ? (current > 0 ? 100 : 0) : Math.round((current / limit) * 100);
  if (percentage < threshold) return null;

  const featureLabel = FEATURE_LABELS[feature] || feature;
  const isAtLimit = percentage >= 100;

  return (
    <div
      className={`mb-4 p-4 rounded-lg flex items-center justify-between ${
        isAtLimit
          ? 'bg-red-50 border border-red-200'
          : 'bg-yellow-50 border border-yellow-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle
          className={isAtLimit ? 'text-red-500' : 'text-yellow-500'}
          size={20}
        />
        <div>
          <p
            className={`font-medium ${
              isAtLimit ? 'text-red-800' : 'text-yellow-800'
            }`}
          >
            {isAtLimit
              ? `${featureLabel} 저장 한도에 도달했습니다`
              : `${featureLabel} 사용량이 ${percentage}%에 도달했습니다`}
          </p>
          <p className="text-sm text-gray-600">
            {current} / {limit} 사용 중 |{' '}
            <Link
              href="/dashboard/subscription"
              className="text-blue-600 hover:underline"
            >
              Pro로 업그레이드
            </Link>
          </p>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-gray-200 rounded"
      >
        <X size={16} className="text-gray-500" />
      </button>
    </div>
  );
}
