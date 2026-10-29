// AI 강의 음성 파일 저장소 (Supabase Storage 비공개 버킷 grammar-lectures) — 서버 전용
// service role 키를 쓰므로 SUPER_ADMIN 확인을 마친 서버 액션에서만 부른다.

import { createClient as createSupabaseAdminClient, type SupabaseClient } from '@supabase/supabase-js'

export const LECTURE_AUDIO_BUCKET = 'grammar-lectures'
/** 서명 URL 유효 시간(초) — 미리보기·내보내기 한 번 할 동안만 */
export const LECTURE_AUDIO_URL_TTL_SEC = 60 * 30

function getAdminStorage(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase 관리자 키가 설정되지 않았습니다.')
  return createSupabaseAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function uploadLectureAudio(path: string, audio: Uint8Array): Promise<void> {
  const { error } = await getAdminStorage()
    .storage.from(LECTURE_AUDIO_BUCKET)
    .upload(path, audio, { contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000' })
  if (error) {
    console.error('[lecture-audio] 업로드 실패:', error)
    const missing = /bucket not found/i.test(error.message)
    throw new Error(
      missing
        ? `음성 저장소(${LECTURE_AUDIO_BUCKET} 버킷)가 없습니다. Supabase Storage에서 비공개 버킷을 만들어 주세요.`
        : '음성 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    )
  }
}

/** 장면 배경 그림 저장 (같은 버킷, scripts/{id}/images/) — 삭제·서명 URL은 음성과 같은 함수를 쓴다 */
export async function uploadLectureImage(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await getAdminStorage()
    .storage.from(LECTURE_AUDIO_BUCKET)
    .upload(path, bytes, { contentType, upsert: true, cacheControl: '31536000' })
  if (error) {
    console.error('[lecture-image] 업로드 실패:', error)
    throw new Error('그림 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
}

/** 파일 삭제 — 실패해도 흐름을 막지 않는다(로그만) */
export async function removeLectureAudio(paths: string[]): Promise<void> {
  const list = Array.from(new Set(paths.filter(Boolean)))
  if (list.length === 0) return
  try {
    const { error } = await getAdminStorage().storage.from(LECTURE_AUDIO_BUCKET).remove(list)
    if (error) console.error('[lecture-audio] 삭제 실패:', error)
  } catch (error) {
    console.error('[lecture-audio] 삭제 실패:', error)
  }
}

/** 경로 → 짧은 서명 URL (없는 파일은 빠진다) */
export async function signLectureAudioUrls(paths: string[], ttlSec: number = LECTURE_AUDIO_URL_TTL_SEC): Promise<Map<string, string>> {
  const list = Array.from(new Set(paths.filter(Boolean)))
  const out = new Map<string, string>()
  if (list.length === 0) return out
  const { data, error } = await getAdminStorage()
    .storage.from(LECTURE_AUDIO_BUCKET)
    .createSignedUrls(list, ttlSec)
  if (error) {
    console.error('[lecture-audio] 서명 URL 실패:', error)
    throw new Error('음성 주소를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
  for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) out.set(item.path, item.signedUrl)
  return out
}
