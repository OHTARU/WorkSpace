// Stripe Webhook 핸들러
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_EVENTS } from '@/lib/stripe/server';
import { createClient } from '@supabase/supabase-js';

// Webhook에서는 서비스 롤 키 사용 (RLS 우회)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case STRIPE_WEBHOOK_EVENTS.CHECKOUT_SESSION_COMPLETED:
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_DELETED:
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAID:
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// 결제 완료 처리
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;
  const planId = session.metadata?.plan_id;
  const billingCycle = session.metadata?.billing_cycle;

  if (!userId || !planId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  const subscriptionId = session.subscription as string;

  // Stripe 구독 정보 조회
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  // 구독 정보 업데이트
  await supabaseAdmin
    .from('subscriptions')
    .update({
      plan_id: planId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
      status: 'active',
      billing_cycle: billingCycle || 'monthly',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  console.log(`Subscription activated for user: ${userId}`);
}

// 구독 업데이트 처리
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    console.error('Missing user_id in subscription metadata');
    return;
  }

  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    unpaid: 'past_due',
    paused: 'canceled',
  };

  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: statusMap[subscription.status] || 'active',
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  console.log(`Subscription updated for user: ${userId}`);
}

// 구독 삭제/취소 처리
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    console.error('Missing user_id in subscription metadata');
    return;
  }

  // 무료 플랜으로 되돌리기
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
        status: 'active',
        stripe_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }

  console.log(`Subscription canceled for user: ${userId}, reverted to free plan`);
}

// 결제 성공 처리
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // 고객 ID로 사용자 찾기
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!subscription) {
    console.error('Subscription not found for customer:', customerId);
    return;
  }

  // 결제 내역 기록
  await supabaseAdmin.from('payment_history').insert({
    user_id: subscription.user_id,
    subscription_id: subscription.id,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    amount: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    status: 'succeeded',
    description: invoice.description || '구독 결제',
    paid_at: new Date().toISOString(),
  });

  console.log(`Payment recorded for user: ${subscription.user_id}`);
}

// 결제 실패 처리
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!subscription) {
    console.error('Subscription not found for customer:', customerId);
    return;
  }

  // 결제 실패 기록
  await supabaseAdmin.from('payment_history').insert({
    user_id: subscription.user_id,
    subscription_id: subscription.id,
    stripe_invoice_id: invoice.id,
    amount: invoice.amount_due,
    currency: invoice.currency.toUpperCase(),
    status: 'failed',
    description: '결제 실패',
  });

  // 구독 상태 업데이트
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', subscription.user_id);

  console.log(`Payment failed for user: ${subscription.user_id}`);
}
