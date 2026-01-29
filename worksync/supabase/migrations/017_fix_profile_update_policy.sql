-- =================================================================
-- Fix Profile Update Policy
-- 마스터 비밀번호 설정(암호화 컬럼 업데이트) 시 발생하는 403 Forbidden 에러 해결
-- =================================================================

-- 1. 기존 업데이트 정책 삭제
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 2. 강력하고 단순한 업데이트 정책 재설정
-- "로그인한 사용자는 자신의 ID와 일치하는 프로필 행을 업데이트할 수 있다."
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 3. 참고: 관리자 업데이트 정책은 유지 (이미 있다면 건드리지 않음)
-- 만약 관리자 정책도 확실히 하고 싶다면 아래 주석 해제
-- DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
-- CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (is_admin());
