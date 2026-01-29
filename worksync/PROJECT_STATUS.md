# WorkSync 프로젝트 현황 및 향후 계획

**작성일**: 2026년 1월 26일
**프로젝트**: WorkSync
**상태**: 핵심 보안/동기화 기능 구현 완료, 구독 시스템 UI 적용 완료

---

## 1. 최근 구현 완료 사항 (1월 23일 기준)

### 1.1 마스터 비밀번호 및 보안 강화
- **검증 메커니즘 개선**: `verifier` 토큰 방식을 도입하여 마스터 비밀번호의 유효성을 암호학적으로 검증하도록 개선 (기존: 단순 키 파생 후 통과 → 개선: 파생 키로 토큰 복호화 성공 여부 확인).
- **설정 유지 문제 해결**: 데이터베이스 RLS 정책 및 필수 컬럼(`verifier`, `encryption_salt`, `email`) 누락 문제를 해결하여 앱 재실행/새로고침 시에도 설정이 초기화되지 않도록 수정.
- **보안 강화**:
  - **Rate Limiting (웹/모바일)**: 비밀번호 입력 5회 실패 시 5분간 차단 기능을 웹과 모바일 양쪽에 모두 적용.
  - **모바일 저장 제한**: 모바일 앱에서는 비밀번호 '생성'을 제한하고 '조회' 전용으로 변경 (보안 및 편의성 고려).

### 1.2 웹-모바일 동기화 (Sync)
- **기능 동기화**: 웹과 모바일 앱이 동일한 보안 로직(`upsert`, `verifier`)을 사용하도록 코드 통일.
- **실시간 동기화 (Realtime)**: 모바일 앱에만 있던 실시간 데이터 갱신 기능을 웹(`page.tsx`)에도 적용하여, 한쪽에서 변경 시 즉시 반영되도록 구현.

### 1.3 모바일 UX 개선
- **URL 목록**: 체크박스 터치 시 'URL 열기'가 아닌 '읽음 상태 토큰'만 작동하도록 영역 분리. URL 복사 버튼 추가.
- **갤러리 저장**: 이미지/비디오 저장 시 공유 시트가 아닌 기기 갤러리에 직접 저장되도록 `expo-media-library` 연동.
- **UI 디테일**: 비밀번호 입력 시 '뒤로가기' 버튼 및 '비밀번호 보기(Eye Icon)' 토글 추가.

### 1.4 데이터베이스 안정화
- **초기화 스크립트**: `supabase/migrations/006_reset_database.sql` 작성. DB 테이블, RLS 정책, 트리거, 기본 데이터를 한 번에 완벽하게 재설정하는 스크립트 제공.

### 1.5 구독 제한 UI 적용 (1월 26일 추가)
- **웹 컴포넌트 생성**:
  - `UpgradeModal`: 한도 도달 시 업그레이드 유도 모달 (UsageBar 시각화 포함)
  - `UsageWarningBanner`: 80% 사용 시 노란색, 100% 사용 시 빨간색 경고 배너
- **모바일 훅 생성**: `useSubscription` 훅을 모바일에도 구현하여 웹과 동일한 API 제공
- **기능별 제한 적용**:
  | 기능 | Free 플랜 한도 | 적용 위치 |
  |------|---------------|----------|
  | URLs | 50개 | 웹 URLs 페이지 |
  | Passwords | 20개 | 웹/모바일 Passwords 페이지 |
  | Clipboards | 100개 | 웹/모바일 Clipboard 페이지 |
  | Projects | 5개 | 웹/모바일 Todos 페이지 |
- **동작 방식**:
  - 웹: 한도 도달 시 `UpgradeModal` 표시, 80% 이상 사용 시 `UsageWarningBanner` 경고
  - 모바일: 한도 도달 시 `Alert.alert()`로 업그레이드 유도 메시지 표시
  - Pro/Business 플랜: 모든 제한 해제 (무제한, limit=-1)

### 1.6 추가 구현 사항 (1월 29일)
- **버그 수정**: Android 이미지 저장(`MediaLibrary`) 오류 수정, Web CSRF 취약점 해결.
- **보안 강화**:
  - 마스터 비밀번호 검증 로직 표준화(Web/Mobile 공통, 강도 검사 강화).
  - Storage 업로드 검증 강화(서버 사이드 MIME 타입 및 크기 제한).
- **광고 수익화**:
  - 모바일: AdMob 배너(상단 배치) 및 전면광고(이미지 저장 시) 적용. Pro 유저 숨김 처리.
- **구독 및 결제 (Web)**:
  - Stripe Checkout 세션 생성 및 Webhook 핸들러 구현 완료.
  - 데이터베이스 자동 사용량 추적(Triggers) 구현 완료.

