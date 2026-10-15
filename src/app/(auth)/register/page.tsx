import Link from 'next/link'
import Image from 'next/image'
import { RegisterTypeSelector } from '@/components/shared/register-type-selector'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Image
            src="/images/wegoup-favicon.png"
            alt="위고업잉글리시"
            width={56}
            height={56}
            priority
            className="mx-auto mb-4 h-14 w-14 rounded-xl"
          />
          <h1 className="text-2xl font-bold text-gray-900">위고업잉글리시</h1>
          <p className="mt-1.5 text-sm text-gray-500">어떤 유형으로 가입하시겠습니까?</p>
        </div>

        <RegisterTypeSelector />

        <p className="text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary-700 hover:text-primary-600">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
