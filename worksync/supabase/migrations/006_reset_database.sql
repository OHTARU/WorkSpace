-- =====================================================
-- WorkSync 데이터베이스 완전 초기화 및 재생성 스크립트
-- 주의: 모든 데이터가 삭제됩니다.
-- =====================================================

-- 1. 기존 데이터 및 구조 삭제 (Drop All)
-- -----------------------------------------------------

-- 의존성 문제 방지를 위해 CASCADE 사용
DROP TABLE IF EXISTS payment_history CASCADE;
DROP TABLE IF EXISTS usage_tracking CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS clipboards CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS passwords CASCADE;
DROP TABLE IF EXISTS urls CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Enum 타입 삭제
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS billing_cycle CASCADE;
DROP TYPE IF EXISTS todo_period CASCADE;

-- 함수 및 트리거 삭제 (필요 시)
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS update_url_usage CASCADE;
DROP FUNCTION IF EXISTS update_password_usage CASCADE;
DROP FUNCTION IF EXISTS update_project_usage CASCADE;
DROP FUNCTION IF EXISTS update_clipboard_usage CASCADE;
DROP FUNCTION IF EXISTS check_usage_limit CASCADE;
DROP FUNCTION IF EXISTS assign_free_plan_to_new_user CASCADE;


-- 2. 기본 설정 및 타입 생성
-- -----------------------------------------------------
CREATE TYPE todo_period AS ENUM ('monthly', 'weekly', 'daily');
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');


-- 3. 테이블 생성
-- -----------------------------------------------------

-- [Profiles] 사용자 프로필
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    encryption_salt TEXT,   -- 마스터 비밀번호 솔트
    verifier TEXT,          -- 마스터 비밀번호 검증 토큰 (JSON)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [URLs] URL 동기화
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

-- [Passwords] 비밀번호 관리
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

-- [Projects] 할일 프로젝트
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',
    is_archived BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [Todos] 할일 목록
CREATE TABLE todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    period todo_period NOT NULL DEFAULT 'daily',
    target_date DATE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    priority INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [Clipboards] 클립보드
CREATE TABLE clipboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text',
    source_device TEXT,
    media_url TEXT,
    media_type TEXT,
    file_size INTEGER,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [Plans] 구독 플랜
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

-- [Subscriptions] 구독 정보
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
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- [Usage Tracking] 사용량
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature VARCHAR(50) NOT NULL,
    current_count INTEGER DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature)
);

-- [Payment History] 결제 내역
CREATE TABLE payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    stripe_payment_intent_id VARCHAR(100),
    stripe_invoice_id VARCHAR(100),
    amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'KRW',
    status VARCHAR(20) NOT NULL,
    description TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 4. 인덱스 생성
-- -----------------------------------------------------
CREATE INDEX idx_urls_user_id ON urls(user_id);
CREATE INDEX idx_passwords_user_id ON passwords(user_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_clipboards_user_id ON clipboards(user_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_usage_tracking_user_id ON usage_tracking(user_id);


-- 5. RLS 정책 설정 (Row Level Security)
-- -----------------------------------------------------

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- [Profiles]
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = id);

-- [URLs]
CREATE POLICY "Users can view own urls" ON urls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own urls" ON urls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own urls" ON urls FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own urls" ON urls FOR DELETE USING (auth.uid() = user_id);

-- [Passwords]
CREATE POLICY "Users can view own passwords" ON passwords FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own passwords" ON passwords FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own passwords" ON passwords FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own passwords" ON passwords FOR DELETE USING (auth.uid() = user_id);

-- [Projects]
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- [Todos]
CREATE POLICY "Users can view own todos" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todos" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own todos" ON todos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own todos" ON todos FOR DELETE USING (auth.uid() = user_id);

-- [Clipboards]
CREATE POLICY "Users can view own clipboards" ON clipboards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clipboards" ON clipboards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clipboards" ON clipboards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clipboards" ON clipboards FOR DELETE USING (auth.uid() = user_id);

-- [Subscriptions]
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- [Usage Tracking]
CREATE POLICY "Users can view own usage" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON usage_tracking FOR UPDATE USING (auth.uid() = user_id);

-- [Plans]
CREATE POLICY "Anyone can view active plans" ON plans FOR SELECT USING (is_active = true);


-- 6. 트리거 및 함수 설정
-- -----------------------------------------------------

-- Updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_urls_updated_at BEFORE UPDATE ON urls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_passwords_updated_at BEFORE UPDATE ON passwords FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 신규 사용자 프로필 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 7. 기본 데이터 삽입 (플랜)
-- -----------------------------------------------------
INSERT INTO plans (name, display_name, description, price_monthly, price_yearly, features, limits, sort_order)
VALUES
    ('free', '무료', '기본 기능', 0, 0, '{"url_sync": true, "password_manager": true}'::jsonb, '{"urls": 50, "passwords": 20}'::jsonb, 1),
    ('pro', 'Pro', '개인 생산성', 4900, 49000, '{"url_sync": true, "password_manager": true}'::jsonb, '{"urls": -1, "passwords": -1}'::jsonb, 2)
ON CONFLICT (name) DO NOTHING;


-- 8. Storage 버킷 설정 (멱등성 보장)
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('clipboard-media', 'clipboard-media', false) 
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage 정책 (기존 삭제 후 재생성)
DROP POLICY IF EXISTS "Users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view clipboard media" ON storage.objects;

CREATE POLICY "Users can upload own media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clipboard-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own media" ON storage.objects FOR SELECT USING (bucket_id = 'clipboard-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own media" ON storage.objects FOR DELETE USING (bucket_id = 'clipboard-media' AND auth.uid()::text = (storage.foldername(name))[1]);
