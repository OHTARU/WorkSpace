// 구독 정보 조회 API
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET: 현재 사용자의 구독 정보 조회
export async function GET() {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 구독 정보 + 플랜 정보 조회
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:plans(*)
      `)
      .eq('user_id', user.id)
      .single();

    if (subError) {
      console.error('Subscription fetch error:', subError);
      return NextResponse.json(
        { error: '구독 정보를 불러올 수 없습니다.' },
        { status: 500 }
      );
    }

    // 사용량 정보 조회
    const { data: usage, error: usageError } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id);

    if (usageError) {
      console.error('Usage fetch error:', usageError);
    }

    // 사용량을 feature 키로 매핑
    const usageMap: Record<string, unknown> = {};
    if (usage) {
      usage.forEach((item) => {
        usageMap[item.feature] = item;
      });
    }

    return NextResponse.json({
      subscription,
      usage: usageMap,
    });
  } catch (error) {
    console.error('Subscription API error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
