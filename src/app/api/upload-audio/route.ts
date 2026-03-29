import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'question-audio'
const MAX_SIZE_BYTES = 30 * 1024 * 1024 // 30MB
const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/aac']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'MP3, WAV, M4A, OGG, AAC 형식만 업로드 가능합니다.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: '파일 크기는 30MB 이하여야 합니다.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'mp3'
  const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const admin = await createAdminClient()
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(fileName, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (uploadError) {
    console.error('Audio storage upload error:', uploadError)
    return NextResponse.json({ error: '오디오 업로드에 실패했습니다.' }, { status: 500 })
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BUCKET).getPublicUrl(fileName)

  return NextResponse.json({ url: publicUrl })
}
