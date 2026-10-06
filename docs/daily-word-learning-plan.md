# 오늘의 단어학습 · 랭킹 · 마스터 검증 개선 계획

> 작성 2026-10-06. 각 STEP의 "프롬프트"는 Claude Code에 그대로 붙여넣어 순서대로 실행할 수 있게 작성했다.
> 실행 위치: `ivy` 레포. 운영 DB 마이그레이션은 사용자가 직접 `npx prisma migrate deploy`로 적용한다
> (vercel.json buildCommand가 migrate deploy를 실행하지 않음).

---

## 0. 현행 시스템 진단 (검증 결과)

| # | 문제 | 위치 | 영향 |
|---|---|---|---|
| D1 | 교사/학원장이 세트를 만들어 배정해야만 학습 가능 → 세트가 끊기면 학습도 끊김 | `student/words/page.tsx` | 학습 지속성 저하 (핵심 요구사항) |
| D2 | **첫날 스펠 1회 정답 = MASTERED** — 간격 반복 검증 없이 마스터 처리 | `_actions/index.ts` `recordProgress` | "마스터" 수치가 실제 장기기억을 반영하지 못함 |
| D3 | **복습에서 정답을 맞혀도 MASTERED → SPELL로 강등** (복습 리콜이 stage='RECALL'로 기록되어 다음 단계 SPELL로 덮어씀). 세트 재학습 시 플래시카드 "알아요"도 MASTERED → RECALL로 강등 | `recordProgress` | 마스터 단어 수가 복습할수록 줄어드는 역전 현상 |
| D4 | **복습에서 틀려도 단계가 그대로** (마스터 단어를 틀려도 MASTERED 유지) | `recordProgress` | 망각한 단어가 마스터로 남음 |
| D5 | 교사 출제 단어시험 오답이 SRS에 들어가지 않음 (학생이 "오답 재학습"을 눌러야만) | `submitWordTest` | 틀린 단어가 복습 큐에서 누락 |
| D6 | 오답복습 세트가 `ownerId=userId`로 생성되는데 접근 조건은 `ownerId=studentId` → **학생이 자기 오답 세트를 열 수 없음** | `wordSetAccessWhere` / `retakeWrong` | 오답 재학습 기능 동작 불가 |
| D7 | 복습 큐가 `nextReviewAt` 순서만 사용 — 자주 틀리는 단어 우선순위 없음, "어려운 단어" 개념 없음 | `progress.ts getDueWords` | 취약 단어 집중 복습 불가 |
| D8 | "오늘" 경계가 서버 시간(UTC) 자정 = **KST 오전 9시** | `mission-engine`, `streak-manager`, `progress.ts isSameDay` | 새벽·아침 학습이 전날로 집계, 스트릭 끊김 |
| D9 | 오늘의 미션이 문법+어휘 **문제은행** 기반인데 어휘 문제는 186개뿐(단어 DB는 10,158개) | `mission-engine.ts` | 어휘 미션 반복·부족 |
| D10 | 미션에서 처음 틀린 문법 문제는 복습 대상이 되지 않음 (기존 테스트 응답이 있을 때만 갱신) | `missions/[id]/actions.ts` | 문법 오답 복습 누락 |
| D11 | 일자별 학습량 기록이 없어 랭킹·추이 분석 불가 (XP 원장만 존재) | — | 랭킹/분석 기능 부재 |

## 1. 목표 설계

```
오늘의 단어학습 (/student/daily-mission, 메뉴명 변경)
 ├─ ① 복습: SRS 기한 도래 단어 (어려운 단어 우선)          → /student/words/review
 ├─ ② 새 단어: 레벨 맞춤 N개 자동 생성 (학원 설정 dailyNewWords)
 │      플래시카드 → 리콜 → 스펠  (자동 생성된 '오늘의 단어' 세트, 기존 학습 화면 재사용)
 └─ ③ 문법 미션: 문법 집중 문제 (약점·오답 복습·도전)        → /student/missions/[id]
 완료 시 보너스 포인트 + 스트릭, 승급 조건 3(미션 20일)에 합산
```

### 마스터 판정 규칙 (D2~D4 해결)
- 학습 단계: FLASHCARD → RECALL → SPELL (같은 날 진행). 스펠 첫 정답 시 `learnedAt` 기록(= "학습 완료").
- **MASTERED = 서로 다른 날 3회 연속 복습 정답 (SRS repetitions ≥ 3, 간격 ≥ 6일)**. 마스터 시 `masteredAt` 기록, +10P.
- 복습/학습에서 정답 → 단계는 절대 내려가지 않음.
- 학습 완료(SPELL) 이상 단어를 틀리면 **망각(lapse)**: `lapses+1`, 단계 RECALL로 강등, 마스터 해제, SRS 초기화.
- **어려운 단어** = `lapses ≥ 2` 또는 (오답 ≥ 2 그리고 오답 ≥ 정답). 복습 큐 최우선, 리포트에 별도 표시.
- 단어시험(교사 출제) 오답 → 자동으로 복습 큐 즉시 삽입 + lapse 처리.

