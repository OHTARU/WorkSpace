# WorkSync (Work Sync Application)

WorkSync는 PC(Web)와 모바일(App) 간의 끊김 없는 업무 연속성을 제공하기 위한 통합 생산성 플랫폼입니다. 사용자가 PC에서 작업하던 URL, 클립보드, 할 일 목록 및 비밀번호 정보를 모바일에서 실시간으로 확인하고 관리할 수 있습니다.

## 🚀 Key Features

### 1. Cross-Device URL Sync
- **실시간 동기화:** PC 웹에서 저장한 URL을 모바일에서 실시간(Supabase Realtime)으로 확인.
- **연동:** 모바일 앱에서 클릭 시 즉시 브라우저 연결.

### 2. Clipboard & Text Sync
- **즉각적인 공유:** PC에서 입력한 텍스트를 모바일 클립보드 탭에서 즉시 확인 및 복사.

### 3. Secure Password Manager
- **Zero-Knowledge Architecture:** 마스터 비밀번호 기반 클라이언트 사이드 암호화. 서버는 암호화된 데이터만 저장하며, 원본 비밀번호를 알 수 없습니다.
- **Strong Encryption:** PBKDF2-HMAC-SHA256 (310,000 iterations) 키 파생 및 AES-256-GCM 암호화 적용.
- **안전한 조회:** 마스킹 처리, 생체 인증(모바일), 자동 잠금 및 클립보드 자동 소거 기능.

### 4. Smart To-Do List
- **계층형 관리:** 프로젝트 > 월간 > 주간 > 일간 단위의 체계적인 할 일 관리.
- **우선순위:** 드래그 앤 드롭 기반의 우선순위 설정 지원.

### 5. Subscription & Monetization (Hybrid Model)
- **Stripe 연동:** 구독 기반의 프리미엄(Pro/Business) 플랜 제공.
- **광고 수익화:** 무료 플랜 사용자 대상 AdMob(모바일) 및 AdSense(웹) 광고 노출.
- **사용량 제한:** 무료/유료 사용자에 따른 기능별(URL, Passwords 등) 저장 용량 제한.

## 🛡 Security Enhancements (Recent Updates)

- **Strict CSRF Protection:** 웹 애플리케이션의 Origin 검증 로직 강화 (Subdomain Attack 방지).
- **Advanced Rate Limiting:**
  - **Middleware:** Upstash Redis 기반의 서버 사이드 요청 제한.
  - **Client-side:** 비밀번호 입력 등 민감 동작에 대한 Token Bucket 알고리즘 적용.
- **Input Validation:** 웹/모바일 공통의 강력한 마스터 비밀번호 복잡도 검증 규칙 적용.
- **Secure Storage:** Android MediaLibrary 저장 시 경로 Traversal 방지 및 파일 무결성 검증.

## 🛠 Tech Stack

- **Frontend (Web):** Next.js 14, Tailwind CSS, TypeScript
- **Mobile (App):** React Native (Expo), TypeScript
- **Backend/Infrastructure:** Supabase (Auth, Database, Realtime, Functions)
- **Payment:** Stripe API
- **Testing:** Vitest, Testing Library

## 📂 Project Structure

```text
worksync/
├── web/        # Next.js 기반 웹 대시보드
├── mobile/     # Expo 기반 모바일 애플리케이션
├── shared/     # 공통 타입 및 유틸리티 (암호화 등)
└── supabase/   # 데이터베이스 스키마 및 Edge Functions
```

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18+)
- Expo CLI
- Supabase Account & Project

### Installation

1. **Repository Clone**
   ```bash
   git clone https://github.com/your-username/worksync.git
   cd worksync
   ```

2. **Web Setup**
   ```bash
   cd web
   npm install
   cp .env.example .env.local
   # .env.local에 Supabase 및 Stripe 키 입력
   npm run dev
   ```

3. **Mobile Setup**
   ```bash
   cd ../mobile
   npm install
   cp .env.example .env
   # .env에 Supabase URL 및 Anon Key 입력
   npx expo start
   ```

## 🔐 Security
- 모든 민감 데이터(비밀번호 등)는 클라이언트 측에서 암호화되어 DB에 전송됩니다.
- `.env` 파일은 절대 버전 관리 시스템(Git)에 포함되지 않도록 주의하십시오.

## 📄 License
This project is licensed under the MIT License.
