// 블로그 등록 단계 — ego lite(ego-browser)로 네이버 블로그 글쓰기 → 임시저장까지만 (발행은 절대 하지 않음)
// 단계: 글쓰기 화면 열기 → 제목 → 본문(소제목 서식)·이미지·유튜브 → 태그 → 카테고리 → 저장(임시저장)
// 단계마다 blog/screenshots/NN-이름.png를 찍고 publish-log.md에 기록한다.
// 에디터 구조가 예상과 다르면(요소를 못 찾으면) 추측해서 누르지 않고 멈춘다.
// 네이버 아이디·비밀번호는 다루지 않는다 — 로그인은 사용자가 ego lite에서 직접 해 둔다.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { checkBlogPost, parseBlogPost, type BlogBlock, type BlogMeta } from '../../../src/lib/lecture-pipeline/blog'
import { rel } from '../common'
import { blogPaths } from './blog'

/** ego lite 작업 공간 이름 — 실행마다 새 이름 (성공하면 결과 탭을 사용자에게 넘겨 그 공간은 다시 못 쓴다) */
let SPACE = 'naver blog draft'
const newSpaceName = (what: string) => {
  const t = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(5, 16).replace(/[-: ]/g, '')
  SPACE = `naver blog ${what} ${t}`
}
const WRITE_URL = 'https://blog.naver.com/GoBlogWrite.naver'

/** 모든 브라우저 스크립트 앞에 붙는 도우미 (ego-browser nodejs 안에서 돈다) */
const prelude = () => String.raw`
const task = await taskSpace(${JSON.stringify(SPACE)});
const page = task.page("p1");
const out = (v) => console.log("@@RESULT " + JSON.stringify(v));
const stop = (reason, extra = {}) => { out({ ok: false, reason, ...extra }); process.exit(0); };
/** 사람처럼 쉬기 (ms ~ ms*1.6) */
const pause = (ms = 700) => page.waitForTimeout(Math.round(ms + Math.random() * ms * 0.6));
/** 에디터(iframe#mainFrame) 안에서 실행 */
const inEditor = (fn, arg) => page.evaluate(new Function("arg", "const d = document.querySelector('iframe#mainFrame')?.contentDocument; if (!d) return { noEditor: true }; return (" + fn.toString() + ")(d, arg);"), arg ?? null);
/** 보이는 요소가 있는지 */
const visible = (sel) => inEditor((d, s) => [...d.querySelectorAll(s)].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), sel);
const shot = (file) => page.screenshot({ path: file });
`

interface EgoResult { ok: boolean; reason?: string; [k: string]: unknown }

/** 브라우저 스크립트 하나 실행 → 마지막 @@RESULT */
function runEgo(body: string, timeoutMs = 180_000): Promise<EgoResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('ego-browser', ['nodejs'], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('브라우저 단계가 너무 오래 걸려 멈췄어요.'))
    }, timeoutMs)
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(new Error(`ego-browser를 실행하지 못했어요 (ego lite 설치 확인 — lectures/README.md "ego lite 설정"): ${e.message}`))
    })
    child.on('close', () => {
      clearTimeout(timer)
      const all = stdout + stderr
      if (/Control of this task space is with the user/.test(all)) {
        resolve({ ok: false, reason: `ego lite에서 작업 공간 제어가 사용자에게 넘어가 있어요. 브라우저를 직접 만지면 넘어가요. ego lite에서 "${SPACE}" 공간의 제어를 돌려준 뒤 다시 실행해 주세요.` })
        return
      }
      const line = all.split('\n').reverse().find((l) => l.startsWith('@@RESULT '))
      if (line) resolve(JSON.parse(line.slice(9)) as EgoResult)
      else resolve({ ok: false, reason: `브라우저 스크립트 오류: ${all.trim().split('\n').slice(-6).join(' / ')}` })
    })
    child.stdin.end(prelude() + body)
  })
}

// ── 단계별 브라우저 스크립트 ──────────────────────────────

const js = (v: unknown) => JSON.stringify(v)

