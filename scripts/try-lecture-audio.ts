/**
 * scripts/try-lecture-audio.ts
 * AI 강의 음성(2-5-3) 실제 호출 확인용 — 수동태 픽스처로 만든 확인용 스크립트 1개에서 장면 음성을 만든다.
 * ⚠ 실제 ElevenLabs 키로 호출하고(글자 수 과금) 운영 DB·Storage에 쓴다. 관리자 확인 후에만 실행.
 *
 *   npx tsx scripts/try-lecture-audio.ts --voices                     목소리 목록만 (과금 없음)
 *   npx tsx scripts/try-lecture-audio.ts --scene quiz                 장면 1개 음성 생성 (바뀐 세그먼트만)
 *   npx tsx scripts/try-lecture-audio.ts --scene quiz --edit          그 장면 첫 문장을 고친 뒤 생성 (그 문장만 호출돼야 함)
 *   npx tsx scripts/try-lecture-audio.ts --cleanup                    확인용 스크립트와 음성 파일 삭제
 *   옵션: --point <포인트 코드> (기본: 제목에 '수동태'가 들어간 첫 포인트)
 */

import * as dotenv from 'dotenv'
import { PrismaClient, type Prisma } from '../src/generated/prisma'
import sample from '../src/lib/grammar/video/samples/passive-voice.json'
import { parseVideoScenes, type VideoScene } from '../src/types/grammar-video'
import { listVoices, resolveAudioVoices, synthesizeSegment } from '../src/lib/grammar/elevenlabs'
import { isSpokenSegment, planScriptAudio, referencedAudioPaths } from '../src/lib/grammar/video/audio-plan'
import { applySceneAudio, generateSceneAudioFiles } from '../src/lib/grammar/video/scene-audio'
import { buildTimeline } from '../src/lib/grammar/video/timeline'
import { removeLectureAudio, uploadLectureAudio, LECTURE_AUDIO_BUCKET } from '../src/lib/grammar/lecture-audio-storage'

dotenv.config({ path: '.env.local' })
dotenv.config()

const TEST_TITLE = '[음성 확인] 수동태 픽스처'
const prisma = new PrismaClient()

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}
const has = (name: string) => process.argv.includes(name)

async function findPoint() {
  const code = arg('--point')
  const point = code
    ? await prisma.grammarPoint.findUnique({ where: { code }, select: { id: true, code: true, title: true } })
    : await prisma.grammarPoint.findFirst({ where: { title: { contains: '수동태' } }, orderBy: { code: 'asc' }, select: { id: true, code: true, title: true } })
  if (!point) throw new Error('포인트를 찾을 수 없습니다. --point 코드를 넣어 주세요.')
  return point
}

async function main() {
  if (has('--voices')) {
    const voices = await listVoices()
    for (const v of voices) console.log(`${v.voiceId}  ${v.name}  [${v.category ?? '-'}] ${Object.values(v.labels).join(', ')}`)
    console.log(`목소리 ${voices.length}개`)
    return
  }

  if (has('--cleanup')) {
    const scripts = await prisma.grammarLectureScript.findMany({ where: { title: TEST_TITLE }, select: { id: true, scenesJson: true } })
    for (const s of scripts) {
      await removeLectureAudio(Array.from(referencedAudioPaths(parseVideoScenes(s.scenesJson).scenes)))
      await prisma.grammarLectureScript.delete({ where: { id: s.id } })
    }
    console.log(`확인용 스크립트 ${scripts.length}개 삭제`)
    return
  }

  const sceneId = arg('--scene')
  if (!sceneId) throw new Error('--scene <장면 ID>가 필요합니다.')
  const voices = resolveAudioVoices()
  if (!voices) throw new Error('ELEVENLABS_KO_VOICE_ID / ELEVENLABS_EN_VOICE_ID를 .env.local에 넣어 주세요.')

  const point = await findPoint()
  let script = await prisma.grammarLectureScript.findFirst({ where: { title: TEST_TITLE, grammarPointId: point.id } })
  if (!script) {
    script = await prisma.grammarLectureScript.create({
      data: {
        grammarPointId: point.id,
        title: TEST_TITLE,
        status: 'APPROVED',
        source: 'MANUAL',
        scenesJson: parseVideoScenes(sample).scenes as unknown as Prisma.InputJsonValue,
        approvedAt: new Date(),
      },
    })
    console.log(`확인용 스크립트 생성: ${script.id} (${point.code} ${point.title})`)
  }

  let scenes = parseVideoScenes(script.scenesJson).scenes
  if (has('--edit')) {
    scenes = scenes.map((s) => {
      if (s.id !== sceneId) return s
      let done = false
      const segments = s.segments.map((seg) => {
        if (done || !isSpokenSegment(seg)) return seg
        done = true
        return { ...seg, text: `${seg.text} 한 번 더!` }
      })
      return { ...s, segments } as VideoScene
    })
    console.log('첫 문장 수정')
  }
  const scene = scenes.find((s) => s.id === sceneId)
  if (!scene) throw new Error(`장면 '${sceneId}'이 없습니다. (${scenes.map((s) => s.id).join(', ')})`)

  let fetchCalls = 0
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('elevenlabs.io')) fetchCalls += 1
    return realFetch(input, init)
  }) as typeof fetch

  const started = Date.now()
  const result = await generateSceneAudioFiles(script.id, scene, voices, {
    synthesize: (text, lang, voiceId, opts) => synthesizeSegment(text, lang, voiceId, opts),
    upload: uploadLectureAudio,
  })
  const applied = applySceneAudio(scenes, sceneId, result.generated, voices)
  const plan = planScriptAudio(applied.scenes, voices)
  await prisma.grammarLectureScript.update({
    where: { id: script.id },
    data: {
      scenesJson: applied.scenes as unknown as Prisma.InputJsonValue,
      totalChars: { increment: result.chars },
      durationSec: Math.round(buildTimeline(applied.scenes).duration / 1000),
      koVoiceId: voices.ko.voiceId,
      enVoiceId: voices.en.voiceId,
      ...(plan.ready ? { status: 'AUDIO_READY', audioReadyAt: new Date() } : {}),
    },
  })
  const still = referencedAudioPaths(applied.scenes)
  const old = applied.applied.map((a) => a.previousPath).filter((p): p is string => Boolean(p) && !still.has(p as string))
  await removeLectureAudio([...old, ...applied.orphanPaths])

  console.log(`장면 ${sceneId}: ElevenLabs 호출 ${fetchCalls}번, 생성 ${result.generated.length}개, ${result.chars}자, ${((Date.now() - started) / 1000).toFixed(1)}초`)
  for (const g of result.generated) console.log(`  ${g.segmentId}  ${g.durationSec}s  ${LECTURE_AUDIO_BUCKET}/${g.audioPath}`)
  if (old.length) console.log(`  이전 파일 삭제 ${old.length}개`)
  if (result.error) console.log(`  오류: ${result.error instanceof Error ? result.error.message : String(result.error)}`)
  console.log(`스크립트 남은 생성 대상: ${plan.segments}개 / ${plan.chars}자, 준비 완료=${plan.ready}`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
