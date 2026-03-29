import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

interface GenerateSimilarRequest {
  domain: string
  difficulty: number
  cefrLevel: string
  contentJson: {
    type: string
    question_text: string
    options?: string[]
    correct_answer?: string
    passage?: string
    audio_script?: string
  }
  count?: number
}

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json() as GenerateSimilarRequest
    const { domain, difficulty, cefrLevel, contentJson, count = 3 } = body

    if (!domain || !cefrLevel || !contentJson) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 })
    }

    const clampedCount = Math.min(Math.max(count, 1), 5)

    const domainNames: Record<string, string> = {
      GRAMMAR: '문법(Grammar)',
      VOCABULARY: '어휘(Vocabulary)',
      READING: '읽기(Reading)',
      WRITING: '쓰기(Writing)',
      LISTENING: '듣기(Listening)',
    }

    const typeNames: Record<string, string> = {
      multiple_choice: '4지선다 객관식',
      fill_blank: '빈칸 채우기',
      short_answer: '단답형',
      essay: '서술형',
    }

    const originalQuestion = JSON.stringify({
      type: contentJson.type,
      question: contentJson.question_text,
      options: contentJson.options,
      correct_answer: contentJson.correct_answer,
      passage: contentJson.passage,
      audio_script: contentJson.audio_script,
    }, null, 2)

    const systemPrompt = `당신은 영어 시험 문제 출제 전문가입니다. 기존 문제와 유사하지만 다른 내용의 문제를 JSON 형식으로 생성해야 합니다.

반환할 JSON 구조:
{
  "questions": [
    {
      "subCategory": "세부 카테고리",
      "question_text": "문제 내용 (영어)",
      "options": ["선택지A", "선택지B", "선택지C", "선택지D"],
      "correct_answer": "A",
      "explanation": "해설 (한국어, 2~3문장)"
    }
  ]
}

규칙:
- 기존 문제와 같은 영역, 난이도, CEFR 레벨로 생성
- 기존 문제와 유사한 문법 포인트/어휘 범위/독해 스킬을 다루되 다른 내용으로 생성
- 객관식인 경우 options 배열에 4개 선택지, correct_answer에 정답 레이블(A/B/C/D)
- 빈칸/단답형인 경우 options는 빈 배열, correct_answer에 정답
- 반드시 유효한 JSON만 반환하세요`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `다음 문제와 유사한 ${clampedCount}개의 새 문제를 생성해주세요.

원본 문제:
영역: ${domainNames[domain] ?? domain}
난이도: ${difficulty}/5
CEFR 레벨: ${cefrLevel}
문제 유형: ${typeNames[contentJson.type] ?? contentJson.type}

${originalQuestion}`,
        },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    })

    const rawContent = completion.choices[0].message.content
    if (!rawContent) {
      return NextResponse.json({ error: 'AI 응답을 받지 못했습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(rawContent) as {
      questions: {
        subCategory?: string
        question_text: string
        options?: string[]
        correct_answer?: string
        explanation?: string
      }[]
    }

    const questions = parsed.questions.map((q) => ({
      domain,
      subCategory: q.subCategory,
      difficulty,
      cefrLevel,
      contentJson: {
        type: contentJson.type,
        question_text: q.question_text,
        options: q.options && q.options.length > 0 ? q.options : undefined,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
      },
    }))

    return NextResponse.json({ success: true, questions })
  } catch (error) {
    console.error('[generate-similar] error:', error)
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API 오류: ${error.message}` },
        { status: error.status ?? 500 },
      )
    }
    return NextResponse.json({ error: 'AI 유사문제 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