/** 1. 글쓰기 화면 열기 — 로그인·이어쓰기 팝업·도움말 처리, 제목 칸 확인 */
function openEditorScript(shotFile: string, opts: { discardAutosave: boolean; checkOnly?: boolean }): string {
  return String.raw`
await page.goto(${js(WRITE_URL)});
await page.waitForLoadState();
await pause(2500);
const url = await page.url();
if (/nid\.naver\.com/.test(url)) { await shot(${js(shotFile)}); await task.handOff(); stop("네이버에 로그인되어 있지 않아요. ego lite에서 직접 로그인한 뒤 다시 실행해 주세요.", { url }); }
try { await page.waitForSelector(".se-documentTitle", { timeout: 20000 }); } catch {}
// 작성 중이던 글 이어쓰기 팝업
const popup = await inEditor((d) => { const p = [...d.querySelectorAll(".se-popup, [class*=layer_popup]")].find((e) => e.getBoundingClientRect().height > 0); return p ? p.textContent.trim().slice(0, 120) : null; });
if (popup && ${!!opts.checkOnly}) { const t = await visible(".se-documentTitle .se-text-paragraph"); await shot(${js(shotFile)}); if (!t) stop("제목 입력란을 찾지 못했어요."); out({ ok: true, url, popup }); process.exit(0); }
if (popup) {
  if (/작성 중인 글|이어서/.test(popup) && ${opts.discardAutosave}) {
    await page.click(".se-popup-button-cancel", { label: "start a new post" });
    await pause(1200);
  } else {
    await shot(${js(shotFile)});
    stop("글쓰기 화면에 팝업이 떠 있어요: " + popup + " — 작성 중이던 글을 버리고 새로 쓰려면 --discard-autosave를 붙여 다시 실행해 주세요.", { popup });
  }
}
if (await visible(".se-help-panel.se-is-on")) { await page.click("button.se-help-panel-close-button", { label: "close help panel" }); await pause(600); }
const ok = await visible(".se-documentTitle .se-text-paragraph");
await shot(${js(shotFile)});
if (!ok) stop("제목 입력란(.se-documentTitle)을 찾지 못했어요. 네이버 에디터 구조가 바뀌었을 수 있어요.");
if (${!!opts.checkOnly}) { out({ ok: true, url }); process.exit(0); }
const empty = await inEditor((d) => { const txt = (el) => { if (!el) return ""; const c = el.cloneNode(true); c.querySelectorAll(".se-placeholder").forEach((x) => x.remove()); return c.textContent.replace(/\u200B/g, "").trim(); }; const comps = [...d.querySelectorAll(".se-components-wrap > .se-component")]; return comps.length <= 2 && comps.every((c) => [...c.querySelectorAll(".se-text-paragraph")].every((p) => txt(p) === "")); });
if (!empty) stop("글쓰기 화면이 비어 있지 않아요 (작성 중이던 글이 열림). 직접 확인한 뒤 다시 실행해 주세요.");
out({ ok: true, url });
`
}

/** 2. 제목 */
function titleScript(title: string, shotFile: string): string {
  return String.raw`
await page.click(".se-documentTitle .se-text-paragraph", { label: "focus title field" });
await pause(500);
await page.keyboard.insertText(${js(title)});
await pause(800);
const got = await inEditor((d) => d.querySelector(".se-documentTitle .se-text-paragraph")?.textContent ?? "");
await shot(${js(shotFile)});
if (got.trim() !== ${js(title)}) stop("제목이 제대로 들어가지 않았어요: " + got);
out({ ok: true });
`
}

