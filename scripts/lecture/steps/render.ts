// 렌더 단계 — output.mp4 + thumbnail.png + subtitles.srt + youtube.md
// 음성(narration.wav)은 로컬 파일 서버로 Remotion에 넘긴다.

import { existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import {
  buildChapters,
  buildCues,
  layoutTimeline,
  toSrt,
  type Timeline,
} from "../../../src/lib/lecture-pipeline/timing";
import type { LectureScript } from "../../../src/lib/lecture-pipeline/types";
import {
  LECTURE_THUMBNAIL_ID,
  LECTURE_VIDEO_ID,
  type LectureVideoProps,
  type ThumbnailProps,
} from "../../../src/components/lecture-video/props";
import { buildYoutubeMd, generateYoutubeMeta } from "../ai";
import {
  browserOptions,
  formatDuration,
  paths,
  readScript,
  readTimeline,
  rel,
  serveFolder,
} from "../common";

export interface RenderOptions {
  subtitles?: boolean;
  concurrency?: number | null;
  /** 음성 없이 (글자 수 어림 타임라인) */
  noAudio?: boolean;
  /** 영상은 다시 만들지 않고 썸네일·자막·youtube.md만 */
  metaOnly?: boolean;
}

/** 대본과 타임라인이 같은 세그먼트를 가리키는지 — 대본을 고친 뒤 voice를 다시 안 했으면 false */
export function timelineMatches(
  script: LectureScript,
  timeline: Timeline | null,
): boolean {
  if (!timeline) return false;
  const a = script.segments.map((s) => s.id).join("|");
  const b = timeline.segments.map((s) => s.id).join("|");
  return a === b;
}

let bundled: string | null = null;
async function getBundle(): Promise<string> {
  if (!bundled) {
    console.log("  Remotion 번들 만드는 중…");
    bundled = await bundle({
      entryPoint: path.resolve("remotion/lecture-pipeline.ts"),
      publicDir: path.resolve("public"),
    });
  }
  return bundled;
}

export async function runRender(
  slug: string,
  opts: RenderOptions = {},
): Promise<void> {
  const p = paths(slug);
  const script = readScript(slug);
  const timeline = readTimeline(slug);
  const withAudio = !opts.noAudio;
  if (withAudio) {
    if (!timeline || !existsSync(p.narration))
      throw new Error(`음성이 아직 없어요. 먼저 npm run voice -- ${slug}`);
    if (!timelineMatches(script, timeline))
      throw new Error(
        `script.json이 음성을 만든 뒤 바뀌었어요. npm run voice -- ${slug} 를 다시 실행해 주세요.`,
      );
  }
  const tl = withAudio ? timeline : null;

  const server = await serveFolder(p.dir);
  try {
    const inputProps: LectureVideoProps = {
      script,
      timeline: tl,
      audioUrl: withAudio
        ? `${server.base}/narration.wav?v=${statSync(p.narration).mtimeMs}`
        : null,
      subtitles: opts.subtitles !== false,
    };
    const serveUrl = await getBundle();
    const browser = browserOptions();
    if (!opts.metaOnly) {
      const composition = await selectComposition({
        serveUrl,
        id: LECTURE_VIDEO_ID,
        inputProps,
        ...browser,
      });
      console.log(
        `▶ 렌더: ${script.title} · ${formatDuration((composition.durationInFrames / composition.fps) * 1000)} · 자막 ${inputProps.subtitles ? "켬" : "끔"}`,
      );

      const started = Date.now();
      let lastPct = -1;
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        audioCodec: "aac",
        crf: 18,
        outputLocation: p.mp4,
        inputProps,
        concurrency: opts.concurrency ?? null,
        licenseKey: process.env.REMOTION_LICENSE_KEY || null,
        ...browser,
        onProgress: ({ progress, renderedFrames }) => {
          const pct = Math.floor(progress * 100);
          if (pct !== lastPct && pct % 5 === 0) {
            lastPct = pct;
            console.log(
              `  렌더 ${pct}% (${renderedFrames}/${composition.durationInFrames} 프레임)`,
            );
          }
        },
      });
      console.log(`  영상 완료 (${formatDuration(Date.now() - started)} 걸림)`);
    }

    // 썸네일
    const titleSlide = script.slides.find((s) => s.type === "title");
    const thumbProps: ThumbnailProps = {
      title:
        titleSlide?.type === "title" ? titleSlide.data.title : script.title,
      subtitle:
        titleSlide?.type === "title" ? titleSlide.data.subtitle : undefined,
      label: "중학 영문법",
    };
    const still = await selectComposition({
      serveUrl,
      id: LECTURE_THUMBNAIL_ID,
      inputProps: thumbProps,
      ...browser,
    });
    await renderStill({
      composition: still,
      serveUrl,
      output: p.thumbnail,
      inputProps: thumbProps,
      imageFormat: "png",
      ...browser,
    });
  } finally {
    server.close();
  }

  // 자막·YouTube 정보
  const finalTimeline = tl ?? layoutTimeline(script);
  writeFileSync(p.srt, toSrt(buildCues(script, finalTimeline)));
  console.log("  YouTube 제목·설명·태그 만드는 중…");
  const meta = await generateYoutubeMeta(script);
  writeFileSync(
    p.youtube,
    buildYoutubeMd(
      script,
      meta,
      buildChapters(script, finalTimeline),
      finalTimeline.totalMs,
    ),
  );

  console.log(
    `✔ 렌더 완료\n  ${rel(p.mp4)}\n  ${rel(p.thumbnail)}\n  ${rel(p.srt)}\n  ${rel(p.youtube)}`,
  );
}
