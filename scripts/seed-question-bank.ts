/**
 * 공용 문제 뱅크 시드 스크립트
 *
 * OpenAI GPT-4o-mini를 사용해 10단계 × 4영역 문제를 생성합니다.
 *
 * 실행:
 *   npx tsx scripts/seed-question-bank.ts --phase=A   # Grammar Lv1~5
 *   npx tsx scripts/seed-question-bank.ts --phase=B   # Grammar Lv6~10
 *   npx tsx scripts/seed-question-bank.ts --phase=C   # Vocabulary Lv1~5
 *   npx tsx scripts/seed-question-bank.ts --phase=D   # Vocabulary Lv6~10
 *   npx tsx scripts/seed-question-bank.ts --phase=E   # Reading Lv1~5
 *   npx tsx scripts/seed-question-bank.ts --phase=F   # Reading Lv6~10
 *   npx tsx scripts/seed-question-bank.ts --phase=G   # Writing Lv1~10
 *   npx tsx scripts/seed-question-bank.ts --phase=all # 전체 실행
 *
 * 옵션:
 *   --dry-run   DB 저장 없이 생성 결과만 출력
 *   --skip-existing  이미 해당 domain+difficulty 문제가 있으면 건너뜀
 */

import { config } from "dotenv";
// .env → .env.local 순으로 로드 (.env.local이 우선)
config({ path: ".env" });
config({ path: ".env.local", override: true });
import OpenAI from "openai";
import { PrismaClient, QuestionDomain } from "../src/generated/prisma";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── CEFR 매핑 ──────────────────────────────────────────────────────────────────

const LEVEL_TO_CEFR: Record<number, string> = {
  1: "Pre-A1",
  2: "A1 하",
  3: "A1 상",
  4: "A2 하",
  5: "A2 상",
  6: "B1 하",
  7: "B1 상",
  8: "B2 하",
  9: "B2 상",
  10: "C1+",
};

// ── 영역별 하위 카테고리 ────────────────────────────────────────────────────────

const GRAMMAR_SUB: Record<number, string[]> = {
  1: ["be동사", "I am/You are", "기본 주어-동사 구조"],
  2: ["현재시제 3인칭 단수", "명사 복수형", "관사 a/an 기초"],
  3: ["규칙/불규칙 과거시제", "Yes/No 의문문", "부정문 don't/doesn't"],
  4: ["현재진행형 be+V-ing", "전치사 in/on/at", "관사 the 용법"],
  5: ["비교급 -er/more", "최상급 -est/most", "there is/are", "접속사 and/but/because/so"],
  6: ["현재완료 have+p.p.", "수동태 be+p.p.", "to부정사 용법", "동명사 vs 부정사"],
  7: ["관계대명사 who/which/that", "조건문 1형 If+현재", "간접의문문", "사역동사 make/let/have"],
  8: ["가정법 과거 If+과거동사", "분사구문", "사역동사 심화", "지각동사"],
  9: ["도치구문", "강조구문 It is...that", "혼합가정법", "부정어 도치"],
  10: ["고급 가정법/도치 통합", "미묘한 시제 차이", "학술적 수동 구문", "고급 관계사절"],
};

const VOCABULARY_SUB: Record<number, string[]> = {
  1: ["색깔", "숫자", "가족 호칭", "기본 인사"],
  2: ["음식 이름", "동물", "학교 용품", "일상 동사"],
  3: ["날씨 표현", "직업", "취미", "기초 형용사"],
  4: ["쇼핑 관련", "교통 수단", "건강/신체", "감정 표현"],
  5: ["동의어/반의어 기초", "문맥 단어 추론", "구동사 기초 (get up/look at)"],
  6: ["학교/학업 어휘", "구동사 심화 (give up/put off)", "기초 숙어"],
  7: ["추상 명사", "관용구 (idioms)", "연어 collocations"],
  8: ["학술 어휘 AWL", "접두사/접미사 활용", "뉘앙스 구분 (similar words)"],
  9: ["고급 관용구", "전문 어휘 (법률/의학/경제)", "문체별 어휘 (formal/informal)"],
  10: ["학술 논문 어휘", "미묘한 의미 차이", "네이티브 표현/구어체"],
};

