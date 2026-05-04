import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '이용약관',
  description: '위고업잉글리시 서비스 이용약관을 확인하세요.',
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

export default function TermsPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gray-50 border-b border-gray-200 py-14 px-6 text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">이용약관</h1>
        <p className="text-sm text-gray-500">
          시행일: {EFFECTIVE_DATE} &nbsp;·&nbsp; 최종 수정일: {LAST_UPDATED}
        </p>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14">

        {/* 전문 */}
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-6 mb-10 text-sm text-gray-700 leading-relaxed">
          본 이용약관은 와이앤지크리에이티브(이하 &quot;회사&quot;)가 운영하는 <strong>위고업잉글리시</strong> 서비스(이하 &quot;서비스&quot;)의 이용조건 및 절차, 회사와 이용자 간의 권리·의무 및 책임사항 등을 규정합니다. 서비스에 가입하거나 이용함으로써 본 약관에 동의한 것으로 간주됩니다.
        </div>

        <Section num="1" title="목적">
          <p>
            이 약관은 와이앤지크리에이티브(이하 &quot;회사&quot;)가 제공하는 위고업잉글리시 AI 영어학원 학습관리 시스템(이하 &quot;서비스&quot;)의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </Section>

        <Section num="2" title="정의">
          <p>이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li><strong>서비스</strong>: 회사가 위고업잉글리시라는 이름으로 제공하는 AI 기반 영어학원 학습관리 시스템 및 관련 제반 서비스</li>
            <li><strong>이용자</strong>: 본 약관에 동의하고 서비스를 이용하는 학원장, 교사, 학생 및 관리자</li>
            <li><strong>학원장(ACADEMY_OWNER)</strong>: 학원 계정을 개설하고 구독을 관리하는 대표 이용자</li>
            <li><strong>교사(TEACHER)</strong>: 학원장의 초대로 가입하여 학생 관리 및 테스트를 운영하는 이용자</li>
            <li><strong>학생(STUDENT)</strong>: 학원장 또는 교사의 초대코드로 가입하여 학습 서비스를 이용하는 이용자</li>
            <li><strong>계정</strong>: 서비스 이용을 위해 이용자가 설정한 이메일 및 비밀번호 등의 정보 일체</li>
            <li><strong>구독</strong>: 일정 기간 동안 서비스를 이용하기 위해 요금을 납부하는 계약</li>
            <li><strong>콘텐츠</strong>: 서비스 내에서 생성·저장·전송되는 문항, 학습 자료, 성적 데이터, AI 분석 결과 등 일체의 정보</li>
          </ol>
        </Section>

        <Section num="3" title="약관의 효력 및 변경">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
            <li>회사는 필요한 경우 관련 법령에 위반되지 않는 범위 내에서 본 약관을 변경할 수 있습니다.</li>
            <li>약관이 변경되는 경우, 회사는 변경 내용 및 적용 일자를 서비스 내 공지 또는 가입 시 기재한 이메일로 30일 전에 통지합니다. 단, 이용자에게 불리한 변경의 경우 최소 30일 이상의 유예기간을 둡니다.</li>
            <li>이용자가 변경된 약관에 동의하지 않을 경우, 서비스 이용을 중단하고 탈퇴할 수 있습니다. 변경 약관 시행 후 계속 서비스를 이용하면 변경 약관에 동의한 것으로 간주합니다.</li>
          </ol>
        </Section>

        <Section num="4" title="서비스 이용 계약의 성립">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>이용 계약은 이용자가 약관에 동의하고 회원가입 신청을 완료한 후 회사가 이를 승낙함으로써 성립합니다.</li>
            <li>학원장은 회사가 정한 양식에 따라 이름, 이메일, 학원명 등 필수 정보를 입력하여 가입 신청을 합니다.</li>
            <li>교사 및 학생은 학원장이 발급한 초대코드를 통해 가입합니다.</li>
            <li>다음 각 호에 해당하는 경우 회사는 가입 승낙을 거부하거나 사후에 이용 계약을 해지할 수 있습니다.
              <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                <li>타인의 정보를 도용하거나 허위 정보를 기재한 경우</li>
                <li>만 14세 미만인 경우</li>
                <li>이전에 약관 위반으로 이용 제한 또는 계약 해지된 경우</li>
                <li>기타 관련 법령에 위반되거나 회사 정책에 반하는 경우</li>
              </ul>
            </li>
          </ol>
        </Section>

        <Section num="5" title="서비스의 제공 및 변경">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>회사는 다음과 같은 서비스를 제공합니다.
              <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                <li>AI 기반 적응형 영어 레벨 테스트 서비스</li>
                <li>학원 학생 관리 및 성적 분석 서비스</li>
                <li>AI 문항 생성 및 자동 채점 서비스</li>
                <li>교사·학원장 대시보드 및 보고서 서비스</li>
                <li>기타 회사가 정하는 부가 서비스</li>
              </ul>
            </li>
            <li>서비스는 연중무휴 24시간 제공을 원칙으로 하나, 시스템 점검·업데이트 등의 사유로 일시 중단될 수 있습니다. 예정된 중단은 사전에 공지합니다.</li>
            <li>회사는 서비스의 내용, 기능, 요금 등을 변경할 수 있으며, 중요한 변경 사항은 사전에 공지합니다.</li>
          </ol>
        </Section>

        <Section num="6" title="구독 및 요금">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>서비스는 선불 구독 방식으로 운영되며, 요금 및 구독 조건은 서비스 내 요금제 페이지에 명시됩니다.</li>
            <li>신규 학원장은 결제 정보 없이 14일 무료 체험을 이용할 수 있습니다. 체험 기간 종료 후 자동 결제되지 않으며, 별도로 구독을 선택해야 합니다.</li>
            <li>현재 결제 방식은 계좌 이체(수동 입금 확인)로 운영됩니다. 구독 신청 후 관리자의 입금 확인 후 서비스가 활성화됩니다.</li>
            <li>구독 기간 중 플랜 업그레이드는 즉시 적용되며, 남은 기간에 비례하여 추가 요금이 청구됩니다.</li>
            <li>구독료는 부가가치세가 포함된 금액으로 표시됩니다.</li>
          </ol>
        </Section>

        <Section num="7" title="환불 정책">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>결제일로부터 <strong>7일 이내</strong>에 서비스를 이용하지 않은 경우 전액 환불이 가능합니다.</li>
            <li>결제일로부터 7일 초과 시, 남은 구독 기간에 해당하는 금액에서 위약금 10%를 공제한 금액을 환불합니다.</li>
            <li>무료 체험 기간 내 발생한 이용료는 별도 청구되지 않으며, 환불 대상이 아닙니다.</li>
            <li>다음 각 호의 경우 환불이 제한될 수 있습니다.
              <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                <li>약관 위반으로 인해 회사가 계약을 해지한 경우</li>
                <li>이용자의 귀책 사유로 서비스 이용이 불가능한 경우</li>
              </ul>
            </li>
            <li>환불 요청은 이메일(hello@wegupenglish.com) 또는 서비스 내 고객센터를 통해 접수하시기 바랍니다.</li>
          </ol>
        </Section>

        <Section num="8" title="이용자의 의무">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>이용자는 다음 행위를 해서는 안 됩니다.
              <ul className="list-disc list-inside space-y-1 pl-4 mt-2">
                <li>타인의 계정을 무단으로 이용하거나 다른 이용자를 사칭하는 행위</li>
                <li>서비스를 통해 얻은 정보를 회사의 사전 승낙 없이 복사·복제·배포·출판하는 행위</li>
                <li>서비스의 정상적인 운영을 방해하는 행위(해킹, 바이러스 유포 등)</li>
                <li>다른 이용자의 개인정보를 수집·저장·공개하는 행위</li>
                <li>관련 법령, 공서양속, 회사 정책에 반하는 행위</li>
                <li>미성년자인 학생의 개인정보를 법령이 허용하는 범위 외로 활용하는 행위</li>
              </ul>
            </li>
            <li>이용자는 계정 정보(이메일, 비밀번호)를 안전하게 관리할 의무가 있으며, 계정 도용으로 인한 손해에 대해 회사는 책임지지 않습니다.</li>
            <li>학원장은 소속 교사 및 학생의 개인정보를 관련 법령에 따라 적법하게 수집·관리할 책임이 있습니다.</li>
          </ol>
        </Section>

        <Section num="9" title="회사의 의무">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>회사는 관련 법령과 본 약관을 준수하며, 이용자에게 안정적인 서비스를 제공하기 위해 최선을 다합니다.</li>
            <li>회사는 이용자의 개인정보를 개인정보처리방침에 따라 보호하며, 법령에 정한 경우를 제외하고는 제3자에게 제공하지 않습니다.</li>
            <li>회사는 서비스 운영 과정에서 이용자로부터 의견이나 불만을 접수한 경우, 해당 내용을 검토하여 처리 결과를 통보합니다.</li>
            <li>회사는 서비스 내 콘텐츠(문항 등)의 정확성을 위해 노력하나, 이를 보증하지는 않습니다.</li>
          </ol>
        </Section>

        <Section num="10" title="지식재산권">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>서비스 내 회사가 제작한 콘텐츠(문항, UI, 디자인, 소프트웨어 등)에 대한 지식재산권은 회사에 귀속됩니다.</li>
            <li>이용자가 서비스에 직접 등록한 콘텐츠(교사 제작 문항, 학원 자체 자료 등)의 저작권은 해당 이용자 또는 학원에 귀속됩니다. 단, 이용자는 회사에 해당 콘텐츠를 서비스 운영에 필요한 범위 내에서 사용·저장할 수 있는 라이선스를 부여합니다.</li>
            <li>이용자는 회사의 사전 동의 없이 서비스 내 콘텐츠를 상업적 목적으로 이용할 수 없습니다.</li>
          </ol>
        </Section>

        <Section num="11" title="서비스 이용 제한 및 계약 해지">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>회사는 이용자가 본 약관의 의무를 위반하거나 서비스 운영을 방해하는 경우, 경고·일시 정지·영구 이용 제한 등의 조치를 취할 수 있습니다.</li>
            <li>이용자는 언제든지 서비스 내 탈퇴 신청을 통해 이용 계약을 해지할 수 있습니다.</li>
            <li>탈퇴 시 해당 계정과 연관된 모든 데이터(학생 정보, 성적, 학습 이력 등)는 관련 법령에 따른 보존 의무 기간이 경과한 후 완전히 삭제됩니다.</li>
            <li>학원장 탈퇴 시 해당 학원에 소속된 교사·학생 계정의 서비스 이용이 제한될 수 있으므로, 사전에 소속 구성원에게 안내하시기 바랍니다.</li>
          </ol>
        </Section>

        <Section num="12" title="책임의 제한">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>회사는 천재지변, 전쟁, 테러, 해킹 등 불가항력적 사유로 서비스를 제공하지 못한 경우 책임을 지지 않습니다.</li>
            <li>회사는 이용자 간 또는 이용자와 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.</li>
            <li>회사는 AI 문항 생성 및 AI 채점 결과의 정확성을 보증하지 않으며, 이를 맹목적으로 의존하여 발생한 손해에 대해 책임지지 않습니다.</li>
            <li>회사의 손해배상 책임은 관련 법령이 허용하는 범위 내에서 제한될 수 있으며, 어떠한 경우에도 해당 월 구독료를 초과하지 않습니다.</li>
          </ol>
        </Section>

        <Section num="13" title="분쟁 해결">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>서비스 이용과 관련한 분쟁은 먼저 회사 고객센터(hello@wegupenglish.com)를 통해 해결을 시도합니다.</li>
            <li>분쟁이 해결되지 않을 경우 관련 법령에 따라 처리하며, 소송이 필요한 경우 회사 본사 소재지를 관할하는 법원을 전속 관할 법원으로 합니다.</li>
            <li>본 약관은 대한민국 법률에 따라 해석되고 적용됩니다.</li>
          </ol>
        </Section>

        <Section num="14" title="기타">
          <ol className="list-decimal list-inside space-y-2 pl-2">
            <li>본 약관에 명시되지 않은 사항은 전자상거래 등에서의 소비자보호에 관한 법률, 개인정보보호법, 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관련 법령에 따릅니다.</li>
            <li>본 약관의 일부 조항이 무효로 판단되더라도 나머지 조항의 효력에는 영향을 미치지 않습니다.</li>
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
