import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { CreateOwnerForm } from './_components/create-owner-form'

export default function NewOwnerAccountPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-1 text-sm text-gray-500">
        <Link href="/admin/academies" className="hover:text-primary-700 transition-colors">
          학원 관리
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">학원장 계정 만들기</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">학원장 계정 만들기</h1>
        <p className="text-sm text-gray-500 mt-1">
          학원장 아이디와 학원을 함께 만듭니다. 만든 뒤 나오는 로그인 정보를 복사해 학원장에게 전달해 주세요.
        </p>
      </div>

      <CreateOwnerForm />
    </div>
  )
}
