'use client';

import { memo } from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * 기본 스켈레톤 컴포넌트
 */
export const Skeleton = memo(function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
});

/**
 * 카드형 스켈레톤
 */
export const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="card animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="w-8 h-8 bg-gray-200 rounded" />
      </div>
    </div>
  );
});

/**
 * URL 아이템 스켈레톤
 */
export const SkeletonUrlItem = memo(function SkeletonUrlItem() {
  return (
    <div className="card animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-2 bg-gray-200 rounded w-1/4" />
        </div>
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-gray-200 rounded" />
          <div className="w-8 h-8 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
});

/**
 * Todo 아이템 스켈레톤
 */
export const SkeletonTodoItem = memo(function SkeletonTodoItem() {
  return (
    <div className="flex items-center gap-3 p-3 bg-white border rounded-lg animate-pulse" aria-hidden="true">
      <div className="w-4 h-4 bg-gray-200 rounded" />
      <div className="w-5 h-5 bg-gray-200 rounded" />
      <div className="flex-1 space-y-1">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>
      <div className="w-12 h-5 bg-gray-200 rounded-full" />
      <div className="w-4 h-4 bg-gray-200 rounded" />
    </div>
  );
});

/**
 * 프로젝트 스켈레톤
 */
export const SkeletonProject = memo(function SkeletonProject() {
  return (
    <div className="card animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-5 h-5 bg-gray-200 rounded" />
        <div className="w-4 h-4 bg-gray-200 rounded" />
        <div className="w-5 h-5 bg-gray-200 rounded" />
        <div className="h-5 bg-gray-200 rounded flex-1 w-1/3" />
        <div className="w-16 h-4 bg-gray-200 rounded" />
        <div className="w-5 h-5 bg-gray-200 rounded" />
        <div className="w-5 h-5 bg-gray-200 rounded" />
      </div>
      <div className="ml-8 space-y-2">
        <SkeletonTodoItem />
        <SkeletonTodoItem />
      </div>
    </div>
  );
});

/**
 * 클립보드 아이템 스켈레톤
 */
export const SkeletonClipboardItem = memo(function SkeletonClipboardItem() {
  return (
    <div className="card animate-pulse" aria-hidden="true">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-16 h-5 bg-gray-200 rounded-full" />
            <div className="w-12 h-4 bg-gray-200 rounded" />
            <div className="w-24 h-4 bg-gray-200 rounded" />
          </div>
          <div className="h-16 bg-gray-200 rounded" />
        </div>
        <div className="flex flex-col gap-1">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
});

/**
 * 비밀번호 아이템 스켈레톤
 */
export const SkeletonPasswordItem = memo(function SkeletonPasswordItem() {
  return (
    <div className="card animate-pulse" aria-hidden="true">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-8 bg-gray-200 rounded" />
            <div className="w-8 h-8 bg-gray-200 rounded-lg" />
            <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          </div>
        </div>
        <div className="w-8 h-8 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
});

/**
 * 스켈레톤 리스트 래퍼
 */
interface SkeletonListProps {
  count?: number;
  children: React.ReactNode;
}

export const SkeletonList = memo(function SkeletonList({ count = 5, children }: SkeletonListProps) {
  return (
    <div className="space-y-3" role="status" aria-label="로딩 중">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{children}</div>
      ))}
      <span className="sr-only">로딩 중...</span>
    </div>
  );
});
