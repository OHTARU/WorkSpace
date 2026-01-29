import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { createClient } from '@supabase/supabase-js';

// Webhook에서는 Service Role Key를 사용해야 RLS를 우회하여 모든 사용자의 구독을 업데이트할 수 있음
// 빌드 타임 에러 방지를 위해 지연 초기화 수행
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase URL or Service Role Key is missing');
  }
  
  return createClient(url, key);
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('Stripe-Signature') as string;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
  }

  const session = event.data.object as any;

  // 이벤트 처리
  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(session.customer, session.id || session.subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(session.customer);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

async function handleSubscriptionChange(stripeCustomerId: string, subscriptionId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  // 1. Stripe에서 상세 정보 가져오기
  const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as any;
  const priceId = subscription.items.data[0].price.id;

  // 2. DB에서 해당 priceId를 가진 플랜 찾기
  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('id')
    .or(`stripe_price_id_monthly.eq.${priceId},stripe_price_id_yearly.eq.${priceId}`)
    .single();

  if (!plan) return;

  // 3. Customer ID로 사용자 찾기
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  if (!profile) return;

  // 4. 구독 정보 업데이트 (Upsert)
  await supabaseAdmin.from('subscriptions').upsert({
    user_id: profile.id,
    plan_id: plan.id,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: stripeCustomerId,
    status: subscription.status,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
}

async function handleSubscriptionDeleted(stripeCustomerId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();

  if (!profile) return;

  // Free 플랜으로 강제 전환하거나 구독 레코드 삭제 (여기서는 삭제 또는 상태 변경)
  // 여기서는 단순히 구독 레코드를 업데이트하거나 삭제함
  const { data: freePlan } = await supabaseAdmin
    .from('plans')
    .select('id')
    .eq('name', 'free')
    .single();

  if (freePlan) {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        plan_id: freePlan.id,
        status: 'canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', profile.id);
  }
}
