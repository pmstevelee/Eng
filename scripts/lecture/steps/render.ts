// 렌더 단계 — output.mp4 + thumbnail.png + subtitles.srt + youtube.md
// 음성(narration.wav)은 로컬 파일 서버로 Remotion에 넘긴다.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  ffmpeg,
  formatDuration,
  paths,
  readScript,
  readTimeline,
  rel,
  serveFolder,
} from "../common";
import { checkVideoFlicker, type FlickerHit } from "../frame-check";

/** 조각 하나 = 30초 (30fps) */
const CHUNK_FRAMES = 900;
/** 깜박임이 남으면 다시 렌더하는 최대 횟수 */
const MAX_ATTEMPTS = 4;

export interface RenderOptions {
  subtitles?: boolean;
  concurrency?: number | null;
  /** 음성 없이 (글자 수 어림 타임라인) */
  noAudio?: boolean;
  /** 영상은 다시 만들지 않고 썸네일·자막·youtube.md만 */
  metaOnly?: boolean;
  /** 이 슬라이드들 구간만 section-{id}.mp4로 (빠른 확인용, 썸네일·youtube.md는 만들지 않음) */
  section?: string[] | null;
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
export async function getBundle(): Promise<string> {
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
      // 구간 렌더 — 고른 슬라이드의 시작~끝 프레임만
      const tlForRange = tl ?? layoutTimeline(script);
      const ranges = (opts.section ?? []).map((id) => {
        const r = tlForRange.slides.find((x) => x.id === id);
        if (!r) throw new Error(`슬라이드 "${id}"가 없어요 (script-review.md의 슬라이드 id 확인)`);
        return r;
      });
      const frameRange: [number, number] | null = ranges.length
        ? [
            Math.floor((Math.min(...ranges.map((r) => r.startMs)) / 1000) * composition.fps),
            Math.min(composition.durationInFrames - 1, Math.ceil((Math.max(...ranges.map((r) => r.endMs)) / 1000) * composition.fps)),
          ]
        : null;
      const output = frameRange ? path.join(p.dir, `section-${(opts.section ?? []).join("-")}.mp4`) : p.mp4;
      console.log(
        `▶ 렌더: ${script.title} · ${formatDuration((composition.durationInFrames / composition.fps) * 1000)} · 자막 ${inputProps.subtitles ? "켬" : "끔"}${frameRange ? ` · 구간 ${(opts.section ?? []).join(", ")}` : ""}`,
      );

      // 깜박임 없는 렌더 — 1440p 캡처에서 Chrome이 다 그리기 전의 빈 화면이 가끔 1프레임씩 섞였다.
      // 30초 조각마다 새 브라우저로 렌더(음성 없이) → 끼어든 프레임 검사 → 걸리면 그 조각만 다시 렌더
      // → 조각을 재인코딩 없이 이어 붙이고 narration.wav를 입힌 뒤, 완성본 전체를 한 번 더 검사한다.
      const started = Date.now();
      const fps = composition.fps;
      const whole: [number, number] = frameRange ?? [0, composition.durationInFrames - 1];
      const chunks: [number, number][] = [];
      for (let a = whole[0]; a <= whole[1]; a += CHUNK_FRAMES) chunks.push([a, Math.min(a + CHUNK_FRAMES - 1, whole[1])]);
      const workDir = path.join(p.dir, ".render-chunks");
      const chunkFile = (i: number) => path.join(workDir, `chunk-${String(i).padStart(3, "0")}.mp4`);
      // 이어서 렌더 — 중간에 멈춰도(예: "got no response") 대본·음성이 같으면 끝난 조각은 다시 쓴다
      const manifestFile = path.join(workDir, "manifest.json");
      const renderKey = createHash("sha1")
        .update(readFileSync(p.script, "utf8") + "\n" + (existsSync(p.timeline) ? readFileSync(p.timeline, "utf8") : "") + "\n")
        .update(JSON.stringify({ section: opts.section ?? null, subtitles: inputProps.subtitles, chunkFrames: CHUNK_FRAMES, audio: withAudio }))
        .digest("hex");
      let doneChunks = new Set<number>();
      try {
        const m = JSON.parse(readFileSync(manifestFile, "utf8")) as { key?: string; done?: number[] };
        if (m.key === renderKey) doneChunks = new Set((m.done ?? []).filter((i) => existsSync(chunkFile(i))));
      } catch {
        // 기록 없음 → 처음부터
      }
      if (!doneChunks.size) rmSync(workDir, { recursive: true, force: true });
      mkdirSync(workDir, { recursive: true });
      const saveManifest = () => writeFileSync(manifestFile, JSON.stringify({ key: renderKey, done: Array.from(doneChunks).sort((a, b) => a - b) }));
      saveManifest();
      if (doneChunks.size) console.log(`  이어서 렌더: 끝난 조각 ${doneChunks.size}개 다시 씀`);
      const skipped = doneChunks.size;

      const renderChunk = async (i: number, attempt: number) => {
        // 렌더용 로컬 서버가 가끔 응답하지 않아 실패한다 → 같은 조각을 몇 번 더 시도
        for (let retry = 1; ; retry++) {
          try {
            await renderChunkOnce(i, attempt);
            return;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (retry >= 3 || !/got no response|ECONNRESET|Target closed/i.test(msg)) throw e;
            console.log(`    ⚠ 조각 ${i + 1} 렌더 연결 오류 → 다시 시도 (${retry + 1}번째)`);
          }
        }
      };
      const renderChunkOnce = async (i: number, attempt: number) => {
        await renderMedia({
          composition,
          serveUrl,
          codec: "h264",
          crf: 18,
          // YouTube는 1440p 이상 업로드에 더 좋은 압축(VP9)을 써서 글자가 선명하다 — 레이아웃은 1080p 그대로 키움
          scale: 4 / 3,
          // 화면 캡처 JPEG 손실(기본 80) 없애기
          jpegQuality: 100,
          pixelFormat: "yuv420p",
          // 일반 스크린샷 캡처 (공유 메모리 캡처는 쓰지 않음)
          disableSharedMemoryCapture: true,
          muted: true,
          frameRange: chunks[i],
          outputLocation: chunkFile(i),
          overwrite: true,
          inputProps: { ...inputProps, audioUrl: null },
          // 다시 렌더할 때는 탭 하나로 천천히 (부하로 캡처가 밀리는 것 방지)
          concurrency: attempt > 1 ? 1 : (opts.concurrency ?? null),
          licenseKey: process.env.REMOTION_LICENSE_KEY || null,
          ...browser,
        });
      };

      /** 조각 하나 렌더 + 검사, 깜박임이 있으면 최대 MAX_ATTEMPTS번까지 다시 */
      const renderCheckedChunk = async (i: number) => {
        for (let attempt = 1; ; attempt++) {
          await renderChunk(i, attempt);
          const hits = await checkVideoFlicker(chunkFile(i), { frameOffset: chunks[i][0] });
          if (hits.length === 0) return;
          const where = hits.slice(0, 5).map((h) => formatDuration((h.frame / fps) * 1000)).join(", ");
          if (attempt >= MAX_ATTEMPTS) throw new Error(`조각 ${i + 1} 깜박임이 ${MAX_ATTEMPTS}번 렌더해도 남아요 (${where}). 다른 프로그램을 닫고 다시 실행해 주세요.`);
          console.log(`    ⚠ 조각 ${i + 1} 깜박임 ${hits.length}곳 (${where}) → 다시 렌더 (${attempt + 1}번째)`);
        }
      };

      for (let i = 0; i < chunks.length; i++) {
        if (doneChunks.has(i)) continue;
        const t = Date.now();
        await renderCheckedChunk(i);
        doneChunks.add(i);
        saveManifest();
        const done = Date.now() - started;
        const renderedNow = Array.from(doneChunks).filter((k) => k <= i).length - skipped;
        const left = (done / Math.max(1, renderedNow)) * (chunks.length - i - 1);
        console.log(`  조각 ${i + 1}/${chunks.length} ✔ (${formatDuration(Date.now() - t)}, 남은 시간 약 ${formatDuration(left)})`);
      }

      const assemble = async () => {
        const list = path.join(workDir, "list.txt");
        writeFileSync(list, chunks.map((_, i) => `file '${chunkFile(i)}'`).join("\n") + "\n");
        const startSec = whole[0] / fps;
        const durSec = (whole[1] - whole[0] + 1) / fps;
        const audio = withAudio
          ? ["-ss", startSec.toFixed(3), "-t", durSec.toFixed(3), "-i", p.narration, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "320k"]
          : ["-map", "0:v"];
        await ffmpeg(["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, ...audio, "-c:v", "copy", "-movflags", "+faststart", output]);
      };
      await assemble();

      // 완성본 전체 검사 (조각 경계 포함) — 60초씩 끊어 읽는다
      for (let round = 1; ; round++) {
        const hits: FlickerHit[] = [];
        const totalFrames = whole[1] - whole[0] + 1;
        for (let a = 0; a < totalFrames; a += 60 * fps) {
          hits.push(...(await checkVideoFlicker(output, { startSec: a / fps, durSec: (Math.min(60 * fps, totalFrames - a) + 3) / fps, frameOffset: a })));
        }
        if (hits.length === 0) break;
        const bad = new Set(hits.map((h) => Math.floor(h.frame / CHUNK_FRAMES)));
        // 경계에 걸친 경우 앞 조각도 다시
        hits.forEach((h) => h.frame % CHUNK_FRAMES === 0 && h.frame > 0 && bad.add(h.frame / CHUNK_FRAMES - 1));
        if (round >= MAX_ATTEMPTS) throw new Error(`완성본에 깜박임이 남아요: ${hits.map((h) => formatDuration(((h.frame) / fps) * 1000)).join(", ")}`);
        console.log(`  ⚠ 완성본 검사에서 깜박임 ${hits.length}곳 → 조각 ${Array.from(bad).map((i) => i + 1).join(", ")} 다시 렌더`);
        for (const i of Array.from(bad)) await renderCheckedChunk(i);
        await assemble();
      }
      rmSync(workDir, { recursive: true, force: true });
      console.log(`  영상 완료 · 깜박임 검사 통과 (${formatDuration(Date.now() - started)} 걸림)`);
      if (frameRange) {
        console.log(`✔ 구간 렌더 완료\n  ${rel(output)}`);
        return;
      }
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
