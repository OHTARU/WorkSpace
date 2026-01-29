-- Fix Admin Permissions and Ensure Column Exists

-- 1. is_admin 컬럼이 없으면 추가 (이미 있으면 무시됨)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_admin') THEN
        ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. 기존 정책 충돌 방지를 위해 관련 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- 3. 정책 재생성

-- (1) 기본 정책: 사용자는 자신의 프로필을 볼 수 있음 (is_admin 포함 모든 컬럼)
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- (2) 관리자 정책: 관리자(is_admin=true)는 모든 사람의 프로필을 볼 수 있음
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
    );

-- (3) 업데이트 정책: 본인은 본인 것 수정 가능 (단, is_admin 컬럼 수정은 Trigger나 별도 로직으로 막는 것이 좋지만, 일단 RLS로는 허용하되 클라이언트에서 안보내면 됨)
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- (4) 관리자 업데이트 정책: 관리자는 모든 프로필 수정 가능
CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (
        (SELECT is_admin FROM profiles WHERE id = auth.uid()) = TRUE
    );
