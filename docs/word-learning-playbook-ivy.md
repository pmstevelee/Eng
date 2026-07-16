# 위고업 단어학습 모듈 — ivy 코드베이스 적용 플레이북 (수정본)

> 원본 플레이북을 실제 `ivy` LMS 코드베이스에 맞춰 검증·수정한 버전.
> 각 STEP 프롬프트는 Claude Code에 그대로 붙여넣어 **순차 실행**할 수 있도록 작성됨.
> **실행 위치: 이 `ivy` 레포 (login.wegoupenglish.com). 랜딩 레포 `wegoup_website` 아님.**

---

## ⚠️ 원본 플레이북의 주요 불일치 (반드시 반영)

| # | 원본 플레이북 가정 | 실제 ivy 코드베이스 | 조치 |
|---|---|---|---|
| 1 | `app/(student)/`, `app/(teacher)/`, `app/(parent)/` 라우트 그룹 | `src/app/(dashboard)/student/`, `.../teacher/`, `.../owner/` | 경로 전부 교체. **`(parent)` 없음 → STEP 13 학부모 리포트 폐기, 학원장(owner) 리포트로 대체** |
| 2 | `lib/`, `components/`, `hooks/` 루트 경로 | `src/lib/`, `src/components/`, `src/hooks/` | 모든 경로 앞에 `src/` |
| 3 | `import { ... } from '@prisma/client'` | Prisma 생성 경로 `src/generated/prisma` | `import { ... } from '@/generated/prisma'` |
| 4 | REST API Route 중심 (STEP 6: `/api/words/**`) | CLAUDE.md: **Server Actions 우선, API Routes는 외부 연동만** | STEP 6을 Server Actions(`_actions/`)로 전면 교체 |
| 5 | `canUseWordLearning(user)` — 유저별 구독 체크 | 구독은 **학원(Academy) 단위** (`Academy.subscriptionStatus`, `Subscription.plan`). Plan enum `FREE/STARTER/STANDARD/PREMIUM` 존재 | 학생의 소속 학원 구독으로 게이트 |
| 6 | SM-2 신규 구현 + `calculateNextReview` 함수명 | **이미 `src/lib/ai/spaced-repetition.ts`에 `calculateNextReview` 존재**(고정 간격 1/3/7일, 문제용) | 단어용 SM-2는 **별도 네임스페이스** `src/lib/words/srs.ts`에 `calculateNextWordReview`로 작성(이름 충돌 방지) |
| 7 | XP/스트릭/미션 신규 구현(STEP 12) | **이미 존재**: `src/lib/missions/xp-manager.ts`(`awardXP`), `streak-manager.ts`(`updateStreak`), `mission-engine.ts`(`buildDailyMissions`, `getOrCreateTodayMission`). `Student.totalXp`, `StudentXp`, `Badge`, `BadgeType` enum | 신규 시스템 만들지 말고 **기존 함수 호출**로 연동 |
| 8 | "오늘의 단어" 위젯 신규(STEP 10) | `src/app/(dashboard)/student/daily-mission/` 일일 미션 시스템 존재 | 기존 미션/홈 흐름에 통합 |
| 9 | 학원장 단어 수 설정 위치 미정 | `Academy.settingsJson` Json 필드 + `updateNotificationSettings` 패턴(`settingsJson.notifications.levelTestPeriod`) 존재 | `settingsJson.wordLearning.dailyNewWords`로 동일 패턴 |
| 10 | 시드 스크립트 `scripts/oxford/` | 기존 시드는 `prisma/seed-*.ts` + `package.json` `seed:*` 스크립트 | 신규 스크립트는 `scripts/oxford/` 유지하되 명령은 `oxford:*`로 등록(기존과 분리 OK) |
| 11 | Supabase RLS가 1차 보안 | 실제 접근 제어는 **서버액션 + `requireStudent()`의 `studentId` 스코프** | RLS는 보조 방어선으로만, 1차는 서버액션 스코프 |
| 12 | shadcn/ui, recharts, openai 설치 필요 | **이미 설치됨**(recharts v3, openai v6, shadcn) | 재설치 불필요 |

### 신규 설치 라이브러리 (사용자 승인 완료)
- `pdf-parse`, `p-limit`, `cli-progress` — 시드 파이프라인 (devDependencies)
- `framer-motion` — 플래시카드 플립/스와이프
- `vitest` — SM-2 단위 테스트 (devDependencies)

