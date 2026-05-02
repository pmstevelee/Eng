import { Suspense } from 'react'
import { getBillingDashboardData } from './actions'
import { BillingDashboardClient } from './_components/billing-dashboard-client'

export const metadata = { title: '결제 모니터링 — EduLevel Admin' }

export default async function AdminBillingPage() {
  const data = await getBillingDashboardData()
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">로딩 중...</div>}>
      <BillingDashboardClient data={data} />
    </Suspense>
  )
}
