// npm run cardnews -- {slug} [--force]
// 카드뉴스 문구(cardnews.json·cardnews-script.md)와 인스타그램·쓰레드 글을 만들고 멈춘다 (검토용)
import { parseArgs, runCli } from './common'
import { runCardnewsScript } from './steps/cardnews'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2))
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run cardnews -- present-perfect')
  await runCardnewsScript(slug, { force: a.has('force') })
  console.log(`\n다음 단계: cardnews-script.md 검토(고칠 곳은 cardnews.json) → npm run cardnews:render -- ${slug}`)
})