### 디자인/규칙 준수 사항 (CLAUDE.md)
- 한국어 UI, `any` 금지, kebab-case 파일명, Server Components 우선
- 색상: 어휘/단어 영역은 **Vocabulary 퍼플 `#7854F7`** 계열 사용
- 카드 `rounded-xl border border-gray-200`, 버튼/Input 최소 44px(터치 56px), 그라디언트 금지

### CEFR ↔ 위고업 10단계 매핑
`src/lib/constants/levels.ts`의 `LEVELS`, `scoreToLevel`, `CEFR_LEVEL_LIST` 재사용.
신규 `src/lib/words/cefr-mapping.ts`는 이 상수에 의존하도록 작성(독립 하드코딩 금지).

---

## 🗺️ 수정된 실행 순서

```
STEP 0  사전 라이브러리 설치
STEP 1  Prisma 스키마 (Word/WordSet/WordSetItem/WordProgress/WordTest)
STEP 2  Oxford 3000+5000 PDF 파싱 → JSON
STEP 3  DB 시드 (OpenAI 한글뜻/예문 생성)
STEP 4  구독 게이트 (학원 단위) + 학원 dailyNewWords 설정값 읽기
STEP 5  SM-2 SRS (src/lib/words/srs.ts, 이름 충돌 회피)
STEP 6  Server Actions (REST 아님)
STEP 7  학생 메뉴 추가 + 단어학습 허브 페이지   ← 사용자 요청 ①
STEP 8  학원장 "하루 암기 단어 수" 설정 UI      ← 사용자 요청 ②
STEP 9  플래시카드 UI
STEP 10 리콜(객관식) UI
STEP 11 스펠(주관식) UI + 채점
STEP 12 SRS 복습 큐 + 일일 미션 통합
STEP 13 자동 테스트 + 오답 재학습 (교사/학생)
STEP 14 게이미피케이션 연동 (기존 awardXP/updateStreak 호출)
STEP 15 학습 리포트 (학생/교사/학원장 — 학부모 제외)
```

---

## STEP 0 — 라이브러리 설치

```
다음 라이브러리를 설치해줘. 설치 후 package.json에 정상 반영됐는지 확인만 하고 다른 변경은 하지 마.
- 런타임/시드용: npm install pdf-parse p-limit cli-progress
- 개발용: npm install -D vitest
- UI 애니메이션: npm install framer-motion
tsx는 이미 설치돼 있으니 재설치하지 마. recharts, openai, shadcn도 이미 있으니 건드리지 마.
```

---

## STEP 1 — Prisma 스키마

```
ivy의 단어학습 모듈을 위해 prisma/schema.prisma에 모델을 추가해줘.

규칙:
- Prisma 클라이언트 생성 경로는 src/generated/prisma 그대로 유지(기존 generator client 블록 변경 금지).
- 기존 모델/필드 삭제 금지. 신규 모델 추가와, 기존 User/Academy/Student 모델에 relation 필드만 추가.
- @map 스네이크케이스 컨벤션을 기존 스키마와 동일하게 유지(예: created_at).

추가 모델 5개:
1. Word: Oxford 단어 마스터
   id, term, partOfSpeech, cefrLevel(Int, 위고업 1~10), oxfordCefr(OxfordCefr enum),
   contextNote(String?), homonymIndex(Int?), meaning(String?), definition(String?),
   example(String?), audioUrl(String?), source(WordSource enum),
   createdAt, updatedAt
2. WordSet: title, description?, cefrLevel(Int), isPublic(Boolean @default(false)),
   source(WordSetSource enum), ownerId(String?, User), academyId(String?, Academy),
   createdAt, updatedAt
3. WordSetItem: setId(WordSet), wordId(Word), order(Int) — N:M 연결 + 순서
4. WordProgress: studentId(Student), wordId(Word), stage(LearnStage @default(FLASHCARD)),
   easeFactor(Float @default(2.5)), intervalDays(Int @default(0)), repetitions(Int @default(0)),
   nextReviewAt(DateTime?), correctCount(Int @default(0)), wrongCount(Int @default(0)),
   lastStudiedAt(DateTime?), createdAt, updatedAt
5. WordTest: studentId(Student), setId(WordSet?), mode(WordTestMode),
   score(Int), totalQuestions(Int), answers(Json), takenAt(DateTime @default(now()))

enum:
- WordSource: OXFORD_3000 | OXFORD_5000 | PUBLISHER | TEACHER | AI_GENERATED
- WordSetSource: PUBLISHER | TEACHER | AI_GENERATED | OXFORD_3000 | OXFORD_5000
- LearnStage: FLASHCARD | RECALL | SPELL | MASTERED
- WordTestMode: EN_TO_KO | KO_TO_EN | SPELL | MIXED
- OxfordCefr: A1 | A2 | B1 | B2 | C1
(기존 enum 이름과 충돌하지 않게 Word* 접두사 사용)

인덱스/제약:
- WordProgress: @@unique([studentId, wordId]), @@index([studentId, nextReviewAt])
- Word: @@index([cefrLevel]), @@index([oxfordCefr]), @@unique([term, partOfSpeech, homonymIndex])
- WordSetItem: @@unique([setId, wordId])

연결: Student 모델에 wordProgress WordProgress[], wordTests WordTest[];
      User 모델에 ownedWordSets WordSet[]; Academy 모델에 wordSets WordSet[] 추가.

작성 후 실행 명령 안내:
- npx prisma migrate dev --name add_word_learning_module
- npx prisma generate
주의: DATABASE_URL은 Transaction Pooler(6543, pgbouncer=true), DIRECT_URL은 5432.
migrate는 DIRECT_URL을 쓰는지 prisma.config.ts/스키마 datasource 확인 후 실행.
```

