-- =====================================================
-- Storage 보안 강화 (파일 타입 및 크기 제한)
-- =====================================================

-- clipboard-media 버킷 설정 업데이트
-- 1. allowed_mime_types: 이미지 및 동영상만 허용
-- 2. file_size_limit: 10MB (10 * 1024 * 1024 bytes)

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'],
    file_size_limit = 10485760 -- 10MB
WHERE id = 'clipboard-media';

-- 참고: image/* 와 같은 와일드카드는 Supabase 버전에 따라 지원되지 않을 수 있어 구체적인 MIME 타입을 명시하는 것이 안전함.
