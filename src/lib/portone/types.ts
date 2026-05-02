// ─── 포트원 V2 응답 타입 정의 ───────────────────────────────────────────────────

export type PortOnePaymentStatus =
  | 'READY'
  | 'PENDING'
  | 'VIRTUAL_ACCOUNT_ISSUED'
  | 'PAID'
  | 'FAILED'
  | 'PARTIAL_CANCELLED'
  | 'CANCELLED'

export interface PortOneAmount {
  total: number
  taxFree: number
  vat: number
  supply: number
  discount: number
  paid: number
  cancelled: number
  cancelledTaxFree: number
}

export interface PortOneCustomer {
  customerId?: string
  fullName?: string
  firstName?: string
  lastName?: string
  phoneNumber?: string
  email?: string
  address?: {
    country?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    province?: string
  }
  zipcode?: string
  gender?: string
  birthYear?: string
  birthMonth?: string
  birthDay?: string
}

export interface PortOnePaymentMethod {
  type: string
  card?: {
    publisher?: string
    issuer?: string
    brand?: string
    type?: string
    ownerType?: string
    bin?: string
    name?: string
    number?: string
  }
  virtualAccount?: {
    accountNumber: string
    bank: string
    customerName: string
    dueDate: string
    expired: boolean
    remitStatus: string
  }
}

export interface PortOnePayment {
  id: string
  transactionId?: string
  merchantId: string
  storeId: string
  paymentMethodType?: string
  method?: PortOnePaymentMethod
  channel?: {
    type: string
    id?: string
    name?: string
    key?: string
    pgProvider?: string
    pgMerchantId?: string
  }
  version: string
  status: PortOnePaymentStatus
  requestedAt: string
  updatedAt?: string
  statusChangedAt?: string
  orderName: string
  amount: PortOneAmount
  currency: string
  customer?: PortOneCustomer
  paidAt?: string
  failedAt?: string
  cancelledAt?: string
  failureReason?: string
  cancelReason?: string
  receiptUrl?: string
  customData?: string
  isEscrow?: boolean
}

export interface PortOneBillingKeyPaymentMethod {
  type: string
  card?: {
    bin?: string
    brand?: string
    name?: string
    number?: string
    issuer?: string
    publisher?: string
    ownerType?: string
    type?: string
  }
}

export interface PortOneBillingKey {
  billingKey: string
  merchantId: string
  storeId: string
  methods?: PortOneBillingKeyPaymentMethod[]
  channels?: Array<{
    type: string
    id?: string
    name?: string
    key?: string
    pgProvider?: string
  }>
  issuedAt: string
  deletedAt?: string
  status: 'ISSUED' | 'DELETED'
  customData?: string
}

export interface PortOneCancelResult {
  cancellation: {
    status: 'REQUESTED' | 'SUCCEEDED' | 'FAILED'
    id: string
    pgCancellationId?: string
    totalAmount: number
    taxFreeAmount: number
    vatAmount: number
    reason: string
    cancelledAt?: string
    requestedAt: string
    receiptUrl?: string
  }
}

// ─── 웹훅 이벤트 타입 ────────────────────────────────────────────────────────

export type PortOneWebhookEventType =
  | 'Transaction.Paid'
  | 'Transaction.Ready'
  | 'Transaction.Failed'
  | 'Transaction.Cancelled'
  | 'Transaction.PartialCancelled'
  | 'Transaction.VirtualAccountIssued'
  | 'Transaction.VirtualAccountDeposited'
  | 'BillingKey.Issued'
  | 'BillingKey.Failed'
  | 'BillingKey.Deleted'
  | 'Schedule.Executed'
  | 'Schedule.Failed'

export interface PortOneWebhookEvent {
  type: PortOneWebhookEventType
  timestamp: string
  data: {
    paymentId?: string
    billingKey?: string
    scheduleId?: string
    transactionId?: string
  }
}

// ─── 서버 래퍼용 파라미터 타입 ────────────────────────────────────────────────

export interface PayWithBillingKeyParams {
  paymentId: string
  billingKey: string
  orderName: string
  amount: number
  customer?: {
    customerId?: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
  customData?: Record<string, unknown>
}

export interface IssueBillingKeyAndPayParams {
  paymentId: string
  orderName: string
  amount: number
  channelKey: string
  cardCredential: {
    number: string
    expiryYear: string
    expiryMonth: string
    birthOrBusinessRegistrationNumber?: string
    passwordTwoDigits?: string
  }
  customer?: {
    customerId?: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
  customData?: Record<string, unknown>
}

// ─── 클라이언트 래퍼용 파라미터 타입 ─────────────────────────────────────────

export interface BillingKeyPaymentClientParams {
  paymentId: string
  orderName: string
  totalAmount: number
  currency?: string
  channelKey?: string
  customer?: {
    customerId?: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
  redirectUrl?: string
  customData?: Record<string, unknown>
}

export interface OneTimePaymentClientParams {
  paymentId: string
  orderName: string
  totalAmount: number
  currency?: string
  channelKey?: string
  payMethod?: string
  customer?: {
    customerId?: string
    fullName?: string
    email?: string
    phoneNumber?: string
  }
  redirectUrl?: string
  customData?: Record<string, unknown>
}

export interface BillingKeyPaymentResult {
  paymentId: string
  billingKey: string
}

export interface PaymentClientError {
  code: string
  message: string
}