✅ 완료: `npx prisma studio`에서 5개 테이블 확인, `@/generated/prisma`에 타입 생성, `can` 동음이의어가 homonymIndex로 구분.

---

## STEP 2 — Oxford 3000 & 5000 PDF 파싱

```
Oxford 3000/5000 PDF 두 개를 파싱해 통합 JSON으로 만드는 스크립트를 작성해줘.
모든 스크립트는 ivy 컨벤션에 맞춰 tsx로 실행 가능하게 작성하고, src/ 밖 scripts/oxford/에 둬.

1. scripts/oxford/download-pdfs.ts
   - 3000: https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000_by_CEFR_level.pdf
   - 5000: https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_5000_by_CEFR_level.pdf
   - scripts/oxford/raw/oxford-3000.pdf, oxford-5000.pdf로 저장. 있으면 스킵(--force로 강제).
2. scripts/oxford/parse-oxford.ts — pdf-parse 사용, 결과 scripts/oxford/data/oxford-words.json
3. 파싱 규칙:
   a. CEFR 헤더: ^(A1|A2|B1|B2|C1)$ 단독 라인
   b. 단어 라인: word(숫자?)( (괄호설명))? pos.(, pos.)*
      - "absorb v." → term:absorb, pos:["v"]
      - "besides prep., adv." → 품사별 분리
      - "can1 modal v." → term:can, homonymIndex:1, pos:["modal v"]
      - "bank (money) n." → term:bank, contextNote:"money", pos:["n"]
   c. 줄 끝이 콤마(,)면 다음 줄과 합치기(다중 라인)
   d. 다중 품사 → 각 품사별 별도 레코드(unique [term,partOfSpeech,homonymIndex] 대응)
4. 헤더/푸터 제외: "© Oxford University Press", "The Oxford XXXX™ by CEFR level X / Y", 페이지번호 단독 라인
5. 중복: 두 PDF에 같은 (term,pos)면 OXFORD_5000 우선. 각 레코드 source 필드.
6. 출력 스키마: { term, partOfSpeech, cefrLevel:'A1'~'C1', contextNote, homonymIndex, source }
7. package.json scripts에 등록(기존 seed:* 와 분리):
   "oxford:download": "tsx scripts/oxford/download-pdfs.ts",
   "oxford:parse": "tsx scripts/oxford/parse-oxford.ts"
8. 콘솔 통계: 3000/5000 각 CEFR 분포, 중복제거 후 총수, 동음이의어 수, contextNote 보유 수
9. 매칭 안 된 비어있지 않은 라인은 scripts/oxford/data/unparsed.txt로 저장
주의: 정규식은 단계적 적용(정제→CEFR헤더→줄합치기→단어). "ice cream" 같은 공백 복합어 허용.
```

✅ 완료: `oxford-words.json` 생성, 총 ~5000개, `unparsed.txt` 비어있거나 의도된 누락만.

---

## STEP 3 — DB 시드 (OpenAI 한글뜻/예문)

