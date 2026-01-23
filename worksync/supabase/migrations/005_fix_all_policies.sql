-- =====================================================
-- WorkSync 전체 정책 및 스키마 통합 재설정 (Final Consolidated Migration)
-- 기존의 모든 정책을 삭제하고, 마스터 비밀번호 유지 및 보안 정책을 완벽하게 재구성합니다.
-- =====================================================

-- 1. 기존 정책 모두 삭제 (Clean start)
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own urls" ON urls;
DROP POLICY IF EXISTS "Users can insert own urls" ON urls;
DROP POLICY IF EXISTS "Users can update own urls" ON urls;
DROP POLICY IF EXISTS "Users can delete own urls" ON urls;

DROP POLICY IF EXISTS "Users can view own passwords" ON passwords;
DROP POLICY IF EXISTS "Users can insert own passwords" ON passwords;
DROP POLICY IF EXISTS "Users can update own passwords" ON passwords;
DROP POLICY IF EXISTS "Users can delete own passwords" ON passwords;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

DROP POLICY IF EXISTS "Users can view own todos" ON todos;
DROP POLICY IF EXISTS "Users can insert own todos" ON todos;
DROP POLICY IF EXISTS "Users can update own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete own todos" ON todos;

DROP POLICY IF EXISTS "Users can view own clipboards" ON clipboards;
DROP POLICY IF EXISTS "Users can insert own clipboards" ON clipboards;
DROP POLICY IF EXISTS "Users can update own clipboards" ON clipboards;
DROP POLICY IF EXISTS "Users can delete own clipboards" ON clipboards;

DROP POLICY IF EXISTS "Users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view clipboard media" ON storage.objects;

-- 2. 필수 컬럼 추가 및 스키마 확인
-- -----------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS encryption_salt TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verifier TEXT;

-- 3. RLS 활성화
-- -----------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboards ENABLE ROW LEVEL SECURITY;

-- 4. 신규 정책 적용 (Profiles INSERT 권한 포함)
-- -----------------------------------------------------
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- [URLs]
CREATE POLICY "Users can view own urls" ON urls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own urls" ON urls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own urls" ON urls FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own urls" ON urls FOR DELETE USING (auth.uid() = user_id);

-- [Passwords]
CREATE POLICY "Users can view own passwords" ON passwords FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own passwords" ON passwords FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own passwords" ON passwords FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own passwords" ON passwords FOR DELETE USING (auth.uid() = user_id);

-- [Projects]
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- [Todos]
CREATE POLICY "Users can view own todos" ON todos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own todos" ON todos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own todos" ON todos FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own todos" ON todos FOR DELETE USING (auth.uid() = user_id);

-- [Clipboards]
CREATE POLICY "Users can view own clipboards" ON clipboards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clipboards" ON clipboards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clipboards" ON clipboards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own clipboards" ON clipboards FOR DELETE USING (auth.uid() = user_id);

-- 5. Storage 정책 재적용
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('clipboard-media', 'clipboard-media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'clipboard-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own media" ON storage.objects FOR SELECT USING (bucket_id = 'clipboard-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own media" ON storage.objects FOR DELETE USING (bucket_id = 'clipboard-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Public can view clipboard media" ON storage.objects FOR SELECT USING (bucket_id = 'clipboard-media');