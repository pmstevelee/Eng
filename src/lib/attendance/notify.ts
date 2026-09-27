import 'server-only'

export type AttendanceNotificationType = 'CHECK_IN' | 'CHECK_OUT' | 'ABSENT'

/**
 * 출결 알림 발송 대기열 등록 — 4단계(알림)에서 구현 예정.
 * 지금은 호출 자리만 잡아 둔 스텁이며 아무 일도 하지 않는다.
 */
export async function enqueueAttendanceNotification(
  recordId: string,
  type: AttendanceNotificationType,
): Promise<void> {
  void recordId
  void type
}
