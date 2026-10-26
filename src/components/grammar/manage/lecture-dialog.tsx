'use client'

// "+ 강의 등록" / 학원 강의 수정 — 2-4 lecture-form을 다이얼로그로 열고 반이 속한 학원의 강의로 저장

import { LectureForm, type LectureFormValues } from '@/components/grammar/lecture-form'
import { youtubeWatchUrl } from '@/lib/grammar/lecture-input'
import { saveAcademyLecture } from '@/lib/grammar/manage-actions'
import type { AssignmentLecture } from '@/lib/grammar/manage-queries'
import { ManageDialog } from './manage-dialog'

export interface LectureTarget {
  pointId: string
  pointTitle: string
  existing: AssignmentLecture | null
}

export function LectureDialog({
  classId,
  target,
  onClose,
  onDone,
}: {
  classId: string
  target: LectureTarget | null
  onClose: () => void
  onDone: (m: string) => void
}) {
  const existing = target?.existing ?? null
  const initial: Partial<LectureFormValues> | undefined = existing
    ? {
        url: youtubeWatchUrl(existing.videoId),
        title: existing.title,
        durationSec: existing.durationSec,
        notesUrl: existing.notesUrl ?? '',
      }
    : target
      ? { title: target.pointTitle }
      : undefined

  return (
    <ManageDialog
      open={target !== null}
      onClose={onClose}
      title={existing ? '우리 학원 강의 수정' : '우리 학원 강의 등록'}
      description={`${target?.pointTitle ?? ''} — 등록하면 본사 기본 강의 대신 이 강의가 학생에게 보입니다. YouTube 일부공개 링크를 써 주세요.`}
      className="max-w-xl"
    >
      {target && (
        <LectureForm
          key={`${target.pointId}-${existing?.id ?? 'new'}`}
          initial={initial}
          submitLabel={existing ? '강의 수정' : '강의 등록'}
          onCancel={onClose}
          onSubmit={async (values) => {
            const res = await saveAcademyLecture(classId, target.pointId, values)
            if (!res.ok) return res
            onDone(existing ? '강의를 수정했어요.' : '우리 학원 강의를 등록했어요.')
            onClose()
            return { ok: true }
          }}
        />
      )}
    </ManageDialog>
  )
}
