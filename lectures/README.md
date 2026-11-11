# 위고업잉글리시 문법 강의 영상 만들기

강의 제목만 넣으면 **대본 → 음성 → 영상(mp4) → 썸네일·자막·YouTube 자료**가 나오는 도구예요.
본 강의에는 **일상영어회화 패턴 + 따라하기** 파트가 들어가고, 그 패턴으로 **유튜브 숏폼**과 **인스타그램·쓰레드 카드뉴스**까지 만들어요.
만든 영상은 YouTube에 올린 뒤 문법학습관리(`/admin/grammar`)의 강의로 등록해요.

---

## 한눈에 보기

| 단계 | 명령 | 하는 일 | 걸리는 시간(10분 강의) |
|---|---|---|---|
| 1 | `npm run script -- "현재완료 시제"` | AI가 대본을 쓰고 **멈춰요** (검토) | 1~2분 |
| 2 | `npm run voice -- present-perfect` | 음성 만들기 + 발음 검수 | 3~5분 |
| 3 | `npm run preview -- present-perfect` | 브라우저에서 미리보기 | 바로 |
| 4 | `npm run render -- present-perfect` | 최종 mp4·썸네일·YouTube 자료 | 10~30분 (컴퓨터 성능에 따라) |
| 숏폼 1 | `npm run shorts -- present-perfect` | 패턴마다 숏폼 대본을 쓰고 **멈춰요** (검토) | 1분 |
| 숏폼 2 | `npm run shorts:render -- present-perfect` | 숏폼 음성 + 1080×1920 mp4 | 한 편에 2~4분 |
| 카드뉴스 1 | `npm run cardnews -- present-perfect` | 카드 문구·인스타·쓰레드 글을 쓰고 **멈춰요** (검토) | 1분 |
| 카드뉴스 2 | `npm run cardnews:render -- present-perfect` | 카드 이미지 8~10장 (1080×1350 PNG) | 1분 |
| 블로그 1 | `npm run blog -- present-perfect` | 네이버 블로그 키워드·원고를 쓰고 **멈춰요** (검토) | 2~3분 |
| 블로그 2 | `npm run blog:publish -- present-perfect` | ego lite로 네이버 블로그에 **임시저장** (발행 안 함) | 3~6분 |
| 한 번에 | `npm run all -- "현재완료 시제"` | 본 강의 → 숏폼 → 카드뉴스 전부 (**검토 지점마다 멈춤**) | 위를 합친 시간 |

`present-perfect` 같은 영문 이름은 **slug(폴더 이름)** 예요. 1단계가 끝날 때 화면에 알려 줘요.

---

## 처음 한 번만: 준비

### 1. 터미널 열기
Mac에서 `터미널` 앱을 열고 프로젝트 폴더로 이동해요.

```bash
cd ~/Downloads/ivy
```

### 2. API 키 확인
`.env.local` 파일(프로젝트 폴더 안, 숨김 파일)에 아래 값이 있어야 해요. 이미 넣어 두었어요.

| 이름 | 무엇 | 어디서 받나 |
|---|---|---|
| `ELEVENLABS_API_KEY` | 음성 만들기 | elevenlabs.io → 프로필 → API Keys |
| `LECTURE_KO_VOICE_ID` | 한국어 선생님 목소리 (지금: sunyong) | ElevenLabs → Voices → 목소리 → ID 복사 |
| `LECTURE_EN_VOICE_ID` | 영어 예문 목소리 (지금: Matilda) | 위와 같음 |
| `OPENAI_API_KEY` | 대본 쓰기 + 발음 검수(Whisper) | platform.openai.com → API keys |
| `LECTURE_SCRIPT_MODEL` | 대본 쓰는 AI 모델 (지금: gpt-4.1) | 바꿀 필요 없음 |

