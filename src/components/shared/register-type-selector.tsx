'use client'

import { useState } from 'react'
import Link from 'next/link'

type RegisterType = 'personal' | 'academy'

const optionClass =
  'flex min-h-[64px] w-full flex-col items-center justify-center rounded-xl border px-4 py-3 text-center transition-colors'

/** 회원가입 유형 선택: 개인(초대 코드로 학생 가입) / 학원관계자(원장·선생님) */
export function RegisterTypeSelector() {
  const [type, setType] = useState<RegisterType | null>(null)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/register/student"
          className={`${optionClass} border-gray-200 bg-white hover:border-primary-700 hover:bg-primary-50`}
        >
          <span className="font-semibold text-gray-900">개인</span>
          <span className="mt-0.5 text-xs text-gray-500">학생 · 개인 학습자</span>
        </Link>
        <button
          type="button"
          onClick={() => setType(type === 'academy' ? null : 'academy')}
          aria-expanded={type === 'academy'}
          className={`${optionClass} ${
            type === 'academy'
              ? 'border-primary-700 bg-primary-50'
              : 'border-gray-200 bg-white hover:border-primary-700 hover:bg-primary-50'
          }`}
        >
          <span className="font-semibold text-gray-900">학원관계자</span>
          <span className="mt-0.5 text-xs text-gray-500">원장 · 선생님</span>
        </button>
      </div>

      {type === 'academy' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-medium text-gray-600">가입 유형을 선택하세요</p>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/register/owner"
              className={`${optionClass} border-gray-200 bg-white hover:border-primary-700 hover:bg-primary-50`}
            >
              <span className="font-semibold text-gray-900">원장</span>
              <span className="mt-0.5 text-xs text-gray-500">학원 등록 · 14일 무료 체험</span>
            </Link>
            <Link
              href="/register/teacher"
              className={`${optionClass} border-gray-200 bg-white hover:border-primary-700 hover:bg-primary-50`}
            >
              <span className="font-semibold text-gray-900">선생님</span>
              <span className="mt-0.5 text-xs text-gray-500">학원 초대 코드로 합류</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
