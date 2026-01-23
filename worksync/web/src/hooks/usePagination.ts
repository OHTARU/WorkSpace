'use client';

import { useState, useCallback } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface UsePaginationOptions {
  initialPageSize?: number;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  offset: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
}

/**
 * 페이지네이션 상태 관리 훅
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPageSize = 20 } = options;

  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [totalCount, setTotalCountState] = useState(0);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const offset = (page - 1) * pageSize;
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, Math.min(newPage, totalPages)));
  }, [totalPages]);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1); // 페이지 크기 변경 시 첫 페이지로
  }, []);

  const setTotalCount = useCallback((count: number) => {
    setTotalCountState(count);
  }, []);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPageState((p) => p + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setPageState((p) => p - 1);
    }
  }, [hasPrevPage]);

  const reset = useCallback(() => {
    setPageState(1);
  }, []);

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    offset,
    hasNextPage,
    hasPrevPage,
    setPage,
    setPageSize,
    setTotalCount,
    nextPage,
    prevPage,
    reset,
  };
}
