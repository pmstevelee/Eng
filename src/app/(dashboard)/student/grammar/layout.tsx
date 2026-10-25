import type { ReactNode } from 'react'
import { GrammarTabs } from './_components/grammar-tabs'

export default function StudentGrammarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">문법학습</h1>
        <GrammarTabs />
      </div>
      {children}
    </div>
  )
}