/** 본문 공용 도우미 — 문단 서식 바꾸기, 마지막 줄로 가기 */
const BODY_HELPERS = String.raw`
const currentFormat = () => inEditor((d) => d.querySelector("button.se-text-format-toolbar-button")?.textContent.trim() ?? "");
async function setFormat(kind) {
  const label = kind === "sectionTitle" ? "소제목" : "본문";
  if ((await currentFormat()).startsWith(label)) return;
  await page.click("button.se-text-format-toolbar-button", { label: "open paragraph format" });
  await pause(400);
  const sel = "button.se-toolbar-option-text-format-" + kind + "-button";
  if (!(await visible(sel))) stop("문단 서식 목록에서 '" + label + "'을 찾지 못했어요.");
  await page.click(sel, { label: "choose " + label + " format" });
  await pause(400);
  if (!(await currentFormat()).startsWith(label)) stop("문단 서식을 '" + label + "'(으)로 바꾸지 못했어요.");
}
/** 글 맨 끝(마지막 글 컴포넌트의 마지막 줄)으로 커서 */
async function focusEnd() {
  const okEnd = await inEditor((d) => {
    d.querySelectorAll("[data-ego-end]").forEach((e) => e.removeAttribute("data-ego-end"));
    const comps = [...d.querySelectorAll(".se-components-wrap > .se-component")].filter((c) => !c.classList.contains("se-documentTitle"));
    const last = comps[comps.length - 1];
    if (!last || !(last.classList.contains("se-text") || last.classList.contains("se-sectionTitle"))) return false;
    const ps = last.querySelectorAll(".se-text-paragraph");
    ps[ps.length - 1].setAttribute("data-ego-end", "1");
    return true;
  });
  if (!okEnd) return false;
  await page.click("[data-ego-end]", { label: "move cursor to end" });
  await page.keyboard.press("End");
  return true;
}
`

/** 3. 본문 블록 하나 (글·소제목·이미지·유튜브) — 블록마다 따로 실행해 중간에 멈춰도 어디까지 했는지 안다 */
function blockScript(block: BlogBlock, index: number, imagePath: string | null, shotFile: string | null): string {
  const shotLine = shotFile ? `await shot(${js(shotFile)});` : ''
  const head = String.raw`
${BODY_HELPERS}
if (!(await focusEnd())) stop("본문 마지막 줄을 찾지 못했어요 (블록 ${index + 1}).");
const lastEmpty = await inEditor((d) => { const p = d.querySelector("[data-ego-end]"); if (!p) return true; const c = p.cloneNode(true); c.querySelectorAll(".se-placeholder").forEach((x) => x.remove()); return c.textContent.replace(/\u200B/g, "").trim() === ""; });
if (!lastEmpty) { await page.keyboard.press("Enter"); await pause(300); }
`
  if (block.type === 'heading' || block.type === 'paragraph') {
    const kind = block.type === 'heading' ? 'sectionTitle' : 'text'
    const lines = block.text.split('\n')
    return head + String.raw`
await setFormat(${js(kind)});
const lines = ${js(lines)};
for (let i = 0; i < lines.length; i++) {
  await page.keyboard.insertText(lines[i]);
  await pause(250);
  if (i < lines.length - 1) await page.keyboard.press("Enter");
}
await page.keyboard.press("Enter");
${block.type === 'paragraph' ? 'await setFormat("text"); await page.keyboard.press("Enter");' : 'await setFormat("text");'}
await pause(500);
${shotLine}
out({ ok: true });
`
  }
  if (block.type === 'image') {
    return head + String.raw`
const before = await inEditor((d) => d.querySelectorAll(".se-component.se-image").length);
const chooserPromise = page.waitForFileChooser({ timeout: 15000 });
await page.click("button.se-image-toolbar-button", { label: "open photo upload" });
let chooser;
try { chooser = await chooserPromise; } catch { stop("사진 버튼을 눌렀는데 파일 선택 창이 열리지 않았어요."); }
await chooser.setFiles(${js(imagePath)});
let uploaded = false;
for (let t = 0; t < 40 && !uploaded; t++) {
  await page.waitForTimeout(500);
  uploaded = await inEditor((d, n) => { const imgs = d.querySelectorAll(".se-component.se-image"); const im = imgs[imgs.length - 1]?.querySelector("img.se-image-resource"); return imgs.length > n && !!im && /pstatic\.net/.test(im.src); }, before);
}
if (!uploaded) { ${shotLine} stop("이미지 업로드가 끝나지 않았어요: ${path.basename(imagePath ?? '')}"); }
await pause(800);
// 설명: 이미지를 골라야 설명 칸이 보인다
await inEditor((d) => { d.querySelectorAll("[data-ego-img]").forEach((e) => e.removeAttribute("data-ego-img")); const imgs = d.querySelectorAll(".se-component.se-image"); imgs[imgs.length - 1].setAttribute("data-ego-img", "1"); });
await page.click("[data-ego-img] img.se-image-resource", { label: "select uploaded image" });
await pause(500);
if (!(await visible("[data-ego-img] .se-caption .se-text-paragraph"))) stop("이미지 설명 칸을 찾지 못했어요.");
await page.click("[data-ego-img] .se-caption .se-text-paragraph", { label: "focus image caption" });
await page.keyboard.insertText(${js(block.caption)});
await pause(500);
// 이미지 뒤 글 줄이 없으면 만든다
const hasAfter = await inEditor((d) => { const im = d.querySelector("[data-ego-img]"); const n = im?.nextElementSibling; return !!n && n.classList.contains("se-text"); });
if (!hasAfter) stop("이미지 다음 줄을 찾지 못했어요.");
${shotLine}
out({ ok: true });
`
  }
  // youtube
  return head + String.raw`
const url = ${js(block.type === 'youtube' ? block.url : null)};
if (!url) { ${shotLine} out({ ok: true, skipped: "유튜브 주소가 없어 건너뜀" }); process.exit(0); }
const before = await inEditor((d) => d.querySelectorAll(".se-component.se-oglink, .se-component.se-video, .se-component.se-oembed").length);
await setFormat("text");
await page.keyboard.insertText(url);
await pause(300);
await page.keyboard.press("Enter");
let embedded = false;
for (let t = 0; t < 30 && !embedded; t++) {
  await page.waitForTimeout(500);
  embedded = await inEditor((d, n) => d.querySelectorAll(".se-component.se-oglink, .se-component.se-video, .se-component.se-oembed").length > n, before);
}
if (!embedded) { ${shotLine} stop("유튜브 주소를 넣었지만 영상 카드로 바뀌지 않았어요."); }
await pause(600);
// 영상 카드 위에 남은 주소 글자 줄 지우기
const urlLine = await inEditor((d, u) => { d.querySelectorAll("[data-ego-url]").forEach((e) => e.removeAttribute("data-ego-url")); const p = [...d.querySelectorAll(".se-component.se-text .se-text-paragraph")].find((x) => x.textContent.trim() === u); if (p) p.setAttribute("data-ego-url", "1"); return !!p; }, url);
if (urlLine) {
  await page.click("[data-ego-url]", { label: "select leftover url text" });
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Home");
  await page.keyboard.press("Backspace");
  await pause(400);
}
${shotLine}
${block.caption ? `await focusEnd(); await page.keyboard.insertText(${js(block.caption)}); await page.keyboard.press("Enter"); await page.keyboard.press("Enter");` : ''}
out({ ok: true });
`
}

