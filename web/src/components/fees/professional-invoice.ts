// ============================================================================
// RCA2.O — Professional Print-Ready Invoice & Fee Receipt Generator
// ============================================================================

export interface InvoiceLineItem {
  slNo?: number;
  description: string;
  courseOrClass?: string;
  subject?: string;
  standard?: string;
  batch?: string;
  billingPeriod?: string | null;
  feeAmount: number;
  discountAmount?: number;
  paidAmount: number;
  balanceAmount: number;
}

export interface ProfessionalInvoiceData {
  documentTitle?: string; // 'OFFICIAL FEE RECEIPT' | 'FEE INVOICE'
  invoiceNumber: string; // e.g. "INV-2026-0042" or "RCP-2026-0019"
  issueDate: string; // formatted date, e.g. "23 Oct 2026"
  paymentDate?: string | null;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';

  // Academy Details (configurable, NO GSTIN)
  academy?: {
    name?: string;
    subTitle?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
  };

  // Student Details (only valid, non-empty values are displayed)
  student: {
    fullName: string;
    studentId: string;
    admissionNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
    courseOrClass?: string | null;
    standard?: string | null;
    batch?: string | null;
    academicYear?: string | null;
  };

  // Structured Line items
  items: InvoiceLineItem[];

  // Totals & calculations from existing authoritative records
  summary: {
    grossInvoiced: number;
    totalDiscounts?: number;
    totalPaid: number;
    outstandingBalance: number;
  };

  // Payment Settlement Info (using existing data only)
  paymentInfo?: {
    method?: string;
    transactionRef?: string | null;
    receiptStatus?: string | null;
    processedBy?: string | null;
    notes?: string | null;
  };

  signatoryTitle?: string;
}

export const DEFAULT_ACADEMY_CONFIG = {
  name: 'RC ACADEMY',
  subTitle: 'Academy of Arts & Education',
  address: 'Main Campus: 123 Education Enclave, Knowledge City',
  phone: '+91 98765 43210',
  email: 'accounts@rcacademy.com',
  website: 'www.rcacademy.com',
  logoUrl: '/logo.png',
};

function formatInr(val: number): string {
  const num = Number(val) || 0;
  return `₹${num.toLocaleString('en-IN')}`;
}

function isValidValue(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return lower !== 'undefined' && lower !== 'null' && lower !== 'n/a' && lower !== '-';
}