설정 항목 전체 목록은 `.env.example`의 "강의 영상 파이프라인" 부분에 있어요.
⚠️ `.env.local`은 비밀번호와 같아요. 다른 사람에게 보내거나 Git에 올리지 마세요.

### 3. 필요한 프로그램
- **Node.js**: 이미 설치되어 있어요 (`node -v`로 확인).
- **Google Chrome**: 영상 렌더에 써요. 설치되어 있어야 해요.
- **ffmpeg**: 따로 설치하지 않아도 돼요. 영상 도구(Remotion)에 들어 있는 ffmpeg를 자동으로 써요.

---

## 1단계: 대본 만들기

```bash
npm run script -- "현재완료 시제"
```

- 강의 제목으로 문법학습관리의 포인트(또는 단원)를 찾아, 그곳의 **관리자 원고와 개념 정리**를 기준으로 대본을 써요.
- 다른 포인트를 쓰고 싶으면 코드로 지정해요: `npm run script -- "현재완료 시제" --point G03-03-01`
- 길이를 바꾸려면: `--minutes 5` (기본 10분)
- 일상회화 패턴 수를 바꾸려면: `--patterns 3` (기본: 3분 이하 강의는 1개, 그 외 2개 · `0`이면 패턴 파트 없음). **패턴 수 = 숏폼 편수**예요.
- 끝나면 `lectures/present-perfect/` 폴더가 생겨요.

### 검토하기
`lectures/present-perfect/script-review.md`를 열어 읽어요.

- **🇰🇷** 한국어 선생님 목소리, **🇺🇸** 원어민 영어 목소리로 읽을 문장이에요.
- **▶2** 는 "이 문장을 읽을 때 화면의 2번째 요소가 나타난다"는 뜻이에요.
- **(읽기: …)** 는 발음 사전으로 바꿔 읽는 문장이에요 (예: to부정사 → 투부정사).
- 맨 위 **확인할 점**을 꼭 보세요. 원고가 없는 포인트면 설명이 맞는지 특히 확인해요.

### 고치기
`script.json`을 텍스트 편집기(VS Code 추천)로 열어 고쳐요.

- 문장 고치기: 해당 세그먼트의 `"text"`를 고쳐요.
- 화면 글자 고치기: 해당 슬라이드의 `"data"`를 고쳐요.
- 따옴표(`"`)와 쉼표(`,`)를 지우지 않게 조심해요. 깨지면 다음 단계에서 어디가 틀렸는지 알려 줘요.
- 한국어 문장 안에 영어를 쓰면 다음 단계에서 **자동으로 영어 목소리 조각으로 나눠요**.

---

## 2단계: 음성 만들기 + 발음 검수

```bash
npm run voice -- present-perfect
```

하는 일:
1. 한국어는 한국어 목소리로, 영어 예문·단어는 원어민 영어 목소리로 따로 만들어요.
2. 앞뒤 무음을 정리하고 쉼을 넣어요. 같은 언어는 0.3초, 언어가 바뀔 때 0.5초, 슬라이드가 바뀔 때 0.8초예요.
3. 전체 음량을 **-16 LUFS**(YouTube 권장 수준)로 맞춰요.
4. **Whisper**로 다시 받아 적어 원문과 비교해요. 결과는 `qa-report.md`에 남아요.

이미 만든 문장은 다시 만들지 않아요(요금 절약). 문장을 고친 세그먼트만 새로 만들어요.

### 검수 결과 보기
`qa-report.md`의 **확인이 필요한 세그먼트** 표를 봐요.

- ❌가 있으면 `audio/clean/세그먼트id.wav`를 직접 들어 보세요. Whisper도 틀릴 때가 있어요.
- 이상하면 다시 만들어요:

```bash
npm run voice -- present-perfect --regen-failed
```

특정 문장만 다시 만들 때 (세그먼트 id는 리포트에 있어요):

```bash
npm run voice -- present-perfect --regen s3-2,s5-1
```

