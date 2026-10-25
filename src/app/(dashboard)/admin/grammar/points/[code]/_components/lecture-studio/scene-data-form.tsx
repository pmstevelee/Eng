'use client'

// 장면 화면 데이터 폼 — 틀(template)마다 필드가 다르다. 항목마다 등장 단계(step)를 함께 고친다.

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import type {
  CaseItem,
  CompareRow,
  QuizItem,
  StepCard,
  Token,
  VariationRow,
  VideoScene,
} from '@/types/grammar-video'
import { Field, IconButton, StepInput, TextArea, TextInput } from './studio-ui'
import { TokenInput } from './token-input'

const EMPTY_SENTENCE: Token[] = [{ text: 'New' }, { text: 'sentence' }, { text: '.' }]

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function nextStep(steps: number[]): number {
  return Math.max(0, ...steps) + 1
}

/** 목록 항목 카드 — 순서 바꾸기·삭제 + 등장 단계 */
function ItemCard({
  title,
  index,
  count,
  min,
  step,
  onStep,
  onMove,
  onRemove,
  children,
}: {
  title: string
  index: number
  count: number
  min: number
  step?: number
  onStep?: (v: number) => void
  onMove: (d: -1 | 1) => void
  onRemove: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        {onStep && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            등장 단계
            <StepInput value={step} onChange={(v) => onStep(v ?? 0)} title="이 단계를 reveal하는 문장에서 화면에 나타나요" />
          </span>
        )}
        <span className="ml-auto flex gap-1">
          <IconButton label="위로" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="h-4 w-4" />
          </IconButton>
          <IconButton label="아래로" onClick={() => onMove(1)} disabled={index === count - 1}>
            <ArrowDown className="h-4 w-4" />
          </IconButton>
          <IconButton label="항목 삭제" tone="danger" onClick={onRemove} disabled={count <= min}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </span>
      </div>
      {children}
    </div>
  )
}

function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 text-sm text-gray-600 hover:border-[#1865F2] hover:text-[#1865F2] disabled:opacity-40"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  )
}

