// 단어 학습 화면(플래시카드/스펠/복습)에서 공통으로 사용하는 TTS 발음 재생 유틸.
// 브라우저가 voice 목록을 비동기로 늦게 로드하거나, lang='en-US'에 매칭되는 보이스가
// 없을 때 임의의(때로는 non-en-US) 보이스로 폴백하는 문제를 막기 위해
// en-US 보이스를 명시적으로 골라 utterance.voice에 지정한다.

let cachedVoices: SpeechSynthesisVoice[] | null = null

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (cachedVoices) return Promise.resolve(cachedVoices)

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
    // 일부 브라우저는 voiceschanged를 발생시키지 않으므로 타임아웃으로 방어
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }, 300)
  })
}

function pickUsEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((v) => v.lang === 'en-US') ??
    voices.find((v) => v.lang.toLowerCase() === 'en-us') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en'))
  )
}

/** 미국식 영어 발음(en-US)으로 단어/문장을 읽어준다. */
export async function speakEnglish(text: string, rate = 0.9): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = rate

  const voice = pickUsEnglishVoice(await loadVoices())
  if (voice) utterance.voice = voice

  window.speechSynthesis.speak(utterance)
}