### 발음이 이상한 단어가 계속 나오면
`lectures/pronunciation-dict.json`에 추가해요. 모든 강의에 적용돼요.

```json
"ko": {
  "to부정사": "투부정사",
  "새로운 말": "이렇게 읽기"
}
```

---

## 3단계: 미리보기

```bash
npm run preview -- present-perfect
```

- 브라우저가 열리면 왼쪽 목록에서 **WeGoUpLecture**를 눌러요.
- 스페이스바로 재생/정지해요.
- 끝내려면 터미널에서 `Ctrl + C`를 눌러요.
- 자막 없이 보려면 `--no-subtitles`를 붙여요.

---

## 4단계: 최종 영상 만들기

```bash
npm run render -- present-perfect
```

- 영상에 하단 자막을 넣지 않으려면: `npm run render -- present-perfect --subtitles off`
- 렌더하는 동안 컴퓨터가 느려질 수 있어요. 30초 조각 단위로 진행 상황이 표시돼요.
- **깜박임 자동 검사:** 조각마다 빈 화면 같은 프레임이 끼어들었는지 검사하고, 걸리면 그 조각만 다시 렌더해요. 마지막에 완성본 전체를 한 번 더 검사해요. `⚠ 깜박임 … 다시 렌더`는 정상 동작이에요.

### 결과물 (`lectures/present-perfect/`)

| 파일 | 내용 |
|---|---|
| `output.mp4` | 완성 영상 (**2560×1440**, 30fps) — YouTube는 1440p 이상 업로드에 더 좋은 압축을 써서 글자가 선명해요. 1080p로 낮추지 마세요 |
| `thumbnail.png` | YouTube 썸네일 (1280×720) |
| `subtitles.srt` | 자막 파일 (YouTube에 따로 올릴 수 있어요) |
| `youtube.md` | 제목 후보 3개, 설명란(챕터 시간 포함), 태그 15개 |
| `script.json` / `script-review.md` | 대본 |
| `qa-report.md` | 발음 검수 결과 |
| `audio/`, `narration.wav`, `timeline.json` | 음성 파일·시간표 (자동 생성) |

---

## 일상영어회화 패턴 + 따라하기 (본 강의 안)

대본을 만들면 문법 설명·퀴즈 뒤, 정리 앞에 패턴마다 슬라이드 3장이 들어가요.

| 슬라이드 | 화면 | 음성 |
|---|---|---|
| **회화 패턴** (`pattern`) | 패턴 공식을 크게 (빈칸 `~`은 인디고 박스) + 한국어 의미 + 예문 | 선생님 소개 → 원어민이 패턴 읽기 → 의미 설명 → 예문 |
| **대화** (`dialogue`) | A/B 말풍선 2~4턴. 말하는 쪽 말풍선이 그 순간 나타나고 테두리가 켜져요 | **A = 남자 원어민, B = 여자 원어민** |
| **따라하기** (`repeat`) | 문장 + 해석. 강세 단어는 **굵게**, 연음은 밑줄 + 작은 발음 힌트(예: want to → 워너) | 1회차 **0.85배** → 따라 할 시간 → 2회차 **1.0배** → 따라 할 시간 |

- 따라 할 시간은 **"그 문장 음성 길이 × 1.5 + 1초"** 로 자동 계산돼요. 기다리는 동안 화면에 "따라 해보세요 🎤", 원형 카운트다운, 마이크 펄스가 나와요.
- 원어민 부분(패턴 읽기·대화·따라하기)은 AI가 아니라 **화면 내용 그대로 자동으로** 만들어져요. 화면 문장을 고치면 읽는 문장도 같이 바뀌어요.

### script.json에서 고치기

```json
{ "id": "s9", "type": "repeat", "data": {
  "sentence": "Have you ever eaten sushi?", "ko": "초밥 먹어 본 적 있어?",
  "stress": ["ever", "eaten"],
  "links": [{ "text": "Have you", "hint": "해뷰" }]
} }
```

