# WorkSync Play Store 출시 체크리스트

**작성일:** 2026-01-27
**프로젝트:** WorkSync Mobile
**현재 버전:** 1.0.0 (versionCode: 1)

---

## 목차

1. [Phase 1: 크리티컬 버그 수정](#phase-1-크리티컬-버그-수정)
2. [Phase 2: 보안 강화](#phase-2-보안-강화)
3. [Phase 3: 앱 서명 및 빌드 설정](#phase-3-앱-서명-및-빌드-설정)
4. [Phase 4: Play Store 정책 준수](#phase-4-play-store-정책-준수)
5. [Phase 5: 최종 테스트](#phase-5-최종-테스트)
6. [Phase 6: 출시](#phase-6-출시)

---

## Phase 1: 크리티컬 버그 수정

> **예상 소요 시간:** 1-2시간
> **우선순위:** 즉시 수행

### 1.1 앱 크래시 수정 ✅ 완료

| 항목 | 상태 | 파일 |
|------|------|------|
| expo-updates 의존성 제거 | ✅ 완료 | `mobile/src/components/GlobalErrorBoundary.tsx` |
| AdMob App ID 설정 | ✅ 완료 | `mobile/app.json`, `AndroidManifest.xml` |

### 1.2 기능 테스트

```
[x] 앱 정상 실행 확인 ✅ (2026-01-27)
[x] 로그인/로그아웃 테스트 ✅
[x] URL 동기화 테스트 ✅
[x] 비밀번호 관리 테스트 ✅
[x] To-Do 리스트 테스트 ✅
[x] 클립보드 동기화 테스트 ✅
[x] 프로필 페이지 테스트 ✅
```

---

## Phase 2: 보안 강화

> **예상 소요 시간:** 3-5일
> **우선순위:** 출시 전 필수

### 2.1 High Priority (필수)

#### 2.1.1 서버사이드 Rate Limiting 구현

**현재 문제:** 클라이언트 사이드 rate limiting만 있어 우회 가능

**파일:** `web/middleware.ts`, `web/src/hooks/useRateLimit.ts`

**해결 방법:**
```typescript
// Upstash Redis 사용 예시
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

**작업 내용:**
```
[x] Upstash Redis 계정 생성 → 환경 변수 설정 필요
[x] @upstash/ratelimit 패키지 설치 ✅
[x] middleware.ts에 서버사이드 rate limiting 구현 ✅
[x] 로그인 시도 제한 (5회/분) → API 전체 100회/분
[x] API 요청 제한 (100회/분) ✅
```

---

#### 2.1.2 CSRF 보호 강화

**현재 문제:** localhost 예외로 인한 우회 가능

**파일:** `web/middleware.ts:33-45`

**작업 내용:**
```
[x] localhost 예외 조건 제거 (프로덕션 환경) ✅
[x] Origin 검증 로직 강화 ✅
[x] 환경 변수로 개발/프로덕션 분리 ✅ (NODE_ENV 사용)
```

**수정 코드:**
```typescript
// 프로덕션에서는 정확한 origin 매칭
const allowedOrigins = [
  'https://worksync.app',
  'https://www.worksync.app'
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:3000');
}
```

---

#### 2.1.3 민감 정보 환경 변수 분리

**현재 문제:** `.env.local` 파일이 저장소에 포함될 수 있음

**작업 내용:**
```
[ ] .gitignore에 모든 .env* 파일 추가 확인
[ ] Vercel/호스팅 서비스에 환경 변수 설정
[ ] 프로덕션 Supabase 키 분리
```

---

### 2.2 Medium Priority (권장)

#### 2.2.1 마스터 비밀번호 강도 검증

**파일:** `web/src/app/(dashboard)/dashboard/passwords/page.tsx`

**작업 내용:**
```
[ ] zxcvbn 라이브러리 설치
[ ] 비밀번호 강도 검사 UI 추가
[ ] 최소 요구사항 강화 (12자, 대소문자, 숫자, 특수문자)
```

---

#### 2.2.2 파일 업로드 서버사이드 검증

**파일:** Supabase Edge Function 추가 필요

**작업 내용:**
```
[ ] Storage trigger 함수 생성
[ ] Magic bytes 서버사이드 검증
[ ] 파일 크기 제한 확인
[ ] 악성 파일 스캔 (선택사항)
```

---

### 2.3 Low Priority (선택)

#### 2.3.1 에러 모니터링 추가

**작업 내용:**
```
[ ] Sentry 계정 생성
[ ] @sentry/react-native 설치
[ ] 앱 초기화 코드에 Sentry 설정
[ ] Web에도 @sentry/nextjs 설정
```

---

## Phase 3: 앱 서명 및 빌드 설정

> **예상 소요 시간:** 2-3시간
> **우선순위:** 출시 전 필수

### 3.1 프로덕션 Keystore 생성

```bash
# 1. Keystore 생성
keytool -genkeypair -v -storetype PKCS12 \
  -keystore worksync-release.keystore \
  -alias worksync \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# 2. 안전한 곳에 백업 (절대 분실하면 안 됨!)
# - Google Drive (암호화)
# - 외장 하드
# - 비밀번호 관리자
```

**중요:** Keystore를 분실하면 앱 업데이트 불가!

### 3.2 Gradle 서명 설정

**파일:** `mobile/android/app/build.gradle`

```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        storeFile file('worksync-release.keystore')
        storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
        keyAlias 'worksync'
        keyPassword System.getenv("KEY_PASSWORD") ?: ""
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        // ... 나머지 설정
    }
}
```

### 3.3 버전 업데이트

**파일:** `mobile/app.json`

```json
{
  "expo": {
    "version": "1.0.0",  // 사용자에게 표시되는 버전
    "android": {
      "versionCode": 2   // Play Store 업로드마다 증가
    }
  }
}
```

### 3.4 EAS Build 설정

**파일:** `mobile/eas.json`

```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### 3.5 빌드 체크리스트

```
[ ] Keystore 생성 완료
[ ] Keystore 백업 완료
[ ] build.gradle 서명 설정 완료
[ ] 환경 변수 설정 (KEYSTORE_PASSWORD, KEY_PASSWORD)
[ ] EAS 프로젝트 연결 확인
[ ] 테스트 빌드 성공 확인
```

---

## Phase 4: Play Store 정책 준수

> **예상 소요 시간:** 1-2일
> **우선순위:** 출시 전 필수

### 4.1 개인정보 처리방침

```
[ ] 개인정보 처리방침 웹페이지 작성
[ ] 수집하는 데이터 명시:
    - 이메일 주소
    - 비밀번호 (암호화 저장)
    - URL, 클립보드 데이터
    - 디바이스 정보 (AdMob)
[ ] 데이터 사용 목적 명시
[ ] 데이터 보관 기간 명시
[ ] 데이터 삭제 방법 명시
[ ] HTTPS URL로 호스팅
```

**예시 URL:** `https://worksync.app/privacy-policy`

### 4.2 데이터 안전 섹션

Play Console에서 작성해야 할 항목:

| 질문 | 답변 |
|------|------|
| 데이터 수집 여부 | 예 |
| 수집 데이터 유형 | 개인정보(이메일), 앱 활동, 기기 ID |
| 데이터 공유 여부 | 아니오 (AdMob 제외) |
| 데이터 암호화 여부 | 예 (AES-256-GCM) |
| 데이터 삭제 요청 방법 | 앱 내 계정 삭제 기능 |

### 4.3 광고 공개

```
[ ] 앱에 광고 포함됨 표시 (AdMob 사용)
[ ] 광고 SDK: Google AdMob
[ ] 광고 유형: 배너 광고
```

### 4.4 앱 콘텐츠 등급

```
[ ] 콘텐츠 등급 설문 작성
[ ] 예상 등급: 전체이용가 (PEGI 3 / Everyone)
```

### 4.5 타겟 연령대

```
[ ] 타겟 연령대: 18세 이상 (비밀번호 관리 앱)
[ ] 아동 대상 아님 확인
```

### 4.6 스토어 등록 정보

```
[ ] 앱 이름: WorkSync
[ ] 짧은 설명 (80자 이내)
[ ] 상세 설명 (4000자 이내)
[ ] 앱 아이콘 (512x512 PNG)
[ ] 기능 그래픽 (1024x500 PNG)
[ ] 스크린샷 (최소 2장, 권장 8장)
    - 휴대전화: 최소 320px, 최대 3840px
[ ] 카테고리: 생산성
[ ] 이메일 주소 (개발자 연락처)
```

---

## Phase 5: 최종 테스트

> **예상 소요 시간:** 1-2일
> **우선순위:** 출시 전 필수

### 5.1 기능 테스트

```
[ ] 신규 가입 플로우
[ ] 로그인/로그아웃
[ ] 비밀번호 찾기
[ ] URL 동기화 (Web ↔ Mobile)
[ ] 비밀번호 저장/조회/삭제
[ ] 마스터 비밀번호 설정/변경
[ ] 생체 인증
[ ] To-Do CRUD
[ ] 클립보드 동기화
[ ] 미디어 업로드/다운로드
[ ] 프로필 편집
[ ] 계정 삭제
[ ] 광고 표시 확인
```

### 5.2 호환성 테스트

```
[ ] Android 7.0 (API 24) - 최소 지원 버전
[ ] Android 10 (API 29)
[ ] Android 12 (API 31)
[ ] Android 13 (API 33)
[ ] Android 14 (API 34)
[ ] 다양한 화면 크기 (폰, 태블릿)
```

### 5.3 성능 테스트

```
[ ] 앱 시작 시간 (< 3초)
[ ] 메모리 사용량 확인
[ ] 배터리 소모 확인
[ ] 네트워크 오프라인 동작
```

### 5.4 보안 테스트

```
[ ] 로그인 시도 제한 동작 확인
[ ] 암호화/복호화 정상 동작
[ ] 세션 만료 처리
[ ] 민감 정보 로그 출력 없음 확인
```

---

## Phase 6: 출시

> **예상 소요 시간:** 1-3일 (심사 기간 포함)

### 6.1 프로덕션 빌드

```bash
# EAS Build 사용 (권장)
cd mobile
eas build --platform android --profile production

# 빌드 완료 후 다운로드
eas build:list
```

### 6.2 Play Console 업로드

```
[ ] Google Play Console 접속
[ ] 앱 생성 (최초) 또는 새 버전 생성
[ ] AAB 파일 업로드
[ ] 스토어 등록정보 작성
[ ] 콘텐츠 등급 설정
[ ] 가격 및 배포 설정 (무료)
[ ] 국가/지역 선택
```

### 6.3 출시 트랙 선택

| 트랙 | 용도 | 권장 |
|------|------|------|
| 내부 테스트 | 최대 100명 테스터 | 첫 업로드 시 |
| 비공개 테스트 | 이메일로 초대한 사용자 | 베타 테스트 |
| 공개 테스트 | 누구나 참여 가능 | 대규모 테스트 |
| 프로덕션 | 모든 사용자 | 최종 출시 |

**권장 순서:**
1. 내부 테스트 → 2. 비공개 테스트 → 3. 프로덕션

### 6.4 출시 후 모니터링

```
[ ] Play Console 크래시 리포트 확인
[ ] 사용자 리뷰 모니터링
[ ] ANR (Application Not Responding) 확인
[ ] Sentry 에러 모니터링 (설정한 경우)
```

---

## 요약: 작업 순서

| 순서 | Phase | 예상 시간 | 필수 여부 |
|------|-------|----------|----------|
| 1 | 크리티컬 버그 수정 | 1-2시간 | ✅ 필수 |
| 2 | 보안 강화 (High) | 2-3일 | ✅ 필수 |
| 3 | 앱 서명 및 빌드 설정 | 2-3시간 | ✅ 필수 |
| 4 | Play Store 정책 준수 | 1-2일 | ✅ 필수 |
| 5 | 최종 테스트 | 1-2일 | ✅ 필수 |
| 6 | 출시 | 1-3일 | ✅ 필수 |
| - | 보안 강화 (Medium/Low) | 추후 | 권장 |

**총 예상 소요 시간: 7-12일**

---

## 긴급 출시 시 최소 요구사항

시간이 급한 경우 아래 항목만 완료:

```
[✅] 앱 크래시 수정 (완료)
[ ] 프로덕션 Keystore 생성
[ ] 개인정보 처리방침 URL
[ ] 기본 스토어 등록정보
[ ] 프로덕션 빌드
[ ] Play Console 업로드
```

**최소 소요 시간: 2-3일**

---

*이 문서는 2026-01-27에 작성되었습니다.*
