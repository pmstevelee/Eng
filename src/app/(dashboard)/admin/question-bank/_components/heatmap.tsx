'use client'

type HeatmapCell = {
  domain: string
  difficulty: number
  totalCount: number
}

type Props = {
  data: HeatmapCell[]
}

const DOMAIN_LABELS: Record<string, string> = {
  GRAMMAR: '문법',
  VOCABULARY: '어휘',
  READING: '읽기',
  WRITING: '쓰기',
  LISTENING: '듣기',
}

const DOMAINS = ['GRAMMAR', 'VOCABULARY', 'READING', 'WRITING', 'LISTENING']

function getCellStyle(count: number): { bg: string; text: string; label: string } {
  if (count >= 15) return { bg: '#1FAF54', text: '#fff', label: '충분' }
  if (count >= 10) return { bg: '#FFB100', text: '#fff', label: '보통' }
  if (count >= 5) return { bg: '#E35C20', text: '#fff', label: '부족' }
  return { bg: '#D92916', text: '#fff', label: '심각' }
}

export default function QuestionBankHeatmap({ data }: Props) {
  const getCount = (domain: string, difficulty: number) =>
    data.find((d) => d.domain === domain && d.difficulty === difficulty)?.totalCount ?? 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">영역 × 난이도 히트맵</h2>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#1FAF54' }} />
            15+ 충분
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#FFB100' }} />
            10-14 보통
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#E35C20' }} />
            5-9 부족
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#D92916' }} />
            0-4 심각
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 pr-4 text-xs text-gray-500 font-medium w-20">영역</th>
              {Array.from({ length: 10 }, (_, i) => (
                <th key={i + 1} className="text-center py-2 px-1 text-xs text-gray-500 font-medium min-w-[48px]">
                  Lv{i + 1}
                </th>
              ))}
              <th className="text-center py-2 px-2 text-xs text-gray-500 font-medium">합계</th>
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map((domain) => {
              const total = Array.from({ length: 10 }, (_, i) => getCount(domain, i + 1)).reduce(
                (a, b) => a + b,
                0,
              )
              return (
                <tr key={domain}>
                  <td className="py-1.5 pr-4 text-xs font-semibold text-gray-700 whitespace-nowrap">
                    {DOMAIN_LABELS[domain]}
                  </td>
                  {Array.from({ length: 10 }, (_, i) => {
                    const count = getCount(domain, i + 1)
                    const style = getCellStyle(count)
                    return (
                      <td key={i + 1} className="py-1.5 px-1">
                        <div
                          className="rounded-md text-center text-xs font-semibold py-2 px-1 min-w-[44px]"
                          style={{ background: style.bg, color: style.text }}
                          title={`${DOMAIN_LABELS[domain]} Lv${i + 1}: ${count}개 (${style.label})`}
                        >
                          {count}
                        </div>
                      </td>
                    )
                  })}
                  <td className="py-1.5 px-2 text-center text-xs font-semibold text-gray-600">
                    {total}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-2 pr-4 text-xs font-semibold text-gray-500">합계</td>
              {Array.from({ length: 10 }, (_, i) => {
                const colTotal = DOMAINS.reduce((sum, d) => sum + getCount(d, i + 1), 0)
                return (
                  <td key={i + 1} className="py-2 px-1 text-center text-xs font-semibold text-gray-600">
                    {colTotal}
                  </td>
                )
              })}
              <td className="py-2 px-2 text-center text-xs font-bold text-gray-700">
                {DOMAINS.reduce(
                  (sum, d) =>
                    sum + Array.from({ length: 10 }, (_, i) => getCount(d, i + 1)).reduce((a, b) => a + b, 0),
                  0,
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
