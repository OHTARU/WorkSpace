# WorkSync - 완전 가이드

PC와 모바일 간 데이터를 실시간으로 동기화하는 크로스 디바이스 애플리케이션

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [주요 기능 상세](#주요-기능-상세)
5. [환경 설정 및 서버 실행](#환경-설정-및-서버-실행)
6. [데이터베이스 스키마](#데이터베이스-스키마)
7. [보안 사항](#보안-사항)

---

## 프로젝트 개요

WorkSync는 PC에서 작업하던 내용을 모바일에서 끊김 없이 이어서 할 수 있도록 설계된 **Work Sync Application**입니다.

### 핵심 가치
- **실시간 동기화**: PC와 모바일 간 데이터가 즉시 반영
- **보안 우선**: AES-256-GCM 암호화로 민감 정보 보호
- **계층적 할일 관리**: 프로젝트 > 월간 > 주간 > 일간 구조
- **간편한 사용성**: 직관적인 UI/UX

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Backend** | Supabase (Auth, DB, Realtime) |
| **Frontend (PC)** | Next.js 14 + TypeScript |
| **Mobile** | React Native (Expo) |
| **스타일링** | Tailwind CSS |
| **암호화** | AES-256-GCM (Web Crypto API) |
| **상태 관리** | React Hooks |
| **드래그앤드롭** | @dnd-kit |
| **아이콘** | Lucide React |
| **날짜 처리** | date-fns |

---

## 프로젝트 구조

```
worksync/
├── web/                          # Next.js 웹 앱 (PC Dashboard)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/           # 인증 페이지 (로그인/회원가입)
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (dashboard)/      # 대시보드 (로그인 후)
│   │   │   │   └── dashboard/
│   │   │   │       ├── passwords/    # 비밀번호 관리
│   │   │   │       ├── todos/        # To-Do 리스트
│   │   │   │       ├── clipboard/    # 클립보드 동기화
│   │   │   │       └── profile/      # 프로필 설정
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx          # 랜딩 페이지
│   │   ├── components/
│   │   │   └── Sidebar.tsx       # 사이드바 네비게이션
│   │   ├── hooks/
│   │   │   └── useCrypto.ts      # 암호화 훅
│   │   └── lib/
│   │       └── supabase/         # Supabase 클라이언트
│   │           ├── client.ts
│   │           └── server.ts
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── .env.local.example
│
├── mobile/                       # React Native (Expo) 앱
│   ├── app/
│   │   ├── (auth)/               # 인증 화면
│   │   │   ├── login.tsx
│   │   │   └── signup.tsx
│   │   ├── (tabs)/               # 탭 네비게이션
│   │   │   ├── _layout.tsx
│   │   │   ├── urls.tsx          # URL 동기화
│   │   │   ├── passwords.tsx     # 비밀번호 관리
│   │   │   ├── todos.tsx         # To-Do 리스트
│   │   │   ├── clipboard.tsx     # 클립보드
│   │   │   └── profile.tsx       # 프로필
│   │   └── index.tsx
│   ├── src/
│   │   └── contexts/
│   │       └── AuthContext.tsx   # 인증 상태 관리
│   └── .env.example
│
├── shared/                       # 공유 코드
│   ├── types/
│   │   └── index.ts              # 공통 타입 정의
│   └── utils/
│       └── crypto.ts             # AES-256 암호화 유틸
│
└── supabase/
    └── schema.sql                # 데이터베이스 스키마
```

---

## 주요 기능 상세

### 1. Cross-Device URL Sync (URL 동기화)

PC 웹에서 URL을 저장하면 모바일에서 실시간으로 확인할 수 있습니다.

**기능:**
- URL 입력 시 Supabase DB에 자동 저장
- 제목, 설명, 파비콘 URL 저장 가능
- 읽음 여부(is_read) 표시
- 모바일에서 클릭 시 인앱 브라우저 또는 기본 브라우저로 이동

**사용 시나리오:**
> PC에서 나중에 읽을 기사 URL을 저장 → 출퇴근 중 모바일에서 바로 열어서 읽기

---

### 2. Secure Password Manager (비밀번호 관리)

서비스별 아이디/비밀번호를 암호화하여 안전하게 저장합니다.

**기능:**
- 서비스명, ID, Password 저장
- **AES-256-GCM** 암호화 (비밀번호는 암호화된 상태로 DB 저장)
- 눈 모양 아이콘 클릭 시 복호화하여 표시
- 클립보드에 비밀번호 복사 기능
- 웹사이트 URL 바로가기

**보안 특징:**
- 암호화 키는 절대 서버/DB에 저장하지 않음
- 각 암호화마다 새로운 IV(초기화 벡터) 생성
- PBKDF2(100,000회 반복)로 키 파생

---

### 3. Smart To-Do List (계층적 할일 관리)

프로젝트 기반의 체계적인 할일 관리 시스템입니다.

**계층 구조:**
```
프로젝트 (Projects)
  └── 월간 목표 (Monthly)
        └── 주간 목표 (Weekly)
              └── 일간 할일 (Daily)
```

**기능:**
- 프로젝트별 색상 지정
- 드래그 앤 드롭으로 우선순위 변경
- 완료 시 체크박스 + 취소선 표시
- 목표 날짜(target_date) 설정

---

### 4. User System (사용자 시스템)

Supabase Auth를 활용한 인증 시스템입니다.

**기능:**
- 이메일 회원가입/로그인
- 프로필 수정 (닉네임, 아바타)
- 회원 탈퇴 (모든 데이터 Cascading Delete)

---

### 5. Clipboard & Text Sync (클립보드 동기화)

PC에서 저장한 텍스트를 모바일에서 바로 사용할 수 있습니다.

**기능:**
- 텍스트, URL, 코드 등 다양한 타입 지원
- 고정(Pin) 기능
- 소스 디바이스 표시 (pc/mobile)
- 실시간 동기화

---

## 환경 설정 및 서버 실행

### Step 1: Supabase 프로젝트 생성

1. [https://supabase.com](https://supabase.com) 접속
2. 새 프로젝트 생성
3. **Settings > API**에서 다음 정보 확인:
   - `Project URL`
   - `anon public` 키

### Step 2: 데이터베이스 스키마 설정

1. Supabase Dashboard > **SQL Editor** 이동
2. `supabase/schema.sql` 파일 내용 복사하여 실행
3. **Database > Replication**에서 아래 테이블 Realtime 활성화:
   - urls
   - clipboards
   - todos
   - projects

### Step 3: 웹 앱 실행 (PC)

```bash
# 1. 웹 디렉토리로 이동
cd worksync/web

# 2. 환경 변수 파일 생성
cp .env.local.example .env.local

# 3. .env.local 파일 편집
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 4. 의존성 설치
npm install

# 5. 개발 서버 실행
npm run dev
```

**접속 주소:** http://localhost:3000

### Step 4: 모바일 앱 실행

```bash
# 1. 모바일 디렉토리로 이동
cd worksync/mobile

# 2. 환경 변수 파일 생성
cp .env.example .env

# 3. .env 파일 편집
# EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 4. 의존성 설치
npm install

# 5. Expo 개발 서버 실행
npx expo start
```

**실행 옵션:**
- `i` 키: iOS 시뮬레이터
- `a` 키: Android 에뮬레이터
- QR 코드 스캔: 실제 기기에서 Expo Go 앱으로 테스트

### 빌드 명령어

**웹 앱 프로덕션 빌드:**
```bash
cd worksync/web
npm run build
npm run start
```

**모바일 앱 빌드 (Expo):**
```bash
cd worksync/mobile
npx expo build:android  # Android APK
npx expo build:ios      # iOS IPA
```

---

## 데이터베이스 스키마

### 테이블 구조

| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 프로필 (auth.users와 연동) |
| `urls` | URL 동기화 데이터 |
| `passwords` | 암호화된 비밀번호 저장 |
| `projects` | To-Do 프로젝트 (최상위) |
| `todos` | 할일 항목 (계층 구조) |
| `clipboards` | 클립보드 동기화 데이터 |

### RLS (Row Level Security)

모든 테이블에 RLS가 활성화되어 있으며, 사용자는 자신의 데이터만 접근할 수 있습니다:

```sql
-- 예시: URLs 테이블 정책
"Users can view own urls" - SELECT: auth.uid() = user_id
"Users can insert own urls" - INSERT: auth.uid() = user_id
"Users can update own urls" - UPDATE: auth.uid() = user_id
"Users can delete own urls" - DELETE: auth.uid() = user_id
```

---

## 보안 사항

### 비밀번호 암호화 (AES-256-GCM)

```
평문 비밀번호
    ↓
PBKDF2 키 파생 (100,000회 반복, SHA-256)
    ↓
AES-256-GCM 암호화 (12바이트 IV)
    ↓
Base64 인코딩
    ↓
DB 저장 (password_encrypted + iv)
```

### 주의사항

1. **마스터 키**: 절대 서버/DB에 저장하지 마세요
2. **IV(초기화 벡터)**: 매 암호화마다 새로 생성
3. **환경 변수**: `.env` 파일은 절대 Git에 커밋하지 마세요
4. **프로덕션**: HTTPS 필수 사용

---

## 문제 해결

### 자주 발생하는 문제

**1. 로그인이 안 되는 경우**
- Supabase URL과 ANON KEY가 올바른지 확인
- 환경 변수 파일 이름 확인 (`.env.local` / `.env`)

**2. 실시간 동기화가 안 되는 경우**
- Supabase Dashboard > Database > Replication에서 테이블 활성화 확인

**3. 비밀번호 복호화 실패**
- 브라우저 캐시 삭제 후 다시 로그인
- 암호화 키가 변경되었을 수 있음

**4. 모바일 앱이 연결되지 않는 경우**
- 같은 네트워크에 연결되어 있는지 확인
- 방화벽 설정 확인

---

## 라이센스

이 프로젝트는 MIT 라이센스를 따릅니다.

---

*마지막 업데이트: 2026년 1월*