세그먼트에는 `type`이 붙어 있어요: `"pattern"`(패턴 읽기), `"dialogue"`(대화, `speaker` "A"/"B"), `"repeat"`(따라하기).
따라하기 세그먼트는 `speed`(읽기 속도)와 `pauseSec`(따라 할 시간, 초)를 바꿀 수 있어요. `pauseSec`를 지우면 자동 계산으로 돌아가요.

```json
{ "id": "s9-2", "slideId": "s9", "lang": "en", "type": "repeat", "speed": 0.85, "text": "Have you ever eaten sushi?", "emotion": "설명" }
{ "id": "s9-4", "slideId": "s9", "lang": "en", "type": "repeat", "speed": 1.0, "pauseSec": 4, "text": "Have you ever eaten sushi?", "emotion": "설명" }
```

### 따라 할 시간에 작은 배경음 깔기 (선택)

무음 대신 아주 작은 소리(-30dB 이하, 기본 -34dB)를 깔 수 있어요.

```bash
npm run voice -- present-perfect --repeat-bed pad
```

- `pad`: 잔잔한 화음 · `noise`: 잔잔한 잡음 · `off`: 무음(기본)
- 크기 조절: `--bed-db -36` (숫자가 작을수록 작게, -30보다 크게는 안 돼요)
- 늘 켜 두려면 `.env.local`에 `LECTURE_REPEAT_BED=pad`

### 구간만 빨리 렌더해 보기

전체를 렌더하지 않고 몇 장만 확인할 수 있어요. `section-s9.mp4`가 생겨요.

```bash
npm run render -- present-perfect --section s9
```

---

## 유튜브 숏폼 만들기

본 강의의 **일상회화 패턴 1개 = 숏폼 1편** (1080×1920, 30fps, 45~60초)이에요. 본 강의 대본·음성이 먼저 있어야 해요.

### 1. 숏폼 대본 (여기서 멈춰요)

```bash
npm run shorts -- present-perfect
```

- 구성: **훅**(첫 2초 질문) → **패턴** → **예문 3개** → **따라하기 1회**(자연 속도, 따라 할 시간 = 음성 길이 × 1.2) → **채널 안내**
- 내레이션은 본 강의보다 빠르게(**한국어 1.1배**) 따로 만들어요.
- `shorts/shorts-01-review.md`를 읽고, 고칠 곳은 `shorts/shorts-01-script.json`에서 고쳐요.
- 이미 있는 숏폼 대본은 덮어쓰지 않아요 (고친 내용 보호). 새로 쓰려면 `--force`, 하나만: `--only 2`

### 2. 음성 + 렌더

```bash
npm run shorts:render -- present-perfect
```

- 하나만: `--only 1` · 발음 검수 불합격 다시 만들기: `--only 1 --regen-failed` · 음성만: `--voice-only`
- 길이가 45~60초를 벗어나면 알려 줘요. 숏폼 대본의 한국어 문장을 늘리거나 줄여요.
- 화면: 자막은 **화면 중앙 위**에 큰 글씨로, 읽는 단어가 금색으로 바뀌어요. 아래 20%·오른쪽 버튼 자리에는 글을 두지 않아요 (YouTube 화면에 가려지는 곳).

### 결과물 (`lectures/present-perfect/shorts/`)

