// 미리보기 단계 — Remotion Studio를 열어 강의를 재생해 본다 (브라우저에서 WeGoUpLecture 선택)
// 음성이 있으면 narration.wav를 함께, 없으면 글자 수 어림 타임라인으로 소리 없이.

import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { LectureVideoProps } from '../../../src/components/lecture-video/props'
import { paths, readScript, readTimeline, serveFolder } from '../common'
import { timelineMatches } from './render'

export async function runPreview(slug: string, opts: { subtitles?: boolean; port?: number | null } = {}): Promise<void> {
  const p = paths(slug)
  const script = readScript(slug)
  const timeline = readTimeline(slug)
  const ready = existsSync(p.narration) && timelineMatches(script, timeline)
  if (!ready) console.log('  ⚠ 최신 음성이 없어 소리 없이(글자 수로 길이를 어림해) 보여 줘요. 음성까지 보려면 npm run voice 먼저.')

  const server = await serveFolder(p.dir)
  const props: LectureVideoProps = {
    script,
    timeline: ready ? timeline : null,
    audioUrl: ready ? `${server.base}/narration.wav?v=${Date.now()}` : null,
    subtitles: opts.subtitles !== false,
  }
  const propsFile = path.join(p.dir, '.preview-props.json')
  writeFileSync(propsFile, JSON.stringify(props))
  console.log(`▶ Remotion Studio를 여는 중… 브라우저에서 왼쪽 목록의 "WeGoUpLecture"를 누르세요. (끝내려면 이 창에서 Ctrl+C)`)

  const args = ['studio', 'remotion/lecture-pipeline.ts', `--props=${propsFile}`, ...(opts.port ? [`--port=${opts.port}`] : [])]
  const child = spawn(path.resolve('node_modules/.bin/remotion'), args, { stdio: 'inherit' })
  await new Promise<void>((resolve) => child.on('close', () => resolve()))
  server.close()
}
