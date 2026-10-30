// 발음 검수용 받아쓰기 — OpenAI Whisper API (whisper-1)
// 원문을 prompt로 넘기면 받아쓰기가 원문 쪽으로 끌려가 검수가 무의미해지므로 넘기지 않는다.
// 영어는 단어 타임스탬프도 받는다 (타임스탬프를 주지 않는 TTS 공급자의 단어 하이라이트용).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Lang } from '../../src/lib/lecture-pipeline/types'
import type { TimedWord } from '../../src/lib/lecture-pipeline/timing'

export interface Transcript {
  text: string
  words?: TimedWord[]
}

export async function transcribe(file: string, lang: Lang): Promise<Transcript> {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) throw new Error('OPENAI_API_KEY가 없어 발음 검수를 할 수 없어요. (검수를 건너뛰려면 --skip-qa)')
  const model = process.env.LECTURE_STT_MODEL?.trim() || 'whisper-1'
  let lastError = ''
  for (let attempt = 1; attempt <= 3; attempt++) {
    const form = new FormData()
    form.append('file', new Blob([readFileSync(file)], { type: 'audio/wav' }), path.basename(file))
    form.append('model', model)
    form.append('language', lang)
    form.append('response_format', 'verbose_json')
    if (lang === 'en') form.append('timestamp_granularities[]', 'word')
    form.append('temperature', '0')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    }).catch((e: unknown) => {
      lastError = e instanceof Error ? e.message : String(e)
      return null
    })
    if (res?.ok) {
      const json = (await res.json()) as { text?: string; words?: { word: string; start: number; end: number }[] }
      return {
        text: (json.text ?? '').trim(),
        ...(json.words?.length ? { words: json.words.map((w) => ({ text: w.word, startMs: Math.round(w.start * 1000), endMs: Math.round(w.end * 1000) })) } : {}),
      }
    }
    if (res) {
      lastError = `${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`
      if (res.status === 401 || res.status === 400) break
    }
    await new Promise((r) => setTimeout(r, attempt * 1500))
  }
  throw new Error(`Whisper 받아쓰기 실패: ${lastError}`)
}
