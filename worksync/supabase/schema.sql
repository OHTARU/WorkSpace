-- WorkSync Database Schema
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 1. 사용자 프로필 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 프로필 자동 생성 트리거
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

-- ============================================
-- 2. URL 동기화 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS urls (
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

CREATE INDEX idx_urls_user_id ON urls(user_id);
CREATE INDEX idx_urls_created_at ON urls(created_at DESC);

-- ============================================
-- 3. 비밀번호 관리자 테이블
-- [보안 주의] password_encrypted는 클라이언트에서 AES-256-GCM으로 암호화된 값
-- 암호화 키는 절대 DB에 저장하지 않음 (클라이언트에서 사용자 마스터 키로 관리)
-- ============================================
CREATE TABLE IF NOT EXISTS passwords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,  -- AES-256-GCM 암호화된 비밀번호
    iv TEXT NOT NULL,                   -- 초기화 벡터 (각 암호화마다 고유)
    website_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_passwords_user_id ON passwords(user_id);

-- ============================================
-- 4. 프로젝트 테이블 (To-Do 최상위 계층)
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6',  -- 기본 파란색
    is_archived BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- ============================================
-- 5. To-Do 테이블 (계층 구조: 프로젝트 > 월간 > 주간 > 일간)
-- ============================================
CREATE TYPE todo_period AS ENUM ('monthly', 'weekly', 'daily');

CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES todos(id) ON DELETE CASCADE,  -- 상위 할일 (계층 구조)
    title TEXT NOT NULL,
    description TEXT,
    period todo_period NOT NULL DEFAULT 'daily',
    target_date DATE,           -- 목표 날짜
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    priority INTEGER DEFAULT 0, -- 우선순위 (드래그앤드롭용)
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_project_id ON todos(project_id);
CREATE INDEX idx_todos_parent_id ON todos(parent_id);
CREATE INDEX idx_todos_target_date ON todos(target_date);

-- ============================================
-- 6. 클립보드 동기화 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS clipboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text',  -- text, url, code 등
    source_device TEXT,                 -- pc, mobile
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clipboards_user_id ON clipboards(user_id);
CREATE INDEX idx_clipboards_created_at ON clipboards(created_at DESC);

-- ============================================
-- Row Level Security (RLS) 정책
-- ============================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboards ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- URLs RLS
CREATE POLICY "Users can view own urls" ON urls
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own urls" ON urls
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own urls" ON urls
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own urls" ON urls
    FOR DELETE USING (auth.uid() = user_id);

-- Passwords RLS
CREATE POLICY "Users can view own passwords" ON passwords
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own passwords" ON passwords
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own passwords" ON passwords
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own passwords" ON passwords
    FOR DELETE USING (auth.uid() = user_id);

-- Projects RLS
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- Todos RLS
CREATE POLICY "Users can view own todos" ON todos
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todos" ON todos
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own todos" ON todos
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own todos" ON todos
    FOR DELETE USING (auth.uid() = user_id);

-- Clipboards RLS
CREATE POLICY "Users can view own clipboards" ON clipboards
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clipboards" ON clipboards
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clipboards" ON clipboards
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clipboards" ON clipboards
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Realtime 활성화 (실시간 동기화용)
-- ============================================
-- Supabase Dashboard > Database > Replication에서 아래 테이블들 활성화 필요:
-- urls, clipboards, todos, projects

-- ============================================
-- Updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_urls_updated_at BEFORE UPDATE ON urls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_passwords_updated_at BEFORE UPDATE ON passwords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
