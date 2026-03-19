import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">IVY LMS</h1>
          <p className="text-muted-foreground">어떤 역할로 가입하시겠습니까?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/register/owner" className="block">
            <Card className="h-full cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all">
              <CardHeader className="text-center space-y-2 pb-2">
                <span className="text-5xl">🏫</span>
                <CardTitle className="text-lg">학원장</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-sm">
                  학원을 등록하고 관리합니다
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/register/teacher" className="block">
            <Card className="h-full cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all">
              <CardHeader className="text-center space-y-2 pb-2">
                <span className="text-5xl">👨‍🏫</span>
                <CardTitle className="text-lg">교사</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-sm">
                  초대 코드로 학원에 합류합니다
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/register/student" className="block">
            <Card className="h-full cursor-pointer border-2 hover:border-primary hover:shadow-md transition-all">
              <CardHeader className="text-center space-y-2 pb-2">
                <span className="text-5xl">👨‍🎓</span>
                <CardTitle className="text-lg">학생</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center text-sm">
                  초대 코드로 학원에 합류합니다
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
