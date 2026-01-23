# WorkSync 수익화 전략 보고서

**작성일**: 2026년 1월 20일
**버전**: 1.0
**프로젝트**: WorkSync - 크로스 디바이스 동기화 플랫폼

---

## 1. Executive Summary

WorkSync는 PC와 모바일 간 실시간 데이터 동기화를 제공하는 생산성 애플리케이션입니다. 현재 수익화 시스템이 구현되어 있지 않으며, 본 보고서는 지속 가능한 비즈니스 모델 구축을 위한 전략을 제시합니다.

### 핵심 권고사항
| 우선순위 | 전략 | 예상 월 수익 (MAU 10K 기준) | 구현 난이도 |
|---------|------|---------------------------|------------|
| 1순위 | Freemium 구독 모델 | ₩2,450,000 | 중간 |
| 2순위 | 광고 기반 수익화 | ₩400,000 | 낮음 |
| 3순위 | B2B 엔터프라이즈 | ₩3,000,000+ | 높음 |

---

## 2. 현재 시스템 분석

### 2.1 기술 스택
| 구분 | 기술 |
|------|------|
| 웹 (PC) | Next.js 14, TypeScript, Tailwind CSS |
| 모바일 | React Native (Expo) |
| 백엔드 | Supabase (PostgreSQL + Realtime) |
| 인증 | Supabase Auth (이메일/비밀번호) |
| 암호화 | AES-256-GCM (클라이언트 사이드) |

### 2.2 주요 기능
1. **URL 동기화** - PC에서 저장한 URL을 모바일에서 실시간 확인
2. **비밀번호 관리자** - AES-256-GCM 암호화 기반 안전한 비밀번호 저장
3. **계층형 할일 관리** - 프로젝트 → 월간 → 주간 → 일간 4단계 구조
4. **클립보드 동기화** - 텍스트, URL, 코드 실시간 공유

### 2.3 현재 제한사항
- 수익화 시스템 미구현
- 결제 시스템 미연동
- 사용량 제한 로직 부재
- 플랜/구독 관리 기능 없음

---

## 3. 수익화 전략 상세

### 3.1 Freemium 구독 모델 (1순위)

#### 플랜 구조

| 기능 | Free | Pro (₩4,900/월) | Business (₩9,900/월/유저) |
|------|------|-----------------|-------------------------|
| URL 저장 한도 | 50개 | 무제한 | 무제한 |
| 비밀번호 저장 한도 | 20개 | 무제한 | 무제한 + 팀 공유 |
| 할일 프로젝트 | 3개 | 무제한 | 무제한 |
| 클립보드 히스토리 | 7일 | 90일 | 365일 |
| 연결 기기 수 | 2대 | 5대 | 무제한 |
| 파일 동기화 | - | 500MB | 5GB |
| 브라우저 확장 | - | ✓ | ✓ |
| 팀 협업 기능 | - | - | ✓ |
| API 접근 | - | - | ✓ |
| 우선 고객지원 | - | ✓ | ✓ |
| 광고 제거 | - | ✓ | ✓ |

#### 수익 예측 모델

```
가정:
- MAU (Monthly Active Users): 10,000명
- Free → Pro 전환율: 5%
- Pro → Business 전환율: 1%

계산:
- Pro 구독자: 10,000 × 5% = 500명
- Business 구독자: 10,000 × 1% = 100명

월간 수익:
- Pro: 500명 × ₩4,900 = ₩2,450,000
- Business: 100명 × ₩9,900 = ₩990,000
- 총 MRR: ₩3,440,000

연간 수익 (ARR): ₩41,280,000
```

#### 기술 구현 요구사항

1. **데이터베이스 스키마 확장**
   - `subscriptions` 테이블 (구독 정보)
   - `plans` 테이블 (플랜 정의)
   - `usage_limits` 테이블 (사용량 추적)

2. **결제 시스템 연동**
   - Stripe (글로벌) 또는 Toss Payments (국내)
   - Webhook 기반 구독 상태 동기화
   - 결제 실패 재시도 로직

3. **접근 제어 로직**
   - RLS 정책 확장 (플랜별 데이터 접근)
   - 사용량 체크 미들웨어
   - 실시간 한도 알림

