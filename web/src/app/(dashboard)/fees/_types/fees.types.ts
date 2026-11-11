import { SimpleInvoicePayload } from './invoice.types';

export interface CourseBreakdownItem {
  courseId: string;
  courseName: string;
  courseCode: string;
  invoiced: number;
  effectiveInvoiced?: number;
  collected: number;
  outstanding: number;
  effectiveOutstanding?: number;
  collectionRate: number;
  enrolledStudentsCount: number;
  hasFeeRule?: boolean;
  feeRuleName?: string | null;
  baseFeeAmount?: number;
  autoCurrentMonthBaseAmount?: number;
  isAutoBase?: boolean;
  activeFeeRulesCount?: number;
}

export interface DashboardKpis {
  totalInvoiced: number;
  effectiveTotalInvoiced?: number;
  totalCollected: number;
  outstandingReceivables: number;
  effectiveOutstandingReceivables?: number;
  overdueAmount: number;
  totalReversals: number;
  totalDiscounts: number;
  totalInvoicesCount: number;
  overdueInvoicesCount: number;
  totalPaymentsCount: number;
  pendingExceptionsCount: number;
  autoCurrentMonthBaseAmount?: number;
  isAutoBaseActive?: boolean;
  activeFeeRulesCount?: number;
}

export interface StudentAccountSummary {
  id: string;
  studentCode: string;
  admissionNumber: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  enrolledCourses: {
    courseId: string;
    courseName: string;
    courseCode: string;
    batchName: string;
    subjectName?: string | null;
  }[];
  courseInvoicesCount: number;
  consolidatedBilled: number;
  consolidatedPaid: number;
  consolidatedBalance: number;
  consolidatedDiscounts: number;
  overallStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';
}

export interface CourseFeeDetail {
  invoiceId: string;
  invoiceNumber: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  subjectId?: string | null;
  subjectName?: string | null;
  batchId?: string | null;
  batchName?: string | null;
  enrollmentId?: string | null;
  billingPeriod: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'CANCELLED';
  dueDate: string;
  nextInstallmentDueDate?: string | null;
  isOverdue: boolean;
  lines: { id: string; description: string; amount: number }[];
  adjustments: { id: string; type: string; amount: number; reason: string; createdAt: string }[];
  allocations: {
    allocationId: string;
    paymentId: string;
    receiptNumber: string;
    paymentDate: string;
    paymentMethod: string;
    allocatedAmount: number;
    recordedBy: string;
  }[];
}

export interface StudentPaymentHistoryItem {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  notes?: string | null;
  cycle?: string | null;
  proofName?: string | null;
  proofSize?: string | null;
  proofObjectKey?: string | null;
  proofFileName?: string | null;
  proofFileSize?: number | null;
  hasRealProof?: boolean;
  proofMimeType?: string | null;
  paidAt: string;
  status: string;
  recordedBy: string;
  allocations: {
    allocationId: string;
    invoiceId: string;
    invoiceNumber?: string;
    allocatedAmount: number;
    courseName?: string;
    subjectName?: string;
    batchName?: string;
    isReversed: boolean;
  }[];
}

export interface StudentDetailedAccount {
  student: {
    id: string;
    studentCode: string;
    admissionNumber: string;
    name: string;
    email?: string;
    phone?: string;
    status: string;
    parentName?: string | null;
    parentPhone?: string | null;
  };
  enrolledCourses: {
    enrollmentId: string;
    courseId: string;
    courseName: string;
    courseCode: string;
    batchId: string;
    batchName: string;
    subjectId?: string | null;
    subjectName?: string | null;
    startDate: string;
  }[];
  courseFees: CourseFeeDetail[];
  payments?: StudentPaymentHistoryItem[];
  consolidatedAccount: {
    totalCoursesEnrolled: number;
    consolidatedTotalBilled: number;
    consolidatedDiscounts: number;
    consolidatedNetPayable: number;
    consolidatedPaid: number;
    consolidatedBalance: number;
    overallStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';
  };
}

export interface CourseFeeConfigItem {
  id: string;
  name: string;
  academicYear: { id: string; name: string };
  class: { id: string; name: string; code: string };
  batch?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  amount: number;
  tier?: string | null;
  billingPeriod: string;
  installmentCount: number;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  isActive: boolean;
  description?: string | null;
  allowedDiscounts?: any[] | null;
  _count?: { invoices: number };
}

export interface InvoiceRowItem {
  id: string;
  invoiceNumber: string;
  student: { id: string; firstName: string; lastName: string; studentCode: string };
  class?: { id: string; name: string; code: string } | null;
  batch?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'CANCELLED';
  dueDate: string;
  billingPeriod?: string | null;
  lines: { id: string; description: string; amount: number }[];
  adjustments: { id: string; type: string; amount: number; reason: string }[];
}

export interface PaymentRowItem {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  status: 'COMPLETED' | 'REVERSED';
  reference?: string | null;
  notes?: string | null;
  paidAt: string;
  student: { id: string; firstName: string; lastName: string; studentCode: string };
  recordedBy: { firstName: string; lastName: string; email: string };
  allocations: {
    id: string;
    allocatedAmount: number;
    isReversed: boolean;
    invoice: {
      id: string;
      invoiceNumber: string;
      class?: { name: string } | null;
      subject?: { name: string } | null;
      balanceAmount: number;
    };
  }[];
  proofObjectKey?: string | null;
  proofFileName?: string | null;
  proofFileSize?: number | null;
  proofMimeType?: string | null;
  proofUploadedAt?: string | null;
}

export interface ProofViewerState {
  isOpen: boolean;
  paymentId: string;
  receiptNumber?: string;
  fileName: string;
  fileSize?: string | number | null;
  mimeType?: string | null;
  downloadUrl?: string | null;
  expiresIn?: number | null;
  uploadedAt?: string | Date | null;
  loading: boolean;
  error?: string | null;
}

export interface AttachProofModalState {
  isOpen: boolean;
  paymentId: string;
  receiptNumber: string;
  studentName: string;
  amount: number;
}

export interface OfficialReceiptData {
  academy: {
    name: string;
    tagline: string;
    address: string;
    contact: string;
  };
  receiptNumber: string;
  paymentDate: string;
  student: {
    id: string;
    name: string;
    studentCode: string;
    admissionNumber: string;
    enrolledCourses: { courseName: string; batchName: string; subjectName?: string | null }[];
  };
  payment: {
    id?: string;
    amount: number;
    paymentMethod: string;
    reference?: string | null;
    notes?: string | null;
    status: string;
    reversedAt?: string | null;
    reversalReason?: string | null;
    recordedBy: string;
    proofObjectKey?: string | null;
    proofFileName?: string | null;
    proofFileSize?: number | null;
    proofMimeType?: string | null;
    hasProofAttachment?: boolean;
  };
  allocations: {
    invoiceNumber: string;
    courseName: string;
    batchName?: string | null;
    subjectName?: string | null;
    allocatedAmount: number;
    invoiceTotal: number;
    invoiceRemainingBalance: number;
    isReversed: boolean;
  }[];
}

