import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Plan } from '@/generated/prisma'

export interface PlanFeature {
  text: string
  included: boolean
}

export interface PlanCardProps {
  plan: Plan
  name: string
  description?: string
  price: number | null        // null = 무료
  yearlyPrice: number | null
  isYearly: boolean
  features: PlanFeature[]
  isCurrent: boolean
  isRecommended: boolean
  badge?: string
  onSelect: (plan: Plan) => void
  disabled?: boolean
}

export function PlanCard({
  plan,
  name,
  description,
  price,
  yearlyPrice,
  isYearly,
  features,
  isCurrent,
  isRecommended,
  badge,
  onSelect,
  disabled,
}: PlanCardProps) {
  const displayPrice = isYearly ? yearlyPrice : price
  const monthlyEquivalent = isYearly && yearlyPrice ? Math.floor(yearlyPrice / 12) : null

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border p-6 transition-shadow',
        isRecommended
          ? 'border-primary-700 shadow-md ring-2 ring-primary-700/20'
          : 'border-gray-200 shadow-sm',
        isCurrent && 'opacity-90',
      )}
    >
      {/* 뱃지 */}
      {(badge || isCurrent) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          {isCurrent ? (
            <Badge className="bg-accent-green text-white border-0 text-xs font-medium px-3 py-0.5">
              현재 플랜
            </Badge>
          ) : badge ? (
            <Badge className="bg-accent-gold text-white border-0 text-xs font-medium px-3 py-0.5">
              {badge}
            </Badge>
          ) : null}
        </div>
      )}

      {/* 플랜명 */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900">{name}</h3>
        {description && (
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">{description}</p>
        )}
      </div>

      {/* 가격 */}
      <div className="mb-6 min-h-[72px]">
        {displayPrice === 0 || displayPrice === null ? (
          <div>
            <span className="text-3xl font-bold text-gray-900">무료</span>
            <p className="mt-1 text-sm text-gray-500">14일 무료 체험 · 카드 등록 불필요</p>
          </div>
        ) : (
          <div>
            {isYearly && monthlyEquivalent ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    {monthlyEquivalent.toLocaleString('ko-KR')}원
                  </span>
                  <span className="text-sm text-gray-500">/월</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  연간 {displayPrice.toLocaleString('ko-KR')}원 청구
                </p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">
                    {displayPrice.toLocaleString('ko-KR')}원
                  </span>
                  <span className="text-sm text-gray-500">/월</span>
                </div>
                {isYearly && (
                  <p className="mt-1 text-sm text-accent-green font-medium">20% 할인 적용</p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 기능 목록 */}
      <ul className="mb-8 flex flex-col gap-2.5 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                feature.included ? 'text-accent-green' : 'text-gray-300',
              )}
            />
            <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Button
        onClick={() => onSelect(plan)}
        disabled={disabled || isCurrent}
        variant={isRecommended ? 'default' : 'outline'}
        className={cn(
          'w-full h-11 font-medium',
          isRecommended && 'bg-primary-700 hover:bg-primary-800 text-white',
          isCurrent && 'cursor-default',
        )}
      >
        {isCurrent ? '현재 사용 중' : plan === 'FREE' ? '무료로 시작' : '이 플랜 선택'}
      </Button>
    </div>
  )
}
