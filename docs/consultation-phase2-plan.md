# 상담관리 2단계 구현 계획

작성일: 2026-09-25 · 상태: 계획 확정 대기 (코드 작성 전)

범위: A. 상담 예약 일정 / B. 학부모 알림(SOLAPI) / C. 레벨테스트 연동 / D. 팔로업 할 일
제외: 통계 대시보드, 외부 상담신청 폼, 재원생 정기상담, 학원별 개별 카카오 채널 연동

---

## 0. 코드 조사 결과

### 1단계 상담관리 구조
- 서버: `src/lib/consultation/`
  - `access.ts` — 권한 (`getConsultationActor`, `leadScopeWhere`, `findScopedLead`, `isValidAssignee`)
  - `actions.ts`, `queries.ts`, `constants.ts`
- UI: `src/components/shared/consultation/` (`lead-pages.tsx` 학원장·교사 공용 서버 컴포넌트, `lead-detail-client.tsx`, `consultation-form-dialog.tsx`, `modal-shell.tsx` 등)
- 라우트: `/owner/consultations`, `/teacher/consultations` (+ `[leadId]`)
- 모델: `Lead`, `Consultation`, `LeadStatusHistory` — `LeadStatus`에 `SCHEDULED`, `CONSULTED` 이미 존재
- `createConsultation`은 NEW/SCHEDULED 상태에서 기록 추가 시 이미 CONSULTED로 자동 전환함

### 알림 발송
- SOLAPI/SMS/알림톡 코드 없음 (요금표 문구만 존재). `Notification` 모델은 앱 내 알림 전용
- → 신규 구성

### 레벨테스트 엔진
- `TestSession.studentId` 필수, `Student`는 `User`(Supabase Auth) 1:1 필수
- `adaptive-actions.ts`의 모든 액션이 `getAuthedStudent()`로 STUDENT 역할 요구, 팝업 페이지도 `requireStudent()` → 로그인 없이 응시 불가
- 저장 결과: `assessedLevels`(영역별·종합 레벨), `placementResult`(`PlacementResult` 전체: 영역별 level/rawScore/confidence, weakestDomain, strongestDomain, imbalanceWarning, 이전 대비 변화), 점수 컬럼 5개, `LevelAssessment` 1건
- CEFR은 레벨 숫자 → `getLevelInfo`로 변환 (별도 저장 안 함)
- 채점·문제 선정은 DB 비의존 순수 함수 (`adaptive-scoring.ts`, `adaptive-selection.ts`)
- 쓰기 영역은 `gradeAdaptiveWriting()`이 GPT-4o-mini로 채점 (실패 시 통계 추정 폴백)
- `TestSession` 사용처: 45개 파일, 104곳

### 배포·예약 작업
- Vercel Pro, 리전 icn1
- 기존 Vercel Cron: `/api/cron/billing` (`0 17 * * *`, `CRON_SECRET` Bearer 인증) → 같은 패턴 사용

### 기타
- rate limit: `src/lib/security/rate-limit.ts` (인메모리, 인스턴스별)
- 학원 연락처: `Academy.phone`, 학원 설정: `Academy.settingsJson`
- 등록 전환 다이얼로그는 초기 레벨 수동 선택(기본 1), `createStudentAccount`가 `currentLevel` 설정

---

## 결정 사항

| 항목 | 결정 |
|---|---|
| 비회원 레벨테스트 모델 | **① 별도 모델** (기존 `TestSession` 무수정) — 확정 |
| Vercel 요금제 | Pro — 확정 |
| SOLAPI 연동 | SDK 없이 `fetch` + HMAC-SHA256 서명 직접 구현 (권장, 확인 대기) |
| 공개 페이지 rate limit | 기존 인메모리 `checkRateLimit` 재사용 (권장, 확인 대기) — 정확한 분산 제한은 `@upstash/ratelimit` 설치 필요 |
| 결과 페이지 로고 | CLAUDE.md "이미지 로고 사용 안 함"에 따라 학원명 텍스트 표시 (확인 대기) |

### 비회원 레벨테스트 모델 선택지 (참고)
| 안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| **① 별도 모델 (채택)** | `PlacementInvite` + `PlacementAttempt` 신설, 엔진 순수 함수 재사용 | 기존 학생 응시 코드 무수정, 학생 통계·승급 오염 없음 | 진행 오케스트레이션 일부 중복, 등록 전환 시 결과 이관 필요 |
| ② `TestSession.studentId` nullable + `leadId` | 기존 테이블 공유 | 결과 화면 재사용 쉬움 | 45개 파일 타입 파손, 학생 쿼리에 비회원 세션 혼입 위험 |
| ③ 임시 Student 생성 | Lead마다 숨김 계정 | 코드 변경 최소 | Auth 계정 필요, 학생 수·과금·목록 오염 |

