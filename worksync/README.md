# WorkSync - Cross-Device Sync Application

PC(Web)와 Mobile(App) 간의 데이터 연동 서비스

## 프로젝트 구조

```
worksync/
├── web/                    # Next.js 웹 앱 (PC Dashboard)
├── mobile/                 # React Native (Expo) 앱
├── shared/                 # 공유 타입 및 유틸리티
└── supabase/              # Supabase 설정 및 마이그레이션
```

## 기술 스택

- **Backend**: Supabase (Auth, DB, Realtime)
- **Frontend (PC)**: Next.js 14 + Tailwind CSS
- **Mobile**: React Native (Expo)
- **암호화**: AES-256-GCM

## 주요 기능

1. Cross-Device URL Sync
2. Secure Password Manager
3. Smart To-Do List (계층 구조)
4. User System
5. Clipboard & Text Sync

## 시작하기

### 1. Supabase 설정
1. https://supabase.com 에서 새 프로젝트 생성
2. `supabase/schema.sql` 실행하여 테이블 생성
3. `.env.local` 파일에 Supabase URL과 ANON KEY 설정

### 2. 웹 앱 실행
```bash
cd web
npm install
npm run dev
```

### 3. 모바일 앱 실행
```bash
cd mobile
npm install
npx expo start
```