```
scripts/oxford/data/oxford-words.json을 Word 테이블에 시드하는 스크립트를 작성해줘.

1. scripts/oxford/seed-oxford.ts
2. src/lib/words/cefr-mapping.ts:
   - mapOxfordCefrToWegoupLevel(oxfordCefr): number — A1→2, A2→4, B1→6, B2→8, C1→10
   - 반드시 src/lib/constants/levels.ts의 LEVELS/CEFR 상수를 참조해 일관성 유지(독립 하드코딩 금지)
   - 1,3,5,7,9 중간 레벨은 향후 세분화 가능하도록 주석
3. OpenAI 호출은 src/lib/openai/word-enrichment.ts로 분리:
   - 기존 OpenAI 클라이언트 초기화 방식(src/lib/ai/* 참고)과 동일하게, 모델 gpt-4o-mini, response_format json_object
   - 입력: term, partOfSpeech, contextNote?, homonymIndex?, oxfordCefr
   - 출력: { meaning(한글, 콤마구분 최대3), definition(영영 1문장), example(예문 1문장) }
   - contextNote/homonymIndex가 있으면 의미 구분되도록 프롬프트에 명시
4. 처리: term+partOfSpeech+homonymIndex 기준 upsert. source/oxfordCefr 저장, cefrLevel은 매핑값.
5. 최적화: p-limit으로 10개 병렬, cli-progress 진행률, 실패 retry 3회(exponential backoff),
   이미 meaning 있으면 스킵(--force), --filter=A1 등 CEFR 필터, --dry-run(처음 5개만 미리보기),
   --retry-failed(meaning 빈 것만 재시도)
6. OPENAI_API_KEY는 .env.local에서 로드(prisma.config.ts가 dotenv 쓰는 방식 참고).
7. package.json:
   "oxford:seed": "tsx scripts/oxford/seed-oxford.ts",
   "oxford:seed:dry": "tsx scripts/oxford/seed-oxford.ts --dry-run",
   "oxford:seed:a1": "tsx scripts/oxford/seed-oxford.ts --filter=A1"
8. 완료 통계: 신규/업데이트/스킵/실패 + CEFR 분포 + 토큰·비용 추정
권장 실행: dry-run → --filter=A1 검증 → 나머지 순차 또는 전체.
주의: 동음이의어/contextNote 케이스가 서로 다른 의미로 생성되는지 샘플 검증.
```

✅ 완료: Word ~5000행, 샘플 20개 난이도 적정, 동음이의어/contextNote 의미 구분 확인.

---

## STEP 4 — 구독 게이트 (학원 단위) + 일일 단어 수 설정값

```
단어학습 접근 권한 + 학원별 하루 단어 수를 처리하는 서버 유틸을 만들어줘.

정책: 학생 소속 학원(Academy)의 구독이 FREE가 아니고 활성(TRIAL/ACTIVE) 상태면 모든 기능 허용.
구독은 유저가 아니라 Academy에 있음(Academy.subscriptionStatus, Subscription.plan).

1. src/lib/words/access-guard.ts (server-only):
   - canUseWordLearning(academyId): Promise<boolean>
     → 해당 학원의 Subscription.plan !== 'FREE' && status in (TRIAL, ACTIVE) 확인
   - assertCanUseWordLearning(academyId): 실패 시 throw (서버액션에서 사용)
   - getWordLearningLimits(academyId): Promise<{ dailyNewWords: number; maxSets: number }>
     → FREE/비활성: { dailyNewWords: 5, maxSets: 0 }
     → 활성: Academy.settingsJson.wordLearning.dailyNewWords (없으면 기본 10),
              maxSets: Number.POSITIVE_INFINITY
   - getAcademyDailyNewWords(academyId): number 헬퍼 (settingsJson 파싱, 기본 10)
2. 클라이언트 훅 src/hooks/use-word-learning-access.ts:
   - { canAccess: boolean, reason: 'FREE_TIER' | 'NO_SUBSCRIPTION' | null }
3. 업그레이드 안내 컴포넌트 src/components/words/upgrade-prompt.tsx:
   - "단어학습은 구독(스타터 이상)에서 사용할 수 있어요" + 구독 설정/문의 CTA
   - 학생은 직접 결제 못 하므로 "학원에 문의" 문구로 처리
주의: 향후 정책 변경은 access-guard.ts만 수정하도록 캡슐화. 한국어 UI, any 금지.
```

✅ 완료: FREE 학원 학생은 업그레이드 안내, 활성 학원 학생은 정상 접근.

