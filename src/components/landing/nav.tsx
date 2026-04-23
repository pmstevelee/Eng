'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/features', label: '기능소개' },
  { href: '/pricing', label: '요금제' },
  { href: '/reviews', label: '도입사례' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: '문의하기' },
]

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 transition-shadow duration-200 ${
        scrolled ? 'shadow-sm' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-primary-900 tracking-tight">
            위고업잉글리시
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors px-4 py-2"
            >
              로그인
            </Link>
            <Link
              href="/register/owner"
              className="bg-primary-700 text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-primary-800 transition-colors"
            >
              무료 시작하기
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="메뉴"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 py-4 flex flex-col gap-1 animate-in slide-in-from-top-2 duration-200">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm font-medium text-gray-600 px-2 py-3 hover:text-primary-700 transition-colors rounded-lg"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
            <hr className="my-2 border-gray-100" />
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 px-2 py-3"
              onClick={() => setMenuOpen(false)}
            >
              로그인
            </Link>
            <Link
              href="/register/owner"
              className="bg-primary-700 text-white text-sm font-bold px-5 py-3 rounded-lg text-center mt-1 hover:bg-primary-800 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              무료 시작하기
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
