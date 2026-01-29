-- ==========================================================
-- Signup Repair Script
-- 회원가입 시 발생하는 DB 에러를 방지하고 안전하게 처리합니다.
-- ==========================================================

-- 1. 기존 트리거 및 함수 제거 (초기화)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. 함수 재생성 (충돌 방지 및 예외 처리 추가)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- [1] 프로필 생성
    -- 이미 존재하는 ID라면 아무것도 하지 않음 (ON CONFLICT DO NOTHING)
    INSERT INTO public.profiles (id, email, display_name, is_admin)
    VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1), FALSE)
    ON CONFLICT (id) DO NOTHING;

    -- [2] 무료 플랜 ID 조회
    SELECT id INTO free_plan_id FROM plans WHERE name = 'free' LIMIT 1;

    -- [3] 구독 생성 (무료)
    -- 플랜 정보가 있을 때만 실행
    IF free_plan_id IS NOT NULL THEN
        INSERT INTO subscriptions (user_id, plan_id, status, billing_cycle)
        VALUES (NEW.id, free_plan_id, 'active', 'monthly')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    -- [4] 사용량 추적 초기화
    INSERT INTO usage_tracking (user_id, feature, current_count)
    VALUES
        (NEW.id, 'urls', 0),
        (NEW.id, 'passwords', 0),
        (NEW.id, 'projects', 0),
        (NEW.id, 'clipboards', 0)
    ON CONFLICT (user_id, feature) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- *** 중요 ***
    -- 내부 로직에서 에러가 나더라도, 회원가입 자체는 성공시키도록 예외를 삼킵니다.
    -- 대신 경고 로그를 남깁니다. (Supabase Logs에서 확인 가능)
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 트리거 재설정
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. (안전장치) 만약 plans 테이블이 비어있다면 기본 무료 플랜 생성
INSERT INTO plans (name, display_name, price_monthly, features, limits)
VALUES (
    'free', 
    '무료', 
    0, 
    '{"url_sync": true, "password_manager": true}'::jsonb, 
    '{"urls": 50, "passwords": 20}'::jsonb
)
ON CONFLICT (name) DO NOTHING;