| 파일 | 내용 |
|---|---|
| `shorts-01.mp4` | 숏폼 영상 |
| `shorts-01-script.json` / `shorts-01-review.md` | 숏폼 대본 |
| `shorts-01-youtube.md` | 제목 후보 3개(#Shorts), 설명, 해시태그 |
| `shorts-01-qa-report.md`, `shorts-01.srt`, `shorts-01-narration.wav`, `shorts-01-timeline.json` | 발음 검수·자막·음성 (자동 생성) |

---

## 인스타그램·쓰레드 카드뉴스 만들기

본 강의 대본으로 **1080×1350(4:5) PNG 8~10장**을 만들어요. 인스타그램과 쓰레드에 같이 써요.

### 1. 카드 문구 (여기서 멈춰요)

```bash
npm run cardnews -- present-perfect
```

| 장 | 내용 |
|---|---|
| 1 | 표지: 강의 주제 + 훅 문구 |
| 2 | "이거 맞을까요?" 흔한 실수 문장 |
| 3~5 | 핵심 문법 정리 (공식, 예문) |
| 6 | 흔한 실수 TOP 3 |
| 7 | 퀴즈 1문제 (정답은 다음 장) |
| 8 | 정답과 해설 |
| 9 | 오늘의 일상회화 패턴 + 예문 (패턴이 없는 강의면 빠져요) |
| 10 | 저장·팔로우 + "전체 강의는 유튜브에서" |

- 한 장 최대 **5줄**, 글자 최소 **40px**, 오른쪽 아래 페이지 번호(1/10).
- `cardnews/cardnews-script.md`를 읽고, 고칠 곳은 `cardnews/cardnews.json`에서 고쳐요. 5줄을 넘는 카드는 맨 위 **확인할 점**에 나와요.
- 캡션도 같이 만들어요: `instagram-caption.md`(본문 2,000자 이내 + 해시태그 20~25개), `threads-post.md`(500자 이내 대화체 + 해시태그 3~5개, 질문으로 끝남). 이 두 파일은 바로 고쳐 쓰면 돼요.
- 이미 있으면 덮어쓰지 않아요. 새로 쓰려면 `--force`

### 2. 이미지 만들기

```bash
npm run cardnews:render -- present-perfect
```

- 몇 장만: `--only 1,3,9`
- 결과: `cardnews/card-01.png` ~ `card-10.png`

---

## 네이버 블로그 글 만들기 (SEO)

본 강의 대본으로 **네이버 블로그용 글을 새로** 써요. 유튜브 설명·카드뉴스 캡션 문장은 그대로 쓰지 않아요(같은 문장이 들어가면 자동으로 다시 쓰게 해요 — 네이버 유사 문서 방지).

### 1. 키워드 + 원고 (여기서 멈춰요)

```bash
npm run blog -- present-perfect
```

하는 일:
1. **키워드 제안** → `blog/keywords.md` (메인 1개 + 서브 3~5개, 후보와 고른 이유)
2. **이미지 준비** → `blog/images/` 카드뉴스 PNG(없는 장은 자동 렌더) + 강의 슬라이드 캡처(1920×1080)
3. **원고** → `blog/blog-post.md` + `blog/blog-meta.json` (제목·태그·카테고리·이미지 순서·유튜브 주소)

원고 규칙(자동 검사): 제목은 메인 키워드로 시작 30자 안팎 · 본문 2,000~3,000자 · 소제목 6개 · 이미지 6~10장(설명 포함) · 메인 키워드 5~8번 · 태그 10~20개 · "~해요"체 짧은 문단.
흐름: 도입(고민) → 개념 → 공식 → 예문 → 흔한 실수 → 일상회화 패턴 → 퀴즈와 정리 → 댓글 질문 + 위고업잉글리시 소개. 중간에 유튜브 본편 자리 `[YOUTUBE: …]`가 하나 들어가요.

옵션:
- 키워드만 먼저 보고 싶으면: `--keywords-only` → `keywords.md`의 **선정** 블록을 고친 뒤 `npm run blog -- present-perfect` (고친 키워드로 원고를 써요)
- 유튜브 본편 주소 넣기: `--youtube https://youtu.be/영상id` (안 넣으면 문법학습관리에 등록된 본사 강의 주소를 찾아요. 없으면 자리만 표시)
- 카테고리: `--category "영어문법"` (기본값 `영어문법`, `.env.local`의 `NAVER_BLOG_CATEGORY`로 바꿀 수 있어요). **내 블로그에 있는 카테고리 이름과 똑같아야** 해요.
- 이미 있으면 덮어쓰지 않아요. 새로 쓰려면 `--force` · 슬라이드 캡처를 다시 하려면 `--recapture`

### 검토·고치기
`blog/blog-post.md`를 열어 바로 고쳐요.

```
# 제목
도입 문단 (빈 줄로 문단 구분)
## 소제목
[IMG: card-03.png | 이미지 아래 설명]
[YOUTUBE: https://youtu.be/영상id | 영상 소개]
```

- 이미지는 `blog/images/` 안의 파일 이름만 쓸 수 있어요.
- 제목·태그·카테고리는 `blog/blog-meta.json`에서 고쳐요 (제목은 `blog-post.md` 첫 줄이 우선).

### 2. 네이버 블로그에 임시저장

```bash
npm run blog:publish -- present-perfect
```

ego lite 브라우저로 내 블로그 글쓰기 화면을 열어 **제목 → 본문(소제목 서식) → 이미지 → 유튜브 → 태그·카테고리**를 차례로 넣고 **임시저장(저장)까지만** 해요. **발행은 하지 않아요** — 마지막 확인과 발행은 직접 해 주세요.

- **태그·카테고리:** 네이버 에디터에서 이 칸은 상단 **발행** 버튼이 여는 "발행 설정" 창에만 있어요. 그래서 그 창을 **열기만** 해서 태그를 넣고 카테고리를 고른 뒤 **Esc로 닫아요**. 창 안의 최종 **발행** 버튼은 절대 누르지 않아요.
- **카테고리가 블로그에 없으면** 손대지 않고(기본 카테고리 그대로) 기록에 ⚠로 남겨요. 네이버 블로그 관리 → 메뉴·글·동영상 관리 → 카테고리에서 같은 이름으로 만들거나, `--category`로 있는 이름을 넣어요.
- **유튜브:** 본문에 주소를 넣으면 네이버가 영상 카드로 바꿔요. 주소가 없으면 그 단계는 건너뛰어요 (`npm run blog -- 폴더이름 --force --youtube 주소`로 원고를 다시 만들거나, `blog-meta.json`의 `youtubeUrl`에 넣어요).
- **"작성 중인 글이 있습니다" 팝업**이 뜨면 멈춰요. 그 글을 버리고 새로 쓰려면 `--discard-autosave`를 붙여요 (이미 **저장**한 임시저장 글은 지워지지 않아요).
- 끝나면 ego lite에 저장된 글 화면을 열어 둬요. 상단 **저장** 옆 숫자를 누르면 임시저장 글 목록이 나와요.

- 단계마다 스크린샷을 `blog/screenshots/`에 남기고, 결과를 `blog/publish-log.md`에 적어요.
- 에디터 화면이 예상과 다르거나 버튼을 못 찾으면 **추측해서 누르지 않고 멈춰요**. 그때 스크린샷을 보고 알려 주세요.
- 사람처럼 단계 사이에 잠깐씩 쉬어요. 글 하나에 3~6분쯤 걸려요.
- 연결만 확인하려면: `npm run blog:publish -- --check` (글쓰기 화면을 열고 제목 칸이 보이는지만 봐요)

---

## ego lite 설정 (처음 한 번만)

ego lite는 사람과 AI가 같이 쓰는 크롬 기반 브라우저예요. 블로그 등록 단계가 이 브라우저를 움직여요. ([citrolabs/ego-lite](https://github.com/citrolabs/ego-lite))

1. **설치:** GitHub 페이지에서 Mac용 DMG를 받아요 (Apple 칩이면 Apple Silicon, 예전 Mac이면 Intel). 열어서 `ego lite`를 응용 프로그램 폴더로 끌어 놓아요.
2. **처음 실행:** `ego lite`를 열면 Chrome 데이터를 가져올지 물어요. 가져오면 크롬에 로그인된 사이트를 그대로 써요 (안 가져와도 돼요).
3. **Claude Code 연결 확인:** 설치하면 `ego-browser` 명령과 스킬이 자동으로 들어가요. 터미널에서 확인해요.
   ```bash
   ego-browser skill | head -3
   ```
   `ego-browser usage guide v…`가 나오면 연결된 거예요. `command not found`면 ego lite를 한 번 실행한 뒤 터미널을 새로 열어요. 스킬이 없으면 `npx skills add citrolabs/ego-lite`.
4. **네이버 로그인 (직접):** ego lite에서 [nid.naver.com](https://nid.naver.com)에 들어가 **직접 로그인**해요. "로그인 상태 유지"를 켜 두면 다음부터 다시 안 해도 돼요.
   - ⚠️ 아이디·비밀번호는 코드나 `.env.local`에 **절대 넣지 않아요.** 로그인은 브라우저에만 남아요.
   - 등록 중에 로그인 화면이 나오면 도구가 멈추고 알려 줘요. ego lite에서 로그인한 뒤 같은 명령을 다시 실행해요.
5. **연결 테스트:** `npm run blog:publish -- --check` → "제목 입력란 확인 ✔"이 나오면 끝이에요.
- 업데이트 알림(`[ego-browser:notice]`)이 나오면 `ego-browser upgrade`로 올려요.
- AI가 브라우저를 쓰는 동안 ego lite에 작업 공간(Space)이 따로 생겨요. 언제든 직접 멈추거나 넘겨받을 수 있어요.

---

## 5단계: YouTube 업로드 → 문법학습관리 등록

1. YouTube Studio에서 `output.mp4`를 올려요.
2. `youtube.md`에서 제목·설명·태그를 복사해 붙여요. 썸네일은 `thumbnail.png`를 써요.
3. 자막을 따로 올리려면 YouTube Studio → 자막 → `subtitles.srt` 업로드를 해요.
4. 올린 영상 주소를 복사해요.
5. 관리자 화면 `/admin/grammar`에서 해당 포인트를 열어요. **강의** 탭 → **강의 등록**을 누르고 주소를 넣어 저장해요.

---

## 한 번에 전부: `npm run all`

```bash
npm run all -- "현재완료 시제"
```

**본 강의 → 숏폼 → 카드뉴스**를 차례로 실행하고, 검토 지점 3곳에서 멈춰요.

1. 본 강의 대본 → ⏸ `script-review.md` 검토 → 음성 → 렌더
2. 숏폼 대본 → ⏸ `shorts-NN-review.md` 검토 → 숏폼 음성·렌더
3. 카드뉴스 문구 → ⏸ `cardnews-script.md` 검토 → 카드 이미지

- 멈추면 파일을 고친 뒤 터미널에서 **Enter**를 눌러 이어 가요. 그만하려면 `q` + Enter (이어서 할 명령을 알려 줘요).
- 검수에 떨어진 문장은 **한 번 자동으로 다시 만들어요**.
- 멈추지 않고 끝까지: `--yes` · 패턴 수: `--patterns 2` · 배경음: `--repeat-bed pad`

---

## 비용 (2026-10 기준)

| 항목 | 10분 강의 1편 |
|---|---|
| ElevenLabs 음성 (Eleven v4, 1천 자당 약 $0.08) | 약 4,000~5,000자 → 약 $0.4 |
| OpenAI 대본 (gpt-4.1) | 약 $0.1 |
| Whisper 발음 검수 | 약 $0.06 |
| 숏폼 1편 (음성 약 400자 + 대본) | 약 $0.05 |
| 카드뉴스 (문구·캡션) | 약 $0.05 |

지금 쓰는 ElevenLabs **Starter** 요금제는 한 달에 약 38,000자예요. 다시 만들기까지 포함하면 **한 달에 강의 7~8편** 정도 만들 수 있어요.
더 만들려면 Creator 요금제(월 $22, 약 275,000자)로 올리세요.

---

## 자주 겪는 문제

| 메시지 | 해결 |
|---|---|
| `인증 오류예요` | `.env.local`의 API 키를 확인해요 |
| `크레딧(사용 한도)이 부족해요` | ElevenLabs 요금제·남은 글자 수를 확인해요 |
| `script.json에 고칠 곳이 있어요` | 알려 준 위치(슬라이드·세그먼트 id)를 고쳐요 |
| `script.json이 음성을 만든 뒤 바뀌었어요` | `npm run voice -- 폴더이름`을 다시 실행해요 (바뀐 문장만 새로 만듦) |
| `맞는 문법 포인트를 찾지 못했어요` | `--point 포인트코드`로 지정해요 (관리자 화면에서 코드 확인) |
| 렌더가 시작하자마자 꺼짐 | Google Chrome이 설치되어 있는지 확인해요 |
| `본 강의에 일상회화 패턴(pattern 슬라이드)이 없어요` | 대본을 `--patterns 1` 이상으로 다시 만들어요 |
| `이미 …cardnews.json이 있어요` | 고친 내용 보호예요. 새로 만들려면 `--force` |
| 숏폼 길이가 45~60초를 벗어남 | `shorts-NN-script.json`의 한국어 문장을 늘리거나 줄인 뒤 `npm run shorts:render -- 폴더이름 --only N` |
| 대화 남자 목소리를 바꾸고 싶어요 | `.env.local`에 `LECTURE_EN_MALE_VOICE_ID=보이스id` (여자는 `LECTURE_EN_FEMALE_VOICE_ID`) |

---

## 참고 (개발자용)

- **TTS 공급자 바꾸기:** `.env.local`의 `LECTURE_TTS_PROVIDER=elevenlabs | google | openai`
  - Google: `GOOGLE_TTS_API_KEY`가 필요해요. Chirp 3: HD 보이스를 쓰고, 단어 타임스탬프는 Whisper로 대신해요.
  - OpenAI TTS: 2027-01-06 종료 예정이라 예비용이에요.
- **코드 위치**
  - CLI: `scripts/lecture/`
  - 대본 형식·정규화·타이밍·검수: `src/lib/lecture-pipeline/`
  - 영상 컴포넌트(슬라이드 13종): `src/components/lecture-video/` — 패턴·대화·따라하기 `pattern-slides.tsx`, 공용 부품(마이크·카운트다운·강세/연음 문장) `practice.tsx`, 숏폼 `shorts-video.tsx`, 카드뉴스 `card-still.tsx`
  - 패턴 묶음·원어민 세그먼트 자동 구성: `src/lib/lecture-pipeline/patterns.ts` · 숏폼 대본·자막: `shorts.ts` · 카드뉴스 형식·줄 수 검사: `cardnews.ts`
  - 숏폼·카드뉴스 AI: `scripts/lecture/ai-social.ts`
  - **속도:** ElevenLabs `eleven_v4`는 `voice_settings.speed`를 무시해요(2026-11 확인). 그래서 속도를 정한 문장(따라하기 0.85배, 숏폼 한국어 1.1배)은 음성 단계에서 ffmpeg `atempo`로 빠르기만 바꿔요(음 높이 그대로). `LECTURE_TTS_SPEED=native|stretch`로 바꿀 수 있어요.
  - Remotion 진입점: `remotion/lecture-pipeline.ts` (컴포지션: WeGoUpLecture, WeGoUpThumbnail, WeGoUpShorts 1080×1920, WeGoUpCard 1080×1350)
- **Remotion 라이선스:** 직원 4명 이상 회사는 회사 라이선스가 필요해요. `REMOTION_LICENSE_KEY`에 넣어요.
- **글꼴:** Pretendard(OFL)를 `public/fonts/pretendard/`에 넣어 두었어요.
