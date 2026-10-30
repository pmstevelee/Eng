// npm run voice -- {slug} [--regen-failed] [--regen id1,id2] [--auto-retry 1] [--force] [--skip-qa]
// 음성 생성 + 발음 검수 → narration.wav, timeline.json, subtitles.srt, qa-report.md
import { parseArgs, runCli } from './common'
import { runVoice } from './steps/voice'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['regen', 'auto-retry'])
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run voice -- present-perfect')
  const { failed } = await runVoice(slug, {
    regenIds: a.get('regen')?.split(',').map((s) => s.trim()).filter(Boolean),
    regenFailed: a.has('regen-failed'),
    autoRetry: a.get('auto-retry') ? Number(a.get('auto-retry')) : 0,
    force: a.has('force'),
    skipQa: a.has('skip-qa'),
  })
  console.log(`\n다음 단계: qa-report.md 확인${failed ? '(❌ 세그먼트는 직접 들어 보기)' : ''} → npm run preview -- ${slug} 또는 npm run render -- ${slug}`)
})
