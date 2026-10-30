// npm run script -- "강의 타이틀" [--minutes 10] [--point G03-03-01] [--slug present-perfect] [--force] [--no-db]
// 대본을 만들고 멈춘다. lectures/{slug}/script-review.md를 읽고 검토한 뒤 npm run voice -- {slug}
import { parseArgs, runCli } from './common'
import { runScript } from './steps/script'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['minutes', 'point', 'slug'])
  const title = a.positional.join(' ').trim()
  if (!title) throw new Error('강의 타이틀을 넣어 주세요. 예) npm run script -- "현재완료 시제"')
  const slug = await runScript(title, {
    minutes: a.get('minutes') ? Number(a.get('minutes')) : undefined,
    pointCode: a.get('point'),
    slug: a.get('slug'),
    force: a.has('force'),
    noDb: a.has('no-db'),
  })
  console.log(`\n다음 단계: 검토가 끝나면 → npm run voice -- ${slug}`)
})
