'use client'

// 포인트 "강의" 탭 — 본사 기본 강의(YouTube 링크) 등록·수정·삭제 + 등록된 강의 목록(학원 강의 포함, 보기만)
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, PlayCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LectureForm, type LectureFormValues } from '@/components/grammar/lecture-form'
import { formatLectureDuration, youtubeWatchUrl } from '@/lib/grammar/lecture-input'
import type { ManagedLecture } from '@/lib/grammar/lectures'
import { deleteHqLecture, saveHqLecture } from '../../../lecture-actions'

type Message = { kind: 'ok' | 'error'; text: string } | null

export function PointLectures({ pointId, lectures }: { pointId: string; lectures: ManagedLecture[] }) {
  const router = useRouter()
  const hq = lectures.find((l) => l.academyId === null) ?? null
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [deleting, startDelete] = useTransition()

  async function handleSubmit(values: LectureFormValues) {
    setMessage(null)
    const res = await saveHqLecture(pointId, values)
    if (res.ok) {
      setEditing(false)
      setMessage({ kind: 'ok', text: hq ? '강의를 수정했어요.' : '강의를 등록했어요.' })
      router.refresh()
    }
    return res
  }

  function handleDelete(lecture: ManagedLecture) {
    const warn = lecture.completedCount > 0 ? `\n시청 완료 기록 ${lecture.completedCount}건도 함께 지워집니다.` : ''
    if (!window.confirm(`"${lecture.title}" 강의를 삭제할까요?${warn}`)) return
    setMessage(null)
    startDelete(async () => {
      const res = await deleteHqLecture(lecture.id)
      if (res.ok) {
        setMessage({ kind: 'ok', text: '강의를 삭제했어요.' })
        router.refresh()
      } else setMessage({ kind: 'error', text: res.error })
    })
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">본사 기본 강의</h3>
            <p className="mt-1 text-sm text-gray-500">
              YouTube 일부공개 영상 링크를 붙입니다. 학원 강의가 없는 학원의 학생에게 이 강의가 보여요. 포인트당 1편.
            </p>
          </div>
          {!editing && hq && (
            <Button variant="outline" className="h-11" onClick={() => setEditing(true)}>
              수정
            </Button>
          )}
        </div>

        <div className="mt-4">
          {editing ? (
            <LectureForm
              key={hq?.id ?? 'new'}
              initial={
                hq
                  ? { url: youtubeWatchUrl(hq.videoId), title: hq.title, durationSec: hq.durationSec, notesUrl: hq.notesUrl ?? '' }
                  : undefined
              }
              onSubmit={handleSubmit}
              onCancel={() => setEditing(false)}
              submitLabel={hq ? '수정 저장' : '강의 등록'}
            />
          ) : hq ? (
            <p className="text-sm text-gray-500">영상을 바꾸면 이 강의의 이전 시청 기록은 초기화됩니다.</p>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF]">
                <PlayCircle className="h-6 w-6 text-[#1865F2]" />
              </div>
              <p className="mt-3 text-sm font-medium text-gray-900">아직 본사 기본 강의가 없어요</p>
              <p className="mt-1 text-sm text-gray-500">학원 강의도 없으면 학생 단원 화면에서 강의 단계가 빠집니다.</p>
              <Button className="mt-4 h-11 bg-[#1865F2] hover:bg-[#1558d6]" onClick={() => setEditing(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                강의 등록
              </Button>
            </div>
          )}
        </div>
      </section>

      {message && (
        <p
          className={
            message.kind === 'ok'
              ? 'rounded-lg bg-[#E8F7EE] px-4 py-3 text-sm text-[#127A3A]'
              : 'rounded-lg bg-[#FDECEA] px-4 py-3 text-sm text-[#B42318]'
          }
        >
          {message.text}
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">등록된 강의 {lectures.length}</h3>
        </div>
        {lectures.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">등록된 강의가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">제목</th>
                  <th className="px-3 py-3 font-medium">범위</th>
                  <th className="px-3 py-3 font-medium">길이</th>
                  <th className="px-3 py-3 font-medium">시청 완료</th>
                  <th className="px-5 py-3 text-right font-medium">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lectures.map((l) => (
                  <tr key={l.id}>
                    <td className="px-5 py-3">
                      <a
                        href={youtubeWatchUrl(l.videoId)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-gray-900 hover:text-[#1865F2]"
                      >
                        {l.title}
                        <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                      </a>
                      {l.notesUrl && (
                        <a href={l.notesUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-[#1865F2] hover:underline">
                          강의 노트
                        </a>
                      )}
                      {l.createdByName && <p className="mt-0.5 text-xs text-gray-400">등록: {l.createdByName}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {l.academyId === null ? (
                        <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-xs font-semibold text-[#1865F2]">본사 기본</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                          {l.academyName ?? '학원'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-gray-700">{formatLectureDuration(l.durationSec)}</td>
                    <td className="px-3 py-3 tabular-nums text-gray-700">{l.completedCount}명</td>
                    <td className="px-5 py-3 text-right">
                      {l.academyId === null ? (
                        <div className="inline-flex gap-1">
                          <Button variant="ghost" className="h-11" onClick={() => setEditing(true)} disabled={deleting}>
                            수정
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-11 text-[#D92916] hover:bg-[#FDECEA] hover:text-[#D92916]"
                            onClick={() => handleDelete(l)}
                            disabled={deleting}
                          >
                            삭제
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">학원 관리</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
