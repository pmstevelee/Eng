// npm run preview -- {slug} [--no-subtitles] [--port 3010]
import { parseArgs, runCli } from './common'
import { runPreview } from './steps/preview'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['port', 'subtitles'])
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run preview -- present-perfect')
  await runPreview(slug, { subtitles: !(a.has('no-subtitles') || a.get('subtitles') === 'off'), port: a.get('port') ? Number(a.get('port')) : null })
})
