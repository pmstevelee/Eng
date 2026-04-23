'use client'

import { useState } from 'react'
import ScrollReveal from './scroll-reveal'

interface FaqItem {
  q: string
  a: string
}

interface FaqGroup {
  category: string
  items: FaqItem[]
}

interface FaqAccordionProps {
  groups: FaqGroup[]
}

function AccordionItem({ q, a }: FaqItem) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-sm leading-relaxed">{q}</span>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
          {a}
        </div>
      )}
    </div>
  )
}

export default function FaqAccordion({ groups }: FaqAccordionProps) {
  return (
    <div className="space-y-10">
      {groups.map((group, gi) => (
        <ScrollReveal key={group.category} delay={gi * 60}>
          <div>
            <h2 className="text-sm font-semibold text-primary-700 uppercase tracking-wider mb-4">
              {group.category}
            </h2>
            <div className="space-y-3">
              {group.items.map((item) => (
                <AccordionItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </ScrollReveal>
      ))}
    </div>
  )
}
