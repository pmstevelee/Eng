import { describe, expect, it } from 'vitest'
import {
  formatLectureDuration,
  parseLectureDuration,
  parseYoutubeUrl,
  pickLectureForAcademy,
  validateLectureInput,
} from './lecture-input'

const ID = 'dQw4w9WgXcQ'

describe('parseYoutubeUrl', () => {
  it.each([
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=abc&t=30`,
    `youtu.be/${ID}`,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?feature=share&v=${ID}&t=1m`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/embed/${ID}?rel=0`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `https://youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('영상 ID 추출: %s', (url) => {
    expect(parseYoutubeUrl(url)).toBe(ID)
  })

  it.each([
    '',
    '   ',
    'not a url',
    'https://vimeo.com/123456789',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/channel/UCabcdefghijk',
    `https://evil.com/watch?v=${ID}`,
    `https://youtu.be/${ID}extra`,
  ])('형식이 틀리면 null: %s', (url) => {
    expect(parseYoutubeUrl(url)).toBeNull()
  })
})

describe('강의 길이', () => {
  it('초 → 표시', () => {
    expect(formatLectureDuration(65)).toBe('1:05')
    expect(formatLectureDuration(3723)).toBe('1:02:03')
    expect(formatLectureDuration(null)).toBe('-')
    expect(formatLectureDuration(0)).toBe('-')
  })
  it('표시 → 초', () => {
    expect(parseLectureDuration('12:05')).toBe(725)
    expect(parseLectureDuration('1:02:03')).toBe(3723)
    expect(parseLectureDuration('90')).toBe(90)
    expect(parseLectureDuration('1:75')).toBeNull()
    expect(parseLectureDuration('abc')).toBeNull()
    expect(parseLectureDuration('')).toBeNull()
  })
})

describe('validateLectureInput', () => {
  const base = { url: `https://youtu.be/${ID}`, title: ' 현재완료 강의 ', durationSec: 600, notesUrl: '' }

  it('정상 입력', () => {
    expect(validateLectureInput(base)).toEqual({
      ok: true,
      value: { title: '현재완료 강의', videoId: ID, durationSec: 600, notesUrl: null },
    })
  })
  it('잘못된 링크', () => {
    const r = validateLectureInput({ ...base, url: 'https://vimeo.com/1' })
    expect(r.ok).toBe(false)
  })
  it('제목 없음', () => {
    expect(validateLectureInput({ ...base, title: '  ' }).ok).toBe(false)
  })
  it('길이는 선택, 범위 밖은 오류', () => {
    expect(validateLectureInput({ ...base, durationSec: null }).ok).toBe(true)
    expect(validateLectureInput({ ...base, durationSec: -1 }).ok).toBe(false)
    expect(validateLectureInput({ ...base, durationSec: 99999 }).ok).toBe(false)
  })
  it('노트 링크는 http(s)만', () => {
    expect(validateLectureInput({ ...base, notesUrl: 'javascript:alert(1)' }).ok).toBe(false)
    const r = validateLectureInput({ ...base, notesUrl: 'https://drive.google.com/x' })
    expect(r.ok && r.value.notesUrl).toBe('https://drive.google.com/x')
  })
})

describe('pickLectureForAcademy', () => {
  const hq = { id: 'hq', academyId: null }
  const mine = { id: 'mine', academyId: 'a1' }
  const other = { id: 'other', academyId: 'a2' }
  it('학원 강의 우선', () => {
    expect(pickLectureForAcademy([hq, mine], 'a1')?.id).toBe('mine')
  })
  it('없으면 본사 강의', () => {
    expect(pickLectureForAcademy([other, hq], 'a1')?.id).toBe('hq')
  })
  it('둘 다 없으면 null', () => {
    expect(pickLectureForAcademy([other], 'a1')).toBeNull()
  })
})