### 포인트(=기존 XP) 및 랭킹
- 포인트는 기존 `awardXP` 원장 그대로 사용(새 화폐 만들지 않음). `awardXP`가 `StudentDailyStat.points`도 함께 누적.
- 일일 학습량 집계 `StudentDailyStat` (학생×KST 날짜): points, newWords, reviewWords, masteredWords, wordCorrect, wordWrong, grammarSolved, grammarCorrect, planCompleted.
- 랭킹: 기간(이번 주/이번 달/누적) × 범위(우리 반/우리 학원/전체). 전체 랭킹은 이름 마스킹(김*수)·학원명 비공개, 학원장이 끌 수 있음.
- 정렬: 포인트 → 학습 단어 수. 내 순위 고정 표시.

---

## 2. 실행 STEP (프롬프트)

### STEP 1 — DB 스키마
```
prisma/schema.prisma에 다음을 추가하고 migrate diff로 마이그레이션 SQL을 만들어줘 (prisma format 금지, 운영 DB 적용은 내가 직접).
1) WordProgress: lapses Int @default(0), learnedAt DateTime?, masteredAt DateTime?, lastReviewedAt DateTime? + (studentId, stage) 인덱스
2) DailyWordPlan: 학생×KST날짜(@db.Date) unique, setId(WordSet, unique, SetNull), targetLevel, newWordIds Json, newTarget,
   reviewTarget, reviewedCount, flashcardDone/recallDone/spellDone, status(GENERATED/IN_PROGRESS/COMPLETED), completedAt, bonusAwarded
3) StudentDailyStat: 학생×날짜 unique, points/newWords/reviewWords/masteredWords/wordCorrect/wordWrong/grammarSolved/grammarCorrect/planCompleted, (statDate) 인덱스
4) QuestionReview: 학생×문제 unique, wrongCount, consecutiveCorrect, nextReviewAt, isMastered, lastAnsweredAt (문법 오답노트)
RLS는 enable만(정책 없음 = Supabase API 직접 접근 차단) 같은 마이그레이션에 포함.
```

### STEP 2 — 마스터 검증 로직 수정 (D2~D8)
```
src/lib/words/mastery.ts(순수 함수 + vitest)로 단계 전이 규칙을 분리하고 recordProgress/applySrsResult를 그 규칙으로 바꿔줘.
- recordProgress에 context('LEARN'|'REVIEW') 추가, 복습 화면은 REVIEW로 호출
- 정답 시 단계 강등 금지, 망각 시 lapse 처리, 마스터는 repetitions≥3
- 같은 날 판정은 KST 기준(src/lib/attendance/time.ts의 toKstDateKey 재사용)
- getDueWords: 어려운 단어 우선 정렬 (lapses desc, easeFactor asc, nextReviewAt asc)
- submitWordTest 오답 → SRS 즉시 삽입 + lapse
- wordSetAccessWhere ownerId를 userId로 수정 (오답 세트 접근 버그)
- 학습 이벤트마다 StudentDailyStat 누적 (src/lib/learning/daily-stats.ts)
```

### STEP 3 — 오늘의 단어학습 엔진 + 화면
```
src/lib/words/daily-plan.ts에 getOrCreateTodayWordPlan을 만들어줘.
- 레벨 → 단어 밴드: Lv1~2→2, 3~4→4, 5~6→6, 7~8→8, 9~10→10 (cefr-mapping과 일치), 부족하면 인접 밴드 보충
- 신규 단어 수 = getWordLearningLimits(academyId).dailyNewWords
- 어제까지 생성됐지만 학습하지 않은 단어(learnedAt null) 먼저 이월, 나머지는 미학습 단어에서 무작위
- 학생 소유 비공개 WordSet('오늘의 단어 · M월 D일')을 만들어 기존 플래시카드/리콜/스펠 화면 재사용
- 복습 목표 = min(기한 도래 수, 신규×3, 최대 50)
- finishWordSession/recordProgress에서 진행 반영, 단어+문법 모두 끝나면 완료 보너스 30P + 스트릭
/student/daily-mission 페이지를 "오늘의 단어학습" 허브(3단계 카드 + 레벨 목표 진행률)로 바꾸고,
메뉴명/홈 카드를 "오늘의 단어학습"으로 변경. 단어학습 미구독 학원은 문법 미션만 노출.
```

