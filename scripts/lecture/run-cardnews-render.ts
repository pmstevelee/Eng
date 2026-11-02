// npm run cardnews:render -- {slug} [--only 1,3,9]
// cardnews.json → card-01.png ~ card-10.png (1080×1350)
import { parseArgs, parseNumberList, runCli } from './common'
import { runCardnewsRender } from './steps/cardnews'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['only'])
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run cardnews:render -- present-perfect')
  await runCardnewsRender(slug, { only: parseNumberList(a.get('only')) })
})