---

## 2. 구독 시스템 (구현 완료)

*2026년 1월 20일 구현 내용 유지*

- **플랜**: Free, Pro, Business 3단계
- **결제**: Stripe 연동 (Checkout, Webhook)
- **제한**: 기능별(URL, 비밀번호 등) 사용량 제한 로직 구현 (`useSubscription` 훅)

---

## 3. 파일 변경 내역

### 3.1 모바일 (Mobile)
| 파일 경로 | 변경 내용 |
|----------|----------|
| `app/(tabs)/passwords.tsx` | 마스터 비밀번호 검증 로직 강화(shared validation), **구독 제한 체크** |
| `app/(tabs)/urls.tsx` | 터치 영역 분리, 복사 기능 추가 |
| `app/(tabs)/clipboard.tsx` | **Android 저장 오류 수정**, **전면광고(`InterstitialAd`) 적용** |
| `app/(tabs)/_layout.tsx` | **배너광고(`BannerAd`) 상단 배치 및 구독 연동** |
| `src/components/BannerAd.tsx` | **구독 상태(`isPro`)에 따른 조건부 렌더링** |
| `src/hooks/useInterstitialAd.ts` | **[신규]** 전면광고 훅 구현 |
| `src/utils/validation.ts` | **[신규]** 비밀번호 유효성 검사 로직 (Shared) |

### 3.2 웹 (Web)
| 파일 경로 | 변경 내용 |
|----------|------|
| `app/(dashboard)/dashboard/passwords/page.tsx` | **마스터 비밀번호 강도 검사 강화** |
| `app/(dashboard)/dashboard/subscription/page.tsx` | **실제 결제(Stripe) 연동 및 플랜 표시** |
| `app/api/checkout/route.ts` | **[신규]** Stripe Checkout 세션 생성 API |
| `app/api/webhook/stripe/route.ts` | **[신규]** Stripe 구독 상태 동기화 Webhook |
| `components/Sidebar.tsx` | **광고 배너(`AdSense`) 구독 상태 연동** |
| `lib/stripe.ts` | **[신규]** Stripe 클라이언트 초기화 |
| `middleware.ts` | **CSRF 취약점(Origin 검증) 수정** |
| `shared/utils/validation.ts` | **[신규]** 비밀번호 유효성 검사 로직 |

### 3.3 데이터베이스
| 파일 경로 | 설명 |
|----------|------|
| `supabase/migrations/006_reset_database.sql` | **[최신]** 전체 DB 초기화 및 올바른 스키마/정책 적용 스크립트 |
| `supabase/migrations/007_storage_security.sql` | **[신규]** Storage 버킷 보안 강화 (MIME, Size 제한) |
| `supabase/migrations/008_add_stripe_columns.sql` | **[신규]** Stripe 고객 ID 컬럼 추가 |
| `supabase/migrations/009_automated_usage_tracking.sql` | **[신규]** 항목 추가/삭제 시 사용량 자동 집계 트리거 |

---

## 4. 향후 계획 (Next Steps)

### 4.1 배포 및 환경 설정 (최우선)
- [ ] **DB 초기화**: Supabase SQL Editor에서 `006_reset_database.sql` 실행하여 DB 구조 확정.
- [ ] **Stripe 설정**: Stripe 대시보드에서 상품/가격 생성 및 API 키 발급, 환경변수 적용.

### 4.2 기능 제한 적용 (구독 모델 연동) ✅ 완료
~~현재 구독 시스템 로직(`useSubscription`)은 구현되어 있으나, 실제 UI에서 제한을 거는 부분은 미적용 상태입니다.~~
- [x] **URL 페이지**: 무료 플랜 50개 초과 시 추가 차단 로직 연결.
- [x] **비밀번호 페이지**: 무료 플랜 20개 초과 시 추가 차단 로직 연결.
- [x] **프로젝트/클립보드**: 각 제한 수치 적용.

### 4.3 광고 수익화 (완료)
- [x] **AdMob 배너**: 모바일 앱(`BannerAd`)에 구독 상태(`isPro`) 연동 완료. Pro 유저에게는 숨김 처리.
- [x] **AdMob 전면광고**: `saveMedia` (이미지 저장) 시점에 적용 완료.
- [x] **구독 연동**: Pro 플랜 이상 사용자에게는 광고 숨김 처리 (완료).

### 4.4 추가 개선 필요 사항
- [ ] **배포**: Play Store / App Store 배포 프로세스 진행.
- [ ] **테스트**: 전체 기능 E2E 테스트 및 베타 테스트 진행.

---

**작성자**: Claude AI (Gemini Agent 수정)