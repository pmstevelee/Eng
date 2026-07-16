import OpenAI from 'openai'

export type WordEnrichmentInput = {
  term: string
  partOfSpeech: string
  oxfordCefr: string
  contextNote?: string
  homonymIndex?: number
}

export type WordEnrichmentOutput = {
  meaning: string    // 한글, 콤마 구분 최대 3개
  definition: string // 영영 1문장
  example: string    // 예문 1문장
}

export type WordEnrichmentResult = WordEnrichmentOutput & {
  tokensUsed: number
}

function buildPrompt(input: WordEnrichmentInput): string {
  const { term, partOfSpeech, oxfordCefr, contextNote, homonymIndex } = input

  let disambiguation = ''
  if (contextNote && homonymIndex !== undefined) {
    disambiguation = `This is homonym #${homonymIndex} of "${term}", specifically in the context of "${contextNote}". Ensure the meaning, definition, and example all reflect THIS specific sense, not other meanings.`
  } else if (contextNote) {
    disambiguation = `Focus on the "${contextNote}" sense of this word. Do not describe other unrelated meanings.`
  } else if (homonymIndex !== undefined) {
    disambiguation = `This is meaning #${homonymIndex} of "${term}" as a ${partOfSpeech}. Provide the appropriate distinct meaning.`
  }

  return `You are an EFL vocabulary expert creating dictionary entries for Korean English learners.

Word: "${term}" (${partOfSpeech}, Oxford CEFR: ${oxfordCefr})
${disambiguation}

Return a JSON object with exactly these fields:
- "meaning": Korean translation(s), comma-separated, maximum 3 meanings (e.g., "가다, 이동하다, 진행하다")
- "definition": One clear English definition sentence suitable for ${oxfordCefr} level learners
- "example": One natural English example sentence showing the word in context

Rules:
- meaning: Korean only, concise, up to 3 items separated by commas
- definition: Start with the part of speech context implicitly. No more than 20 words.
- example: Natural, level-appropriate sentence (${oxfordCefr} level vocabulary overall)`
}

export async function enrichWord(input: WordEnrichmentInput): Promise<WordEnrichmentResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.')

  const openai = new OpenAI({ apiKey })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
    temperature: 0.3,
    max_tokens: 300,
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('OpenAI 응답이 비어 있습니다.')

  const parsed = JSON.parse(raw) as Partial<WordEnrichmentOutput>

  if (!parsed.meaning || !parsed.definition || !parsed.example) {
    throw new Error(`OpenAI 응답 필드 누락: ${JSON.stringify(parsed)}`)
  }

  return {
    meaning: parsed.meaning.trim(),
    definition: parsed.definition.trim(),
    example: parsed.example.trim(),
    tokensUsed: response.usage?.total_tokens ?? 0,
  }
}
