-- =====================================================
-- 마스터 비밀번호 반복 횟수 저장용 컬럼 추가
-- =====================================================

-- [Profiles] 에 encryption_iterations 추가
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='encryption_iterations') THEN
        ALTER TABLE profiles ADD COLUMN encryption_iterations INTEGER DEFAULT 100000;
    END IF;
END $$;
