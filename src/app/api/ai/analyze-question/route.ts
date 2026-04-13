import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

interface AnalyzeQuestionRequest {
  questionText: string
  passage?: string
  audioScript?: string
  options?: string[]
  currentDomain?: string
}

interface AIAnalysisResult {
  domain: string
  cefrLevel: string
  difficulty: number
  subCategory: string
  rationale: string
}

const DOMAIN_NAMES: Record<string, string> = {
  GRAMMAR: '문법(Grammar)',
  VOCABULARY: '어휘(Vocabulary)',
  READING: '읽기(Reading)',
  WRITING: '쓰기(Writing)',
  LISTENING: '듣기(Listening)',
}

const VALID_DOMAINS = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING']
const VALID_CEFR = [
  'Pre-A1', 'A1 하', 'A1 상', 'A2 하', 'A2 상',
  'B1 하', 'B1 상', 'B2 하', 'B2 상', 'C1+',
]

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    // 인증 확인 (역할 무관, 로그인만 필요)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json() as AnalyzeQuestionRequest
    const { questionText, passage, audioScript, options, currentDomain } = body

    if (!questionText?.trim()) {
      return NextResponse.json({ error: '문제 텍스트를 입력하세요.' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey })

    // 영역 힌트
    const domainHint = currentDomain
      ? `영역 힌트: ${DOMAIN_NAMES[currentDomain] ?? currentDomain}\n`
      : ''

    // 추가 컨텍스트 블록 조립
    const contextParts: string[] = []
    if (passage?.trim()) {
      contextParts.push(`[지문]\n${passage.trim()}`)
    }
    if (audioScript?.trim()) {
      contextParts.push(`[오디오 스크립트]\n${audioScript.trim()}`)
    }
    if (options && options.some((o) => o.trim())) {
      const filled = options.filter((o) => o.trim())
      contextParts.push(
        `[선택지]\n${filled.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}`,
      )
    }
    const contextBlock = contextParts.length ? `\n\n${contextParts.join('\n\n')}` : ''

    const prompt = `다음 영어 학원 시험 문제를 분석하고 메타데이터를 추천해주세요.
${domainHint}
[문제 본문]
${questionText.trim()}${contextBlock}

위의 문제 본문과 제공된 지문·스크립트·선택지를 종합적으로 분석하여 다음 JSON 형식으로 응답하세요:
{
  "domain": "GRAMMAR|VOCABULARY|READING|WRITING|LISTENING 중 하나",
  "cefrLevel": "Pre-A1|A1 하|A1 상|A2 하|A2 상|B1 하|B1 상|B2 하|B2 상|C1+ 중 하나",
  "difficulty": 1에서 10 사이의 정수,
  "subCategory": "세부 카테고리 한국어로 (예: 시제, 관계사, 주제 파악, 유의어, 대화 이해 등)",
  "rationale": "문제 본문·지문·선택지를 근거로 분석 이유를 한국어로 2~3문장 설명"
}

CEFR 레벨과 난이도 매핑 기준:
Pre-A1→1, A1 하→2, A1 상→3, A2 하→4, A2 상→5, B1 하→6, B1 상→7, B2 하→8, B2 상→9, C1+→10`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const raw = response.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as {
      domain?: string
      cefrLevel?: string
      difficulty?: number
      subCategory?: string
      rationale?: string
    }

    const result: AIAnalysisResult = {
      domain: VALID_DOMAINS.includes(parsed.domain ?? '') ? (parsed.domain as string) : (currentDomain ?? 'GRAMMAR'),
      cefrLevel: VALID_CEFR.includes(parsed.cefrLevel ?? '') ? parsed.cefrLevel! : 'A1 하',
      difficulty: Math.max(1, Math.min(10, Math.round(parsed.difficulty ?? 2))),
      subCategory: parsed.subCategory ?? '',
      rationale: parsed.rationale ?? '',
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[analyze-question] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 },
      )
    }
    return NextResponse.json({ error: 'AI 분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