const READING_SUB: Record<number, { topic: string; length: string; skills: string[] }> = {
  1: { topic: "2~3문장 짧은 글", length: "15~25단어", skills: ["사실 확인", "인물/장소 파악"] },
  2: { topic: "3~4문장 짧은 글", length: "25~40단어", skills: ["사실 확인", "세부 정보 찾기"] },
  3: { topic: "짧은 단락", length: "50단어 내외", skills: ["주제 파악", "핵심 정보 찾기"] },
  4: { topic: "짧은 단락", length: "50~70단어", skills: ["주제 파악", "중심 내용 이해"] },
  5: { topic: "중간 길이 지문", length: "80~100단어", skills: ["추론", "요약"] },
  6: { topic: "중간 길이 지문", length: "80~100단어", skills: ["추론", "요약", "의도 파악"] },
  7: { topic: "긴 지문", length: "120~150단어", skills: ["비판적 읽기", "구조 분석"] },
  8: { topic: "긴 지문", length: "120~150단어", skills: ["비판적 읽기", "필자 관점", "구조 분석"] },
  9: { topic: "학술/논설 지문", length: "180~220단어", skills: ["논증 분석", "관점 비교"] },
  10: { topic: "학술/논설 지문", length: "200~250단어", skills: ["논증 분석", "관점 비교", "전제 파악"] },
};

const WRITING_SUB: Record<number, { type: string; length: string }> = {
  1: { type: "단어 완성 또는 짧은 문장 완성", length: "단어 1~5개" },
  2: { type: "짧은 문장 쓰기", length: "5~10단어" },
  3: { type: "2~3문장 쓰기", length: "20~35단어" },
  4: { type: "짧은 문단 쓰기", length: "30~50단어" },
  5: { type: "짧은 단락 쓰기", length: "50~80단어" },
  6: { type: "단락 쓰기 (주제문+뒷받침)", length: "60~80단어" },
  7: { type: "짧은 에세이 쓰기", length: "80~120단어" },
  8: { type: "에세이 쓰기 (서론-본론-결론)", length: "100~150단어" },
  9: { type: "논술 쓰기", length: "150~200단어" },
  10: { type: "고급 논술 쓰기", length: "200~250단어" },
};

// ── 타입 정의 ──────────────────────────────────────────────────────────────────

interface GeneratedQuestion {
  type: string;
  domain: string;
  subCategory: string;
  difficulty: number;
  cefrLevel: string;
  contentJson: Record<string, unknown>;
}

interface PhaseConfig {
  label: string;
  tasks: Array<{
    domain: QuestionDomain;
    level: number;
    count: number; // 총 문제 수
    batchSize: number; // 한 API 호출당 문제 수
  }>;
}

// ── Phase 정의 ─────────────────────────────────────────────────────────────────

function buildPhases(): Record<string, PhaseConfig> {
  const grammarTasks = (levels: number[]) =>
    levels.map((lv) => ({ domain: "GRAMMAR" as QuestionDomain, level: lv, count: 15, batchSize: 5 }));

  const vocabTasks = (levels: number[]) =>
    levels.map((lv) => ({ domain: "VOCABULARY" as QuestionDomain, level: lv, count: 15, batchSize: 5 }));

  const readingTasks = (levels: number[]) =>
    levels.map((lv) => ({ domain: "READING" as QuestionDomain, level: lv, count: 10, batchSize: 5 }));

  const writingTasks = (levels: number[]) =>
    levels.map((lv) => ({ domain: "WRITING" as QuestionDomain, level: lv, count: 5, batchSize: 5 }));

  return {
    A: { label: "Grammar Lv1~5", tasks: grammarTasks([1, 2, 3, 4, 5]) },
    B: { label: "Grammar Lv6~10", tasks: grammarTasks([6, 7, 8, 9, 10]) },
    C: { label: "Vocabulary Lv1~5", tasks: vocabTasks([1, 2, 3, 4, 5]) },
    D: { label: "Vocabulary Lv6~10", tasks: vocabTasks([6, 7, 8, 9, 10]) },
    E: { label: "Reading Lv1~5", tasks: readingTasks([1, 2, 3, 4, 5]) },
    F: { label: "Reading Lv6~10", tasks: readingTasks([6, 7, 8, 9, 10]) },
    G: { label: "Writing Lv1~10", tasks: writingTasks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) },
  };
}

