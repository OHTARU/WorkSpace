// Stripe 결제 세션 생성 API
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createServerClient } from '@/lib/supabase/server';
import { BillingCycle } from '@shared/types';

interface CheckoutRequestBody {
  plan_id: string;
  billing_cycle: BillingCycle;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // 사용자 인증 확인
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

    const body: CheckoutRequestBody = await request.json();
    const { plan_id, billing_cycle } = body;

    if (!plan_id || !billing_cycle) {
      return NextResponse.json(
        { error: '플랜 ID와 결제 주기가 필요합니다.' },
        { status: 400 }
      );
    }

    // 플랜 정보 조회
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: '플랜을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 무료 플랜은 결제 불필요
    if (plan.name === 'free') {
      return NextResponse.json(
        { error: '무료 플랜은 결제가 필요하지 않습니다.' },
        { status: 400 }
      );
    }

    // Stripe 가격 ID 확인
    const priceId =
      billing_cycle === 'yearly'
        ? plan.stripe_price_id_yearly
        : plan.stripe_price_id_monthly;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe 가격이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 기존 Stripe 고객 ID 확인
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    // 고객이 없으면 새로 생성
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // 고객 ID 저장
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    // Checkout 세션 생성
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
        plan_id: plan_id,
        billing_cycle: billing_cycle,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_id: plan_id,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return NextResponse.json({
      session_id: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: '결제 세션 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
