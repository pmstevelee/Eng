import { Users, FileText, Calendar, MessageSquare, ClipboardCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const statCards = [
  { label: '담당 학생', value: '–', icon: Users, desc: '내 반 학생 수' },
  { label: '출제한 테스트', value: '–', icon: FileText, desc: '전체 테스트 수' },
  { label: '채점 대기', value: '–', icon: ClipboardCheck, desc: '채점 필요한 답안' },
  { label: '이번 주 일정', value: '–', icon: Calendar, desc: '예정된 수업 수' },
]

export default function TeacherDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground mt-1">오늘의 수업 현황을 확인하세요.</p>
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
              <Calendar size={16} />
              오늘의 일정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">오늘 예정된 수업이 여기에 표시됩니다.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare size={16} />
              최근 메시지
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">최근 학생 메시지가 여기에 표시됩니다.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
