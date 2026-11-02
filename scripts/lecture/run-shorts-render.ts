// npm run shorts:render -- {slug} [--only 1] [--regen-failed] [--regen id1,id2] [--force] [--skip-qa] [--voice-only] [--repeat-bed off|pad|noise] [--concurrency 4]
// 숏폼 음성(한국어 1.1배) + 발음 검수 + 1080×1920 mp4 렌더
import { parseArgs, parseNumberList, runCli } from './common'
import { runShortsRender } from './steps/shorts'
import { resolveBed } from './steps/voice'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['only', 'regen', 'auto-retry', 'repeat-bed', 'bed-db', 'concurrency'])
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run shorts:render -- present-perfect')
  await runShortsRender(slug, {
    only: parseNumberList(a.get('only')),
    regenIds: a.get('regen')?.split(',').map((s) => s.trim()).filter(Boolean),
    regenFailed: a.has('regen-failed'),
    autoRetry: a.get('auto-retry') ? Number(a.get('auto-retry')) : 1,
    force: a.has('force'),
    skipQa: a.has('skip-qa'),
    voiceOnly: a.has('voice-only'),
    repeatBed: resolveBed(a.get('repeat-bed')),
    bedDb: a.get('bed-db') ? Number(a.get('bed-db')) : undefined,
    concurrency: a.get('concurrency') ? Number(a.get('concurrency')) : null,
  })
  console.log(`\n🎬 lectures/${slug}/shorts/ 폴더에 숏폼과 업로드 정보(shorts-NN-youtube.md)가 준비됐어요.`)
})
