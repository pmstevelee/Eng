import Link from 'next/link'

export default function LandingFooter() {
  return (
    <footer className="bg-primary-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="text-xl font-bold mb-3">위고업잉글리시</div>
            <p className="text-sm text-white/60 leading-relaxed mb-6">
              AI 기반 적응형 영어학원 학습관리 시스템.
              <br />
              교육에 집중할 수 있도록 설계되었습니다.
            </p>
            <div className="flex gap-2">
              <a
                href="#"
                aria-label="카카오톡"
                className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-xs font-bold"
              >
                K
              </a>
              <a
                href="#"
                aria-label="인스타그램"
                className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
            </div>
          </div>

          {/* 서비스 */}
          <div>
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">서비스</div>
            <ul className="space-y-3">
              {[
                { href: '/features', label: '기능소개' },
                { href: '/pricing', label: '요금제' },
                { href: '/reviews', label: '도입사례' },
                { href: '/faq', label: 'FAQ' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/70 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 지원 */}
          <div>
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">지원</div>
            <ul className="space-y-3">
              {[
                { href: '/contact', label: '도입문의' },
                { href: '/terms', label: '이용약관' },
                { href: '/privacy', label: '개인정보처리방침' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/70 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 연락처 */}
          <div>
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">연락처</div>
            <ul className="space-y-4">
              <li>
                <div className="text-xs text-white/50 mb-0.5">이메일</div>
                <div className="text-sm text-white/80">hello@wegupenglish.com</div>
              </li>
              <li>
                <div className="text-xs text-white/50 mb-0.5">카카오톡</div>
                <div className="text-sm text-white/80">@위고업잉글리시</div>
              </li>
              <li>
                <div className="text-xs text-white/50 mb-0.5">운영시간</div>
                <div className="text-sm text-white/80">평일 09:00 – 18:00</div>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 text-center text-sm text-white/40">
          © 2026 위고업잉글리시. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
