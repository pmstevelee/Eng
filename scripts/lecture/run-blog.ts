// npm run blog -- {slug} [--force] [--keywords-only] [--youtube URL] [--category 이름] [--recapture]
// 네이버 블로그 키워드 제안(keywords.md) + 원고(blog-post.md·blog-meta.json)를 만들고 멈춘다 (검토용)
import { parseArgs, runCli } from './common'
import { runBlog } from './steps/blog'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['youtube', 'category'])
  const slug = a.positional[0]
  if (!slug) throw new Error('강의 폴더 이름(slug)을 넣어 주세요. 예) npm run blog -- present-perfect')
  await runBlog(slug, {
    force: a.has('force'),
    keywordsOnly: a.has('keywords-only'),
    youtube: a.get('youtube'),
    category: a.get('category'),
    recapture: a.has('recapture'),
  })
  if (!a.has('keywords-only')) console.log(`\n다음 단계: blog-post.md 검토 → npm run blog:publish -- ${slug} (네이버 블로그 임시저장)`)
})
