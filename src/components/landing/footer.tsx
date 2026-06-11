import Link from 'next/link'

export default function LandingFooter() {
  return (
    <footer className="bg-primary-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <div className="text-xl font-bold mb-3">위고업잉글리시</div>
            <p className="text-base text-white/60 leading-relaxed mb-6">
              AI 기반 적응형 영어학원 학습관리 시스템.
              <br />
              교육에 집중할 수 있도록 설계되었습니다.
            </p>
            <div className="flex gap-2 flex-wrap">
              <a
                href="#"
                aria-label="카카오톡"
                className="h-9 px-3 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-sm font-semibold"
              >
                카카오톡
              </a>
              <a
                href="#"
                aria-label="인스타그램"
                className="h-9 px-3 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-sm font-semibold"
              >
                인스타그램
              </a>
            </div>
          </div>

          {/* 서비스 */}
          <div>
            <div className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">서비스</div>
            <ul className="space-y-3">
              {[
                { href: '/features', label: '기능소개' },
                { href: '/pricing', label: '요금제' },
                { href: '/reviews', label: '도입사례' },
                { href: '/faq', label: 'FAQ' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-base text-white/70 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 지원 */}
          <div>
            <div className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">지원</div>
            <ul className="space-y-3">
              {[
                { href: '/contact', label: '도입문의' },
                { href: '/terms', label: '이용약관' },
                { href: '/privacy', label: '개인정보처리방침' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-base text-white/70 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 연락처 */}
          <div>
            <div className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-4">연락처</div>
            <ul className="space-y-4">
              <li>
                <div className="text-sm text-white/50 mb-0.5">이메일</div>
                <div className="text-base text-white/80">hello@wegupenglish.com</div>
              </li>
              <li>
                <div className="text-sm text-white/50 mb-0.5">카카오톡</div>
                <div className="text-base text-white/80">@위고업잉글리시</div>
              </li>
              <li>
                <div className="text-sm text-white/50 mb-0.5">운영시간</div>
                <div className="text-base text-white/80">평일 09:00 – 18:00</div>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8">
          <div className="text-sm text-white/40 leading-relaxed mb-4 space-y-1">
            <p>와이앤지크리에이티브 ｜ 대표 이선용 ｜ 사업자등록번호 206-19-73665 ｜ 통신판매업신고 제2014-경기안양-00277</p>
            <p>경기도 안양시 동안구 시민대로 361, 1410(관양동, 에이스 평촌타워)</p>
            <p>TEL 02-2244-0391 ｜ MAIL hello@wegoupenglish.com</p>
          </div>
          <div className="text-center text-base text-white/40">
            © 2026 위고업잉글리시. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