/**
 * 태그·카테고리 — 네이버 에디터에서 이 칸은 상단 "발행" 버튼이 여는 "발행 설정" 창에만 있다.
 * 상단 버튼은 설정 창만 연다. 창 안의 최종 "발행"(confirm_btn)은 절대 누르지 않고, Esc로 닫는다.
 * (2026-11-02 사용자 승인: 설정 창만 열기)
 */
function settingsScript(tags: string[], category: string, shotFile: string): string {
  return String.raw`
const panelOpen = () => visible("[class*=layer_publish] input[class^=tag_input]");
// 상단 "발행" 버튼 = 설정 창 열기
const opener = await inEditor((d) => { d.querySelectorAll("[data-ego-pub]").forEach((e) => e.removeAttribute("data-ego-pub")); const b = [...d.querySelectorAll("button")].find((x) => /^publish_btn/.test(x.className) && x.textContent.trim().startsWith("발행")); if (b) b.setAttribute("data-ego-pub", "1"); return !!b; });
if (!opener) { await shot(${js(shotFile)}); stop("상단 '발행'(설정 창 열기) 버튼을 찾지 못했어요."); }
await pause(800);
await page.click("[data-ego-pub]", { label: "open publish settings only" });
for (let t = 0; t < 10 && !(await panelOpen()); t++) await page.waitForTimeout(400);
if (!(await panelOpen())) { await shot(${js(shotFile)}); stop("발행 설정 창이 열리지 않았어요 (태그 입력칸을 찾지 못함)."); }
await pause(700);

// 카테고리 — 목록에 같은 이름이 있을 때만 고른다 (없으면 손대지 않고 기록)
let categoryNote = "";
const want = ${js(category)};
const current = await inEditor((d) => d.querySelector('[class*=layer_publish] button[aria-label="카테고리 목록 버튼"]')?.textContent.trim() ?? null);
if (current === null) stop("카테고리 목록 버튼을 찾지 못했어요.");
if (current === want) categoryNote = "카테고리 '" + want + "' (이미 선택됨)";
else {
  await page.click('[class*=layer_publish] button[aria-label="카테고리 목록 버튼"]', { label: "open category list" });
  await pause(600);
  const names = await inEditor((d, w) => {
    d.querySelectorAll("[data-ego-cat]").forEach((e) => e.removeAttribute("data-ego-cat"));
    const items = [...d.querySelectorAll("[class*=layer_publish] [class*=option_category] li")].filter((e) => e.getBoundingClientRect().height > 0);
    const hit = items.find((e) => e.textContent.trim() === w);
    if (hit) hit.setAttribute("data-ego-cat", "1");
    return items.map((e) => e.textContent.trim());
  }, want);
  if (names.includes(want)) {
    await page.click("[data-ego-cat]", { label: "choose blog category" });
    await pause(600);
    const now = await inEditor((d) => d.querySelector('[class*=layer_publish] button[aria-label="카테고리 목록 버튼"]')?.textContent.trim() ?? "");
    categoryNote = now === want ? "카테고리 '" + want + "' 선택" : "⚠ 카테고리를 골랐지만 '" + now + "'로 보여요";
  } else {
    await page.click('[class*=layer_publish] button[aria-label="카테고리 목록 버튼"]', { label: "close category list" });
    await pause(400);
    categoryNote = "⚠ 블로그에 '" + want + "' 카테고리가 없어 '" + current + "' 그대로 둠 (있는 카테고리: " + names.join(", ") + ")";
  }
}

// 태그
const tags = ${js(tags)};
const existing = await inEditor((d) => [...d.querySelectorAll("[class*=layer_publish] [class^=tag__]")].map((e) => e.getAttribute("aria-label")));
for (const tag of tags) {
  if (existing.includes(tag)) continue;
  await page.click("[class*=layer_publish] input[class^=tag_input]", { label: "focus tag input" });
  await page.keyboard.insertText(tag);
  await pause(250);
  await page.keyboard.press("Enter");
  await pause(350);
}
const added = await inEditor((d) => [...d.querySelectorAll("[class*=layer_publish] [class^=tag__]")].map((e) => e.getAttribute("aria-label")));
await shot(${js(shotFile)});
const missingTags = tags.filter((t) => !added.includes(t));

// 설정 창 닫기 — Esc (창 안의 "발행 설정 닫기"는 안쪽 항목만 접는 버튼이라 쓰지 않는다). 최종 발행 버튼은 누르지 않는다
await page.keyboard.press("Escape");
await pause(800);
const stillOpen = await visible("[class*=layer_publish] button[class^=confirm_btn]");
if (stillOpen) stop("발행 설정 창이 닫히지 않았어요. 여기서 멈춰요 (발행은 하지 않았어요).");
out({ ok: true, tags: added.length, missingTags, categoryNote });
`
}

