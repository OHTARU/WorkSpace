-- =================================================================
-- Fix Infinite Recursion & Cleanup Admin Policies
-- 1. 무한 루프 문제 해결 (is_admin() 함수 사용)
-- 2. 정책 중복 생성 에러 방지 (모든 기존 정책 삭제 후 생성)
-- =================================================================

-- 1. 안전한 관리자 확인 함수 생성 (Security Definer)
-- 이 함수는 RLS를 우회하여 직접 테이블을 조회하므로 무한 루프에 빠지지 않습니다.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid() AND is_admin = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 기존 정책 삭제 (모든 경우의 수를 대비하여 삭제)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins can update all subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Admins can insert subscriptions" ON subscriptions;

DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Admins can view all usage_tracking" ON usage_tracking;

-- 3. 새로운 정책 적용 (is_admin() 함수 사용)

-- [Profiles]
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (is_admin());

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON profiles
    FOR UPDATE USING (is_admin());

-- [Subscriptions]
CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON subscriptions
    FOR SELECT USING (is_admin());

CREATE POLICY "Admins can update all subscriptions" ON subscriptions
    FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can insert subscriptions" ON subscriptions
    FOR INSERT WITH CHECK (is_admin());

-- [Usage Tracking]
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON usage_tracking
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage_tracking" ON usage_tracking
    FOR SELECT USING (is_admin());