// ── 프롬프트 빌더 ──────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `너는 한국 영어학원 학생을 위한 영어 문제 출제 전문가야.
CEFR 기준에 맞는 정확한 난이도의 문제를 만들어.
한국 학생들이 자주 틀리는 포인트를 반영해.
반드시 JSON 배열로만 응답해. 다른 텍스트는 절대 포함하지 마.`;
}

function buildGrammarPrompt(level: number, batchIndex: number): string {
  const cefr = LEVEL_TO_CEFR[level];
  const subs = GRAMMAR_SUB[level];
  const subList = subs.join(", ");
  const questionTypes = level <= 3 ? "multiple_choice" : "multiple_choice, fill_in_blank";

  return `아래 조건에 맞는 영어 문법 문제 5개를 만들어줘.

영역: Grammar (문법)
난이도: Level ${level} / 10
CEFR: ${cefr}
하위 카테고리: ${subList}
이번 배치: ${batchIndex + 1}번째 (같은 하위 카테고리 반복 최소화)
문제 유형: ${questionTypes}

조건:
1. 각 문제는 서로 다른 하위 카테고리에서 출제
2. 한국 학생(초등~고등)이 풀기에 적합한 내용
3. 선택지(객관식)는 4개, 오답도 학생이 실수할 만한 것으로
4. 해설은 한국어로, 왜 정답인지 + 오답인 이유 포함
5. fill_in_blank 유형: 빈칸이 있는 문장, 정답은 단어/구

JSON 배열 형식 (다른 텍스트 없이 배열만):
[
  {
    "type": "multiple_choice",
    "domain": "GRAMMAR",
    "subCategory": "하위카테고리명",
    "difficulty": ${level},
    "cefrLevel": "${cefr}",
    "contentJson": {
      "type": "multiple_choice",
      "question_text": "영어 문제 본문",
      "question_text_ko": "한국어 번역 또는 힌트",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "A",
      "explanation": "한국어 해설: 정답 이유 + 오답 이유"
    }
  }
]`;
}

function buildVocabularyPrompt(level: number, batchIndex: number): string {
  const cefr = LEVEL_TO_CEFR[level];
  const subs = VOCABULARY_SUB[level];
  const subList = subs.join(", ");

  return `아래 조건에 맞는 영어 어휘 문제 5개를 만들어줘.

영역: Vocabulary (어휘)
난이도: Level ${level} / 10
CEFR: ${cefr}
하위 카테고리: ${subList}
이번 배치: ${batchIndex + 1}번째 (같은 하위 카테고리 반복 최소화)
문제 유형: multiple_choice, fill_in_blank 중 다양하게

조건:
1. 각 문제는 서로 다른 하위 카테고리에서 출제
2. 한국 학생(초등~고등)이 풀기에 적합한 내용
3. 선택지(객관식)는 4개, 오답은 실제로 혼동하기 쉬운 단어로
4. 해설은 한국어로, 단어 뜻 + 예문 + 오답 이유 포함
5. 고급(Lv7+): 문맥 속에서 의미를 묻는 형태

JSON 배열 형식 (다른 텍스트 없이 배열만):
[
  {
    "type": "multiple_choice",
    "domain": "VOCABULARY",
    "subCategory": "하위카테고리명",
    "difficulty": ${level},
    "cefrLevel": "${cefr}",
    "contentJson": {
      "type": "multiple_choice",
      "question_text": "영어 문제 본문",
      "question_text_ko": "한국어 번역 또는 힌트",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "B",
      "explanation": "한국어 해설: 단어 뜻 + 오답 이유"
    }
  }
]`;
}

function buildReadingPrompt(level: number, batchIndex: number): string {
  const cefr = LEVEL_TO_CEFR[level];
  const info = READING_SUB[level];
  const passageCount = batchIndex === 0 ? "지문 2개 (지문당 2~3문제)" : "지문 2개 (지문당 2~3문제)";

  return `아래 조건에 맞는 영어 읽기 문제 5개를 만들어줘.

영역: Reading (읽기)
난이도: Level ${level} / 10
CEFR: ${cefr}
지문 유형: ${info.topic} (${info.length})
읽기 스킬: ${info.skills.join(", ")}
구성: ${passageCount}, 이번 배치: ${batchIndex + 1}번째

조건:
1. 지문은 해당 레벨 어휘/문장 길이 엄수
2. 각 지문 뒤에 2~3개 문제 (사실, 추론, 어휘 유형 혼합)
3. 선택지 4개, 오답은 지문과 관련 있지만 틀린 내용
4. 해설은 한국어로, 지문의 어느 부분에서 답을 찾는지 설명
5. 지문 주제: 한국 학생 관심사 (학교, 여행, 음식, 환경, 기술 등)

