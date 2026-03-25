import { MessageSquare, Users, GraduationCap, Trash2, Clock } from 'lucide-react'
import { getAnnouncements, getMyClasses, deleteAnnouncement } from './actions'
import { AnnouncementForm } from './_components/announcement-form'

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function CommunicationPage() {
  const pageStart = performance.now()

  const dataStart = performance.now()
  const [announcements, classes] = await Promise.all([getAnnouncements(), getMyClasses()])
  console.log(`  [쿼리1] getAnnouncements + getMyClasses: ${(performance.now() - dataStart).toFixed(0)}ms`)

  const totalTime = performance.now() - pageStart
  console.log(`📊 [CommunicationPage] 전체 서버 시간: ${totalTime.toFixed(0)}ms`)
  if (totalTime > 200) console.log(`⚠️ SLOW PAGE: ${totalTime.toFixed(0)}ms`)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">커뮤니케이션</h1>
        <p className="text-sm text-gray-500 mt-1">학생들에게 공지사항을 발송합니다</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 공지사항 작성 폼 */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-700/10 flex items-center justify-center">
                <MessageSquare size={16} className="text-primary-700" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">새 공지사항</h2>
            </div>
            <AnnouncementForm classes={classes} />
          </div>
        </div>

        {/* 발송 이력 */}
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">발송 이력</h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {announcements.length}건
              </span>
            </div>

            {announcements.length === 0 ? (
              <div className="py-16 text-center">
                <MessageSquare size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">발송된 공지사항이 없습니다</p>
                <p className="text-xs text-gray-400 mt-1">좌측 폼에서 첫 공지사항을 발송해보세요</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {announcements.map((a) => (
                  <div key={a.id} className="px-5 py-4 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                              a.target === 'ALL_STUDENTS'
                                ? 'bg-blue-50 text-primary-700'
                                : 'bg-purple-50 text-accent-purple'
                            }`}
                          >
                            {a.target === 'ALL_STUDENTS' ? (
                              <>
                                <Users size={10} />
                                전체
                              </>
                            ) : (
                              <>
                                <GraduationCap size={10} />
                                {a.className ?? '반'}
                              </>
                            )}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.content}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                          <Clock size={11} />
                          {formatDate(a.createdAt)}
                        </div>
                      </div>
                      <form
                        action={async () => {
                          'use server'
                          await deleteAnnouncement(a.id)
                        }}
                      >
                        <button
                          type="submit"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-accent-red hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
