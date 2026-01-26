-- =====================================================
-- 기존 정책 모두 삭제
-- =====================================================

-- profiles 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- urls 정책 삭제
DROP POLICY IF EXISTS "Users can view own urls" ON urls;
DROP POLICY IF EXISTS "Users can insert own urls" ON urls;
DROP POLICY IF EXISTS "Users can update own urls" ON urls;
DROP POLICY IF EXISTS "Users can delete own urls" ON urls;

-- passwords 정책 삭제
DROP POLICY IF EXISTS "Users can view own passwords" ON passwords;
DROP POLICY IF EXISTS "Users can insert own passwords" ON passwords;
DROP POLICY IF EXISTS "Users can update own passwords" ON passwords;
DROP POLICY IF EXISTS "Users can delete own passwords" ON passwords;

-- projects 정책 삭제
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- todos 정책 삭제
DROP POLICY IF EXISTS "Users can view own todos" ON todos;
DROP POLICY IF EXISTS "Users can insert own todos" ON todos;
DROP POLICY IF EXISTS "Users can update own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete own todos" ON todos;

-- clipboards 정책 삭제
DROP POLICY IF EXISTS "Users can view own clipboards" ON clipboards;
DROP POLICY IF EXISTS "Users can insert own clipboards" ON clipboards;
DROP POLICY IF EXISTS "Users can update own clipboards" ON clipboards;
DROP POLICY IF EXISTS "Users can delete own clipboards" ON clipboards;

-- storage 정책 삭제
DROP POLICY IF EXISTS "Users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view clipboard media" ON storage.objects;

-- =====================================================
-- RLS 활성화
-- =====================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboards ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- profiles 테이블 정책
-- =====================================================
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
ON profiles FOR DELETE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- =====================================================
-- urls 테이블 정책
-- =====================================================
CREATE POLICY "Users can view own urls"
ON urls FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own urls"
ON urls FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own urls"
ON urls FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own urls"
ON urls FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- passwords 테이블 정책
-- =====================================================
CREATE POLICY "Users can view own passwords"
ON passwords FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own passwords"
ON passwords FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own passwords"
ON passwords FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own passwords"
ON passwords FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- projects 테이블 정책
-- =====================================================
CREATE POLICY "Users can view own projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
ON projects FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
ON projects FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
ON projects FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- todos 테이블 정책
-- =====================================================
CREATE POLICY "Users can view own todos"
ON todos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own todos"
ON todos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos"
ON todos FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos"
ON todos FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- clipboards 테이블 정책
-- =====================================================
CREATE POLICY "Users can view own clipboards"
ON clipboards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clipboards"
ON clipboards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clipboards"
ON clipboards FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clipboards"
ON clipboards FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- profiles 테이블에 encryption_salt 컬럼 추가
-- =====================================================
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS encryption_salt TEXT;

-- =====================================================
-- Storage 버킷 및 정책
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('clipboard-media', 'clipboard-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "Users can upload own media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'clipboard-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'clipboard-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'clipboard-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
