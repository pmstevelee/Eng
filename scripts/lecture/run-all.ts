// npm run all -- "강의 타이틀" [--minutes 10] [--point 코드] [--subtitles off]
// 대본 → 음성(검수 불합격은 1번 자동 다시 만들기) → 렌더까지 멈추지 않고 실행
import { parseArgs, runCli } from './common'
import { runScript } from './steps/script'
import { runVoice } from './steps/voice'
import { runRender } from './steps/render'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['minutes', 'point', 'slug', 'subtitles', 'auto-retry'])
  const title = a.positional.join(' ').trim()
  if (!title) throw new Error('강의 타이틀을 넣어 주세요. 예) npm run all -- "현재완료 시제"')
  const slug = await runScript(title, {
    minutes: a.get('minutes') ? Number(a.get('minutes')) : undefined,
    pointCode: a.get('point'),
    slug: a.get('slug'),
    noDb: a.has('no-db'),
  })
  console.log('')
  await runVoice(slug, { autoRetry: a.get('auto-retry') ? Number(a.get('auto-retry')) : 1 })
  console.log('')
  await runRender(slug, { subtitles: !(a.has('no-subtitles') || a.get('subtitles') === 'off') })
  console.log(`\n🎬 lectures/${slug}/ 폴더에 영상과 업로드 자료가 모두 준비됐어요.`)
})
