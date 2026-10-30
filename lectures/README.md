# 위고업잉글리시 문법 강의 영상 만들기

강의 제목만 넣으면 **대본 → 음성 → 영상(mp4) → 썸네일·자막·YouTube 자료**가 나오는 도구예요.
만든 영상은 YouTube에 올린 뒤 문법학습관리(`/admin/grammar`)의 강의로 등록해요.

---

## 한눈에 보기

| 단계 | 명령 | 하는 일 | 걸리는 시간(10분 강의) |
|---|---|---|---|
| 1 | `npm run script -- "현재완료 시제"` | AI가 대본을 쓰고 **멈춰요** (검토) | 1~2분 |
| 2 | `npm run voice -- present-perfect` | 음성 만들기 + 발음 검수 | 3~5분 |
| 3 | `npm run preview -- present-perfect` | 브라우저에서 미리보기 | 바로 |
| 4 | `npm run render -- present-perfect` | 최종 mp4·썸네일·YouTube 자료 | 10~30분 (컴퓨터 성능에 따라) |
| 한 번에 | `npm run all -- "현재완료 시제"` | 1~4를 멈추지 않고 전부 | 위를 합친 시간 |

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
- 렌더하는 동안 컴퓨터가 느려질 수 있어요. 진행률(%)이 표시돼요.

### 결과물 (`lectures/present-perfect/`)

| 파일 | 내용 |
|---|---|
| `output.mp4` | 완성 영상 (1920×1080, 30fps) |
| `thumbnail.png` | YouTube 썸네일 (1280×720) |
| `subtitles.srt` | 자막 파일 (YouTube에 따로 올릴 수 있어요) |
| `youtube.md` | 제목 후보 3개, 설명란(챕터 시간 포함), 태그 15개 |
| `script.json` / `script-review.md` | 대본 |
| `qa-report.md` | 발음 검수 결과 |
| `audio/`, `narration.wav`, `timeline.json` | 음성 파일·시간표 (자동 생성) |

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

1~4단계를 멈추지 않고 실행해요. 검수에 떨어진 문장은 **한 번 자동으로 다시 만들어요**.
대본을 검토하지 않고 바로 만들기 때문에, 처음 몇 편은 단계별로 실행하는 것을 추천해요.

---

## 비용 (2026-10 기준)

| 항목 | 10분 강의 1편 |
|---|---|
| ElevenLabs 음성 (Eleven v4, 1천 자당 약 $0.08) | 약 4,000~5,000자 → 약 $0.4 |
| OpenAI 대본 (gpt-4.1) | 약 $0.1 |
| Whisper 발음 검수 | 약 $0.06 |

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

---

## 참고 (개발자용)

- **TTS 공급자 바꾸기:** `.env.local`의 `LECTURE_TTS_PROVIDER=elevenlabs | google | openai`
  - Google: `GOOGLE_TTS_API_KEY`가 필요해요. Chirp 3: HD 보이스를 쓰고, 단어 타임스탬프는 Whisper로 대신해요.
  - OpenAI TTS: 2027-01-06 종료 예정이라 예비용이에요.
- **코드 위치**
  - CLI: `scripts/lecture/`
  - 대본 형식·정규화·타이밍·검수: `src/lib/lecture-pipeline/`
  - 영상 컴포넌트(슬라이드 10종): `src/components/lecture-video/`
  - Remotion 진입점: `remotion/lecture-pipeline.ts`
- **Remotion 라이선스:** 직원 4명 이상 회사는 회사 라이선스가 필요해요. `REMOTION_LICENSE_KEY`에 넣어요.
- **글꼴:** Pretendard(OFL)를 `public/fonts/pretendard/`에 넣어 두었어요.
