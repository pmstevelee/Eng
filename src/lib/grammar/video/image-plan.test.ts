import { describe, expect, it } from 'vitest'
import sample from './samples/passive-voice.json'
import { parseVideoScenes, type SceneImage, type VideoScene } from '../../../types/grammar-video'
import {
  buildSceneImagePrompt,
  carryOverImages,
  coverRect,
  normalizeImagePrompt,
  referencedImagePaths,
  replaceSceneImage,
  sceneImageAlpha,
  sceneImagePath,
  sceneImageSubject,
} from './image-plan'

const scenes = parseVideoScenes(sample).scenes
const img = (path: string): SceneImage => ({ path, prompt: 'p', strength: 'medium' })
const withImage = (list: VideoScene[], id: string, image: SceneImage) =>
  list.map((s) => (s.id === id ? ({ ...s, image } as VideoScene) : s))

describe('장면 그림 파싱', () => {
  it('그림 필드를 읽고, 진하기가 틀리면 보통으로', () => {
    const raw = JSON.parse(JSON.stringify(sample)) as Record<string, unknown>[]
    raw[0].image = { path: 'scripts/a/images/x.webp', prompt: 'hello', strength: 'nope' }
    raw[1].image = { path: '' }
    const parsed = parseVideoScenes(raw)
    expect(parsed.ok).toBe(true)
    expect(parsed.scenes[0].image).toEqual({ path: 'scripts/a/images/x.webp', prompt: 'hello', strength: 'medium' })
    expect(parsed.scenes[1].image).toBeUndefined()
  })
})

describe('그림 프롬프트', () => {
  it('장면 예문을 주제로 넣고 글자 금지를 적는다', () => {
    const compare = scenes.find((s) => s.template === 'compare')!
    const prompt = buildSceneImagePrompt(compare, '수동태')
    expect(sceneImageSubject(compare).length).toBeGreaterThan(5)
    expect(prompt).toContain(sceneImageSubject(compare).slice(0, 20))
    expect(prompt).toContain('no text')
    expect(prompt).toContain('right third')
  })

  it('남색 장면은 어두운 색을 요청', () => {
    const opening = scenes.find((s) => s.template === 'opening')!
    expect(buildSceneImagePrompt(opening, '수동태')).toContain('dark navy')
  })

  it('프롬프트 정리', () => {
    expect(normalizeImagePrompt('  a \n b ')).toBe('a b')
    expect(normalizeImagePrompt('   ')).toBeNull()
    expect(normalizeImagePrompt(3)).toBeNull()
  })
})

describe('그림 위치·진하기', () => {
  it('cover: 넓은 그림은 좌우를 자른다', () => {
    const r = coverRect(1536, 1024, 1920, 1080)
    expect(r.sh).toBeCloseTo(864)
    expect(r.sw).toBeCloseTo(1536)
    expect(r.sy).toBeCloseTo(80)
  })

  it('남색 장면이 더 진하다', () => {
    expect(sceneImageAlpha('opening', 'medium')).toBeGreaterThan(sceneImageAlpha('compare', 'medium'))
    expect(sceneImageAlpha('compare', 'strong')).toBeGreaterThan(sceneImageAlpha('compare', 'light'))
  })

  it('경로에 못 쓰는 글자는 바꾼다', () => {
    expect(sceneImagePath('s/1', 'a b', 'x')).toBe('scripts/s_1/images/a_b-x.webp')
  })
})

describe('장면 저장 시 그림 이어 붙이기', () => {
  const saved = withImage(scenes, scenes[0].id, img('a.webp'))

  it('화면에서 온 그림 값은 무시하고 저장된 값을 쓴다', () => {
    const fromClient = withImage(scenes, scenes[0].id, img('hacked.webp'))
    const res = carryOverImages(saved, withImage(fromClient, scenes[1].id, img('b.webp')))
    expect(res.scenes[0].image?.path).toBe('a.webp')
    expect(res.scenes[1].image).toBeUndefined()
    expect(res.removedPaths).toEqual([])
  })

  it('지운 장면의 그림은 삭제 대상', () => {
    const res = carryOverImages(saved, scenes.slice(1))
    expect(res.removedPaths).toEqual(['a.webp'])
    expect(referencedImagePaths(res.scenes).size).toBe(0)
  })

  it('그림 교체·빼기', () => {
    const swapped = replaceSceneImage(saved, scenes[0].id, img('c.webp'))
    expect(swapped.found).toBe(true)
    expect(swapped.removedPath).toBe('a.webp')
    expect(swapped.scenes[0].image?.path).toBe('c.webp')
    const removed = replaceSceneImage(swapped.scenes, scenes[0].id, null)
    expect(removed.scenes[0].image).toBeUndefined()
    expect(removed.removedPath).toBe('c.webp')
    expect(replaceSceneImage(saved, 'none', null).found).toBe(false)
  })
})
