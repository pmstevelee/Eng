// 키패드 오프라인 입력 대기열 (IndexedDB) — 네트워크 실패 시 입력 시각과 함께 저장했다가 순서대로 재전송
// 자동 증가 키 순서 = 입력 순서. IndexedDB를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 메모리에만 보관한다.

export type QueuedCheck = {
  id?: number
  code: string
  studentId?: string
  sessionId?: string
  /** 입력 시각 (서버 시계로 보정한 ISO) */
  at: string
}

const DB_NAME = 'wegoup-kiosk'
const STORE = 'pending-checks'

let dbPromise: Promise<IDBDatabase> | null = null
const memoryQueue: QueuedCheck[] = []
let memorySeq = 0

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch((err: unknown) => {
    dbPromise = null
    throw err
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export async function enqueueCheck(item: Omit<QueuedCheck, 'id'>): Promise<void> {
  try {
    await run('readwrite', (s) => s.add(item))
  } catch {
    memoryQueue.push({ ...item, id: --memorySeq })
  }
}

/** 입력 순서대로 */
export async function listQueuedChecks(): Promise<QueuedCheck[]> {
  let stored: QueuedCheck[] = []
  try {
    stored = await run<QueuedCheck[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedCheck[]>)
  } catch {
    // 메모리 대기열만 사용
  }
  return [...memoryQueue, ...stored].sort((a, b) => a.at.localeCompare(b.at))
}

export async function removeQueuedCheck(id: number): Promise<void> {
  if (id < 0) {
    const i = memoryQueue.findIndex((q) => q.id === id)
    if (i >= 0) memoryQueue.splice(i, 1)
    return
  }
  try {
    await run('readwrite', (s) => s.delete(id))
  } catch {
    // 다음 전송 때 다시 시도 (서버 판정은 중복 입력에 안전)
  }
}

export async function countQueuedChecks(): Promise<number> {
  let stored = 0
  try {
    stored = await run<number>('readonly', (s) => s.count())
  } catch {
    // 메모리 대기열만 사용
  }
  return memoryQueue.length + stored
}
