-- =====================================================
-- WorkSync Row Level Security (RLS) 정책
-- =====================================================
-- 이 파일은 Supabase에서 데이터 보안을 위한 RLS 정책을 정의합니다.
-- 각 사용자는 자신의 데이터만 접근할 수 있습니다.
-- =====================================================

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboards ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- profiles 테이블 정책
-- =====================================================

-- 사용자는 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 사용자는 자신의 프로필만 수정 가능
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 사용자는 자신의 프로필만 삭제 가능
CREATE POLICY "Users can delete own profile"
ON profiles FOR DELETE
USING (auth.uid() = id);

-- 프로필 생성은 인증된 사용자만 (자신의 ID로만)
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
-- passwords 테이블 정책 (가장 민감한 데이터)
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

-- encryption_salt는 해당 사용자만 읽을 수 있도록 별도 정책 없음 (위 정책에서 이미 커버)

-- =====================================================
-- Storage 버킷 정책 (clipboard-media)
-- =====================================================

-- Storage 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('clipboard-media', 'clipboard-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS 정책
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
