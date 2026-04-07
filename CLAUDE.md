# EduLevel LMS - 프로젝트 규칙

## 기술 스택 (절대 변경 금지)
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL) + Supabase Auth
- Prisma ORM
- Vercel 배포
- OpenAI API (GPT-4o-mini)

## 코드 규칙
- 모든 컴포넌트는 TypeScript (.tsx)
- Server Components 우선 사용, 클라이언트 필요 시만 "use client"
- Server Actions 사용 (API Routes는 외부 연동만)
- 한국어 UI (에러 메시지, 라벨, 버튼 모두 한국어)
- shadcn/ui 컴포넌트 우선 사용
- 파일명: kebab-case (예: student-list.tsx)
- 함수명: camelCase
- 타입명: PascalCase

## 폴더 구조
- src/app/(auth)/ : 로그인 관련
- src/app/(dashboard)/owner/ : 학원장 페이지
- src/app/(dashboard)/teacher/ : 교사 페이지
- src/app/(dashboard)/student/ : 학생 페이지
- src/components/ui/ : shadcn/ui
- src/components/shared/ : 공통 컴포넌트
- src/lib/ : 유틸리티, Supabase, Prisma 클라이언트
- src/types/ : TypeScript 타입
- src/hooks/ : 커스텀 훅

## DB
- Prisma 스키마: prisma/schema.prisma
- 마이그레이션: npx prisma migrate dev --name 설명
- Supabase RLS 정책 적용됨

## 사용자 역할 (4개만, 학부모 없음)
- SUPER_ADMIN: 전체 관리
- ACADEMY_OWNER: 학원 관리
- TEACHER: 테스트/학생 관리
- STUDENT: 테스트 응시/학습

## 절대 하지 말 것
- 새로운 드라이버리를 설치하기 전에 반드시 물어볼 것
- 기존 파일을 삭제하지 말 것 (수정만)
- .env 파일을 Git에 커밋하지 말 것
- any 타입 사용 금지

## UI/UX 디자인 시스템
### 디자인 철학
- Khan Academy 스타일: 깔끔하고 신뢰감 있는 교육 플랫폼
- 플랫 디자인, 최소한의 그림자 (shadow-sm까지만)
- 넉넉한 여백, 콘텐츠 중심 레이아웃
- 모바일 우선 반응형

### 핵심 색상 (반드시 준수)
- 주요 액션/링크: primary-700 (#1865F2)
- 성공/정답: accent-green (#1FAF54)
- 경고/배지: accent-gold (#FFB100)
- 에러/오답: accent-red (#D92916)
- AI/분석: accent-purple (#7854F7)
- 사이드바: primary-900 (#0C2340)
- 본문: gray-900 (#21242C)
- 페이지 배경: gray-50 (#F7F8F9)

### 영역 색상 (4영역)
- Grammar: #1865F2 (블루)
- Vocabulary: #7854F7 (퍼플)
- Reading: #0FBFAD (틸)
- Writing: #E35C20 (오렌지)

### 컴포넌트 원칙
- 버튼 최소 높이 44px (터치 타겟)
- Input 최소 높이 44px
- 카드: rounded-xl border border-gray-200 (그림자 거의 없음)
- 테이블 헤더: bg-gray-50 text-gray-500 text-sm uppercase
- 배지: rounded-full, 상태별 색상 (green/gold/red/blue)
- 빈 상태: 중앙 아이콘 + 설명 + 액션 버튼

### 금지 사항
- 그라디언트 사용 금지
- 과도한 그림자 금지 (shadow-lg 이상)
- 밝은 배경에 밝은 텍스트 금지
- 네온/형광 색상 금지
- 둥근 모서리 과도하게 크게 금지 (rounded-2xl까지만)

## 로고 정책
- 이미지 로고 사용 안 함
- 사이드바: 학원 business_name 텍스트 (bold, white)
- 로그인/가입: "EduLevel" 텍스트 로고
- 관리자: "EduLevel Admin"

## 구독 모델
- 선불 구독제 (월/연), 14일 무료 체험
- 학원장: 직접 가입 + 학원 생성 + 초대코드 발급
- 교사/학생: 초대코드로 가입
- 결제: 수동 입금 확인 (관리자)

## 데이터 삭제
- 탈퇴 시 모든 데이터 완전 삭제
- Prisma 트랜잭션 + Supabase Auth 삭제

## 레벨 시스템 (10단계)
- Level 1 (Pre-A1) ~ Level 10 (C1+)
- 점수 기반: 0~10 = Lv1, 11~20 = Lv2, 21~30 = Lv3, ..., 91~100 = Lv10
- 레벨 상수: `src/lib/constants/levels.ts`의 `LEVELS`, `LEVEL_UP_THRESHOLDS`, `LEVEL_COLORS` 사용
- 레벨 표시: `getLevelInfo(level)`, `LEVEL_COLORS[level]` 사용
- 점수→레벨 변환: `scoreToLevel(score)` 함수 사용
- 레벨업 기준: `LEVEL_UP_THRESHOLDS[].requiredAvg` (최근 3회 평균)
- CEFR 목록: `CEFR_LEVEL_LIST` (Pre-A1, A1 하, A1 상, A2 하, A2 상, B1 하, B1 상, B2 하, B2 상, C1+)
- 기존 5단계에서 하드코딩된 1~5 범위는 모두 1~10으로 변경됨
- DB 마이그레이션 스크립트: `scripts/migrate-levels.ts`
