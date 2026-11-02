// npm run render -- {slug} [--subtitles off] [--concurrency 4] [--no-audio] [--meta-only] [--section s7,s9]
import { parseArgs, runCli } from './common'
import { runRender } from './steps/render'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['subtitles', 'concurrency', 'section'])
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run render -- present-perfect')
  await runRender(slug, {
    subtitles: !(a.has('no-subtitles') || a.get('subtitles') === 'off'),
    concurrency: a.get('concurrency') ? Number(a.get('concurrency')) : null,
    noAudio: a.has('no-audio'),
    metaOnly: a.has('meta-only'),
    section: a.get('section')?.split(',').map((x) => x.trim()).filter(Boolean) ?? null,
  })
})
