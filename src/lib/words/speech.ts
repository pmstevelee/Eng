// 단어 학습 화면(플래시카드/스펠/복습)에서 공통으로 사용하는 TTS 발음 재생 유틸.
// 브라우저가 voice 목록을 비동기로 늦게 로드하거나, lang='en-US'에 매칭되는 보이스가
// 없을 때 임의의(때로는 non-en-US) 보이스로 폴백하는 문제를 막기 위해
// en-US 보이스를 명시적으로 골라 utterance.voice에 지정한다.

let cachedVoices: SpeechSynthesisVoice[] | null = null

function loadVoices(forceRefresh = false): Promise<SpeechSynthesisVoice[]> {
  if (cachedVoices && !forceRefresh) return Promise.resolve(cachedVoices)

  const voices = window.speechSynthesis.getVoices()
  if (voices.length > 0) {
    cachedVoices = voices
    return Promise.resolve(voices)
  }

  return new Promise((resolve) => {
    const handleVoicesChanged = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)
    // 일부 브라우저(특히 안드로이드)는 음성 엔진 목록 로딩이 늦으므로 타임아웃을 넉넉히 잡는다
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }, 1000)
  })
}

// 같은 en-US 라도 엔진별 품질 차이가 커서(특히 삼성 등 일부 기기 기본 엔진은
// 한국어 억양으로 들리는 경우가 있음) 신뢰도 높은 엔진을 이름으로 우선 선택한다.
const PREFERRED_VOICE_NAME_PATTERNS = [
  'google us english',
  'samantha',
  'microsoft aria',
  'microsoft jenny',
  'microsoft guy',
  'alex',
]

function pickUsEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const enUs = voices.filter((v) => v.lang.toLowerCase() === 'en-us')
  if (enUs.length > 0) {
    const preferred = enUs.find((v) =>
      PREFERRED_VOICE_NAME_PATTERNS.some((pattern) => v.name.toLowerCase().includes(pattern))
    )
    return preferred ?? enUs[0]
  }

  // en-US 보이스가 전혀 없으면 다른 원어민 영어 억양(en-GB 등)이라도 사용해
  // 한국어 엔진으로 대체 재생되는 것을 막는다.
  return voices.find((v) => v.lang.toLowerCase().startsWith('en'))
}

/** 미국식 영어 발음(en-US)으로 단어/문장을 읽어준다. */
export async function speakEnglish(text: string, rate = 0.9): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()

  let voice = pickUsEnglishVoice(await loadVoices())
  if (!voice) {
    // 첫 로딩 시점에 엔진이 아직 준비되지 않았을 수 있으므로 한 번 더 새로고침해서 재시도
    voice = pickUsEnglishVoice(await loadVoices(true))
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = rate
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = 'en-US'
  }

  window.speechSynthesis.speak(utterance)
}