### SOLAPI: SDK vs fetch
| | `solapi` SDK | `fetch` 직접 |
|---|---|---|
| 설치 | npm 패키지 추가 | 없음 |
| 인증 서명 | SDK 처리 | `crypto`로 약 30줄 |
| 타입 | 제공 | 사용하는 1~2개 API만 직접 정의 |
| API 변경 대응 | SDK 업데이트 | 코드 수정 |

기능 차이 없음 (알림톡 실패 시 SMS/LMS 대체발송은 SOLAPI 서버가 요청 옵션으로 처리).

---

## A. 상담 예약 일정

### DB
- `enum AppointmentStatus { SCHEDULED, COMPLETED, NO_SHOW, CANCELED }`
- `model ConsultationAppointment`: id, leadId, counselorId, scheduledAt, durationMinutes(30), status, rescheduledFromId?(@unique), consultationId?(@unique), createdAt, updatedAt
  - 인덱스: (counselorId, scheduledAt), (leadId, scheduledAt)
- 역관계: `Lead.appointments`, `User`(상담자), `Consultation.appointment`

### 서버
- `src/lib/consultation/appointment-actions.ts` (신규)
  - `createAppointment` — Lead NEW면 SCHEDULED + 이력 (트랜잭션)
  - `checkAppointmentConflict` — 같은 담당자 시간 겹침 → 클라이언트 경고 후 `confirmOverlap: true`로 재호출
  - `rescheduleAppointment` — 기존 CANCELED, 새 예약 `rescheduledFromId` 연결
  - `cancelAppointment`, `markNoShow`
- `actions.ts` — `createConsultation`에 `appointmentId?` 추가: 예약 COMPLETED + `consultationId` 연결 + CONSULTED 전환 (트랜잭션)
- `queries.ts` — `getAppointments(actor, { from, to, counselorId })`, `getLeadDetail`에 예약 목록·노쇼 횟수 추가
- `constants.ts` — 예약 상태 라벨·색상

### UI
- `appointment-form-dialog.tsx` (신규) — 날짜, 시간(30분 단위), 소요시간, 담당자, 겹침 경고 확인
- `lead-detail-client.tsx` — "상담 예약" 버튼, 예약 카드(변경/취소/노쇼/상담 완료), 노쇼 횟수 배지. "상담 완료" → 상담 기록 폼(appointmentId 전달)
- `consultation-tabs.tsx` (신규) — "문의 목록 | 상담 일정"
- `appointment-calendar.tsx` (신규) — 주간 캘린더(CSS grid, 라이브러리 없음, KST) + 일간 목록, `view` 파라미터 없으면 모바일은 일간 기본
- 라우트: `/owner/consultations/schedule`, `/teacher/consultations/schedule`

### 권한
- 교사: 본인 담당 Lead에만 예약 생성, 상담자 = 본인. 캘린더는 counselorId = 본인
- 학원장: 전체 + 담당자 필터, 상담자 자유 선택
- 학원장이 타 교사 담당 Lead의 예약을 교사에게 배정하면 해당 교사 캘린더엔 표시되나 문의 상세 링크는 비활성

---

## B. 학부모 알림 (SOLAPI)

### 구조
- `src/lib/notifications/` (server-only)
  - `solapi.ts` — HMAC 서명 + 발송 (`fetch`), 알림톡 실패 시 SMS/LMS 대체발송 옵션
  - `templates.ts` — templateKey·변수 정의 상수
  - `send.ts` — `sendNotification({ academyId, leadId?, appointmentId?, phone, templateKey, variables })`, dedupeKey 중복 방지
