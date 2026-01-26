'use client';

import { Modal } from '@/components/Modal';
import { UsageBar } from './UsageBar';
import { Crown, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  current: number;
  limit: number;
}

const FEATURE_LABELS: Record<string, string> = {
  urls: 'URL',
  passwords: '비밀번호',
  projects: '프로젝트',
  clipboards: '클립보드',
};

export function UpgradeModal({ isOpen, onClose, feature, current, limit }: UpgradeModalProps) {
  const featureLabel = FEATURE_LABELS[feature] || feature;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="사용량 한도 도달">
      <div className="text-center py-4">
        <div className="inline-flex p-4 bg-yellow-100 rounded-full mb-4">
          <AlertTriangle className="text-yellow-600" size={32} />
        </div>

        <p className="text-gray-600 mb-4">
          {featureLabel} 저장 한도에 도달했습니다.
        </p>

        <div className="mb-6">
          <UsageBar label={featureLabel} current={current} limit={limit} />
        </div>

        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Crown className="text-purple-600" size={20} />
            <span className="font-semibold text-gray-900">Pro로 업그레이드</span>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            무제한 저장, 고급 기능을 이용하세요!
          </p>
          <Link
            href="/dashboard/subscription"
            className="btn btn-primary w-full inline-block text-center"
            onClick={onClose}
          >
            업그레이드 하기
          </Link>
        </div>

        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-500 hover:text-gray-700"
        >
          나중에 하기
        </button>
      </div>
    </Modal>
  );
}
