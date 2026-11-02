// npm run blog:publish -- {slug} [--discard-autosave]   → ego lite로 네이버 블로그 임시저장 (발행 안 함)
// npm run blog:publish -- --check                       → 연결 테스트 (글쓰기 화면·제목 칸 확인만)
import { parseArgs, runCli } from './common'
import { runBlogCheck, runBlogPublish } from './steps/blog-publish'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2))
  if (a.has('check')) return runBlogCheck()
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run blog:publish -- present-perfect')
  await runBlogPublish(slug, { discardAutosave: a.has('discard-autosave') })
})
