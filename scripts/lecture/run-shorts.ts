// npm run shorts -- {slug} [--only 1,2] [--force]
// 본 강의의 일상회화 패턴마다 숏폼 대본을 만들고 멈춘다 (검토용). 검토 후 → npm run shorts:render -- {slug}
import { parseArgs, parseNumberList, runCli } from './common'
import { runShortsScript } from './steps/shorts'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['only'])
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run shorts -- present-perfect')
  await runShortsScript(slug, { only: parseNumberList(a.get('only')), force: a.has('force') })
  console.log(`\n다음 단계: shorts-NN-review.md 검토 → npm run shorts:render -- ${slug}`)
})