/** 저장(임시저장) — 발행 버튼은 건드리지 않는다 */
function saveScript(shotFile: string): string {
  return String.raw`
const countOf = () => inEditor((d) => { const b = d.querySelector('button[aria-label^="임시저장된 글 보기"]'); const m = b?.getAttribute("aria-label")?.match(/(\d+)개/); return m ? Number(m[1]) : null; });
const before = await countOf();
const saveBtn = await inEditor((d) => { d.querySelectorAll("[data-ego-save]").forEach((e) => e.removeAttribute("data-ego-save")); const b = [...d.querySelectorAll("button")].find((x) => /^save_btn/.test(x.className) && x.textContent.trim().startsWith("저장")); if (b) b.setAttribute("data-ego-save", "1"); return !!b; });
if (!saveBtn) { await shot(${js(shotFile)}); stop("저장(임시저장) 버튼을 찾지 못했어요."); }
await pause(800);
await page.click("[data-ego-save]", { label: "save as draft" });
let after = before;
for (let t = 0; t < 20 && after === before; t++) { await page.waitForTimeout(500); after = await countOf(); }
await pause(800);
await shot(${js(shotFile)});
if (after === before) stop("저장 버튼을 눌렀지만 임시저장 개수가 늘지 않았어요 (" + before + "개).");
out({ ok: true, before, after });
`
}

