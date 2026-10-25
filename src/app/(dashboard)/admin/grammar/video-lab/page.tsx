export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Clapperboard } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { formatVideoSceneErrors, parseVideoScenes } from '@/types/grammar-video'
import passiveVoiceSample from '@/lib/grammar/video/samples/passive-voice.json'
import { VideoLabPlayer } from './video-lab-player'

const SAMPLE_URL = 'https://claude.ai/artifact/9idMRTp6Au6ENKEWmkPaWZ'

export default async function GrammarVideoLabPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') redirect('/login')

  const parsed = parseVideoScenes(passiveVoiceSample)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/grammar" className="inline-flex min-h-[44px] items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        문법 커리큘럼
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF]">
          <Clapperboard className="h-5 w-5 text-[#1865F2]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">영상 렌더러 확인</h1>
          <p className="text-sm text-gray-500">
            AI 강의 영상의 장면 틀 8종을 수동태 샘플 데이터로 그려 봅니다. 미리보기와 MP4가 같은 렌더러를 씁니다.{' '}
            <a href={SAMPLE_URL} target="_blank" rel="noreferrer" className="text-[#1865F2] underline-offset-2 hover:underline">
              원본 샘플 보기
            </a>
          </p>
        </div>
      </div>

      {!parsed.ok && (
        <div className="rounded-xl border border-[#D92916]/30 bg-[#D92916]/5 p-4 text-sm text-[#D92916]">
          <p className="font-medium">샘플 데이터에 오류가 있어 일부 장면이 빠졌습니다.</p>
          <ul className="mt-1 list-disc pl-5">
            {formatVideoSceneErrors(parsed.errors).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {parsed.scenes.length > 0 ? (
        <VideoLabPlayer scenes={parsed.scenes} />
      ) : (
        <p className="text-sm text-gray-500">그릴 장면이 없습니다.</p>
      )}
    </div>
  )
}
