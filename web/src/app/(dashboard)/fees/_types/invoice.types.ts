export interface SimpleInvoicePayload {
  invoiceNumber: string;
  date: string;
  paymentDate?: string | null;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
  studentName: string;
  studentCode: string;
  admissionNumber?: string | null;
  phone?: string | null;
  email?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  courseOrClass?: string | null;
  standard?: string | null;
  batch?: string | null;
  academicYear?: string | null;
  items: {
    description: string;
    courseName?: string;
    amount: number;
    discount?: number;
    paid: number;
    balance: number;
    billingPeriod?: string | null;
  }[];
  totalBilled: number;
  totalDiscount?: number;
  totalPaid: number;
  totalBalance: number;
  paymentMethod?: string;
  paymentReference?: string | null;
  recordedBy?: string | null;
}