---

## STEP 5 — SM-2 SRS

```
SM-2 간격반복을 순수함수로 구현해줘. 기존 src/lib/ai/spaced-repetition.ts의 calculateNextReview와
이름이 겹치지 않게 별도 네임스페이스로 작성.

1. src/lib/words/srs.ts:
   - calculateNextWordReview(progress: { easeFactor; intervalDays; repetitions }, quality: 0~5)
     → { easeFactor; intervalDays; repetitions; nextReviewAt }
   - 로직: quality<3 → repetitions=0, interval=1;
           quality>=3 → rep0:1, rep1:6, else prevInterval*EF
           EF 갱신: EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)), 최소 1.3
           nextReviewAt = now + intervalDays*24h
   - QUALITY 매핑 상수: 플래시"안다"4/"모른다"2, 리콜 정답4/오답1, 스펠 정답5/오답2/힌트3
2. 단위 테스트 src/lib/words/srs.test.ts (vitest):
   - 최소 10케이스: 신규 첫 정답, 연속 정답 interval 증가, 오답 rep 초기화, EF 하한 1.3, 경계값 0~5
   - package.json에 "test": "vitest run" (기존 test 스크립트 없으면 추가)
3. DB 연동 헬퍼 src/lib/words/progress.ts (server-only, src/generated/prisma import):
   - getDueWords(studentId, limit): nextReviewAt <= now 단어 limit개
   - applySrsResult(studentId, wordId, quality): SM-2 계산 후 WordProgress upsert
주의: import는 '@/generated/prisma'. 순수함수와 DB 함수 파일 분리.
```

✅ 완료: `npm test` 통과, 정답 5연속 시 interval 1→6→15→… 증가.

---

## STEP 6 — Server Actions (REST API 아님)

```
단어학습 기능을 REST API가 아니라 Next.js Server Actions로 구현해줘.
(CLAUDE.md: Server Actions 우선, API Routes는 외부 연동만)

위치: src/app/(dashboard)/student/words/_actions/index.ts ("use server")
모든 액션은 requireStudent()로 인증·studentId 확보 후 assertCanUseWordLearning(academyId) 게이트.
zod로 입력 검증. 반환은 { ok: true, data } | { ok: false, error: { code, message } } 통일.

액션 목록:
1. getWordSet(setId) — 세트 정보 + 단어 목록(WordSetItem order순)
2. startWordSet(setId) — 학생 WordProgress 초기화(없는 단어만 생성). 일일 신규 한도(getWordLearningLimits) 적용
3. getFlashcards(setId) — 플래시카드 라운드 단어 목록(한도 내)
4. recordProgress({ wordId, stage, quality, isCorrect, userAnswer? }) — applySrsResult 호출 + correct/wrongCount 갱신
5. getTodayReview() — getDueWords로 오늘 복습 단어(최대 50, 오래된 순)
6. getRecallOptions(wordId) — 정답 + 같은 cefrLevel·partOfSpeech 단어 3개 무작위. 부족하면 인접 레벨 보충
7. checkSpell({ wordId, userAnswer, usedHint }) — src/lib/words/spell-check.ts로 채점

채점 src/lib/words/spell-check.ts:
- normalize: trim, toLowerCase, 공백/특수문자 제거
- 정확 일치 → 정답. 편집거리 1이면 "거의 정답" 옵션(quality 4). 힌트는 quality 3.

보안: 모든 조회/수정은 본인 studentId로 스코프(다른 학생 데이터 접근 불가).
보조로 Supabase RLS 정책 SQL을 supabase/migrations에 추가(WordProgress: student 본인,
Word: 인증 사용자 SELECT, WordSet: isPublic OR ownerId 본인 OR 같은 academy).
주의: import '@/generated/prisma'. revalidatePath 적절히 사용.
```

✅ 완료: 각 액션 정상 동작, 다른 학생 데이터 접근 차단.

---

## STEP 7 — 학생 메뉴 추가 + 단어학습 허브  ← 요청 ①

