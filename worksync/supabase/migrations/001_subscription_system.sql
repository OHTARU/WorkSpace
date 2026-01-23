-- ============================================
-- WorkSync 구독 시스템 마이그레이션
-- 실행 순서: Supabase SQL Editor에서 실행
-- ============================================

-- ============================================
-- 1. 플랜 정의 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,           -- 'free', 'pro', 'business'
    display_name VARCHAR(100) NOT NULL,         -- '무료', 'Pro', 'Business'
    description TEXT,
    price_monthly INTEGER NOT NULL DEFAULT 0,   -- 월 가격 (원)
    price_yearly INTEGER DEFAULT 0,             -- 연 가격 (원, 할인 적용)
    stripe_price_id_monthly VARCHAR(100),       -- Stripe 월간 가격 ID
    stripe_price_id_yearly VARCHAR(100),        -- Stripe 연간 가격 ID
    features JSONB NOT NULL DEFAULT '{}',       -- 기능 목록
    limits JSONB NOT NULL DEFAULT '{}',         -- 사용량 제한
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 구독 정보 테이블
-- ============================================
CREATE TYPE subscription_status AS ENUM (
    'active',       -- 활성 구독
    'trialing',     -- 체험 기간
    'past_due',     -- 결제 실패
    'canceled',     -- 취소됨
    'incomplete',   -- 결제 미완료
    'incomplete_expired'  -- 결제 미완료 만료
);

CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    stripe_subscription_id VARCHAR(100),
    stripe_customer_id VARCHAR(100),
    status subscription_status NOT NULL DEFAULT 'active',
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- 3. 사용량 추적 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature VARCHAR(50) NOT NULL,         -- 'urls', 'passwords', 'projects', 'clipboards'
    current_count INTEGER DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature)
);

CREATE INDEX idx_usage_tracking_user_id ON usage_tracking(user_id);

-- ============================================
-- 4. 결제 내역 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(100),
    stripe_invoice_id VARCHAR(100),
    amount INTEGER NOT NULL,              -- 결제 금액 (원)
    currency VARCHAR(10) DEFAULT 'KRW',
    status VARCHAR(20) NOT NULL,          -- 'succeeded', 'failed', 'pending', 'refunded'
    description TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX idx_payment_history_subscription_id ON payment_history(subscription_id);

-- ============================================
-- 5. RLS 정책 설정
-- ============================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Plans: 모든 사용자가 플랜 목록 조회 가능
CREATE POLICY "Anyone can view active plans" ON plans
    FOR SELECT USING (is_active = true);

-- Subscriptions: 자신의 구독 정보만 조회 가능
CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Usage Tracking: 자신의 사용량만 조회 가능
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON usage_tracking
    FOR UPDATE USING (auth.uid() = user_id);