### STEP 4 — 문법 집중 + 문법 오답 복습 (D9·D10)
```
mission-engine을 문법 중심으로 바꿔줘: VOCAB_QUIZ 제거(어휘는 오늘의 단어가 담당), 약점·균형·도전은 GRAMMAR,
REVIEW_MISSION은 QuestionReview(미션 오답) + 기존 question_responses 복습을 합쳐서 선택.
미션 답안 제출(개별/일괄 모두)에서 오답은 QuestionReview에 등록, 정답 2회 연속이면 해제(1→3→7일 간격).
문법 풀이 수·정답 수를 StudentDailyStat에 누적. 미션 날짜도 KST 기준으로.
```

### STEP 5 — 포인트·랭킹
```
awardXP에서 StudentDailyStat.points를 같은 트랜잭션으로 누적.
src/lib/learning/ranking.ts: 기간(week/month/all)×범위(class/academy/global) 랭킹 (groupBy + unstable_cache 60초).
/student/ranking 페이지(내 순위 고정, 1~3위 강조, 전체는 이름 마스킹), 학생 메뉴 '랭킹' 추가,
학원장/교사 단어학습 관리에 '랭킹' 탭(/owner/words/ranking, /teacher/words/ranking).
학원장 단어학습 설정에 '하루 문법 문제 수', '전체 랭킹 참여' 옵션 추가.
```

### STEP 6 — 학습 분석
```
학생 단어 리포트에: 최근 14일 학습량/정답률 추이(StudentDailyStat), 마스터 퍼널(학습중/학습완료/마스터),
어려운 단어 TOP 20, 문법 약점 하위 카테고리. 교사/학원장 반 리포트에 오늘의 단어학습 완료율·어려운 단어 TOP.
승급 조건 3의 '미션 완료일'을 오늘의 단어학습 완료일 ∪ 기존 미션 완료일로 계산.
```

### STEP 7 — 검증
```
tsc --noEmit, eslint, vitest(mastery/srs) 통과 확인 → 개발 서버에서 학생 계정으로
오늘의 단어학습 생성·플래시카드·복습·랭킹 화면 렌더 확인. 운영 DB 쓰기 경로는 테스트 학생으로만.
```

---

## 3. 호환성 체크리스트
- 기존 세트 학습(교사 배정 세트)·교사 출제 시험은 그대로 동작 (오늘의 단어 세트는 학생 소유 비공개라 허브 목록에 노출 안 됨)
- 기존 MASTERED 단어(구 규칙)는 유지 → 복습에서 틀리면 새 규칙으로 강등
- DailyMission 모델·승급 엔진 조건 3 유지 (계산 대상만 확장)
- 포인트는 기존 XP와 동일 값 → 홈 XP 표시·배지와 일관

---

## 4. 진행 상태 (2026-10-06)

| STEP | 상태 | 주요 파일 |
|---|---|---|
| 1 스키마 | ✅ 코드 완료 · **DB 미적용** | `prisma/migrations/20261006000000_add_daily_word_learning/` |
| 2 마스터 검증 | ✅ | `lib/words/mastery.ts`(+test), `lib/words/progress.ts`, `student/words/_actions/index.ts` |
| 3 오늘의 단어학습 | ✅ | `lib/words/daily-plan.ts`, `components/student/today-learning.tsx`, `student/daily-mission/page.tsx`, 홈 |
| 4 문법 집중 | ✅ | `lib/missions/mission-engine.ts`(`planGrammarMissions`), `lib/missions/question-review.ts` |
| 5 포인트·랭킹 | ✅ | `lib/learning/{daily-stats,ranking}.ts`, `/student/ranking`, `/{owner,teacher}/words/ranking`, 설정 |
| 6 분석 | ✅ | 학생 리포트(퍼널·14일 추이·어려운 단어·문법 오답노트), 반 리포트 7일 지표, 승급 조건 3 |
| 7 검증 | tsc·vitest(49)·next build 통과. DB 적용 후 브라우저 검증 필요 | |

### 배포 순서 (중요)
1. `npx prisma migrate deploy` — **코드 배포 전에 먼저** (awardXP가 student_daily_stats에 쓰므로, 테이블이 없으면 모든 XP 지급이 실패)
2. 커밋·push → Vercel 배포
3. 학생 계정으로 `/student/daily-mission` → 새 단어 3단계 → 복습 → 문법 미션 → 완료 보너스, `/student/ranking` 확인