```
학생 사이드바에 "단어학습" 메뉴를 추가하고 허브 페이지를 만들어줘.

1. src/components/layout/nav-items.ts의 NAV_ITEMS.STUDENT 배열에 항목 추가:
   { label: '단어학습', href: '/student/words', icon: <적절한 lucide 아이콘, 예: Languages 또는 BookA> }
   - 위치: '학습공간' 다음. import에 아이콘 추가.
2. src/app/(dashboard)/student/words/page.tsx (Server Component):
   - requireStudent()로 인증, 소속 academyId 확보
   - useWordLearningAccess 대신 서버에서 canUseWordLearning(academyId) 체크 →
     불가 시 UpgradePrompt 렌더
   - 가능 시: 오늘의 복습 단어 수, 학원 설정 하루 단어 수(getAcademyDailyNewWords),
     추천 세트(현재 레벨 기반 WordSet) 카드 표시
   - CEFR/레벨별 WordSet 목록, 각 세트 진입 → /student/words/[setId]/flashcard
3. 디자인: Vocabulary 퍼플(#7854F7) 계열, rounded-xl border, 기존 student/learn/page.tsx의
   카드 스타일과 톤 일치. 한국어 UI.
주의: 기존 nav 항목/순서 훼손 금지. 새 라우트는 (dashboard) 그룹 안.
```

✅ 완료: 학생 사이드바에 "단어학습" 노출, 허브 진입 정상.

---

## STEP 8 — 학원장 "하루 암기 단어 수" 설정  ← 요청 ②

```
학원장이 학원 전체 학생의 "하루 암기 단어 수"를 설정하는 UI를 추가해줘.
기존 알림 설정(updateNotificationSettings, settingsJson.notifications)과 동일한 패턴으로 구현.

1. 서버액션: src/app/(dashboard)/owner/settings/actions.ts에 함수 추가:
   updateWordLearningSettings({ dailyNewWords: number })
   - 학원장 권한 확인(기존 actions.ts의 인증 헬퍼 재사용)
   - academy.settingsJson을 읽어 기존 값 보존하며 settingsJson.wordLearning.dailyNewWords 갱신
   - dailyNewWords 범위 검증(예: 1~100), revalidatePath('/owner/settings/word-learning')
2. 페이지: src/app/(dashboard)/owner/settings/word-learning/page.tsx
   - 현재 settingsJson.wordLearning.dailyNewWords(기본 10) 로드
   - 클라이언트 컴포넌트 _components/word-learning-client.tsx: 숫자 입력 + 저장 버튼(min-height 44px)
   - 안내문: "학원 전체 학생에게 적용되는 하루 신규 단어 수입니다."
3. 학원장 설정 진입 동선: src/app/(dashboard)/owner/settings 페이지(설정 허브)에
   "단어학습" 설정 카드/링크 추가(기존 notifications 카드와 동일 스타일).
주의: 기존 settingsJson 다른 키(notifications 등) 보존. 한국어 UI, any 금지.
이 값은 STEP 4의 getWordLearningLimits / getAcademyDailyNewWords가 읽는 값과 동일 키.
```

✅ 완료: 학원장이 값 저장 → 학생 단어학습 신규 단어 수에 즉시 반영.

---

## STEP 9 — 플래시카드 UI

```
플래시카드 학습 화면을 만들어줘.
경로: src/app/(dashboard)/student/words/[setId]/flashcard/page.tsx (+ _components 클라이언트)

데이터: 진입 시 STEP 6의 getFlashcards(setId) 서버액션, 응답 기록은 recordProgress 호출.
UI:
- 중앙 큰 카드(3:4), 앞면: 영단어+발음기호+스피커(Web Speech API TTS), 뒷면: 한글뜻+영영풀이+예문
- 탭/Space → framer-motion 플립. 우스와이프/→ "안다"(quality4), 좌스와이프/← "모른다"(quality2)
- 상단 진행바("12 / 30", 네이비 #0C2340), 하단 [모른다][안다] 버튼(56px)
- 라운드 종료: "모른다" 단어만 재학습 옵션 + "리콜 단계로" CTA
- 30단어 prefetch, 키보드 단축키, aria-label, 다크모드 대응
디자인: Vocabulary 퍼플 포인트, shadcn Card, 그라디언트 금지. 한국어 UI.
```

---

## STEP 10 — 리콜(객관식) UI

```
리콜 4지선다 화면을 만들어줘.
경로: src/app/(dashboard)/student/words/[setId]/recall/page.tsx (+ _components)

- 모드: 영→한 / 한→영 / 혼합(진입 시 선택)
- getRecallOptions(wordId)로 보기 4개(무작위 순서)
- 정답: 초록(#1FAF54) 강조 + 다음. 오답: 빨강(#D92916) + 정답표시 + 확인
- recordProgress({ stage:'RECALL', quality: 정답4/오답1, isCorrect })
- 상단 진행바 + 실시간 정답률, 오답 단어 라운드 끝 재출제(최대 2회)
- 정답률 80%+ → "스펠 단계로" CTA, 미만 → "한 번 더"
- 단축키 1~4. 한국어 UI.
```

