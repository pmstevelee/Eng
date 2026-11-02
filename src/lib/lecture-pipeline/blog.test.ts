import { describe, expect, it } from 'vitest'
import { bodyCharCount, cleanTags, countKeyword, findCopiedSentences, parseBlogPost, parseKeywordsMd } from './blog'

const MD = `<!-- 안내 -->
# 현재완료 시제, 쉽게 정리해요

현재완료 시제가 헷갈리죠?
두 번째 줄이에요.

## 현재완료 예문
[IMG: card-03.png | 공식 카드]
본문이에요.
[YOUTUBE: https://youtu.be/abcdefgh123 | 본편]
[YOUTUBE: 본편 링크 | 자리만]
`

describe('parseBlogPost', () => {
  it('제목·문단·소제목·이미지·유튜브를 나눈다', () => {
    const { title, blocks } = parseBlogPost(MD)
    expect(title).toBe('현재완료 시제, 쉽게 정리해요')
    expect(blocks.map((b) => b.type)).toEqual(['paragraph', 'heading', 'image', 'paragraph', 'youtube', 'youtube'])
    expect(blocks[0]).toEqual({ type: 'paragraph', text: '현재완료 시제가 헷갈리죠?\n두 번째 줄이에요.' })
    expect(blocks[2]).toEqual({ type: 'image', file: 'card-03.png', caption: '공식 카드' })
    expect(blocks[4]).toMatchObject({ url: 'https://youtu.be/abcdefgh123' })
    expect(blocks[5]).toMatchObject({ url: null })
  })
  it('본문 글자 수는 제목·표시를 빼고 이미지 설명은 넣는다', () => {
    const { blocks } = parseBlogPost('# 제목\n\n가나다\n\n[IMG: a.png | 라마]')
    expect(bodyCharCount(blocks)).toBe(5)
  })
})

describe('키워드·태그', () => {
  it('띄어쓰기 차이를 무시하고 센다', () => {
    expect(countKeyword('현재완료 시제와 현재완료시제, 현재완료', '현재완료 시제')).toBe(2)
  })
  it('태그는 #·공백·중복을 정리한다', () => {
    expect(cleanTags(['#중학 영어', '중학영어', '영문법'])).toEqual(['중학영어', '영문법'])
  })
  it('keywords.md 선정 블록을 읽는다', () => {
    expect(parseKeywordsMd('```keywords\n메인: 현재완료 시제\n서브: 현재완료 예문, 중학 영문법\n```')).toEqual({ main: '현재완료 시제', subs: ['현재완료 예문', '중학 영문법'] })
  })
})

describe('findCopiedSentences', () => {
  it('한국어 문장이 그대로 들어가면 잡고, 영어 예문은 넘어간다', () => {
    const other = '현재완료 시제의 기본 구조와 사용법을 배웁니다.\nHe has finished his lunch already.'
    const blog = '오늘은 현재완료 시제의 기본 구조와 사용법을 배웁니다! He has finished his lunch already.'
    expect(findCopiedSentences(blog, [other])).toEqual(['현재완료 시제의 기본 구조와 사용법을 배웁니다'])
  })
})