JSON 배열 형식 (다른 텍스트 없이 배열만):
[
  {
    "type": "reading_comprehension",
    "domain": "READING",
    "subCategory": "${info.topic}",
    "difficulty": ${level},
    "cefrLevel": "${cefr}",
    "contentJson": {
      "type": "reading_comprehension",
      "passage": "영어 지문 전체 텍스트",
      "question_text": "문제 (지문 기반)",
      "question_text_ko": "한국어 번역",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "C",
      "explanation": "한국어 해설: 지문 근거 + 오답 이유"
    }
  }
]`;
}

function buildWritingPrompt(level: number): string {
  const cefr = LEVEL_TO_CEFR[level];
  const info = WRITING_SUB[level];

  return `아래 조건에 맞는 영어 쓰기 과제 5개를 만들어줘.

영역: Writing (쓰기)
난이도: Level ${level} / 10
CEFR: ${cefr}
쓰기 유형: ${info.type}
목표 분량: ${info.length}

조건:
1. 과제는 서로 다른 주제로 (일상, 학교, 여행, 의견, 묘사 등)
2. 한국 학생에게 친숙하고 쓸 말이 있는 주제
3. 채점 기준(rubric)을 한국어로 포함 (문법/어휘/내용/구성)
4. 예시 답안(model_answer)을 영어로 포함
5. 예시 답안은 해당 레벨의 자연스러운 수준으로 (너무 완벽하지 않게)