---

## STEP 11 — 스펠(주관식) UI + 채점

```
스펠 주관식 화면을 만들어줘.
경로: src/app/(dashboard)/student/words/[setId]/spell/page.tsx (+ _components)

- 상단: 한글뜻 (+ 예문 빈칸). 입력창 autoFocus, autoComplete off, autoCapitalize off, inputMode text
- 글자 수 힌트 "○ ○ ○", [힌트](첫글자, quality3), [건너뛰기](오답)
- 채점은 STEP 6 checkSpell 서버액션(src/lib/words/spell-check.ts):
  정확일치 quality5, 편집거리1 "거의맞음" quality4, 그외 오답 quality2
- 정답: 초록 체크 + 발음재생. 오답: 정답 vs 입력 비교(틀린 글자 빨강). 1.5초 후 자동 진행/Enter
- 오답 라운드 끝 재출제. 정답률 90%+ → MASTERED 승격 후보
- recordProgress({ stage:'SPELL', quality, isCorrect, userAnswer })
- 모바일 키보드가 입력창 안 가리게 상단 고정. 한국어 UI.
```

---

## STEP 12 — SRS 복습 큐 + 일일 미션 통합

```
"오늘 복습할 단어" 큐 화면을 기존 일일 미션 시스템과 통합해줘.
경로: src/app/(dashboard)/student/words/review/page.tsx (+ _components)

- getTodayReview() 서버액션으로 복습 단어 로드(최대 50, 오래된 순)
- 혼합 모드: correctCount<3 → 리콜, >=3 → 스펠 (단어별 약한 단계 자동 출제)
- 홈/단어허브 위젯 src/components/words/daily-review-widget.tsx:
  "오늘 복습할 단어 N개" + CTA, 0개면 "오늘 복습 끝! 🎉 새 단어 시작하기"
- 완료 시:
  - STEP 14의 게이미피케이션 이벤트 호출(awardXP/updateStreak)
  - 기존 일일 미션 시스템(src/lib/missions/mission-engine.ts)과 "오늘 활동"으로 연동되도록
    streak-manager.updateStreak(studentId) 호출
- 통계: 오늘 복습 완료 수, 정답률, 누적 마스터 수
주의: 신규 XP/스트릭 시스템 만들지 말고 기존 src/lib/missions/* 함수 호출.
이메일/푸시 알림은 선택(후순위).
```

---

## STEP 13 — 자동 테스트 + 오답 재학습

```
교사 자동 출제 테스트 + 학생 응시 화면을 만들어줘. (학부모 화면 없음 — owner/teacher만)

[교사]
1. src/app/(dashboard)/teacher/words/sets/[setId]/test/new/page.tsx
   - 모드(EN_TO_KO|KO_TO_EN|SPELL|MIXED), 속도(20/12/8/5초), 문항수(기본20),
     합격점수(기본80%), 응시기간, 대상(반/개별)
   - 생성 시 WordTest + 배정 레코드
2. .../test/[testId]/results/page.tsx
   - 응시자 점수/시각, 문항별 정답률, 학생별 오답 단어 → 보충 세트 생성 버튼
[학생]
3. src/app/(dashboard)/student/words/test/[testId]/page.tsx
   - 리콜/스펠 컴포넌트 재사용, 문항당 제한시간(CircularProgress), 제출 자동채점
4. .../test/[testId]/result/page.tsx
   - 점수/합격여부, 문항별 정답·오답, "오답 단어 모아 복습" → SRS 큐 강제 삽입
[채점/재학습]
5. src/lib/words/test-grader.ts — SPELL은 spell-check 재사용, 객관식은 단순비교, WordTest.answers(JSON) 저장
6. 서버액션 retakeWrong(testId) — 오답만 임시 WordSet(source: AI_GENERATED, isPublic:false) 생성 후 학습 이동
주의: 모든 경로 (dashboard) 그룹. 서버액션 사용. 한국어 UI.
```

---

## STEP 14 — 게이미피케이션 연동 (기존 시스템 호출)

