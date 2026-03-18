/**
 * 테스트 계정 및 기본 데이터 생성 스크립트
 * 실행: npm run db:seed
 */
import { config } from 'dotenv'

// .env.local 우선 로드 (Next.js 환경변수)
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const prisma = new PrismaClient()

// ── 요금제 기본 데이터 ────────────────────────────────────
const SUBSCRIPTION_PLANS = [
  {
    name: 'BASIC',
    displayName: '베이직',
    monthlyPrice: 300000,
    yearlyPrice: 3000000,
    maxStudents: 50,
    maxTeachers: 3,
    featuresJson: {
      features: ['레벨 테스트', '학생 관리', '기본 리포트'],
    },
  },
  {
    name: 'STANDARD',
    displayName: '스탠다드',
    monthlyPrice: 500000,
    yearlyPrice: 5000000,
    maxStudents: 150,
    maxTeachers: 5,
    featuresJson: {
      features: ['레벨 테스트', '학생 관리', '상세 리포트', 'AI 분석', '출석 관리'],
    },
  },
  {
    name: 'PREMIUM',
    displayName: '프리미엄',
    monthlyPrice: 800000,
    yearlyPrice: 8000000,
    maxStudents: -1, // -1 = 무제한
    maxTeachers: -1,
    featuresJson: {
      features: [
        '레벨 테스트',
        '학생 관리',
        '상세 리포트',
        'AI 분석',
        '출석 관리',
        '무제한 학생/교사',
        '커스텀 테스트',
        '우선 지원',
      ],
    },
  },
  {
    name: 'ENTERPRISE',
    displayName: '엔터프라이즈',
    monthlyPrice: 0, // 별도 협의
    yearlyPrice: 0,
    maxStudents: -1,
    maxTeachers: -1,
    featuresJson: {
      features: ['프리미엄 전체 기능', '전담 매니저', 'API 연동', '맞춤형 기능 개발', '별도 협의'],
    },
  },
]

// ── 테스트 학원 ──────────────────────────────────────────
const TEST_ACADEMY = {
  name: 'IVY 영어학원',
  businessName: 'IVY 영어학원',
  address: '서울시 강남구 테헤란로 123',
  phone: '02-1234-5678',
}

// ── 테스트 계정 ──────────────────────────────────────────
const TEST_USERS = [
  {
    email: 'owner@ivy.test',
    password: 'Test1234!',
    name: '김학원',
    role: 'ACADEMY_OWNER' as const,
  },
  {
    email: 'teacher@ivy.test',
    password: 'Test1234!',
    name: '이교사',
    role: 'TEACHER' as const,
  },
  {
    email: 'student@ivy.test',
    password: 'Test1234!',
    name: '박학생',
    role: 'STUDENT' as const,
  },
]

async function getOrCreateAuthUser(email: string, password: string) {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (!error && created.user) return created.user.id

  if (error?.message.includes('already') || error?.code === 'email_exists') {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 })
    const existing = list?.users.find((u) => u.email === email)
    if (existing) return existing.id
  }

  throw new Error(`Auth 생성 실패 (${email}): ${error?.message ?? '알 수 없는 오류'}`)
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

async function main() {
  console.log('🌱 기본 데이터 생성을 시작합니다...\n')

  // 1. 요금제 기본 데이터 생성 (없으면 생성)
  console.log('📦 요금제 데이터 초기화...')
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        maxStudents: plan.maxStudents,
        maxTeachers: plan.maxTeachers,
        featuresJson: plan.featuresJson,
      },
      create: plan,
    })
    console.log(`  ✅ ${plan.displayName} (${plan.name})`)
  }

  // 2. 테스트 학원 생성 또는 조회
  let academy = await prisma.academy.findFirst({
    where: { name: TEST_ACADEMY.name },
  })

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

  if (!academy) {
    academy = await prisma.academy.create({
      data: {
        ...TEST_ACADEMY,
        planType: 'STANDARD',
        subscriptionPlan: 'STANDARD',
        inviteCode: generateInviteCode(),
        subscriptionStatus: 'TRIAL',
        trialEndsAt,
        maxStudents: 150,
        maxTeachers: 5,
      },
    })
    console.log(`\n✅ 학원 생성 완료: ${academy.name} (초대 코드: ${academy.inviteCode})`)
  } else {
    console.log(`\nℹ️  기존 학원 사용: ${academy.name}`)
  }

  // 3. 테스트 사용자 생성
  let ownerAuthId: string | null = null

  for (const u of TEST_USERS) {
    try {
      const authId = await getOrCreateAuthUser(u.email, u.password)

      await prisma.user.upsert({
        where: { id: authId },
        update: {
          role: u.role,
          academyId: academy.id,
          name: u.name,
          isActive: true,
        },
        create: {
          id: authId,
          email: u.email,
          name: u.name,
          role: u.role,
          academyId: academy.id,
          agreedTerms: true,
          agreedPrivacy: true,
        },
      })

      if (u.role === 'ACADEMY_OWNER') ownerAuthId = authId
      console.log(`✅ ${u.role.padEnd(14)} | ${u.name} (${u.email})`)
    } catch (err) {
      console.error(`❌ 생성 실패 (${u.email}):`, err)
    }
  }

  // 4. 학원의 ownerId 설정 (owner 생성 후)
  if (ownerAuthId && !academy.ownerId) {
    await prisma.academy.update({
      where: { id: academy.id },
      data: { ownerId: ownerAuthId },
    })
    console.log(`\n✅ 학원장 연결 완료`)
  }

  // 5. 결과 출력
  console.log('\n' + '─'.repeat(55))
  console.log('📋 테스트 계정 목록')
  console.log('─'.repeat(55))
  console.log(`${'역할'.padEnd(16)} ${'이메일'.padEnd(22)} 비밀번호`)
  console.log('─'.repeat(55))
  for (const u of TEST_USERS) {
    const roleLabel =
      u.role === 'ACADEMY_OWNER' ? '학원장' : u.role === 'TEACHER' ? '교사' : '학생'
    console.log(`${roleLabel.padEnd(16)} ${u.email.padEnd(22)} ${u.password}`)
  }
  console.log('─'.repeat(55))
  console.log(`\n🔑 학원 초대 코드: ${academy.inviteCode}`)
  console.log('✨ 완료! 위 계정으로 로그인하세요.')
}

main()
  .catch((e) => {
    console.error('\n❌ 오류 발생:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
