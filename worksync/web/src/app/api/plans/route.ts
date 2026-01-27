// 플랜 목록 조회 API
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 동적 렌더링 강제 (cookies 사용)
export const dynamic = 'force-dynamic';

// GET: 모든 활성 플랜 목록 조회
export async function GET() {
  try {
    const supabase = createClient();

    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Plans fetch error:', error);
      return NextResponse.json(
        { error: '플랜 목록을 불러올 수 없습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('Plans API error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