```
단어학습 이벤트를 ivy의 기존 XP/스트릭/배지 시스템에 연결해줘. 신규 시스템 생성 금지.
기존: src/lib/missions/xp-manager.ts(awardXP), streak-manager.ts(updateStreak),
      Student.totalXp, StudentXp, Badge, BadgeType enum.

1. src/lib/words/word-events.ts:
   - emitWordEvent(studentId, type, payload?) — 내부에서 awardXP(studentId, amount, source, sourceId?) 호출
   - 타입별 XP: FLASHCARD_COMPLETED +2, RECALL_CORRECT +3, SPELL_CORRECT +5,
     WORD_MASTERED +10, DAILY_REVIEW_COMPLETED +20(+updateStreak), TEST_PASSED +50, PERFECT_SET +100
   - source 문자열은 'WORD_*' 규칙으로(기존 awardXP source 컨벤션 따름)
2. 스트릭: 단어학습도 "오늘 활동"으로 인정 → DAILY_REVIEW_COMPLETED 등에서 updateStreak(studentId) 호출
3. 배지: 기존 BadgeType enum 범위 내에서 부여(예: MISSION_COMPLETE, MASTER). 새 BadgeType가 꼭 필요하면
   먼저 사용자에게 확인(스키마 enum 변경은 마이그레이션 필요).
4. 학습 라운드 종료 화면에 획득 XP 카운터/배지 모달/스트릭 애니메이션(기존 daily-mission UI 톤 재사용).
주의: awardXP/updateStreak 시그니처를 먼저 읽고 정확히 호출. any 금지.
```

---

## STEP 15 — 학습 리포트 (학생/교사/학원장)

```
단어학습 리포트 대시보드를 만들어줘. recharts(이미 설치됨) 사용. 학부모 화면 없음.

[학생] src/app/(dashboard)/student/words/report/page.tsx (또는 단어허브 내 탭)
   - 누적/마스터 단어 수, CEFR 레벨별 진도(1~10 막대), 최근 7일 활동 히트맵,
     약점 단어 TOP10(wrongCount), 다음 추천 세트
[교사] src/app/(dashboard)/teacher/words/page.tsx
   - 우리반 현황 테이블(학생|학습단어|마스터|최근학습|평균정답률), 미응시 테스트,
     반 약점 단어 TOP20, 레벨 승급 후보
[학원장] src/app/(dashboard)/owner/words/page.tsx (또는 analytics 내 섹션)
   - 학원 전체 단어학습 현황 요약, 반별 비교, 활성 학생 수
[데이터] 서버액션으로 제공(REST 아님):
   getStudentWordStats(studentId), getClassWordStats(classId), getWeaknessStats(scope)
   - recharts에 바로 넘길 형태로 반환
주의: 모든 경로 (dashboard) 그룹. 한국어 UI, 색상 규칙 준수. PDF/카톡 리포트는 후순위(선택).
```

---

## 🚀 실행 요약

```bash
# STEP 0
npm install pdf-parse p-limit cli-progress framer-motion && npm install -D vitest
# STEP 1
npx prisma migrate dev --name add_word_learning_module && npx prisma generate
# STEP 2-3
npm run oxford:download && npm run oxford:parse
npm run oxford:seed:dry          # 미리보기(비용 0)
npm run oxford:seed:a1           # A1 검증
npm run oxford:seed              # 전체(~$5-10)
# STEP 5
npm test
# STEP 4,6~15 — 각 STEP 프롬프트 순차 실행
```

## ⚠️ 주의사항
1. **레포 위치**: 모든 작업은 `ivy`에서. 랜딩(`wegoup_website`) 아님.
2. **Server Actions 우선**: API Route는 외부 연동만(CLAUDE.md). STEP 6/15는 서버액션.
3. **Prisma import**: 항상 `@/generated/prisma`.
4. **이름 충돌**: 단어 SRS는 `calculateNextWordReview`(기존 `calculateNextReview`와 분리).
5. **기존 시스템 재사용**: XP/스트릭/미션은 `src/lib/missions/*` 호출, 신규 생성 금지.
6. **구독은 학원 단위**: 학생 게이트는 소속 Academy 구독으로 판정.
7. **학부모 없음**: STEP 15에서 학부모 리포트 제외.
8. **OpenAI 비용**: dry-run + --filter로 단계 검증 후 전체 시드.
9. **마이그레이션 URL**: migrate는 DIRECT_URL(5432) 사용 확인.
