-- ==============================================================================
-- WorkSync Full Database Reset & Setup Script (v2.0)
-- 관리자 기능, 구독 시스템, 사용량 추적 기능이 모두 포함된 통합 버전입니다.
-- 주의: 실행 시 기존 데이터가 모두 삭제됩니다.
-- ==============================================================================

-- 1. 기존 스키마 정리 (순서 중요: 의존성 있는 테이블부터 삭제)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_assign_plan ON auth.users;

DROP TABLE IF EXISTS payment_history CASCADE;
DROP TABLE IF EXISTS usage_tracking CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS clipboards CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS passwords CASCADE;
DROP TABLE IF EXISTS urls CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ENUM 타입 정리
DROP TYPE IF EXISTS todo_period CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS billing_cycle CASCADE;

-- ==============================================================================
-- 2. 테이블 생성
-- ==============================================================================

-- 2.1. 사용자 프로필 (관리자 여부 포함)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE, -- 관리자 여부 컬럼 추가됨
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2. 플랜 (요금제) 정의
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    price_monthly INTEGER NOT NULL DEFAULT 0,
    price_yearly INTEGER DEFAULT 0,
    stripe_price_id_monthly VARCHAR(100),
    stripe_price_id_yearly VARCHAR(100),
    features JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3. 구독 정보
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    stripe_subscription_id VARCHAR(100),
    stripe_customer_id VARCHAR(100),
    status subscription_status NOT NULL DEFAULT 'active',
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2.4. 사용량 추적
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature VARCHAR(50) NOT NULL, -- 'urls', 'passwords', 'projects', 'clipboards'
    current_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature)
);

-- 2.5. 서비스 테이블들
CREATE TABLE urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    favicon_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE passwords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    iv TEXT NOT NULL,
    website_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE todo_period AS ENUM ('monthly', 'weekly', 'daily');

CREATE TABLE todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    period todo_period NOT NULL DEFAULT 'daily',
    target_date DATE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clipboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text',
    source_device TEXT,
    is_pinned BOOLEAN DEFAULT FALSE,
    media_url TEXT,
    media_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. RLS (Row Level Security) 정책 설정
-- ==============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboards ENABLE ROW LEVEL SECURITY;

-- 3.1. Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- 관리자는 모든 프로필 조회/수정 가능
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE);
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE);

-- 3.2. Plans (누구나 조회 가능)
CREATE POLICY "Anyone can view active plans" ON plans FOR SELECT USING (is_active = true);

-- 3.3. Subscriptions
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
-- 관리자는 모든 구독 정보 조회/수정/생성 가능
CREATE POLICY "Admins can view all subscriptions" ON subscriptions FOR SELECT USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE);
CREATE POLICY "Admins can update all subscriptions" ON subscriptions FOR UPDATE USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE);
CREATE POLICY "Admins can insert subscriptions" ON subscriptions FOR INSERT WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE);

-- 3.4. Usage Tracking
CREATE POLICY "Users can view own usage" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON usage_tracking FOR UPDATE USING (auth.uid() = user_id);
-- 관리자는 모든 사용량 조회 가능
CREATE POLICY "Admins can view all usage_tracking" ON usage_tracking FOR SELECT USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE);

-- 3.5. User Data Tables (Urls, Passwords, etc.) - 본인 것만 접근 가능
CREATE POLICY "Users can view own urls" ON urls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own urls" ON urls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own urls" ON urls FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own urls" ON urls FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own passwords" ON passwords FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own passwords" ON passwords FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own passwords" ON passwords FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own passwords" ON passwords FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own todos" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todos" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own todos" ON todos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own todos" ON todos FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own clipboards" ON clipboards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clipboards" ON clipboards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clipboards" ON clipboards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clipboards" ON clipboards FOR DELETE USING (auth.uid() = user_id);

-- ==============================================================================
-- 4. 함수 및 트리거 설정
-- ==============================================================================

-- 4.1. Updated At 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_urls_updated_at BEFORE UPDATE ON urls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_passwords_updated_at BEFORE UPDATE ON passwords FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usage_tracking_updated_at BEFORE UPDATE ON usage_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4.2. 신규 사용자 처리 (프로필 생성, 무료 플랜 할당, 사용량 초기화)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- 1. 프로필 생성
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1));

    -- 2. 무료 플랜 ID 조회
    SELECT id INTO free_plan_id FROM plans WHERE name = 'free' LIMIT 1;

    -- 3. 구독 생성 (무료)
    IF free_plan_id IS NOT NULL THEN
        INSERT INTO subscriptions (user_id, plan_id, status, billing_cycle)
        VALUES (NEW.id, free_plan_id, 'active', 'monthly');
    END IF;

    -- 4. 사용량 추적 초기화
    INSERT INTO usage_tracking (user_id, feature, current_count)
    VALUES
        (NEW.id, 'urls', 0),
        (NEW.id, 'passwords', 0),
        (NEW.id, 'projects', 0),
        (NEW.id, 'clipboards', 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.3. 사용량 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_usage_on_change()
RETURNS TRIGGER AS $$
DECLARE
    feature_name TEXT;
BEGIN
    feature_name := TG_ARGV[0];
    
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO usage_tracking (user_id, feature, current_count)
        VALUES (NEW.user_id, feature_name, 1)
        ON CONFLICT (user_id, feature)
        DO UPDATE SET 
            current_count = usage_tracking.current_count + 1, 
            updated_at = NOW();
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE usage_tracking 
        SET 
            current_count = GREATEST(0, usage_tracking.current_count - 1), 
            updated_at = NOW()
        WHERE user_id = OLD.user_id AND feature = feature_name;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 각 테이블에 트리거 연결
CREATE TRIGGER tr_update_url_usage AFTER INSERT OR DELETE ON urls FOR EACH ROW EXECUTE FUNCTION update_usage_on_change('urls');
CREATE TRIGGER tr_update_password_usage AFTER INSERT OR DELETE ON passwords FOR EACH ROW EXECUTE FUNCTION update_usage_on_change('passwords');
CREATE TRIGGER tr_update_project_usage AFTER INSERT OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION update_usage_on_change('projects');
CREATE TRIGGER tr_update_clipboard_usage AFTER INSERT OR DELETE ON clipboards FOR EACH ROW EXECUTE FUNCTION update_usage_on_change('clipboards');

-- ==============================================================================
-- 5. 초기 데이터 삽입 (플랜)
-- ==============================================================================

INSERT INTO plans (name, display_name, description, price_monthly, price_yearly, features, limits, sort_order)
VALUES
    (
        'free',
        '무료',
        '기본 기능을 무료로 이용하세요',
        0,
        0,
        '{"url_sync": true, "password_manager": true, "todo_list": true, "clipboard_sync": true}'::jsonb,
        '{"urls": 50, "passwords": 20, "projects": 3, "clipboards": 100}'::jsonb,
        1
    ),
    (
        'pro',
        'Pro',
        '개인 생산성을 극대화하세요',
        4900,
        49000,
        '{"url_sync": true, "password_manager": true, "todo_list": true, "clipboard_sync": true, "priority_support": true}'::jsonb,
        '{"urls": -1, "passwords": -1, "projects": -1, "clipboards": -1}'::jsonb,
        2
    ),
    (
        'business',
        'Business',
        '팀과 함께 협업하세요',
        9900,
        99000,
        '{"url_sync": true, "password_manager": true, "todo_list": true, "clipboard_sync": true, "team_features": true}'::jsonb,
        '{"urls": -1, "passwords": -1, "projects": -1, "clipboards": -1}'::jsonb,
        3
    );
