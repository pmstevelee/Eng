import { FileText, Award, BarChart2, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const statCards = [
  { label: '완료한 테스트', value: '–', icon: FileText, desc: '응시한 테스트 수' },
  { label: '현재 레벨', value: '–', icon: BarChart2, desc: '나의 영어 레벨' },
  { label: '획득 배지', value: '–', icon: Award, desc: '받은 배지 수' },
  { label: '학습 중', value: '–', icon: BookOpen, desc: '진행 중인 학습' },
]

export default function StudentDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">홈</h1>
        <p className="text-muted-foreground mt-1">오늘도 열심히 학습해요!</p>
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
              <FileText size={16} />
              다음 테스트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">예정된 테스트가 여기에 표시됩니다.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award size={16} />
              최근 획득 배지
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">최근 받은 배지가 여기에 표시됩니다.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
