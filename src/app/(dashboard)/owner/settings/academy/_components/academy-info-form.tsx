'use client'

import { useState, useTransition } from 'react'
import { updateAcademyInfo } from '../../actions'

type Props = {
  businessName: string
  address: string
  phone: string
}

export function AcademyInfoForm({ businessName, address, phone }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateAcademyInfo(formData)
      if (res?.error) {
        setError(res.error)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      {/* 상호명 */}
      <div className="space-y-1.5">
        <label htmlFor="businessName" className="block text-sm font-medium text-gray-700">
          상호명
        </label>
        <p className="text-xs text-gray-500">상호명은 모든 페이지에서 로고로 표시됩니다</p>
        <input
          id="businessName"
          name="businessName"
          type="text"
          defaultValue={businessName}
          placeholder="예: 청담어학원"
          className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': '#1865F2' } as React.CSSProperties}
          required
        />
      </div>

      {/* 주소 */}
      <div className="space-y-1.5">
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          학원 주소
          <span className="ml-1 text-xs font-normal text-gray-400">(선택)</span>
        </label>
        <input
          id="address"
          name="address"
          type="text"
          defaultValue={address}
          placeholder="예: 서울시 강남구 테헤란로 123"
          className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': '#1865F2' } as React.CSSProperties}
        />
      </div>

      {/* 전화번호 */}
      <div className="space-y-1.5">
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          전화번호
          <span className="ml-1 text-xs font-normal text-gray-400">(선택)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone}
          placeholder="예: 02-1234-5678"
          className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': '#1865F2' } as React.CSSProperties}
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {success && (
        <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
          학원 정보가 저장되었습니다.
        </p>
      )}

      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="h-11 px-6 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1865F2' }}
        >
          {isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}
