'use client'

import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

type FormState = 'idle' | 'sending' | 'sent' | 'error'

export default function ContactForm() {
  const [state, setState] = useState<FormState>('idle')
  const [form, setForm] = useState({
    name: '',
    academy: '',
    email: '',
    phone: '',
    students: '',
    message: '',
  })

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    // 실제 제출 로직 연동 전 임시 처리
    await new Promise((r) => setTimeout(r, 1200))
    setState('sent')
  }

  if (state === 'sent') {
    return (
      <div className="text-center py-16 border border-gray-200 rounded-2xl">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">문의가 접수되었습니다</h3>
        <p className="text-gray-600 text-sm">
          1영업일 내에 입력하신 이메일로 답변드리겠습니다.
          <br />
          빠른 상담을 원하시면 카카오톡으로 문의해 주세요.
        </p>
        <button
          onClick={() => { setState('idle'); setForm({ name: '', academy: '', email: '', phone: '', students: '', message: '' }) }}
          className="mt-6 text-sm text-primary-700 hover:underline"
        >
          새 문의 작성하기
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            담당자 성함 <span className="text-accent-red">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="홍길동"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            학원명 <span className="text-accent-red">*</span>
          </label>
          <input
            type="text"
            name="academy"
            value={form.academy}
            onChange={handleChange}
            required
            placeholder="○○영어학원"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            이메일 <span className="text-accent-red">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="example@academy.com"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">연락처</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="010-0000-0000"
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">현재 학생 수</label>
        <select
          name="students"
          value={form.students}
          onChange={handleChange}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent bg-white"
        >
          <option value="">선택해 주세요</option>
          <option value="under10">10명 미만</option>
          <option value="10-30">10 – 30명</option>
          <option value="30-60">30 – 60명</option>
          <option value="60-100">60 – 100명</option>
          <option value="over100">100명 이상</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          문의 내용 <span className="text-accent-red">*</span>
        </label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          required
          rows={5}
          placeholder="궁금하신 점이나 도입 관련 문의 사항을 자유롭게 작성해 주세요."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent resize-none"
        />
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="privacy"
          required
          className="mt-1 rounded"
        />
        <label htmlFor="privacy" className="text-xs text-gray-500 leading-relaxed">
          개인정보 수집 및 이용에 동의합니다. 수집된 정보는 도입 상담 목적으로만 사용되며,
          상담 완료 후 1년 이내 삭제됩니다.{' '}
          <a href="/privacy" className="text-primary-700 hover:underline">개인정보처리방침</a>
        </label>
      </div>

      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full min-h-[48px] bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
      >
        {state === 'sending' ? '전송 중...' : '문의 보내기'}
      </button>

      {state === 'error' && (
        <p className="text-sm text-accent-red text-center">
          전송에 실패했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </form>
  )
}