---

### 3.2 광고 기반 모델 (2순위)

#### 광고 배치 전략

| 위치 | 플랫폼 | 광고 형식 | 예상 CPM | 노출 빈도 |
|------|--------|----------|---------|----------|
| 대시보드 하단 | 웹 | 배너 (728x90) | $2 | 상시 |
| 탭 전환 시 | 모바일 | 인터스티셜 | $8 | 5분당 1회 |
| URL 열기 전 | 양쪽 | 네이티브 | $3 | 매 3회 |
| 기능 잠금 해제 | 양쪽 | 리워드 | $15 | 사용자 선택 |

#### 광고 수익 예측

```
가정:
- DAU: 1,000명
- 일 평균 세션: 3회
- 세션당 광고 노출: 2회

일간 노출:
- 배너: 1,000 × 3 = 3,000회
- 인터스티셜: 1,000 × 1 = 1,000회

일간 수익:
- 배너: 3,000 ÷ 1,000 × $2 = $6
- 인터스티셜: 1,000 ÷ 1,000 × $8 = $8
- 일 총계: $14 (약 ₩18,200)

월간 수익: ₩546,000
```

#### 광고 플랫폼 선택

| 플랫폼 | 장점 | 단점 | 추천 |
|--------|------|------|------|
| Google AdSense/AdMob | 높은 fill rate, 안정적 | 심사 엄격 | 웹/모바일 |
| 카카오 애드핏 | 국내 최적화 | 글로벌 제한 | 웹 (국내) |
| Unity Ads | 리워드 광고 강점 | 게임 중심 | 모바일 |

---

### 3.3 B2B 엔터프라이즈 (3순위)

#### 타겟 고객
- 원격근무 스타트업 (10-50인)
- IT 개발팀
- 디지털 에이전시
- 프리랜서 그룹

#### 엔터프라이즈 기능

| 기능 | 설명 | 가치 제안 |
|------|------|----------|
| **팀 비밀번호 금고** | 안전한 팀 비밀번호 공유 | 보안 강화 |
| **SSO 통합** | Google Workspace, SAML | IT 관리 편의 |
| **감사 로그** | 모든 활동 기록 | 컴플라이언스 |
| **관리자 대시보드** | 팀원 관리, 권한 설정 | 중앙 관리 |
| **SLA 보장** | 99.9% 가동률 | 서비스 신뢰 |
| **전용 지원** | 슬랙 채널, 온보딩 | 빠른 문제 해결 |

#### 가격 정책

| 플랜 | 가격 | 포함 내역 |
|------|------|----------|
| Team Starter | ₩99,000/월 | 10유저, 기본 기능 |
| Team Pro | ₩199,000/월 | 25유저, SSO, 감사로그 |
| Enterprise | 별도 협의 | 무제한, 전용 지원, SLA |

---

## 4. 구현 로드맵

### Phase 1: 구독 시스템 MVP (2-3주)

```
Week 1:
├── 구독 DB 스키마 설계 및 마이그레이션
├── Stripe 계정 설정 및 상품 생성
└── 결제 API 엔드포인트 구현

Week 2:
├── Webhook 핸들러 구현
├── 플랜별 제한 로직 구현
└── 구독 관리 UI 개발

Week 3:
├── 결제 플로우 테스트
├── 엣지 케이스 처리
└── 프로덕션 배포
```

### Phase 2: 광고 통합 (1-2주)

```
Week 4:
├── AdMob SDK 통합 (모바일)
├── AdSense 설정 (웹)
├── Pro 사용자 광고 제거 로직
└── 광고 빈도 최적화
```

### Phase 3: B2B 기능 (4-6주)

```
Week 5-8:
├── 조직/팀 관리 시스템
├── 역할 기반 접근 제어 (RBAC)
├── 팀 비밀번호 공유 기능
├── 관리자 대시보드
└── SSO 통합 (Google, SAML)
```

---

## 5. 기술 구현 상세

### 5.1 데이터베이스 스키마 (구독 시스템)