// ── 실행 ──────────────────────────────────────────────────

export interface PublishOptions {
  /** 글쓰기 화면을 열고 제목 칸만 확인 */
  check?: boolean
  /** 작성 중이던 글 팝업이 뜨면 버리고 새로 쓰기 */
  discardAutosave?: boolean
}

interface LogStep { name: string; ok: boolean | null; note?: string; shot?: string }

function writeLog(file: string, title: string, steps: LogStep[], status: string): void {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const prev = existsSync(file) ? readFileSync(file, 'utf8').replace(/^# .*\n+(아직 등록하지 않았어요.*\n)?/, '') : ''
  const rows = steps.map((s, i) => `| ${i + 1} | ${s.name} | ${s.ok === null ? '—' : s.ok ? '✔' : '✖'} | ${(s.note ?? '').replace(/\|/g, '/')} | ${s.shot ? `[보기](screenshots/${path.basename(s.shot)})` : ''} |`)
  const entry = [`## ${now} — ${status}`, '', '| # | 단계 | 결과 | 메모 | 스크린샷 |', '|---|---|---|---|---|', ...rows, '', '']
  writeFileSync(file, [`# 네이버 블로그 등록 기록 — ${title}`, '', ...entry, prev.trim() ? prev.trim() + '\n' : ''].join('\n'))
}

export async function runBlogCheck(): Promise<void> {
  const dir = path.resolve('lectures', '.ego-check')
  mkdirSync(dir, { recursive: true })
  const shot = path.join(dir, 'check.png')
  newSpaceName('check')
  console.log('▶ ego lite 연결 테스트: 네이버 블로그 글쓰기 화면 열기')
  const r = await runEgo(openEditorScript(shot, { discardAutosave: false, checkOnly: true }))
  if (!r.ok) throw new Error(`${r.reason}\n  스크린샷: ${rel(shot)}`)
  console.log(`✔ 글쓰기 화면 · 제목 입력란 확인${r.popup ? ' (작성 중인 글 팝업이 떠 있어요 — 등록할 때 --discard-autosave)' : ''}\n  스크린샷: ${rel(shot)}`)
  await runEgo('await task.finish({ keep: [] }); out({ ok: true });')
}

export async function runBlogPublish(slug: string, opts: PublishOptions = {}): Promise<void> {
  const bp = blogPaths(slug)
  if (!existsSync(bp.post) || !existsSync(bp.meta)) throw new Error(`블로그 원고가 없어요. 먼저 npm run blog -- ${slug}`)
  const meta = JSON.parse(readFileSync(bp.meta, 'utf8')) as BlogMeta
  const md = readFileSync(bp.post, 'utf8')
  const { title, blocks } = parseBlogPost(md)
  const finalTitle = title || meta.title
  // blog-meta.json의 유튜브 주소가 원고보다 나중에 들어갔으면 그것을 쓴다
  const postBlocks = blocks.map((b) => (b.type === 'youtube' && !b.url && meta.youtubeUrl ? { ...b, url: meta.youtubeUrl } : b))
  const errors = checkBlogPost(md, meta, postBlocks.flatMap((b) => (b.type === 'image' && existsSync(path.join(bp.images, b.file)) ? [b.file] : []))).filter((i) => i.level === 'error')
  const missing = postBlocks.filter((b) => b.type === 'image' && !existsSync(path.join(bp.images, b.file)))
  if (missing.length) throw new Error(`blog/images/에 없는 이미지가 있어요: ${missing.map((b) => (b.type === 'image' ? b.file : '')).join(', ')}`)
  if (errors.length) console.log(`  ⚠ 원고 검사에서 고칠 점 ${errors.length}개 (그래도 임시저장은 진행):\n${errors.map((e) => `   - ${e.message}`).join('\n')}`)

  mkdirSync(bp.shots, { recursive: true })
  const steps: LogStep[] = []
  let n = 0
  const shotPath = (name: string) => path.join(bp.shots, `${String(++n).padStart(2, '0')}-${name}.png`)
  const step = async (name: string, script: string, shot: string | null): Promise<EgoResult> => {
    const r = await runEgo(script)
    steps.push({ name, ok: r.ok, note: r.ok ? (typeof r.skipped === 'string' ? r.skipped : '') : r.reason, shot: shot ?? undefined })
    console.log(`  ${r.ok ? '✔' : '✖'} ${name}${r.ok ? (r.skipped ? ` (${String(r.skipped)})` : '') : ` — ${r.reason}`}`)
    if (!r.ok) {
      writeLog(bp.log, meta.lectureTitle, steps, '중간에 멈춤 (발행 안 함)')
      throw new Error(`${name} 단계에서 멈췄어요: ${r.reason}${shot ? `\n  스크린샷: ${rel(shot)}` : ''}\n  기록: ${rel(bp.log)}`)
    }
    return r
  }

  newSpaceName(slug)
  console.log(`▶ 네이버 블로그 임시저장: ${finalTitle} (ego lite 작업 공간 "${SPACE}")`)
  const s1 = shotPath('editor')
  await step('글쓰기 화면 열기', openEditorScript(s1, { discardAutosave: !!opts.discardAutosave }), s1)
  const s2 = shotPath('title')
  await step('제목 입력', titleScript(finalTitle, s2), s2)

  let headingNo = 0
  let imageNo = 0
  for (let i = 0; i < postBlocks.length; i++) {
    const b = postBlocks[i]
    const isLastOfSection = i === postBlocks.length - 1 || postBlocks[i + 1].type === 'heading'
    if (b.type === 'heading') headingNo++
    if (b.type === 'image') imageNo++
    const name = b.type === 'heading' ? `소제목 ${headingNo}: ${b.text}` : b.type === 'image' ? `이미지 ${imageNo}: ${b.file}` : b.type === 'youtube' ? '유튜브 링크' : `본문 문단 ${i + 1}`
    // 스크린샷: 이미지·유튜브마다, 그리고 소제목 구간이 끝날 때마다
    const shot = b.type === 'image' || b.type === 'youtube' || isLastOfSection ? shotPath(b.type === 'image' ? `image-${imageNo}` : b.type === 'youtube' ? 'youtube' : `section-${headingNo}`) : null
    await step(name, blockScript(b, i, b.type === 'image' ? path.join(bp.images, b.file) : null, shot), shot)
  }

  const sSet = shotPath('tags-category')
  const set = await step('태그·카테고리 (발행 설정 창만 열고 닫음)', settingsScript(meta.tags, meta.category, sSet), sSet)
  const setNote = [`태그 ${String(set.tags)}개`, String(set.categoryNote ?? ''), Array.isArray(set.missingTags) && set.missingTags.length ? `⚠ 안 들어간 태그: ${set.missingTags.join(', ')}` : ''].filter(Boolean).join(' · ')
  steps[steps.length - 1].note = setNote
  console.log(`    ${setNote}`)

  const sSave = shotPath('saved')
  const saved = await step('임시저장 (저장 버튼)', saveScript(sSave), sSave)
  await runEgo('await task.finish({ keep: ["p1"] }); out({ ok: true });')
  steps.push({ name: '발행', ok: null, note: '하지 않음 — 직접 확인 후 발행해 주세요' })
  writeLog(bp.log, meta.lectureTitle, steps, `임시저장 완료 (임시저장 ${String(saved.before)} → ${String(saved.after)}개, 발행 안 함)`)
  console.log(`✔ 임시저장 완료 — 발행은 하지 않았어요. 네이버 블로그 → 글쓰기 → "저장" 옆 숫자에서 열어 확인 후 발행해 주세요.\n  기록: ${rel(bp.log)}\n  스크린샷: ${rel(bp.shots)}/`)
}
