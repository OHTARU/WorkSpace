// WorkSync 공유 타입 정의

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Url {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  description: string | null;
  favicon_url: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface Password {
  id: string;
  user_id: string;
  service_name: string;
  username: string;
  password_encrypted: string;
  iv: string;
  website_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TodoPeriod = 'monthly' | 'weekly' | 'daily';

export interface Todo {
  id: string;
  user_id: string;
  project_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  period: TodoPeriod;
  target_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  priority: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Clipboard {
  id: string;
  user_id: string;
  content: string;
  content_type: string;
  source_device: string | null;
  is_pinned: boolean;
  created_at: string;
}

// Form 타입
export interface UrlFormData {
  url: string;
  title?: string;
  description?: string;
}

export interface PasswordFormData {
  service_name: string;
  username: string;
  password: string;
  website_url?: string;
  notes?: string;
}

export interface ProjectFormData {
  name: string;
  description?: string;
  color?: string;
}

export interface TodoFormData {
  title: string;
  description?: string;
  period: TodoPeriod;
  target_date?: string;
  project_id?: string;
  parent_id?: string;
}

export interface ClipboardFormData {
  content: string;
  content_type?: string;
}

// ============================================
// 구독 시스템 타입
// ============================================

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired';

export type BillingCycle = 'monthly' | 'yearly';

export type PlanName = 'free' | 'pro' | 'business';

export interface PlanFeatures {
  url_sync: boolean;
  password_manager: boolean;
  todo_list: boolean;
  clipboard_sync: boolean;
  browser_extension: boolean;
  file_sync: boolean;
  team_features: boolean;
  api_access: boolean;
  priority_support: boolean;
  ads_free: boolean;
}

export interface PlanLimits {
  urls: number;           // -1 = 무제한
  passwords: number;
  projects: number;
  clipboards: number;
  devices: number;
  clipboard_history_days: number;
  file_storage_mb: number;
}

export interface Plan {
  id: string;
  name: PlanName;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  features: PlanFeatures;
  limits: PlanLimits;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
  // 조인된 플랜 정보
  plan?: Plan;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  feature: string;
  current_count: number;
  last_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistory {
  id: string;
  user_id: string;
  subscription_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'refunded';
  description: string | null;
  paid_at: string | null;
  created_at: string;
}

// 사용량 체크 응답
export interface UsageLimitCheck {
  allowed: boolean;
  current_usage: number;
  max_limit: number;
  plan_name: PlanName;
}

// 구독 관련 폼 데이터
export interface SubscriptionFormData {
  plan_id: string;
  billing_cycle: BillingCycle;
}

// 결제 세션 응답
export interface CheckoutSession {
  session_id: string;
  url: string;
}

// 사용자 구독 상태 (프론트엔드용)
export interface UserSubscriptionState {
  subscription: Subscription | null;
  plan: Plan | null;
  usage: Record<string, UsageTracking>;
  isLoading: boolean;
  error: string | null;
}
