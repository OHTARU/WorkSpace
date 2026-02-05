import Stripe from 'stripe';
import { env } from './env';

// STRIPE_SECRET_KEY가 없으면 빌드 시 에러가 발생하므로 더미 키를 사용합니다.
const stripeKey = env.STRIPE_SECRET_KEY || 'sk_test_placeholder';

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});
