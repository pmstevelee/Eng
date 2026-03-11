import { Users, UserCheck, BookOpen, FileText, BarChart2, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const statCards = [
  { label: '전체 학생', value: '–', icon: Users, desc: '등록된 학생 수' },
  { label: '전체 교사', value: '–', icon: UserCheck, desc: '소속 교사 수' },
  { label: '운영 반', value: '–', icon: BookOpen, desc: '활성 클래스 수' },
  { label: '이번 달 테스트', value: '–', icon: FileText, desc: '완료된 테스트 수' },
]

export default function OwnerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground mt-1">학원 현황을 한눈에 확인하세요.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {item.label}
                </CardTitle>
                <Icon size={16} className="text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp size={16} />
              최근 활동
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">최근 활동 내역이 여기에 표시됩니다.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 size={16} />
              학습 통계
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">학습 통계 차트가 여기에 표시됩니다.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