export function generateProfessionalInvoiceHtml(data: ProfessionalInvoiceData): string {
  const academy = {
    ...DEFAULT_ACADEMY_CONFIG,
    ...(data.academy || {}),
  };

  const isFullyPaid =
    data.paymentStatus === 'PAID' ||
    (data.summary.outstandingBalance <= 0 && data.summary.totalPaid > 0);

  const documentHeading =
    data.documentTitle || (isFullyPaid ? 'OFFICIAL FEE RECEIPT' : 'FEE INVOICE');

  // Status Badge Label & Styling
  let statusBadgeText = 'UNPAID';
  let statusBadgeClass = 'badge-unpaid';
  if (isFullyPaid) {
    statusBadgeText = 'PAID IN FULL';
    statusBadgeClass = 'badge-paid';
  } else if (data.paymentStatus === 'PARTIAL' || data.summary.totalPaid > 0) {
    statusBadgeText = 'PARTIALLY PAID';
    statusBadgeClass = 'badge-partial';
  }

  // Student Info Fields (Only valid fields)
  const studentMetaRows: { label: string; value: string }[] = [];
  studentMetaRows.push({ label: 'Student Full Name', value: data.student.fullName });
  studentMetaRows.push({ label: 'Student ID', value: data.student.studentId });

  if (isValidValue(data.student.admissionNumber)) {
    studentMetaRows.push({ label: 'Admission No', value: data.student.admissionNumber });
  }
  if (isValidValue(data.student.phone)) {
    studentMetaRows.push({ label: 'Student Contact', value: data.student.phone });
  }
  if (isValidValue(data.student.parentName)) {
    const parentContact = isValidValue(data.student.parentPhone)
      ? `${data.student.parentName} (${data.student.parentPhone})`
      : data.student.parentName;
    studentMetaRows.push({ label: 'Parent / Guardian', value: parentContact });
  } else if (isValidValue(data.student.parentPhone)) {
    studentMetaRows.push({ label: 'Parent Contact', value: data.student.parentPhone });
  }
  if (isValidValue(data.student.courseOrClass)) {
    studentMetaRows.push({ label: 'Course / Class', value: data.student.courseOrClass });
  }
  if (isValidValue(data.student.standard)) {
    studentMetaRows.push({ label: 'Standard', value: data.student.standard });
  }
  if (isValidValue(data.student.batch)) {
    studentMetaRows.push({ label: 'Batch / Cohort', value: data.student.batch });
  } else if (isValidValue(data.student.academicYear)) {
    studentMetaRows.push({ label: 'Academic Year', value: data.student.academicYear });
  }

  // Academy contact line (NO GSTIN)
  const academyContactParts: string[] = [];
  if (isValidValue(academy.address)) academyContactParts.push(academy.address);
  if (isValidValue(academy.phone)) academyContactParts.push(`Phone: ${academy.phone}`);
  if (isValidValue(academy.email)) academyContactParts.push(`Email: ${academy.email}`);
  const contactLine = academyContactParts.join('  •  ');

  // Resolved logo url
  const logoUrl = academy.logoUrl || '/logo.png';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${documentHeading} - ${data.invoiceNumber} - ${data.student.fullName}</title>
  <style>
    /* ----------------------------------------------------
       Arial Typography & Page Setup
       ---------------------------------------------------- */
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      background: #ffffff;
      color: #0f172a;
      font-size: 11.5px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      padding: 16px;
    }

    /* Container */
    .receipt-wrapper {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 24px 28px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      position: relative;
    }

    /* Header */
    .receipt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 2px solid #0f172a;
    }
    .brand-block {
      display: flex;
      align-items: center;
      gap: 14px;
      flex: 1;
    }
    .brand-logo {
      width: 60px;
      height: 60px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .brand-text h1 {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #0f172a;
      line-height: 1.15;
    }
    .brand-text .tagline {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      margin-top: 1px;
    }
    .brand-text .contact-info {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 3px;
      line-height: 1.3;
    }

    /* Document Meta & Status */
    .doc-meta {
      text-align: right;
      min-width: 190px;
    }
    .doc-title {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin-bottom: 4px;
    }
    .status-badge {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      padding: 3px 9px;
      border-radius: 4px;
      margin-bottom: 6px;
    }
    .badge-paid {
      background: #f0fdf4;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .badge-partial {
      background: #fefce8;
      color: #a16207;
      border: 1px solid #fde047;
    }
    .badge-unpaid {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .meta-line {
      font-size: 10.5px;
      color: #475569;
      margin-top: 1.5px;
    }
    .meta-line strong {
      color: #0f172a;
      font-weight: 700;
    }

    /* Student Information Section */
    .student-section {
      margin-top: 14px;
      margin-bottom: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .section-title {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 6px;
      padding-bottom: 3px;
      border-bottom: 1px solid #e2e8f0;
    }
    .student-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px 12px;
    }
    @media (max-width: 650px) {
      .student-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    .student-field-label {
      font-size: 9px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .student-field-value {
      font-size: 11px;
      color: #0f172a;
      font-weight: 700;
      word-break: break-word;
    }

    /* Structured Fee Table */
    .fee-table-container {
      margin-bottom: 14px;
    }
    table.fee-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      font-size: 10.5px;
    }
    table.fee-table th {
      background: #f1f5f9;
      color: #1e293b;
      font-weight: 700;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    table.fee-table td {
      padding: 7px 8px;
      border: 1px solid #e2e8f0;
      color: #0f172a;
      vertical-align: middle;
    }
    table.fee-table tr:nth-child(even) {
      background: #fafafa;
    }
    .col-center {
      text-align: center;
    }
    .col-right {
      text-align: right;
    }
    .item-desc-main {
      font-weight: 700;
      color: #0f172a;
    }
    .item-desc-sub {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 1px;
    }
    .text-paid-amt {
      color: #15803d;
      font-weight: 700;
    }
    .text-bal-amt {
      color: #b45309;
      font-weight: 700;
    }
    .text-bal-zero {
      color: #64748b;
      font-weight: normal;
    }

    /* Split Section: Settlement & Seal vs. Totals Summary */
    .split-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .left-settlement-box {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .payment-info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 10px;
      line-height: 1.5;
    }
    .payment-info-title {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
      padding-bottom: 2px;
      border-bottom: 1px solid #e2e8f0;
    }
    .payment-info-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 1.5px 0;
    }
    .payment-info-label {
      color: #64748b;
      font-weight: 600;
    }
    .payment-info-val {
      color: #0f172a;
      font-weight: 700;
      text-align: right;
    }

    /* Paid Seal (ONLY FOR FULL SETTLEMENT) */
    .seal-wrapper {
      padding: 4px 0;
    }
    .paid-seal-box {
      display: inline-block;
      border: 2px dashed #15803d;
      border-radius: 8px;
      padding: 4px;
      transform: rotate(-6deg);
      background: #f0fdf4;
    }
    .paid-seal-inner {
      border: 2px solid #15803d;
      border-radius: 5px;
      padding: 6px 16px;
      text-align: center;
      color: #15803d;
    }
    .seal-check {
      font-size: 14px;
      font-weight: 900;
      line-height: 1;
    }
    .seal-heading {
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .seal-date {
      font-size: 8.5px;
      font-weight: 700;
      color: #166534;
      margin-top: 1px;
    }
    .seal-sub {
      font-size: 7.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #15803d;
      margin-top: 1px;
    }

    /* Partial / Unpaid Status Notice (when seal is NOT shown) */
    .status-notice {
      padding: 7px 10px;
      border-radius: 6px;
      font-size: 9.5px;
      font-weight: 600;
    }
    .status-notice-partial {
      background: #fefce8;
      border: 1px solid #fde047;
      color: #854d0e;
    }
    .status-notice-unpaid {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #475569;
    }

    /* Right: Totals Summary Table */
    .totals-box {
      width: 270px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .totals-header {
      background: #f1f5f9;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #334155;
      padding: 6px 12px;
      border-bottom: 1px solid #cbd5e1;
    }
    .totals-body {
      padding: 6px 12px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 10.5px;
      color: #475569;
    }
    .totals-row-val {
      font-weight: 700;
      color: #0f172a;
    }
    .totals-row.discount-row {
      color: #15803d;
    }
    .totals-row.discount-row .totals-row-val {
      color: #15803d;
    }
    .totals-row.grand-paid {
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      margin-top: 2px;
      font-size: 11.5px;
      color: #15803d;
      font-weight: 800;
    }
    .totals-row.grand-paid .totals-row-val {
      color: #15803d;
      font-size: 12.5px;
    }
    .totals-row.balance-due {
      border-top: 1px dashed #e2e8f0;
      padding-top: 4px;
      margin-top: 2px;
      font-size: 11px;
      font-weight: 700;
      color: #b45309;
    }
    .totals-row.balance-due .totals-row-val {
      color: #b45309;
    }

    /* Footer & Signatory */
    .receipt-footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      page-break-inside: avoid;
    }
    .disclaimer {
      font-size: 9px;
      color: #64748b;
      line-height: 1.4;
      max-width: 460px;
    }
    .disclaimer strong {
      color: #334155;
    }
    .signatory-box {
      text-align: center;
      min-width: 170px;
    }
    .sig-line {
      border-bottom: 1.5px solid #0f172a;
      margin-bottom: 4px;
      height: 28px;
    }
    .sig-label {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.3px;
    }
    .sig-academy {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 1px;
    }

    /* Top Control Bar (Screen only) */
    .action-toolbar {
      max-width: 820px;
      margin: 0 auto 14px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 8px;
    }
    .toolbar-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .btn-print {
      background: #ff8500;
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s ease;
    }
    .btn-print:hover {
      background: #e67700;
    }
    .btn-close {
      background: transparent;
      color: #cbd5e1;
      border: 1px solid #475569;
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      margin-right: 8px;
    }
    .btn-close:hover {
      background: #1e293b;
      color: #ffffff;
    }

    /* Print Overrides */
    @media print {
      body {
        padding: 0 !important;
        background: #ffffff !important;
      }
      .action-toolbar {
        display: none !important;
      }
      .receipt-wrapper {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <!-- Action Toolbar (Hidden during print) -->
  <div class="action-toolbar">
    <div class="toolbar-title">
      ${documentHeading} • ${data.invoiceNumber}
    </div>
    <div>
      <button class="btn-close" onclick="window.close()">Close Window</button>
      <button class="btn-print" onclick="window.print()">🖨️ Download as PDF / Print</button>
    </div>
  </div>

  <!-- Printable Receipt Wrapper -->
  <div class="receipt-wrapper">
    <!-- Academy Header -->
    <div class="receipt-header">
      <div class="brand-block">
        <img
          src="${logoUrl}"
          alt="RC Academy Logo"
          class="brand-logo"
          onerror="this.style.display='none'"
        />
        <div class="brand-text">
          <h1>${academy.name}</h1>
          <div class="tagline">${academy.subTitle}</div>
          ${contactLine ? `<div class="contact-info">${contactLine}</div>` : ''}
        </div>
      </div>

      <div class="doc-meta">
        <div class="doc-title">${documentHeading}</div>
        <div>
          <span class="status-badge ${statusBadgeClass}">${statusBadgeText}</span>
        </div>
        <div class="meta-line">Receipt / Inv #: <strong>${data.invoiceNumber}</strong></div>
        <div class="meta-line">Issue Date: <strong>${data.issueDate}</strong></div>
      </div>
    </div>

    <!-- Student Details -->
    <div class="student-section">
      <div class="section-title">Student Information</div>
      <div class="student-grid">
        ${studentMetaRows
          .map(
            (row) => `
          <div>
            <div class="student-field-label">${row.label}</div>
            <div class="student-field-value">${row.value}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <!-- Structured Fee Table -->
    <div class="fee-table-container">
      <table class="fee-table">
        <thead>
          <tr>
            <th style="width: 34px;" class="col-center">Sl.</th>
            <th>Course / Class & Fee Description</th>
            <th style="width: 120px;">Billing Period</th>
            <th style="width: 95px;" class="col-right">Total Fee</th>
            <th style="width: 95px;" class="col-right">Amount Paid</th>
            <th style="width: 95px;" class="col-right">Remaining Bal.</th>
          </tr>
        </thead>
        <tbody>
          ${data.items
            .map((item, idx) => {
              const sl = item.slNo || idx + 1;
              const period = item.billingPeriod && isValidValue(item.billingPeriod) ? item.billingPeriod : '—';
              const isItemSettled = item.balanceAmount <= 0;
              return `
              <tr>
                <td class="col-center" style="color: #64748b;">${sl}</td>
                <td>
                  <div class="item-desc-main">${item.description}</div>
                  ${item.courseOrClass && item.courseOrClass !== item.description ? `<div class="item-desc-sub">${item.courseOrClass}</div>` : ''}
                </td>
                <td style="color: #475569;">${period}</td>
                <td class="col-right">${formatInr(item.feeAmount)}</td>
                <td class="col-right ${item.paidAmount > 0 ? 'text-paid-amt' : ''}">${formatInr(item.paidAmount)}</td>
                <td class="col-right ${isItemSettled ? 'text-bal-zero' : 'text-bal-amt'}">${formatInr(item.balanceAmount)}</td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- Settlement Info & Seal vs. Summary Box -->
    <div class="split-section">
      <div class="left-settlement-box">
        <!-- Payment Details Card -->
        <div class="payment-info-card">
          <div class="payment-info-title">Payment Settlement Details</div>
          <div class="payment-info-row">
            <span class="payment-info-label">Payment Method:</span>
            <span class="payment-info-val">${data.paymentInfo?.method || 'CASH / UPI'}</span>
          </div>
          ${isValidValue(data.paymentInfo?.transactionRef) ? `
            <div class="payment-info-row">
              <span class="payment-info-label">Transaction Reference:</span>
              <span class="payment-info-val">${data.paymentInfo?.transactionRef}</span>
            </div>
          ` : ''}
          <div class="payment-info-row">
            <span class="payment-info-label">Receipt Settlement Status:</span>
            <span class="payment-info-val">${isFullyPaid ? 'Full Clearance (Settled)' : data.summary.totalPaid > 0 ? 'Partial Settlement' : 'Payment Awaited'}</span>
          </div>
          ${isValidValue(data.paymentInfo?.processedBy) ? `
            <div class="payment-info-row">
              <span class="payment-info-label">Processed By:</span>
              <span class="payment-info-val">${data.paymentInfo?.processedBy}</span>
            </div>
          ` : ''}
          ${isValidValue(data.paymentDate) ? `
            <div class="payment-info-row">
              <span class="payment-info-label">Payment Date:</span>
              <span class="payment-info-val">${data.paymentDate}</span>
            </div>
          ` : ''}
        </div>

        <!-- PAID SEAL (ONLY FOR FULL SETTLEMENT) -->
        ${isFullyPaid ? `
          <div class="seal-wrapper">
            <div class="paid-seal-box">
              <div class="paid-seal-inner">
                <div class="seal-check">✓</div>
                <div class="seal-heading">PAID IN FULL</div>
                ${isValidValue(data.paymentDate) ? `<div class="seal-date">${data.paymentDate}</div>` : ''}
                <div class="seal-sub">${academy.name} OFFICIAL</div>
              </div>
            </div>
          </div>
        ` : data.summary.outstandingBalance > 0 ? `
          <div class="status-notice status-notice-partial">
            Remaining Balance of <strong>${formatInr(data.summary.outstandingBalance)}</strong> is pending collection for upcoming cycle.
          </div>
        ` : `
          <div class="status-notice status-notice-unpaid">
            This invoice is currently pending settlement.
          </div>
        `}
      </div>

      <!-- Right: Totals Summary -->
      <div class="totals-box">
        <div class="totals-header">Payment Summary</div>
        <div class="totals-body">
          <div class="totals-row">
            <span>Gross Invoiced:</span>
            <span class="totals-row-val">${formatInr(data.summary.grossInvoiced)}</span>
          </div>
          ${data.summary.totalDiscounts && data.summary.totalDiscounts > 0 ? `
            <div class="totals-row discount-row">
              <span>Discounts Applied:</span>
              <span class="totals-row-val">- ${formatInr(data.summary.totalDiscounts)}</span>
            </div>
          ` : ''}
          <div class="totals-row grand-paid">
            <span>Total Paid:</span>
            <span class="totals-row-val">${formatInr(data.summary.totalPaid)}</span>
          </div>
          <div class="totals-row balance-due">
            <span>Outstanding Balance:</span>
            <span class="totals-row-val">${formatInr(data.summary.outstandingBalance)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer & Signatory -->
    <div class="receipt-footer">
      <div class="disclaimer">
        <strong>Notice:</strong> This is a computer-generated official educational fee document issued by <strong>${academy.name}</strong>. Official acknowledgment of payment received. Please retain for your academic records.
      </div>
      <div class="signatory-box">
        <div class="sig-line"></div>
        <div class="sig-label">${data.signatoryTitle || 'Authorized Signatory'}</div>
        <div class="sig-academy">${academy.name}</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      // Auto-trigger print dialog after assets load
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;
}

export function openProfessionalInvoicePrintWindow(data: ProfessionalInvoiceData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open and print the fee receipt / invoice.');
    return;
  }

  // Prepend origin if logo is relative
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  let resolvedLogo = data.academy?.logoUrl || '/logo.png';
  if (resolvedLogo.startsWith('/')) {
    resolvedLogo = `${origin}${resolvedLogo}`;
  }

  const payload: ProfessionalInvoiceData = {
    ...data,
    academy: {
      ...DEFAULT_ACADEMY_CONFIG,
      ...(data.academy || {}),
      logoUrl: resolvedLogo,
    },
  };

  const html = generateProfessionalInvoiceHtml(payload);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
