import { InvoiceStatusEnum, PaymentMethodEnum, PaymentStatusEnum } from './enums.js';

export interface FeeInvoiceLineDto {
  id?: string;
  description: string;
  amount: number;
}

export interface CreateFeeInvoiceDto {
  studentId: string;
  dueDate: string;
  lines: FeeInvoiceLineDto[];
}

export interface FeeInvoiceDto {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatusEnum;
  dueDate: string;
  createdAt: string;
}

export interface RecordPaymentDto {
  studentId: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  transactionReference?: string;
  invoiceId?: string; // Optional if auto-allocating to oldest invoice
  notes?: string;
}

export interface PaymentReceiptDto {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  status: PaymentStatusEnum;
  paidAt: string;
  recordedByName: string;
}
