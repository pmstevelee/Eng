import type { Metadata } from 'next'
import ScrollReveal from '@/components/landing/scroll-reveal'
import FaqAccordion from '@/components/landing/faq-accordion'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ',
  description: '위고업잉글리시에 대한 자주 묻는 질문들을 확인하세요.',
}

const FAQ_GROUPS = [
  {
    category: '서비스 일반',
    items: [
      {
        q: '위고업잉글리시는 어떤 서비스인가요?',
        a: '위고업잉글리시는 AI 기반 영어학원 학습관리 시스템(LMS)입니다. 적응형 레벨 테스트, AI 맞춤 학습 추천, 자동 채점, 실시간 분석 대시보드를 통해 학원 운영을 효율화하고 학생의 영어 실력 향상을 돕습니다.',
      },
      {
        q: '어떤 규모의 학원에 적합한가요?',
        a: '학생 10명의 소규모 학원부터 100명 이상의 대형 학원까지 모두 사용하실 수 있습니다. 무료 플랜으로 먼저 체험해보시고 학원 규모에 맞는 플랜을 선택하시면 됩니다.',
      },
      {
        q: '영어 외 다른 과목도 지원하나요?',
        a: '현재는 영어 과목에 특화되어 있습니다. 문법, 어휘, 읽기, 쓰기 4개 영역을 CEFR 기준 10단계로 정밀하게 측정합니다. 타 과목 지원은 향후 로드맵에 포함되어 있습니다.',
      },
      {
        q: '학원 여러 곳을 동시에 관리할 수 있나요?',
        a: '현재는 계정 1개당 학원 1개를 지원합니다. 여러 지점을 운영하시는 경우 도입 상담을 통해 맞춤 솔루션을 안내드릴 수 있습니다.',
      },
    ],
  },
  {
    category: '시작 & 설정',
    items: [
      {
        q: '무료 체험은 어떻게 시작하나요?',
        a: '\'무료 시작하기\' 버튼을 눌러 학원장 계정을 만들면 바로 시작됩니다. 카드 정보 입력 없이 14일간 모든 기능을 무료로 사용하실 수 있습니다.',
      },
      {
        q: '교사와 학생은 어떻게 초대하나요?',
        a: '학원장이 역할별 초대코드를 발급하면 교사와 학생이 해당 코드로 가입합니다. 가입 즉시 학원에 연결되며 별도의 승인 과정 없이 바로 사용 가능합니다.',
      },
      {
        q: '기존 학생 데이터를 가져올 수 있나요?',
        a: '엑셀/CSV 형식의 학생 데이터 일괄 가져오기 기능을 준비 중입니다. 현재는 도입 지원팀이 초기 데이터 설정을 도와드립니다. 도입 상담 시 문의해 주세요.',
      },
      {
        q: '설치가 필요한가요?',
        a: '별도 설치 없이 웹 브라우저에서 바로 사용 가능합니다. 학생은 PC, 태블릿, 스마트폰 모두에서 최적화된 화면으로 학습할 수 있습니다.',
      },
    ],
  },
  {
    category: '레벨 테스트 & 학습',
    items: [
      {
        q: '레벨 테스트는 얼마나 자주 보나요?',
        a: '초기 배치 시험은 가입 후 1회 진행되며, 이후 정기 레벨 테스트는 학원 설정에 따라 분기별 또는 반기별로 진행됩니다. 학원장이 직접 주기를 설정할 수 있습니다.',
      },
      {
        q: '레벨 테스트 문제는 반복 출제되나요?',
        a: '동일 학원에서 1년 내 같은 문제가 다시 출제되지 않도록 사용 이력을 추적합니다. 450+ 공용 문제 뱅크와 AI 생성 문제를 활용하여 매번 새로운 문제를 제공합니다.',
      },
      {
        q: 'AI 쓰기 평가는 얼마나 정확한가요?',
        a: 'GPT-4o 모델을 기반으로 문법, 표현, 구성, 내용의 4개 기준으로 채점합니다. 실제 교사의 채점과 비교했을 때 85% 이상 일치율을 보이며, 교사가 AI 점수를 수정할 수도 있습니다.',
      },
      {
        q: '교사가 레벨을 수동으로 조정할 수 있나요?',
        a: '네, 가능합니다. 교사 권한으로 학생 레벨을 수동 조정할 수 있으며, 조정 이력이 자동으로 기록됩니다. 테스트 결과와 교사 판단을 함께 반영하는 유연한 구조입니다.',
      },
    ],
  },
  {
    category: '결제 & 요금',
    items: [
      {
        q: '무료 체험 기간이 끝나면 자동으로 결제되나요?',
        a: '아니요. 무료 체험 종료 후 자동 결제되지 않습니다. 계속 사용하시려면 직접 플랜을 선택하여 구독하셔야 합니다.',
      },
      {
        q: '결제 방법은 무엇인가요?',
        a: '현재는 계좌 이체(수동 입금 확인) 방식으로 운영됩니다. 구독 신청 후 관리자가 입금을 확인하면 서비스가 활성화됩니다. 카드 자동 결제는 2026년 하반기 지원 예정입니다.',
      },
      {
        q: '언제든지 해지할 수 있나요?',
        a: '네, 언제든지 해지 가능합니다. 해지 후에는 남은 구독 기간까지 서비스를 사용하실 수 있으며, 환불 정책은 이용약관을 참조해 주세요.',
      },
      {
        q: '학생 수가 갑자기 늘면 어떻게 하나요?',
        a: '플랜 한도 초과 시 알림을 드리며, 상위 플랜으로 업그레이드할 수 있습니다. 업그레이드는 즉시 적용되며 추가 요금은 남은 기간에 비례하여 계산됩니다.',
      },
    ],
  },
  {
    category: '보안 & 데이터',
    items: [
      {
        q: '학생 개인정보는 안전하게 보호되나요?',
        a: 'Supabase 기반 PostgreSQL에 저장되며 Row Level Security(RLS) 정책으로 권한 없는 접근을 차단합니다. 서버는 국내 리전에서 운영되며, 개인정보보호법을 준수합니다.',
      },
      {
        q: '탈퇴하면 데이터는 어떻게 되나요?',
        a: '탈퇴 신청 시 학원의 모든 데이터(학생 정보, 성적, 학습 이력)가 완전히 삭제됩니다. 삭제는 되돌릴 수 없으므로 신중하게 결정해 주세요.',
      },
      {
        q: '데이터 백업은 어떻게 되나요?',
        a: 'Supabase 클라우드 인프라를 통해 일 1회 자동 백업이 이루어집니다. 데이터 손실 위험을 최소화합니다.',
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-primary-50 to-white py-20 text-center px-6">
        <ScrollReveal>
          <h1 className="text-4xl md:text-5xl font-bold text-primary-900 mb-4">
            자주 묻는 질문
          </h1>
          <p className="text-lg text-gray-600">
            궁금한 점이 있으신가요? 아래에서 찾아보세요.
          </p>
        </ScrollReveal>
      </section>

      {/* FAQ accordion */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <FaqAccordion groups={FAQ_GROUPS} />
        </div>
      </section>

      {/* Still have questions */}
      <section className="bg-gray-50 py-16 px-6">
        <ScrollReveal>
          <div className="max-w-xl mx-auto text-center">
            <div className="text-4xl mb-4">💬</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">답변을 찾지 못하셨나요?</h2>
            <p className="text-gray-600 mb-6">
              도입 상담 또는 카카오톡으로 문의해 주시면 빠르게 답변드립니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/contact"
                className="bg-primary-700 text-white font-bold px-6 py-3 rounded-xl hover:bg-primary-800 transition-colors"
              >
                1:1 문의하기
              </Link>
              <a
                href="https://open.kakao.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gray-300 text-gray-700 font-bold px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                카카오톡 문의
              </a>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  )
}
