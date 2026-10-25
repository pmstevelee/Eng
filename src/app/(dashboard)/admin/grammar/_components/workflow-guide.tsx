// 관리자 문법 콘텐츠 제작 순서 안내 — 원고 → 분석·보완 → AI 초안 → 검수·공개 → 강의
const STEPS = [
  { title: '원고 올리기', desc: '대분류·중분류(또는 포인트)에 문법 설명 원고를 붙여 넣습니다.' },
  { title: 'AI 분석', desc: '중분류에서 원고를 분석하면 설명·예문이 부족한 포인트에 보완 요청이 생깁니다.' },
  { title: '보완 원고', desc: '보완 요청마다 원고를 추가합니다. 원고는 계속 쌓이며 언제든 다시 보완할 수 있습니다.' },
  { title: 'AI 초안', desc: '원고를 바탕으로 개념 정리와 다양한 예문을 만듭니다. 포인트에서 고쳐 저장합니다.' },
  { title: '검수·공개', desc: '검수 요청 → 공개. 같은 원고로 강의 스크립트도 만듭니다.' },
] as const

export function WorkflowGuide() {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {STEPS.map((s, i) => (
        <li key={s.title} className="rounded-xl border border-gray-200 bg-white px-3 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-xs font-bold text-[#1865F2]">
              {i + 1}
            </span>
            {s.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.desc}</p>
        </li>
      ))}
    </ol>
  )
}
