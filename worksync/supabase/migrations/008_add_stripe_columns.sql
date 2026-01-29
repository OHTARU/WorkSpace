-- =====================================================
-- Stripe 연동을 위한 컬럼 추가
-- =====================================================

-- [Profiles] 에 stripe_customer_id 추가
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='stripe_customer_id') THEN
        ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
    END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