- 환경변수: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_PFID`, `SOLAPI_SENDER_NUMBER`, 템플릿별 ID, `NOTIFICATION_MODE`(live/log, 미설정 시 log) → `.env.example`에 주석과 함께 추가
- `docs/alimtalk-templates.md` — 카카오 검수 신청용 템플릿 문구 초안

### 모델
- `NotificationLog`: id, academyId, leadId?, appointmentId?, phone, templateKey, variables(Json), channel(ALIMTALK/SMS/LMS), status(PENDING/SENT/FAILED/SKIPPED), errorMessage?, dedupeKey(@unique), sentAt?, createdAt

### 템플릿
1. `APPOINTMENT_CONFIRMED` — #{학원명}, #{학생명}, #{일시}, #{학원연락처}
2. `APPOINTMENT_REMINDER` — #{학원명}, #{학생명}, #{일시}
3. `PLACEMENT_TEST_LINK` — #{학원명}, #{학생명}, #{응시링크}, #{마감일}
4. `PLACEMENT_TEST_RESULT` — #{학원명}, #{학생명}, #{결과링크}

### 발송 시점
- 예약 생성: 폼의 "학부모에게 알림 발송"(기본 체크) → 확정 알림
- 전날 리마인드: `/api/cron/consultation` `0 1 * * *`(UTC = 10:00 KST), 다음날(KST) SCHEDULED 예약 대상, dedupeKey `reminder:{appointmentId}`. 발송 직전 상태 재확인으로 취소 예약 제외
- 문의 상세에 발송 이력 표시

### 제약
- SOLAPI 응답은 "접수" 기준. 최종 알림톡 성공/대체발송 여부는 수 초 뒤 확정 → 로그는 접수 시점 SENT, 최종 채널은 SOLAPI 콘솔 확인 (웹훅은 범위 밖)

---

## C. 레벨테스트 연동

### 모델
- `PlacementInvite`: id, academyId, leadId, token(unique, 랜덤), expiresAt(7일), status(SENT/STARTED/COMPLETED/EXPIRED), attemptId?, createdAt
- `PlacementAttempt`: id, academyId, leadId, 문항 이력(Json), 쓰기 답안, assessedLevels, placementResult, overallLevel, resultToken(unique), resultExpiresAt(30일), startedAt, completedAt

### 엔진 재사용
- `adaptive-actions.ts`는 `'use server'` 파일이라 export하면 공개 서버 액션이 됨 → 쓰기 채점·문제 선정 헬퍼를 **동작 변경 없이** server-only 모듈(`src/lib/assessment/`)로 이동, 학생·비회원 양쪽에서 import
- 응시 UI는 `AdaptiveTestClient`에 서버 액션을 prop으로 주입해 재사용
- 쓰기 영역 AI 채점 동일 적용 → 비회원 응시도 OpenAI 비용 발생
- 학원별 1년 중복 방지 `recordLevelTestUsage(academyId)` 동일 기록

### 화면
- 문의 상세: "레벨테스트 보내기"(알림 발송 / 링크 복사), 결과 카드(CEFR, 영역별, 약점 요약), "결과 리포트 발송"(자동 발송 안 함)
- `/placement/invite/[token]` — 공개, 만료·완료 안내, 시작 전 이름 확인
- `/placement/result/[token]` — 공개, 30일 만료, 학부모용 문장, 문항·정답 비노출, 학원명 텍스트
- 공개 페이지·액션에 IP 기준 rate limit

### 등록 전환 이관
- 완료된 응시가 있으면 전환 다이얼로그 초기 레벨을 측정 레벨로 미리 채움
- 전환 트랜잭션에 `LevelAssessment`(PLACEMENT, testSessionId null, detailJson에 attempt 참조) 생성
- 승급 엔진은 학생별 `isCurrent` 최신 `LevelAssessment`만 읽으므로 신규 학생과 충돌 없을 것으로 판단 → 구현 후 검증·보고

---

## D. 팔로업 할 일

- `FollowUpTask`: id, academyId, leadId, assigneeId, dueAt, content, completedAt?, createdById, createdAt
- 문의 상세: 할 일 추가(내일/3일 후/1주 후/직접 선택), 완료 체크
- 상담관리 첫 화면 상단 "오늘 할 일": 오늘 마감 + 기한 경과 (교사는 본인 것)
- 사이드바 상담관리 메뉴에 기한 경과 개수 배지
- 방치 표시: `Lead.lastActivityAt` 컬럼 추가, 상담 기록·상태 변경·예약·할 일 저장 시 갱신. ENROLLED/LOST 제외, 기준 일수 `settingsJson.consultation.staleDays`(기본 7) — 상담관리 화면에서 학원장이 변경

---

## 공통 규칙
- 모든 신규 모델 쿼리에 academyId 조건 (`leadScopeWhere` 경유)
- 교사는 본인 담당 Lead의 예약·할 일·알림·레벨테스트만
- 공개 페이지는 토큰으로만 접근
- 마이그레이션: `migrate diff` + `migrate deploy` (`prisma format` 금지)

## 진행 순서
A → D → B → C, 각 파트 완료 시 커밋·푸시
