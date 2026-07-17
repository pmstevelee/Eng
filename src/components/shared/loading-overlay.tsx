interface Props {
  show: boolean
  label?: string
}

export function LoadingOverlay({ show, label = '이동 중...' }: Props) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#7854F7] border-t-transparent" />
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</p>
    </div>
  )
}