```sql
-- 플랜 정의
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,           -- 'free', 'pro', 'business'
    display_name VARCHAR(100) NOT NULL,  -- '무료', 'Pro', 'Business'
    price_monthly INTEGER NOT NULL,       -- 월 가격 (원)
    price_yearly INTEGER,                 -- 연 가격 (원, 할인 적용)
    stripe_price_id_monthly VARCHAR(100),
    stripe_price_id_yearly VARCHAR(100),
    features JSONB NOT NULL,              -- 기능 목록
    limits JSONB NOT NULL,                -- 사용량 제한
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 구독 정보
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    stripe_subscription_id VARCHAR(100),
    stripe_customer_id VARCHAR(100),
    status VARCHAR(20) NOT NULL,          -- 'active', 'canceled', 'past_due', 'trialing'
    billing_cycle VARCHAR(10) NOT NULL,   -- 'monthly', 'yearly'
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 사용량 추적
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature VARCHAR(50) NOT NULL,         -- 'urls', 'passwords', 'projects', 'devices'
    current_count INTEGER DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature)
);

-- RLS 정책
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage"
    ON usage_tracking FOR SELECT
    USING (auth.uid() = user_id);
```

### 5.2 플랜 제한 설정

```json
{
  "free": {
    "urls": 50,
    "passwords": 20,
    "projects": 3,
    "devices": 2,
    "clipboard_history_days": 7,
    "file_storage_mb": 0,
    "browser_extension": false,
    "team_features": false,
    "api_access": false,
    "priority_support": false,
    "ads_free": false
  },
  "pro": {
    "urls": -1,
    "passwords": -1,
    "projects": -1,
    "devices": 5,
    "clipboard_history_days": 90,
    "file_storage_mb": 500,
    "browser_extension": true,
    "team_features": false,
    "api_access": false,
    "priority_support": true,
    "ads_free": true
  },
  "business": {
    "urls": -1,
    "passwords": -1,
    "projects": -1,
    "devices": -1,
    "clipboard_history_days": 365,
    "file_storage_mb": 5120,
    "browser_extension": true,
    "team_features": true,
    "api_access": true,
    "priority_support": true,
    "ads_free": true
  }
}
```

---

## 6. KPI 및 성과 지표

### 6.1 핵심 지표

| 지표 | 설명 | 목표 (6개월) |
|------|------|-------------|
| MRR | 월간 반복 수익 | ₩5,000,000 |
| ARR | 연간 반복 수익 | ₩60,000,000 |
| Conversion Rate | Free → Paid 전환율 | 5% |
| Churn Rate | 월간 이탈률 | < 5% |
| ARPU | 유저당 평균 수익 | ₩500 |
| LTV | 고객 생애 가치 | ₩50,000 |
| CAC | 고객 획득 비용 | < ₩10,000 |

### 6.2 모니터링 대시보드 요구사항

- 실시간 구독자 수
- 플랜별 분포
- 일/주/월 수익 추이
- 전환 퍼널 분석
- 이탈 사유 분석

---

## 7. 리스크 및 대응 방안

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| 낮은 전환율 | 높음 | A/B 테스트, 가격 조정, 무료 기능 재검토 |
| 결제 시스템 장애 | 높음 | Stripe 외 백업 결제 수단, 모니터링 강화 |
| 경쟁사 진입 | 중간 | 차별화 기능 강화, 사용자 락인 |
| 개인정보 규정 | 중간 | GDPR/개인정보보호법 준수, 법률 검토 |
| 환불 요청 증가 | 낮음 | 명확한 환불 정책, 무료 체험 기간 |

---

## 8. 결론 및 다음 단계

### 즉시 실행 항목
1. ✅ 구독 시스템 DB 스키마 구현
2. ⬜ Stripe 계정 생성 및 상품 설정
3. ⬜ 결제 API 엔드포인트 개발
4. ⬜ 플랜별 제한 로직 구현
5. ⬜ 구독 관리 UI 개발

### 성공 기준
- 출시 후 1개월: 유료 전환 100명 달성
- 출시 후 3개월: MRR ₩1,000,000 달성
- 출시 후 6개월: MRR ₩5,000,000 달성

---

**문서 작성**: Claude AI
**검토 필요**: 사업팀, 개발팀, 법무팀
