import { NextRequest, NextResponse } from 'next/server'

// 대시보드 레이아웃에서 getCurrentUser()가 null을 반환할 때 이 엔드포인트로 리다이렉트.
// user-role 쿠키를 삭제 후 /login으로 리다이렉트하여 미들웨어 무한 루프를 방지.
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url))
  response.cookies.delete('user-role')
  return response
}