-- Payment History: 자신의 결제 내역만 조회 가능
CREATE POLICY "Users can view own payment history" ON payment_history
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 6. 기본 플랜 데이터 삽입
-- ============================================
INSERT INTO plans (name, display_name, description, price_monthly, price_yearly, features, limits, sort_order)
VALUES
    (
        'free',
        '무료',
        '기본 기능을 무료로 이용하세요',
        0,
        0,
        '{
            "url_sync": true,
            "password_manager": true,
            "todo_list": true,
            "clipboard_sync": true,
            "browser_extension": false,
            "file_sync": false,
            "team_features": false,
            "api_access": false,
            "priority_support": false,
            "ads_free": false
        }'::jsonb,
        '{
            "urls": 50,
            "passwords": 20,
            "projects": 3,
            "clipboards": 100,
            "devices": 2,
            "clipboard_history_days": 7,
            "file_storage_mb": 0
        }'::jsonb,
        1
    ),
    (
        'pro',
        'Pro',
        '개인 생산성을 극대화하세요',
        4900,
        49000,
        '{
            "url_sync": true,
            "password_manager": true,
            "todo_list": true,
            "clipboard_sync": true,
            "browser_extension": true,
            "file_sync": true,
            "team_features": false,
            "api_access": false,
            "priority_support": true,
            "ads_free": true
        }'::jsonb,
        '{
            "urls": -1,
            "passwords": -1,
            "projects": -1,
            "clipboards": -1,
            "devices": 5,
            "clipboard_history_days": 90,
            "file_storage_mb": 500
        }'::jsonb,
        2
    ),
    (
        'business',
        'Business',
        '팀과 함께 협업하세요',
        9900,
        99000,
        '{
            "url_sync": true,
            "password_manager": true,
            "todo_list": true,
            "clipboard_sync": true,
            "browser_extension": true,
            "file_sync": true,
            "team_features": true,
            "api_access": true,
            "priority_support": true,
            "ads_free": true
        }'::jsonb,
        '{
            "urls": -1,
            "passwords": -1,
            "projects": -1,
            "clipboards": -1,
            "devices": -1,
            "clipboard_history_days": 365,
            "file_storage_mb": 5120
        }'::jsonb,
        3
    )
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 7. 신규 사용자 무료 플랜 자동 할당 트리거
-- ============================================
CREATE OR REPLACE FUNCTION public.assign_free_plan_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- 무료 플랜 ID 조회
    SELECT id INTO free_plan_id FROM plans WHERE name = 'free' LIMIT 1;

    -- 구독 생성
    INSERT INTO subscriptions (user_id, plan_id, status, billing_cycle)
    VALUES (NEW.id, free_plan_id, 'active', 'monthly');

    -- 사용량 추적 초기화
    INSERT INTO usage_tracking (user_id, feature, current_count)
    VALUES
        (NEW.id, 'urls', 0),
        (NEW.id, 'passwords', 0),
        (NEW.id, 'projects', 0),
        (NEW.id, 'clipboards', 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created_assign_plan
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.assign_free_plan_to_new_user();

-- ============================================
-- 8. 사용량 자동 업데이트 함수들
-- ============================================

-- URL 추가/삭제 시 사용량 업데이트
CREATE OR REPLACE FUNCTION update_url_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO usage_tracking (user_id, feature, current_count)
        VALUES (NEW.user_id, 'urls', 1)
        ON CONFLICT (user_id, feature)
        DO UPDATE SET current_count = usage_tracking.current_count + 1,
                      updated_at = NOW();
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE usage_tracking
        SET current_count = GREATEST(current_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.user_id AND feature = 'urls';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_url_usage_trigger
    AFTER INSERT OR DELETE ON urls
    FOR EACH ROW EXECUTE FUNCTION update_url_usage();

-- 비밀번호 추가/삭제 시 사용량 업데이트
CREATE OR REPLACE FUNCTION update_password_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO usage_tracking (user_id, feature, current_count)
        VALUES (NEW.user_id, 'passwords', 1)
        ON CONFLICT (user_id, feature)
        DO UPDATE SET current_count = usage_tracking.current_count + 1,
                      updated_at = NOW();
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE usage_tracking
        SET current_count = GREATEST(current_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.user_id AND feature = 'passwords';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_password_usage_trigger
    AFTER INSERT OR DELETE ON passwords
    FOR EACH ROW EXECUTE FUNCTION update_password_usage();

-- 프로젝트 추가/삭제 시 사용량 업데이트
CREATE OR REPLACE FUNCTION update_project_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO usage_tracking (user_id, feature, current_count)
        VALUES (NEW.user_id, 'projects', 1)
        ON CONFLICT (user_id, feature)
        DO UPDATE SET current_count = usage_tracking.current_count + 1,
                      updated_at = NOW();
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE usage_tracking
        SET current_count = GREATEST(current_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.user_id AND feature = 'projects';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_project_usage_trigger
    AFTER INSERT OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_project_usage();

-- 클립보드 추가/삭제 시 사용량 업데이트
CREATE OR REPLACE FUNCTION update_clipboard_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO usage_tracking (user_id, feature, current_count)
        VALUES (NEW.user_id, 'clipboards', 1)
        ON CONFLICT (user_id, feature)
        DO UPDATE SET current_count = usage_tracking.current_count + 1,
                      updated_at = NOW();
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE usage_tracking
        SET current_count = GREATEST(current_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.user_id AND feature = 'clipboards';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_clipboard_usage_trigger
    AFTER INSERT OR DELETE ON clipboards
    FOR EACH ROW EXECUTE FUNCTION update_clipboard_usage();

-- ============================================
-- 9. 사용량 제한 체크 함수
-- ============================================
CREATE OR REPLACE FUNCTION check_usage_limit(
    p_user_id UUID,
    p_feature VARCHAR(50)
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_usage INTEGER,
    max_limit INTEGER,
    plan_name VARCHAR(50)
) AS $$
DECLARE
    v_plan_limits JSONB;
    v_plan_name VARCHAR(50);
    v_current_count INTEGER;
    v_limit INTEGER;
BEGIN
    -- 사용자의 현재 플랜 조회
    SELECT p.limits, p.name INTO v_plan_limits, v_plan_name
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.user_id = p_user_id AND s.status = 'active';

    -- 플랜이 없으면 기본값 사용
    IF v_plan_limits IS NULL THEN
        SELECT limits, name INTO v_plan_limits, v_plan_name
        FROM plans WHERE name = 'free';
    END IF;

    -- 현재 사용량 조회
    SELECT current_count INTO v_current_count
    FROM usage_tracking
    WHERE user_id = p_user_id AND feature = p_feature;

    v_current_count := COALESCE(v_current_count, 0);

    -- 제한 값 추출
    v_limit := (v_plan_limits->>p_feature)::INTEGER;

    -- -1은 무제한
    IF v_limit = -1 THEN
        RETURN QUERY SELECT true, v_current_count, -1, v_plan_name;
    ELSE
        RETURN QUERY SELECT v_current_count < v_limit, v_current_count, v_limit, v_plan_name;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. Updated_at 트리거 추가
-- ============================================
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON usage_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. Realtime 활성화 메모
-- ============================================
-- Supabase Dashboard > Database > Replication에서 아래 테이블 활성화:
-- subscriptions, usage_tracking