JSON 배열 형식 (다른 텍스트 없이 배열만):
[
  {
    "type": "writing_prompt",
    "domain": "WRITING",
    "subCategory": "${info.type}",
    "difficulty": ${level},
    "cefrLevel": "${cefr}",
    "contentJson": {
      "type": "writing_prompt",
      "question_text": "영어 쓰기 과제 지시문",
      "question_text_ko": "한국어 번역",
      "target_length": "${info.length}",
      "rubric": {
        "grammar": "문법 채점 기준 (한국어)",
        "vocabulary": "어휘 채점 기준 (한국어)",
        "content": "내용 채점 기준 (한국어)",
        "organization": "구성 채점 기준 (한국어)"
      },
      "model_answer": "예시 답안 (영어)",
      "keywords": ["관련 키워드1", "키워드2"]
    }
  }
]`;
}

// ── OpenAI 호출 (재시도 포함) ──────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  retryCount = 0
): Promise<GeneratedQuestion[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "";

    // JSON 파싱 — response_format: json_object 는 항상 객체를 반환하므로
    // 배열이 최상위인 경우 wrapping 처리
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`JSON 파싱 실패: ${raw.slice(0, 200)}`);
    }

    // 배열 추출 (최상위가 배열이거나 { questions: [...] } 형태 모두 처리)
    let questions: unknown[];
    if (Array.isArray(parsed)) {
      questions = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
      if (arrayKey) {
        questions = obj[arrayKey] as unknown[];
      } else {
        throw new Error(`배열을 찾을 수 없음: ${JSON.stringify(parsed).slice(0, 200)}`);
      }
    } else {
      throw new Error(`예상치 못한 응답 형태: ${raw.slice(0, 200)}`);
    }

    return questions as GeneratedQuestion[];
  } catch (err) {
    const error = err as Error & { status?: number };

    // Rate limit (429) → 30초 대기
    if (error.status === 429 || (error.message && error.message.includes("rate_limit"))) {
      console.log("  ⚠️  Rate limit 도달. 30초 대기...");
      await sleep(30000);
      if (retryCount < 3) return callOpenAI(systemPrompt, userPrompt, retryCount + 1);
    }

    // JSON 파싱 오류 또는 기타 → 최대 3회 재시도
    if (retryCount < 3) {
      console.log(`  ⚠️  재시도 ${retryCount + 1}/3: ${error.message}`);
      await sleep(2000);
      return callOpenAI(systemPrompt, userPrompt, retryCount + 1);
    }

    console.error(`  ❌ 최대 재시도 초과: ${error.message}`);
    return [];
  }
}

// ── DB 저장 ────────────────────────────────────────────────────────────────────

async function saveQuestions(
  questions: GeneratedQuestion[],
  dryRun: boolean
): Promise<number> {
  if (dryRun) {
    questions.forEach((q, i) => {
      console.log(`  [DRY-RUN] ${i + 1}. ${q.domain} Lv${q.difficulty} - ${q.subCategory}`);
    });
    return questions.length;
  }

  let saved = 0;
  for (const q of questions) {
    try {
      await prisma.question.create({
        data: {
          academyId: null,
          domain: q.domain as QuestionDomain,
          subCategory: q.subCategory,
          difficulty: q.difficulty,
          cefrLevel: q.cefrLevel,
          contentJson: q.contentJson as Parameters<typeof prisma.question.create>[0]["data"]["contentJson"],
          source: "SYSTEM",
          isVerified: true,
          isActive: true,
          qualityScore: 0.7,
        },
      });
      saved++;
    } catch (err) {
      console.error(`  ❌ 저장 실패 (${q.domain} Lv${q.difficulty}):`, (err as Error).message);
    }
  }
  return saved;
}

// ── 통계 업데이트 ──────────────────────────────────────────────────────────────

async function updateQuestionBankStats(): Promise<void> {
  console.log("\n📊 question_bank_stats 업데이트 중...");

  const domains = ["GRAMMAR", "VOCABULARY", "READING", "WRITING"] as const;
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for (const domain of domains) {
    for (const difficulty of levels) {
      const [total, verified, qualityAgg] = await Promise.all([
        prisma.question.count({
          where: { domain, difficulty, isActive: true },
        }),
        prisma.question.count({
          where: { domain, difficulty, isActive: true, isVerified: true },
        }),
        prisma.question.aggregate({
          where: { domain, difficulty, isActive: true, qualityScore: { not: null } },
          _avg: { qualityScore: true },
        }),
      ]);

      await prisma.questionBankStats.upsert({
        where: { domain_difficulty: { domain, difficulty } },
        create: {
          domain,
          difficulty,
          totalCount: total,
          verifiedCount: verified,
          avgQualityScore: qualityAgg._avg.qualityScore,
          lastUpdatedAt: new Date(),
        },
        update: {
          totalCount: total,
          verifiedCount: verified,
          avgQualityScore: qualityAgg._avg.qualityScore,
          lastUpdatedAt: new Date(),
        },
      });
    }
  }

  console.log("✅ 통계 업데이트 완료\n");
}

// ── 진행률 출력 ────────────────────────────────────────────────────────────────

function progress(phaseLabel: string, current: number, total: number): void {
  const pct = Math.round((current / total) * 100);
  const bar = "█".repeat(Math.floor(pct / 5)) + "░".repeat(20 - Math.floor(pct / 5));
  process.stdout.write(`\r  [${bar}] ${current}/${total} (${pct}%)`);
  if (current === total) process.stdout.write("\n");
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Phase 실행 ─────────────────────────────────────────────────────────────────

async function runPhase(
  phaseKey: string,
  config: PhaseConfig,
  dryRun: boolean,
  skipExisting: boolean
): Promise<void> {
  const totalQuestions = config.tasks.reduce((s, t) => s + t.count, 0);
  let totalSaved = 0;
  let totalGenerated = 0;

  console.log(`\n${"═".repeat(60)}`);
  console.log(`[Phase ${phaseKey}] ${config.label} — 목표: ${totalQuestions}문제`);
  console.log("═".repeat(60));

  for (const task of config.tasks) {
    const { domain, level, count, batchSize } = task;
    const cefr = LEVEL_TO_CEFR[level];
    const batches = Math.ceil(count / batchSize);

    console.log(`\n▶ ${domain} Level ${level} (${cefr}) — ${count}문제`);

    // skipExisting: 이미 충분한 문제가 있으면 건너뜀
    if (skipExisting) {
      const existing = await prisma.question.count({
        where: { domain: domain as QuestionDomain, difficulty: level, academyId: null, isActive: true },
      });
      if (existing >= count) {
        console.log(`  ⏭️  이미 ${existing}개 존재 — 건너뜀`);
        totalSaved += existing;
        totalGenerated += existing;
        progress(`Phase ${phaseKey}`, totalGenerated, totalQuestions);
        continue;
      }
    }

    let levelSaved = 0;

    for (let b = 0; b < batches; b++) {
      const systemPrompt = buildSystemPrompt();
      let userPrompt: string;

      if (domain === "GRAMMAR") userPrompt = buildGrammarPrompt(level, b);
      else if (domain === "VOCABULARY") userPrompt = buildVocabularyPrompt(level, b);
      else if (domain === "READING") userPrompt = buildReadingPrompt(level, b);
      else userPrompt = buildWritingPrompt(level);

      const questions = await callOpenAI(systemPrompt, userPrompt);

      if (questions.length === 0) {
        console.log(`\n  ⚠️  배치 ${b + 1}/${batches} 생성 실패 (0개)`);
        continue;
      }

      // domain/difficulty 강제 설정 (AI가 다르게 쓸 수 있음)
      const normalized = questions.map((q) => ({
        ...q,
        domain,
        difficulty: level,
        cefrLevel: cefr,
      }));

      const saved = await saveQuestions(normalized, dryRun);
      levelSaved += saved;
      totalSaved += saved;
      totalGenerated += questions.length;

      progress(`Phase ${phaseKey}`, totalGenerated, totalQuestions);

      // API 요청 간 짧은 딜레이 (rate limit 예방)
      if (b < batches - 1) await sleep(1000);
    }

    console.log(`  ✅ ${domain} Lv${level}: ${levelSaved}문제 저장`);
  }

  console.log(`\n[Phase ${phaseKey}] 완료! ${config.label}: ${totalSaved}문제 저장\n`);
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const phaseArg = args.find((a) => a.startsWith("--phase="))?.split("=")[1]?.toUpperCase() ?? "all";
  const dryRun = args.includes("--dry-run");
  const skipExisting = args.includes("--skip-existing");

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
    process.exit(1);
  }

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       공용 문제 뱅크 시드 스크립트 (IVY LMS)            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`실행 모드: Phase=${phaseArg}${dryRun ? " [DRY-RUN]" : ""}${skipExisting ? " [SKIP-EXISTING]" : ""}`);
  console.log(`시작 시각: ${new Date().toLocaleString("ko-KR")}\n`);

  const allPhases = buildPhases();
  const failedPhases: string[] = [];

  let phasesToRun: Array<[string, PhaseConfig]>;
  if (phaseArg === "ALL") {
    phasesToRun = Object.entries(allPhases);
  } else {
    if (!allPhases[phaseArg]) {
      console.error(`❌ 알 수 없는 Phase: ${phaseArg}`);
      console.error("   가능한 값: A, B, C, D, E, F, G, all");
      process.exit(1);
    }
    phasesToRun = [[phaseArg, allPhases[phaseArg]]];
  }

  const startTime = Date.now();

  for (const [key, config] of phasesToRun) {
    try {
      await runPhase(key, config, dryRun, skipExisting);
    } catch (err) {
      console.error(`\n❌ Phase ${key} 실패:`, (err as Error).message);
      failedPhases.push(key);
    }
  }

  // 전체 실행 완료 후 통계 업데이트 (dry-run 제외)
  if (!dryRun && phasesToRun.length > 0) {
    await updateQuestionBankStats();
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                    시드 완료                            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`소요 시간: ${minutes}분 ${seconds}초`);

  if (failedPhases.length > 0) {
    console.log(`\n⚠️  실패한 Phase: ${failedPhases.join(", ")}`);
    console.log("   다시 실행하여 누락된 Phase를 재생성하세요.");
    console.log(`   예) npx tsx scripts/seed-question-bank.ts --phase=${failedPhases[0]}`);
  }

  // 최종 통계 출력
  if (!dryRun) {
    console.log("\n📊 최종 문제 뱅크 현황:");
    const stats = await prisma.questionBankStats.findMany({
      orderBy: [{ domain: "asc" }, { difficulty: "asc" }],
    });

    const grouped: Record<string, typeof stats> = {};
    for (const s of stats) {
      if (!grouped[s.domain]) grouped[s.domain] = [];
      grouped[s.domain].push(s);
    }

    for (const [domain, rows] of Object.entries(grouped)) {
      const total = rows.reduce((s, r) => s + r.totalCount, 0);
      console.log(`\n  ${domain} — 총 ${total}문제`);
      for (const r of rows) {
        const bar = "▓".repeat(Math.min(r.totalCount, 20));
        console.log(`    Lv${r.difficulty.toString().padStart(2)} (${LEVEL_TO_CEFR[r.difficulty]}): ${r.totalCount.toString().padStart(3)}문제  ${bar}`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error("\n치명적 오류:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
