-- =====================================================
-- 자동 사용량 추적 (Automated Usage Tracking)
-- =====================================================

-- 사용량 업데이트 함수
CREATE OR REPLACE FUNCTION update_usage_on_change()
RETURNS TRIGGER AS $$
DECLARE
    feature_name TEXT;
BEGIN
    -- 트리거 인수에서 기능 이름 가져오기
    feature_name := TG_ARGV[0];
    
    IF (TG_OP = 'INSERT') THEN
        -- 항목 추가 시: 사용량 증가
        INSERT INTO usage_tracking (user_id, feature, current_count)
        VALUES (NEW.user_id, feature_name, 1)
        ON CONFLICT (user_id, feature)
        DO UPDATE SET 
            current_count = usage_tracking.current_count + 1, 
            updated_at = NOW();
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        -- 항목 삭제 시: 사용량 감소 (0 미만으로 내려가지 않도록 처리)
        UPDATE usage_tracking 
        SET 
            current_count = GREATEST(0, usage_tracking.current_count - 1), 
            updated_at = NOW()
        WHERE user_id = OLD.user_id AND feature = feature_name;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 각 테이블에 트리거 적용
-- 1. URLs
DROP TRIGGER IF EXISTS tr_update_url_usage ON urls;
CREATE TRIGGER tr_update_url_usage 
    AFTER INSERT OR DELETE ON urls 
    FOR EACH ROW EXECUTE FUNCTION update_usage_on_change('urls');

-- 2. Passwords
DROP TRIGGER IF EXISTS tr_update_password_usage ON passwords;
CREATE TRIGGER tr_update_password_usage 
    AFTER INSERT OR DELETE ON passwords 
    FOR EACH ROW EXECUTE FUNCTION update_usage_on_change('passwords');

-- 3. Projects
DROP TRIGGER IF EXISTS tr_update_project_usage ON projects;
CREATE TRIGGER tr_update_project_usage 
    AFTER INSERT OR DELETE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_usage_on_change('projects');

-- 4. Clipboards
DROP TRIGGER IF EXISTS tr_update_clipboard_usage ON clipboards;
CREATE TRIGGER tr_update_clipboard_usage 
    AFTER INSERT OR DELETE ON clipboards 
    FOR EACH ROW EXECUTE FUNCTION update_usage_on_change('clipboards');
