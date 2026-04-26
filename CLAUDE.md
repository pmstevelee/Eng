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

### 영역 색상 (5영역)
- Grammar: #1865F2 (블루)
- Vocabulary: #7854F7 (퍼플)
- Reading: #0FBFAD (틸)
- Writing: #E35C20 (오렌지)
- Listening: #E91E8A (핑크)

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

## 레벨 시스템 (10단계, 적응형)
- Level 1 (Pre-A1) ~ Level 10 (C1+)
- 점수 기반: 0~10 = Lv1, 11~20 = Lv2, 21~30 = Lv3, ..., 91~100 = Lv10
- 레벨 상수: `src/lib/constants/levels.ts`의 `LEVELS`, `LEVEL_UP_THRESHOLDS`, `LEVEL_COLORS` 사용
- 레벨 표시: `getLevelInfo(level)`, `LEVEL_COLORS[level]` 사용
- 점수→레벨 변환: `scoreToLevel(score)` 함수 사용
- 레벨업 기준: `LEVEL_UP_THRESHOLDS[].requiredAvg` (최근 3회 평균)
- CEFR 목록: `CEFR_LEVEL_LIST` (Pre-A1, A1 하, A1 상, A2 하, A2 상, B1 하, B1 상, B2 하, B2 상, C1+)
- 기존 5단계에서 하드코딩된 1~5 범위는 모두 1~10으로 변경됨
- DB 마이그레이션 스크립트: `scripts/migrate-levels.ts`

## 레벨 승급 시스템
- 레벨은 레벨 테스트(적응형 배치 시험)로만 직접 결정
- 승급 조건 3가지 모두 충족 필요:
  1. 레벨 테스트: 5영역 중 3개 이상 목표 레벨 도달
  2. 단원 테스트: 현재 레벨 단원 70% 이수 + 평균 60점
  3. 학습 활동: 30일 내 문제 50개 또는 미션 20일 완료
- 연습/학습공간은 레벨에 직접 영향 없음 (활동량만 카운트)
- 교사가 수동으로 레벨 조정 가능 (기록 남음): `overrideStudentLevel()` in teacher students actions
- `level_assessments` 테이블: 레벨 평가 공식 이력 (assessmentType: PLACEMENT/PERIODIC/PROMOTION/TEACHER_OVERRIDE)
- `level_promotion_status` 테이블: 승급 진행 상태 (조건별 met 여부 + detail JSON)
- 승급 판정 엔진: `src/lib/assessment/promotion-engine.ts` (`checkPromotionStatus`, `getPromotionProgress`)
- 학생 홈(`/student`)에서 승급 진행 카드 표시 (promotionProgress via getStudentDashboardData)
- 교사 학생상세(`/teacher/students/[id]`)에 "레벨 관리" 탭: 레벨 조회/이력/수동조정/테스트배포
- 학원장 분석(`/owner/analytics`)에 승급 대기 학생 목록 표시
- 학원 설정(`/owner/settings/notifications`)에서 정기 레벨 테스트 주기 설정 (settingsJson.notifications.levelTestPeriod)

## 문제 뱅크 구조
- 공용 문제: `academyId = null` (모든 학원 사용 가능, isVerified=true)
- 학원 전용: `academyId = 특정 ID` (해당 학원만 사용)
- 문제 검색: `WHERE (academyId IS NULL OR academyId = 현재학원) AND isActive = true`
- AI 유사문제는 공용 풀에 비동기 공유 (`source: AI_SHARED`, `share-to-pool.ts`)
- 레벨 테스트: `question_usage_log`로 학원별 1년 중복 방지 (`usage-tracker.ts`)
- 연습/학습공간: 중복 허용
- 통계 캐시: `question_bank_stats` 테이블 (도메인×난이도별 집계, `updateQuestionBankStatsForDomain()`)
- 캐시 레이어: `src/lib/questions/cached-queries.ts` (`unstable_cache`, tag: `question-bank`)
- 캐시 무효화: `revalidateTag('question-bank')` 문제 추가/수정/삭제 시
- 적응형 테스트 최적화: `preloadAdaptiveQuestions()` → 영역별 전체 로드 후 메모리에서 선택
- 관리자 대시보드: `/admin/question-bank` (히트맵, AI 자동 생성, 품질 관리)
- 출처(source): SYSTEM / AI_GENERATED / AI_SHARED / TEACHER_CREATED
