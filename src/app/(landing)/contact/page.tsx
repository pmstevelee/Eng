import type { Metadata } from 'next'
import ScrollReveal from '@/components/landing/scroll-reveal'
import ContactForm from '@/components/landing/contact-form'

export const metadata: Metadata = {
  title: '문의하기',
  description: '위고업잉글리시 도입 상담 및 문의를 남겨주세요. 1영업일 내에 답변드립니다.',
}

const CONTACT_METHODS = [
  {
    icon: '✉️',
    title: '이메일',
    desc: '평일 기준 1영업일 내 답변',
    value: 'hello@wegupenglish.com',
    link: 'mailto:hello@wegupenglish.com',
  },
  {
    icon: '💬',
    title: '카카오톡',
    desc: '실시간 채팅 상담 가능',
    value: '@위고업잉글리시',
    link: 'https://open.kakao.com/',
  },
  {
    icon: '📞',
    title: '운영시간',
    desc: '전화 상담 예약 가능',
    value: '평일 09:00 – 18:00',
    link: null,
  },
]

export default function ContactPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20 text-center px-6">
        <ScrollReveal>
          <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
            도입 상담 & 문의
          </h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            궁금한 점이나 도입 관련 문의를 남겨주세요.
            <br />
            1영업일 내에 담당자가 연락드립니다.
          </p>
        </ScrollReveal>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12">
          {/* Contact form */}
          <div className="md:col-span-3">
            <ScrollReveal>
              <h2 className="text-xl font-bold text-gray-900 mb-6">문의 남기기</h2>
              <ContactForm />
            </ScrollReveal>
          </div>

          {/* Contact info */}
          <div className="md:col-span-2">
            <ScrollReveal delay={100}>
              <h2 className="text-xl font-bold text-gray-900 mb-6">연락처</h2>
              <div className="space-y-4 mb-8">
                {CONTACT_METHODS.map((method) => (
                  <div key={method.title} className="border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{method.icon}</div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm mb-0.5">{method.title}</div>
                        <div className="text-xs text-gray-500 mb-1.5">{method.desc}</div>
                        {method.link ? (
                          <a
                            href={method.link}
                            target={method.link.startsWith('http') ? '_blank' : undefined}
                            rel={method.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                            className="text-sm font-medium text-primary-700 hover:underline"
                          >
                            {method.value}
                          </a>
                        ) : (
                          <div className="text-sm font-medium text-gray-700">{method.value}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick CTA */}
              <div className="bg-primary-50 rounded-xl p-5 border border-primary-100">
                <div className="text-sm font-semibold text-primary-900 mb-2">
                  📋 먼저 무료로 체험해보세요
                </div>
                <p className="text-xs text-primary-700 leading-relaxed mb-4">
                  14일 동안 모든 기능을 무료로 사용해보시고 결정하셔도 늦지 않습니다.
                  카드 등록 없이 5분 안에 시작할 수 있습니다.
                </p>
                <a
                  href="/register/owner"
                  className="block text-center bg-primary-700 text-white text-sm font-bold py-2.5 rounded-lg hover:bg-primary-800 transition-colors"
                >
                  무료 체험 시작하기
                </a>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  )
}
