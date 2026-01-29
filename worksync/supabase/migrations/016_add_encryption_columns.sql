-- =================================================================
-- Add Encryption Columns to Profiles Table
-- 마스터 비밀번호 설정 및 검증에 필요한 암호화 관련 컬럼을 추가합니다.
-- =================================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS encryption_salt TEXT,
ADD COLUMN IF NOT EXISTS verifier TEXT,
ADD COLUMN IF NOT EXISTS encryption_iterations INTEGER DEFAULT 100000;

-- 컬럼 설명 (선택 사항)
COMMENT ON COLUMN profiles.encryption_salt IS 'PBKDF2 키 생성에 사용되는 고유 Salt (Base64)';
COMMENT ON COLUMN profiles.verifier IS '마스터 비밀번호 검증을 위한 암호화된 테스트 데이터';
COMMENT ON COLUMN profiles.encryption_iterations IS 'PBKDF2 반복 횟수 (기본 100,000회)';
