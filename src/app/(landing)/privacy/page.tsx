import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: '위고업잉글리시 개인정보처리방침을 확인하세요.',
}

const LAST_UPDATED = '2026년 5월 1일'
const EFFECTIVE_DATE = '2026년 5월 1일'

interface SectionProps {
  num: string
  title: string
  children: React.ReactNode
}

function Section({ num, title, children }: SectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
        제{num}조 ({title})
      </h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gray-50 border-b border-gray-200 py-14 px-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">개인정보처리방침</h1>
        <p className="text-sm text-gray-500">
          시행일: {EFFECTIVE_DATE} &nbsp;·&nbsp; 최종 수정일: {LAST_UPDATED}
        </p>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14">

        {/* 전문 */}
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-6 mb-10 text-sm text-gray-700 leading-relaxed">
          와이앤지크리에이티브(이하 &quot;회사&quot;)는 <strong>개인정보보호법</strong> 및 관련 법령을 준수하며, 이용자의 개인정보를 소중히 보호합니다. 본 개인정보처리방침은 회사가 운영하는 <strong>위고업잉글리시</strong> 서비스에서 수집하는 개인정보의 처리 목적, 항목, 보유 기간 및 이용자의 권리에 대해 안내합니다.
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: '🔒', title: '최소 수집', desc: '서비스에 필요한 최소한의 정보만 수집합니다.' },
            { icon: '🚫', title: '제3자 미제공', desc: '법령에 따른 경우 외 외부 제공 없음' },
            { icon: '🗑️', title: '완전 삭제', desc: '탈퇴 시 모든 데이터를 완전히 삭제합니다.' },
          ].map((item) => (
            <div key={item.title} className="border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="font-semibold text-gray-900 text-sm mb-1">{item.title}</div>
              <div className="text-xs text-gray-500">{item.desc}</div>
            </div>
          ))}
        </div>

        <Section num="1" title="개인정보의 수집 항목 및 방법">
          <p>회사는 서비스 제공을 위해 다음과 같이 개인정보를 수집합니다.</p>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left border-b border-gray-200">구분</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">필수 항목</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">선택 항목</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                <tr>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">학원장</td>
                  <td className="px-3 py-2">이름, 이메일, 비밀번호, 학원명, 연락처</td>
                  <td className="px-3 py-2">학원 주소, 학원 전화번호</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">교사</td>
                  <td className="px-3 py-2">이름, 이메일, 비밀번호</td>
                  <td className="px-3 py-2">연락처</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">학생</td>
                  <td className="px-3 py-2">이름, 이메일, 비밀번호</td>
                  <td className="px-3 py-2">생년월일, 학년, 연락처</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3">또한 서비스 이용 과정에서 다음 정보가 자동으로 생성·수집될 수 있습니다.</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>테스트 응시 기록, 답안, 점수, 레벨 이력</li>
            <li>학습 활동 로그 (학습 시간, 문제 풀이 이력)</li>
            <li>서비스 접속 IP, 브라우저 정보, 접속 일시</li>
            <li>결제 관련 정보 (입금 확인을 위한 입금자명, 금액)</li>
          </ul>
          <p className="mt-3">
            개인정보는 회원가입 양식, 서비스 이용 과정, 고객 문의 등을 통해 수집됩니다.
          </p>
        </Section>

        <Section num="2" title="개인정보의 처리 목적">
          <p>회사는 수집한 개인정보를 다음 목적으로만 처리합니다.</p>
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li><strong>회원 관리</strong>: 회원가입, 본인 확인, 계정 유지, 공지 전달, 불량 이용자 제재</li>
            <li><strong>서비스 제공</strong>: 적응형 레벨 테스트, AI 문항 제공, 성적 분석, 학습 관리, 리포트 생성</li>
            <li><strong>구독 및 결제 관리</strong>: 구독 신청·해지, 입금 확인, 세금계산서 발급</li>
            <li><strong>고객 지원</strong>: 문의 접수 및 처리, 서비스 장애 대응</li>
            <li><strong>서비스 개선</strong>: 이용 통계 분석, 신기능 개발, AI 모델 개선</li>
            <li><strong>법적 의무 이행</strong>: 관련 법령에 따른 기록 보존</li>
          </ol>
        </Section>

        <Section num="3" title="개인정보의 보유 및 이용 기간">
          <p>회사는 이용자의 개인정보를 회원 탈퇴 또는 동의 철회 시까지 보유하며, 탈퇴 즉시 지체 없이 파기합니다. 단, 관련 법령에 따라 다음 기간 동안 보존합니다.</p>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left border-b border-gray-200">보존 항목</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">보존 기간</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">근거 법령</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                <tr>
                  <td className="px-3 py-2">계약 또는 청약 철회 기록</td>
                  <td className="px-3 py-2 whitespace-nowrap">5년</td>
                  <td className="px-3 py-2">전자상거래법</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">대금 결제 및 재화 공급 기록</td>
                  <td className="px-3 py-2 whitespace-nowrap">5년</td>
                  <td className="px-3 py-2">전자상거래법</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">소비자 불만 또는 분쟁 처리 기록</td>
                  <td className="px-3 py-2 whitespace-nowrap">3년</td>
                  <td className="px-3 py-2">전자상거래법</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">서비스 접속 로그</td>
                  <td className="px-3 py-2 whitespace-nowrap">3개월</td>
                  <td className="px-3 py-2">통신비밀보호법</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section num="4" title="개인정보의 제3자 제공">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.</li>
            <li>다음 각 호의 경우에는 예외적으로 제3자에게 제공할 수 있습니다.
              <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                <li>이용자가 사전에 동의한 경우</li>
                <li>법령의 규정에 따르거나 수사기관의 적법한 요청이 있는 경우</li>
              </ul>
            </li>
          </ol>
        </Section>

        <Section num="5" title="개인정보 처리 업무의 위탁">
          <p>회사는 서비스 제공을 위해 다음 업체에 개인정보 처리를 위탁합니다.</p>

          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left border-b border-gray-200">수탁 업체</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">위탁 업무</th>
                  <th className="px-3 py-2 text-left border-b border-gray-200">보유 기간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                <tr>
                  <td className="px-3 py-2 font-medium">Supabase Inc.</td>
                  <td className="px-3 py-2">데이터베이스 저장 및 인증 서비스</td>
                  <td className="px-3 py-2">회원 탈퇴 시까지</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">Vercel Inc.</td>
                  <td className="px-3 py-2">웹 서비스 호스팅</td>
                  <td className="px-3 py-2">서비스 계약 종료 시까지</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium">OpenAI Inc.</td>
                  <td className="px-3 py-2">AI 문항 생성 및 쓰기 채점</td>
                  <td className="px-3 py-2">처리 완료 즉시 파기</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3">
            위탁 업체의 개인정보 처리에 관한 사항은 각 업체의 개인정보처리방침을 참고하시기 바랍니다.
            OpenAI에는 채점·생성에 필요한 텍스트만 전달되며, 이름·이메일 등 식별 정보는 전달되지 않습니다.
          </p>
        </Section>

        <Section num="6" title="개인정보의 파기">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>회사는 개인정보 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 해당 개인정보를 파기합니다.</li>
            <li>전자적 파일 형태의 경우 복구 불가능한 방법으로 영구 삭제하며, 출력물 등 서면의 경우 분쇄하거나 소각합니다.</li>
            <li>탈퇴 신청 시, 해당 계정 및 연관된 모든 개인정보(학생 정보, 성적, 학습 이력 등)는 법정 보존 기간이 경과한 후 완전히 삭제됩니다.</li>
          </ol>
        </Section>

        <Section num="7" title="정보주체의 권리와 행사 방법">
          <p>이용자는 언제든지 다음과 같은 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li><strong>열람 요청</strong>: 자신의 개인정보 처리 현황 확인</li>
            <li><strong>정정·삭제 요청</strong>: 잘못된 정보 수정 또는 삭제 요청</li>
            <li><strong>처리 정지 요청</strong>: 개인정보 처리의 일시적 정지 요청</li>
            <li><strong>동의 철회</strong>: 개인정보 수집·이용에 대한 동의 철회</li>
          </ul>
          <p className="mt-3">
            권리 행사는 서비스 내 계정 설정 또는 개인정보 보호책임자에게 이메일(hello@wegupenglish.com)로 요청하실 수 있습니다. 회사는 요청을 받은 날로부터 <strong>10일 이내</strong>에 처리 결과를 통보합니다.
          </p>
          <p>
            만 14세 미만 아동의 경우, 법정대리인이 해당 권리를 행사할 수 있습니다.
          </p>
        </Section>

        <Section num="8" title="개인정보의 안전성 확보 조치">
          <p>회사는 개인정보의 안전성 확보를 위해 다음 조치를 취하고 있습니다.</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li><strong>암호화</strong>: 비밀번호, 민감 정보는 암호화하여 저장·전송합니다. 모든 통신은 TLS(HTTPS)로 보호됩니다.</li>
            <li><strong>접근 통제</strong>: Row Level Security(RLS) 정책을 통해 권한 있는 사용자만 데이터에 접근하도록 제한합니다.</li>
            <li><strong>접속 기록 관리</strong>: 개인정보 처리 시스템 접속 기록을 최소 6개월 보관하고 정기 점검합니다.</li>
            <li><strong>백업</strong>: 일 1회 자동 백업으로 데이터 손실을 방지합니다.</li>
            <li><strong>관리적 보호</strong>: 개인정보 취급 직원을 최소화하고, 정기 교육을 실시합니다.</li>
          </ul>
        </Section>

        <Section num="9" title="쿠키(Cookie)의 사용">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>회사는 서비스 운영을 위해 쿠키를 사용합니다. 쿠키는 서버가 이용자 브라우저에 전송하는 소량의 데이터입니다.</li>
            <li>사용 쿠키 유형:
              <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                <li><strong>필수 쿠키</strong>: 로그인 세션 유지, 보안 인증 (거부 시 서비스 이용 불가)</li>
                <li><strong>기능 쿠키</strong>: 언어·지점 선택 등 설정 기억</li>
                <li><strong>분석 쿠키</strong>: 서비스 이용 통계 수집 (이용자 동의 시 수집)</li>
              </ul>
            </li>
            <li>이용자는 브라우저 설정에서 쿠키를 거부하거나 삭제할 수 있습니다. 단, 필수 쿠키 거부 시 로그인 등 일부 기능이 제한됩니다.</li>
          </ol>
        </Section>

        <Section num="10" title="개인정보 보호책임자">
          <p>회사는 개인정보 처리에 관한 업무를 총괄하고 이용자의 불만 처리 및 피해 구제를 담당하는 개인정보 보호책임자를 지정하고 있습니다.</p>

          <div className="bg-gray-50 rounded-xl p-5 mt-3 text-sm space-y-1">
            <p className="font-semibold text-gray-900 mb-2">개인정보 보호책임자</p>
            <p>성명: 이선용</p>
            <p>직위: 대표이사</p>
            <p>이메일: hello@wegupenglish.com</p>
            <p>전화: 02-2244-0391</p>
          </div>

          <p className="mt-4">
            개인정보와 관련한 불만이나 침해 구제를 위해 다음 기관에 도움을 요청하실 수도 있습니다.
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2 mt-2">
            <li>개인정보 침해신고센터: <span className="font-medium">privacy.kisa.or.kr</span> / 국번 없이 118</li>
            <li>개인정보 분쟁조정위원회: <span className="font-medium">www.kopico.go.kr</span> / 1833-6972</li>
            <li>대검찰청 사이버범죄수사단: <span className="font-medium">www.spo.go.kr</span> / 02-3480-3573</li>
            <li>경찰청 사이버안전국: <span className="font-medium">cyberbureau.police.go.kr</span> / 국번 없이 182</li>
          </ul>
        </Section>

        <Section num="11" title="개인정보처리방침의 변경">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>본 개인정보처리방침은 법령, 정책 또는 서비스 변경에 따라 개정될 수 있습니다.</li>
            <li>개정 시 시행 7일 전부터 서비스 내 공지 또는 이메일로 안내드립니다. 이용자에게 불리한 변경의 경우 30일 이상 사전 공지합니다.</li>
            <li>이전 버전의 개인정보처리방침은 요청 시 제공해 드립니다.</li>
          </ol>
        </Section>

        {/* 회사 정보 */}
        <div className="mt-12 bg-gray-50 rounded-xl p-6 text-sm text-gray-600 space-y-1">
          <p className="font-semibold text-gray-800 mb-3">사업자 정보</p>
          <p>상호: 와이앤지크리에이티브</p>
          <p>대표자: 이선용</p>
          <p>사업자등록번호: 206-19-73665</p>
          <p>통신판매업신고번호: 제2014-경기안양-00277</p>
          <p>주소: 경기도 안양시 동안구 시민대로 361, 1410호 (관양동, 에이스 평촌타워)</p>
          <p>전화: 02-2244-0391</p>
          <p>이메일: hello@wegupenglish.com</p>
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center">시행일: {EFFECTIVE_DATE}</p>
      </div>
    </div>
  )
}
