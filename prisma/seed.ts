/**
 * 테스트 계정 생성 스크립트
 * 실행: npm run db:seed
 */
import { config } from 'dotenv'

// .env.local 우선 로드 (Next.js 환경변수)
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '../src/generated/prisma'

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

// ── 테스트 학원 ──────────────────────────────────────────
const TEST_ACADEMY = {
  name: 'IVY 영어학원',
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
  // 먼저 생성 시도
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // 이메일 확인 없이 바로 사용 가능
  })

  if (!error && created.user) return created.user.id

  // 이미 존재하면 목록에서 조회
  if (error.message.includes('already') || error.code === 'email_exists') {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 })
    const existing = list?.users.find((u) => u.email === email)
    if (existing) return existing.id
  }

  throw new Error(`Auth 생성 실패 (${email}): ${error.message}`)
}

async function main() {
  console.log('🌱 테스트 계정 생성을 시작합니다...\n')

  // 1. 테스트 학원 생성 또는 조회
  let academy = await prisma.academy.findFirst({
    where: { name: TEST_ACADEMY.name },
  })

  if (!academy) {
    academy = await prisma.academy.create({
      data: { ...TEST_ACADEMY, planType: 'STANDARD' },
    })
    console.log(`✅ 학원 생성 완료: ${academy.name}`)
  } else {
    console.log(`ℹ️  기존 학원 사용: ${academy.name}`)
  }

  // 2. 테스트 사용자 생성
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
        },
      })

      console.log(`✅ ${u.role.padEnd(14)} | ${u.name} (${u.email})`)
    } catch (err) {
      console.error(`❌ 생성 실패 (${u.email}):`, err)
    }
  }

  // 3. 결과 출력
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
  console.log('\n✨ 완료! 위 계정으로 로그인하세요.')
}

main()
  .catch((e) => {
    console.error('\n❌ 오류 발생:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
