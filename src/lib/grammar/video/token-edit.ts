// 장면 편집 — 화면 문장(Token[])을 고치는 순수 함수 (관리자 장면 편집 화면 전용)

import { joinTokens, needsSpaceBetween, type Token, type TokenRole } from '../../../types/grammar-video'

/** 문장을 단어·문장부호 조각으로 나눈다 (아포스트로피·하이픈은 단어에 붙임) */
export function splitWords(text: string): string[] {
  return text.match(/[A-Za-z0-9가-힣À-ÿ]+(?:['’\-][A-Za-z0-9가-힣À-ÿ]+)*|[^\sA-Za-z0-9가-힣À-ÿ]/g) ?? []
}

/**
 * 고친 문장을 다시 조각으로 나누되, 예전 조각과 같은 말이 그대로 있으면 그 묶음·색을 살린다.
 * (예: "The letter"(목적어)가 그대로 있으면 두 단어를 한 조각·주황으로 유지)
 */
export function retokenize(text: string, prev: Token[]): Token[] {
  const words = splitWords(text)
  const prevGroups = prev
    .map((t) => ({ words: splitWords(t.text), role: t.role }))
    .filter((g) => g.words.length > 0)
    .sort((a, b) => b.words.length - a.words.length)
  const used = new Set<number>()
  const out: Token[] = []
  let i = 0
  while (i < words.length) {
    let matched = false
    for (let gi = 0; gi < prevGroups.length; gi++) {
      const g = prevGroups[gi]
      if (used.has(gi) || !g.role) continue
      if (g.words.every((w, k) => words[i + k] === w)) {
        out.push({ text: joinTokens(g.words.map((w) => ({ text: w }))), role: g.role })
        used.add(gi)
        i += g.words.length
        matched = true
        break
      }
    }
    if (!matched) {
      out.push({ text: words[i] })
      i += 1
    }
  }
  return out
}

/** 조각 색 바꾸기 (null이면 색 없음) */
export function setTokenRole(tokens: Token[], index: number, role: TokenRole | null): Token[] {
  return tokens.map((t, i) => {
    if (i !== index) return t
    return role ? { text: t.text, role } : { text: t.text }
  })
}

/** 조각을 다음 조각과 합친다 (색은 앞 조각 기준) */
export function mergeWithNext(tokens: Token[], index: number): Token[] {
  if (index < 0 || index >= tokens.length - 1) return tokens
  const a = tokens[index]
  const b = tokens[index + 1]
  const text = `${a.text}${needsSpaceBetween(a.text, b.text) ? ' ' : ''}${b.text}`
  const merged: Token = a.role ? { text, role: a.role } : b.role ? { text, role: b.role } : { text }
  return [...tokens.slice(0, index), merged, ...tokens.slice(index + 2)]
}

/** 여러 단어 조각을 단어로 나눈다 (같은 색 유지) */
export function splitToken(tokens: Token[], index: number): Token[] {
  const t = tokens[index]
  if (!t) return tokens
  const words = splitWords(t.text)
  if (words.length <= 1) return tokens
  const parts = words.map((w) => (t.role ? { text: w, role: t.role } : { text: w }))
  return [...tokens.slice(0, index), ...parts, ...tokens.slice(index + 1)]
}
