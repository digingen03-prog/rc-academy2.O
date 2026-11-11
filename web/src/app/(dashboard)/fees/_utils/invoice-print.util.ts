import { SimpleInvoicePayload } from '../_types/invoice.types';
import { openProfessionalInvoicePrintWindow } from '@/components/fees/professional-invoice';

export function downloadOrPrintSimpleInvoice(data: SimpleInvoicePayload) {
  const isPaid = data.status === 'PAID' || data.totalBalance <= 0;
  openProfessionalInvoicePrintWindow({
    documentTitle: isPaid ? 'OFFICIAL FEE RECEIPT' : 'FEE INVOICE',
    invoiceNumber: data.invoiceNumber,
    issueDate: data.date,
    paymentDate: data.paymentDate || data.date,
    paymentStatus: isPaid ? 'PAID' : data.status === 'PARTIAL' ? 'PARTIAL' : 'UNPAID',
    student: {
      fullName: data.studentName,
      studentId: data.studentCode,
      admissionNumber: data.admissionNumber,
      phone: data.phone,
      email: data.email,
      parentName: data.parentName,
      parentPhone: data.parentPhone,
      courseOrClass: data.courseOrClass,
      standard: data.standard,
      batch: data.batch,
      academicYear: data.academicYear,
    },
    items: data.items.map((item, idx) => ({
      slNo: idx + 1,
      description: item.description,
      courseOrClass: item.courseName,
      feeAmount: item.amount,
      discountAmount: item.discount,
      paidAmount: item.paid,
      balanceAmount: item.balance,
      billingPeriod: item.billingPeriod || null,
    })),
    summary: {
      grossInvoiced: data.totalBilled,
      totalDiscounts: data.totalDiscount,
      totalPaid: data.totalPaid,
      outstandingBalance: data.totalBalance,
    },
    paymentInfo: {
      method: data.paymentMethod || 'CASH / UPI',
      transactionRef: data.paymentReference,
      receiptStatus: isPaid ? 'Full Clearance (Settled)' : 'Partial Settlement',
      processedBy: data.recordedBy,
    },
  });
}

export function getCurrentMonthBillingCycle(): string {
  const now = new Date();
  return now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function generateBillingCycleGroups() {
  const now = new Date();
  const currentMonthYear = getCurrentMonthBillingCycle();
  const currentYear = now.getFullYear();

  // 1. Current Month (Primary Default)
  const currentMonthGroup = [
    { label: `${currentMonthYear} (Current Month)`, value: currentMonthYear },
  ];

  // 2. Standard Plan Types
  const standardPlans = [
    { label: 'Annual Tuition (All Year)', value: 'ANNUAL' },
    { label: 'Monthly Tuition (All Months)', value: 'MONTHLY' },
    { label: 'Term 1 Cycle', value: 'TERM_1' },
    { label: 'Term 2 Cycle', value: 'TERM_2' },
    { label: 'One-Time Registration', value: 'ONE_TIME' },
  ];

  // 3. Past Months for Current Year
  const pastCurrentYear: { label: string; value: string }[] = [];
  for (let m = now.getMonth() - 1; m >= 0; m--) {
    const d = new Date(currentYear, m, 1);
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    pastCurrentYear.push({ label, value: label });
  }

  // 4. Past Months for Prior Years
  const pastPriorYears: { group: string; options: { label: string; value: string }[] }[] = [];
  for (let y = currentYear - 1; y >= currentYear - 2; y--) {
    const yearOptions: { label: string; value: string }[] = [];
    for (let m = 11; m >= 0; m--) {
      const d = new Date(y, m, 1);
      const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      yearOptions.push({ label, value: label });
    }
    pastPriorYears.push({
      group: `Past Months (${y})`,
      options: yearOptions,
    });
  }

  // 5. Future Months (Next 12 Months)
  const futureMonths: { label: string; value: string }[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    futureMonths.push({ label, value: label });
  }

  const groups: { group: string; options: { label: string; value: string }[] }[] = [
    {
      group: 'Current Billing Cycle',
      options: currentMonthGroup,
    },
    {
      group: 'Standard Plan Types',
      options: standardPlans,
    },
    ...(pastCurrentYear.length > 0
      ? [
          {
            group: `Past Months (${currentYear})`,
            options: pastCurrentYear,
          },
        ]
      : []),
    ...pastPriorYears,
    {
      group: 'Upcoming Future Months',
      options: futureMonths,
    },
  ];

  return groups;
}

export const BILLING_CYCLE_GROUPS = generateBillingCycleGroups();

