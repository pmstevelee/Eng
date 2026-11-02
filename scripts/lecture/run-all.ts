// npm run all -- "강의 타이틀" [--minutes 10] [--point 코드] [--patterns 2] [--subtitles off] [--repeat-bed pad] [--yes]
// 본 강의(대본 → 음성 → 렌더) → 숏폼(대본 → 음성·렌더) → 카드뉴스(문구 → 이미지)
// 각 검토 지점(대본·숏폼 대본·카드뉴스 문구)에서 멈추고 Enter를 기다린다. --yes면 멈추지 않는다.
import { parseArgs, reviewPoint, runCli } from './common'
import { runScript } from './steps/script'
import { resolveBed, runVoice } from './steps/voice'
import { runRender } from './steps/render'
import { runShortsRender, runShortsScript } from './steps/shorts'
import { runCardnewsRender, runCardnewsScript } from './steps/cardnews'
import { findPatternGroups } from '../../src/lib/lecture-pipeline/patterns'
import { readScript } from './common'

runCli(async () => {
  const a = parseArgs(process.argv.slice(2), ['minutes', 'point', 'slug', 'subtitles', 'auto-retry', 'patterns', 'repeat-bed'])
  const title = a.positional.join(' ').trim()
  if (!title) throw new Error('강의 타이틀을 넣어 주세요. 예) npm run all -- "현재완료 시제"')
  const yes = a.has('yes')
  const bed = resolveBed(a.get('repeat-bed'))

  console.log('━━ 1/3 본 강의 ━━')
  const slug = await runScript(title, {
    minutes: a.get('minutes') ? Number(a.get('minutes')) : undefined,
    pointCode: a.get('point'),
    slug: a.get('slug'),
    noDb: a.has('no-db'),
    patterns: a.get('patterns') !== null ? Number(a.get('patterns')) : null,
  })
  await reviewPoint(`lectures/${slug}/script-review.md 를 읽고, 고칠 곳은 script.json에서 고치세요.`, {
    yes,
    resume: `npm run voice -- ${slug} → npm run render -- ${slug} → npm run shorts -- ${slug} → npm run cardnews -- ${slug}`,
  })
  console.log('')
  await runVoice(slug, { autoRetry: a.get('auto-retry') ? Number(a.get('auto-retry')) : 1, repeatBed: bed })
  console.log('')
  await runRender(slug, { subtitles: !(a.has('no-subtitles') || a.get('subtitles') === 'off') })

  console.log('\n━━ 2/3 유튜브 숏폼 ━━')
  if (findPatternGroups(readScript(slug)).length === 0) {
    console.log('  본 강의에 일상회화 패턴이 없어 숏폼은 건너뛰어요.')
  } else {
    await runShortsScript(slug)
    await reviewPoint(`lectures/${slug}/shorts/shorts-NN-review.md 를 읽고, 고칠 곳은 shorts-NN-script.json에서 고치세요.`, {
      yes,
      resume: `npm run shorts:render -- ${slug} → npm run cardnews -- ${slug}`,
    })
    await runShortsRender(slug, { repeatBed: bed })
  }

  console.log('\n━━ 3/3 카드뉴스 ━━')
  await runCardnewsScript(slug)
  await reviewPoint(`lectures/${slug}/cardnews/cardnews-script.md 와 캡션 2개를 읽고, 카드 문구는 cardnews.json에서 고치세요.`, {
    yes,
    resume: `npm run cardnews:render -- ${slug}`,
  })
  await runCardnewsRender(slug)
  console.log(`\n🎬 lectures/${slug}/ 에 본 강의·숏폼·카드뉴스가 모두 준비됐어요.`)
})