export function SceneDataForm({ scene, onChange }: { scene: VideoScene; onChange: (scene: VideoScene) => void }) {
  const set = <S extends VideoScene>(s: S, data: Partial<S['data']>) => onChange({ ...s, data: { ...s.data, ...data } } as VideoScene)

  switch (scene.template) {
    case 'opening': {
      const d = scene.data
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="시리즈 표시">
            <TextInput value={d.seriesLabel} onChange={(v) => set(scene, { seriesLabel: v })} />
          </Field>
          <Field label="훅 등장 단계">
            <StepInput value={d.hookStep} onChange={(v) => set(scene, { hookStep: v ?? 0 })} />
          </Field>
          <Field label="한국어 제목">
            <TextInput value={d.titleKo} onChange={(v) => set(scene, { titleKo: v })} />
          </Field>
          <Field label="영어 제목">
            <TextInput lang="en" value={d.titleEn} onChange={(v) => set(scene, { titleEn: v })} />
          </Field>
          <Field label="한 줄 훅" className="sm:col-span-2">
            <TextInput value={d.hook} onChange={(v) => set(scene, { hook: v })} />
          </Field>
        </div>
      )
    }
    case 'compare': {
      const d = scene.data
      const setRows = (rows: CompareRow[]) => set(scene, { rows })
      return (
        <div className="space-y-3">
          <Field label="화면 제목">
            <TextInput value={d.title} onChange={(v) => set(scene, { title: v })} />
          </Field>
          {d.rows.map((row, i) => {
            const up = (patch: Partial<CompareRow>) => setRows(d.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
            return (
              <ItemCard
                key={i}
                title={`문장 ${i + 1}`}
                index={i}
                count={d.rows.length}
                min={2}
                step={row.step}
                onStep={(v) => up({ step: v })}
                onMove={(dir) => setRows(move(d.rows, i, dir))}
                onRemove={() => setRows(d.rows.filter((_, k) => k !== i))}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="이름표 (예: 능동태)">
                    <TextInput value={row.label} onChange={(v) => up({ label: v })} />
                  </Field>
                  <Field label="보조 설명">
                    <TextInput value={row.sub} onChange={(v) => up({ sub: v })} />
                  </Field>
                </div>
                <Field label="영어 문장">
                  <TokenInput label={`문장 ${i + 1}`} value={row.sentence} onChange={(v) => up({ sentence: v })} />
                </Field>
                <Field label="해석">
                  <TextInput value={row.ko} onChange={(v) => up({ ko: v })} />
                </Field>
              </ItemCard>
            )
          })}
          <AddButton
            label="문장 추가"
            disabled={d.rows.length >= 4}
            onClick={() => setRows([...d.rows, { label: '문장', sub: '', sentence: EMPTY_SENTENCE, ko: '해석', step: nextStep(d.rows.map((r) => r.step)) }])}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="아래 메모 (선택)">
              <TextInput
                value={d.note?.text ?? ''}
                onChange={(v) =>
                  set(scene, { note: v.trim() ? { text: v, step: d.note?.step ?? nextStep(d.rows.map((r) => r.step)) } : undefined })
                }
              />
            </Field>
            {d.note && (
              <Field label="메모 단계">
                <StepInput value={d.note.step} onChange={(v) => set(scene, { note: { text: d.note?.text ?? '', step: v ?? 0 } })} />
              </Field>
            )}
          </div>
        </div>
      )
    }
    case 'steps': {
      const d = scene.data
      const setSteps = (steps: StepCard[]) => set(scene, { steps })
      return (
        <div className="space-y-3">
          <Field label="화면 제목">
            <TextInput value={d.title} onChange={(v) => set(scene, { title: v })} />
          </Field>
          {d.steps.map((st, i) => {
            const up = (patch: Partial<StepCard>) => setSteps(d.steps.map((r, k) => (k === i ? { ...r, ...patch } : r)))
            return (
              <ItemCard
                key={i}
                title={`단계 ${i + 1}`}
                index={i}
                count={d.steps.length}
                min={2}
                step={st.step}
                onStep={(v) => up({ step: v })}
                onMove={(dir) => setSteps(move(d.steps, i, dir))}
                onRemove={() => setSteps(d.steps.filter((_, k) => k !== i))}
              >
                <Field label="단계 설명">
                  <TextInput value={st.title} onChange={(v) => up({ title: v })} />
                </Field>
                <Field label="예시">
                  <TokenInput label={`단계 ${i + 1} 예시`} value={st.example} onChange={(v) => up({ example: v })} />
                </Field>
              </ItemCard>
            )
          })}
          <AddButton
            label="단계 추가"
            disabled={d.steps.length >= 4}
            onClick={() => setSteps([...d.steps, { title: '단계', example: EMPTY_SENTENCE, step: nextStep(d.steps.map((r) => r.step)) }])}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="공식">
              <TokenInput label="공식" value={d.formula} onChange={(v) => set(scene, { formula: v })} />
            </Field>
            <Field label="공식 단계">
              <StepInput value={d.formulaStep} onChange={(v) => set(scene, { formulaStep: v ?? 0 })} />
            </Field>
          </div>
        </div>
      )
    }
    case 'variations': {
      const d = scene.data
      const setRows = (rows: VariationRow[]) => set(scene, { rows })
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="화면 제목">
              <TextInput value={d.title} onChange={(v) => set(scene, { title: v })} />
            </Field>
            <Field label="부제 (선택)">
              <TextInput value={d.subtitle ?? ''} onChange={(v) => set(scene, { subtitle: v || undefined })} />
            </Field>
          </div>
          {d.rows.map((row, i) => {
            const up = (patch: Partial<VariationRow>) => setRows(d.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
            return (
              <ItemCard
                key={i}
                title={`줄 ${i + 1}`}
                index={i}
                count={d.rows.length}
                min={2}
                step={row.step}
                onStep={(v) => up({ step: v })}
                onMove={(dir) => setRows(move(d.rows, i, dir))}
                onRemove={() => setRows(d.rows.filter((_, k) => k !== i))}
              >
                <Field label="이름표 (예: 현재)">
                  <TextInput value={row.label} onChange={(v) => up({ label: v })} />
                </Field>
                <Field label="문장">
                  <TokenInput label={`줄 ${i + 1}`} value={row.sentence} onChange={(v) => up({ sentence: v })} />
                </Field>
              </ItemCard>
            )
          })}
          <AddButton
            label="줄 추가"
            disabled={d.rows.length >= 6}
            onClick={() => setRows([...d.rows, { label: '이름', sentence: EMPTY_SENTENCE, step: nextStep(d.rows.map((r) => r.step)) }])}
          />
        </div>
      )
    }
    case 'cases': {
      const d = scene.data
      const setCases = (cases: CaseItem[]) => set(scene, { cases })
      return (
        <div className="space-y-3">
          <Field label="화면 제목">
            <TextInput value={d.title} onChange={(v) => set(scene, { title: v })} />
          </Field>
          {d.cases.map((c, i) => {
            const up = (patch: Partial<CaseItem>) => setCases(d.cases.map((r, k) => (k === i ? { ...r, ...patch } : r)))
            return (
              <ItemCard
                key={i}
                title={`경우 ${i + 1}`}
                index={i}
                count={d.cases.length}
                min={1}
                step={c.step}
                onStep={(v) => up({ step: v })}
                onMove={(dir) => setCases(move(d.cases, i, dir))}
                onRemove={() => setCases(d.cases.filter((_, k) => k !== i))}
              >
                <Field label="경우 설명">
                  <TextInput value={c.title} onChange={(v) => up({ title: v })} />
                </Field>
                <Field label="예문">
                  <TokenInput label={`경우 ${i + 1} 예문`} value={c.sentence} onChange={(v) => up({ sentence: v })} />
                </Field>
                <Field label="해석">
                  <TextInput value={c.ko} onChange={(v) => up({ ko: v })} />
                </Field>
              </ItemCard>
            )
          })}
          <AddButton
            label="경우 추가"
            disabled={d.cases.length >= 3}
            onClick={() => setCases([...d.cases, { title: '경우', sentence: EMPTY_SENTENCE, ko: '해석', step: nextStep(d.cases.map((r) => r.step)) }])}
          />
        </div>
      )
    }
    case 'warning': {
      const d = scene.data
      return (
        <div className="space-y-3">
          <Field label="화면 제목">
            <TextInput value={d.title} onChange={(v) => set(scene, { title: v })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="규칙">
              <TextArea value={d.rule} onChange={(v) => set(scene, { rule: v })} />
            </Field>
            <Field label="단계">
              <StepInput value={d.ruleStep} onChange={(v) => set(scene, { ruleStep: v ?? 0 })} />
            </Field>
            <Field label="✗ 틀린 문장">
              <TextInput lang="en" value={d.wrong} onChange={(v) => set(scene, { wrong: v })} />
            </Field>
            <Field label="단계">
              <StepInput value={d.wrongStep} onChange={(v) => set(scene, { wrongStep: v ?? 0 })} />
            </Field>
            <Field label="✓ 바른 문장">
              <TextInput lang="en" value={d.right} onChange={(v) => set(scene, { right: v })} />
            </Field>
            <Field label="단계">
              <StepInput value={d.rightStep} onChange={(v) => set(scene, { rightStep: v ?? 0 })} />
            </Field>
            <Field label="자주 틀리는 단어 (쉼표로 구분, 최대 6개)">
              <TextInput
                lang="en"
                value={d.words.join(', ')}
                onChange={(v) =>
                  set(scene, {
                    words: v
                      .split(',')
                      .map((w) => w.trim())
                      .filter(Boolean)
                      .slice(0, 6),
                  })
                }
              />
            </Field>
            <Field label="단계">
              <StepInput value={d.wordsStep} onChange={(v) => set(scene, { wordsStep: v ?? 0 })} />
            </Field>
          </div>
        </div>
      )
    }
    case 'quiz': {
      const d = scene.data
      const setItems = (items: QuizItem[]) => set(scene, { items })
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="화면 제목">
              <TextInput value={d.title} onChange={(v) => set(scene, { title: v })} />
            </Field>
            <Field label="안내">
              <TextInput value={d.subtitle} onChange={(v) => set(scene, { subtitle: v })} />
            </Field>
            <Field label="문제 단계">
              <StepInput value={d.itemsStep} onChange={(v) => set(scene, { itemsStep: v ?? 0 })} />
            </Field>
          </div>
          {d.items.map((q, i) => {
            const up = (patch: Partial<QuizItem>) => setItems(d.items.map((r, k) => (k === i ? { ...r, ...patch } : r)))
            return (
              <ItemCard
                key={i}
                title={`문제 ${i + 1} (정답 번호 ${i + 1})`}
                index={i}
                count={d.items.length}
                min={1}
                onMove={(dir) => setItems(move(d.items, i, dir))}
                onRemove={() => setItems(d.items.filter((_, k) => k !== i))}
              >
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="앞">
                    <TextInput lang="en" value={q.before} onChange={(v) => up({ before: v })} />
                  </Field>
                  <Field label="정답 (빈칸)">
                    <TextInput lang="en" value={q.answer} onChange={(v) => up({ answer: v })} />
                  </Field>
                  <Field label="뒤">
                    <TextInput lang="en" value={q.after} onChange={(v) => up({ after: v })} />
                  </Field>
                  <Field label="힌트">
                    <TextInput lang="en" value={q.hint} onChange={(v) => up({ hint: v })} />
                  </Field>
                </div>
              </ItemCard>
            )
          })}
          <AddButton
            label="문제 추가"
            disabled={d.items.length >= 4}
            onClick={() => setItems([...d.items, { before: '', answer: 'answer', after: '', hint: '' }])}
          />
          <p className="text-xs text-gray-500">문제를 추가하면 그 정답을 공개하는 문장(answer 번호)도 아래 나레이션에 넣어 주세요.</p>
        </div>
      )
    }
    case 'summary': {
      const d = scene.data
      const setLines = (lines: Token[][]) => set(scene, { lines })
      return (
        <div className="space-y-3">
          <Field label="화면 제목">
            <TextInput value={d.title} onChange={(v) => set(scene, { title: v })} />
          </Field>
          {d.lines.map((line, i) => (
            <ItemCard
              key={i}
              title={`핵심 줄 ${i + 1} (등장 단계 ${i + 1})`}
              index={i}
              count={d.lines.length}
              min={1}
              onMove={(dir) => setLines(move(d.lines, i, dir))}
              onRemove={() => setLines(d.lines.filter((_, k) => k !== i))}
            >
              <TokenInput label={`핵심 줄 ${i + 1}`} value={line} onChange={(v) => setLines(d.lines.map((l, k) => (k === i ? v : l)))} />
            </ItemCard>
          ))}
          <AddButton label="줄 추가" disabled={d.lines.length >= 4} onClick={() => setLines([...d.lines, [{ text: '핵심' }]])} />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="마무리 안내 (구독 등)">
              <TextInput value={d.cta} onChange={(v) => set(scene, { cta: v })} />
            </Field>
            <Field label="단계">
              <StepInput value={d.ctaStep} onChange={(v) => set(scene, { ctaStep: v ?? 0 })} />
            </Field>
          </div>
        </div>
      )
    }
  }
}
