# Role
너는 시니어 풀스택 개발자야. 업무 생산성을 위해 PC(Web)와 Mobile(App) 간의 데이터 연동 서비스를 구축하려고 해.

# Goal
사용자가 PC에서 작업하던 내용을 모바일에서 끊김 없이 이어서 할 수 있는 'Work Sync Application'의 MVP 버전을 만들어줘.

# Tech Stack Recommendation
(특별히 선호하는 스택이 없다면 이대로 진행하고, 있다면 수정해줘)
- Backend: Supabase (Auth, DB, Realtime) - 빠르고 간편한 구축을 위해
- Frontend (PC): Next.js (Admin Dashboard 형태)
- Mobile: React Native (Expo) 또는 Flutter
- Styling: Tailwind CSS

# Key Features (Requirements)
아래 기능들을 구현해야 해.

1. **Cross-Device URL Sync**
   - PC 웹에서 URL 입력 시 Supabase DB에 저장.
   - 모바일 앱에서는 실시간(Realtime)으로 리스트가 갱신되어야 함.
   - 모바일에서 리스트 클릭 시 인앱 브라우저 또는 기본 브라우저로 이동.

2. **Secure Password Manager**
   - 서비스명, ID, Password를 저장.
   - DB 저장 시에는 반드시 암호화(AES-256 등) 처리되어야 함.
   - 모바일 앱에서 조회 시에는 '눈 모양' 아이콘을 눌러야 복호화된 비번이 보여야 함.
   - (Optional) 비밀번호 조회 전 생체 인증 로직을 고려한 구조로 설계.

3. **Smart To-Do List**
   - 계층 구조: 프로젝트 > 월간 > 주간 > 일간.
   - 드래그 앤 드롭으로 우선순위 변경 가능하도록 UI 고려.
   - 완료된 항목은 체크박스로 처리 및 시각적 구분(취소선).

4. **User System**
   - 이메일 회원가입/로그인 (Supabase Auth 활용).
   - 프로필 수정 및 회원 탈퇴 (탈퇴 시 모든 데이터 삭제 처리: Cascading delete).

5. **Clipboard & Text Sync (추가 요청)**
   - PC에서 텍스트 입력 시 모바일 클립보드 탭에 즉시 동기화.

# Implementation Guide
1. 먼저 프로젝트 폴더 구조를 제안해줘.
2. Supabase 데이터베이스 스키마(Table SQL)를 작성해줘.
3. 각 기능별 핵심 로직과 컴포넌트 구조를 설명하고 코드를 작성해줘.
4. 보안(암호화 키 관리 등)에 대한 주의사항을 주석으로 남겨줘.

# Output
설명보다는 실행 가능한 코드 위주로 작성해주고, 단계별로 진행해줘.