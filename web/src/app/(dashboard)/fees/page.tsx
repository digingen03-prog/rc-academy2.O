'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import {
  CreditCard,
  Plus,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  Printer,
  FileText,
  Search,
  Building2,
  X,
  DollarSign,
  Layers,
  Settings,
  CheckCircle2,
  RefreshCw,
  Receipt,
  BookOpen,
  ArrowUpRight,
  ShieldCheck,
  Award,
  GraduationCap,
  Calendar,
  Users,
  Eye,
  Filter,
  Check,
  Copy,
  AlertTriangle,
  Clock,
  Pencil,
  Upload,
  Paperclip,
  Trash2,
  Image,
  Banknote,
  Smartphone,
  ArrowLeftRight,
  ArrowRight,
  Zap,
  Percent,
  Sparkles,
  Tag,
  ExternalLink,
  Loader2,
  Shield,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sun,
  Moon,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiClient } from '@/lib/api/api-client';
import { processPaymentProofFile, formatBytes } from '@/lib/utils/image-compression';

// ----------------------------------------------------
// Interfaces
// ----------------------------------------------------

interface CourseBreakdownItem {
  courseId: string;
  courseName: string;
  courseCode: string;
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  enrolledStudentsCount: number;
}

interface DashboardKpis {
  totalInvoiced: number;
  totalCollected: number;
  outstandingReceivables: number;
  overdueAmount: number;
  totalReversals: number;
  totalDiscounts: number;
  totalInvoicesCount: number;
  overdueInvoicesCount: number;
  totalPaymentsCount: number;
  pendingExceptionsCount: number;
}

interface StudentAccountSummary {
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

interface CourseFeeDetail {
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

interface StudentPaymentHistoryItem {
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

interface StudentDetailedAccount {
  student: {
    id: string;
    studentCode: string;
    admissionNumber: string;
    name: string;
    email?: string;
    phone?: string;
    status: string;
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

interface CourseFeeConfigItem {
  id: string;
  name: string;
  academicYear: { id: string; name: string };
  class: { id: string; name: string; code: string };
  batch?: { id: string; name: string } | null;
  subject?: { id: string; name: string } | null;
  amount: number;
  billingPeriod: string;
  installmentCount: number;
  effectiveStartDate: string;
  effectiveEndDate?: string | null;
  isActive: boolean;
  description?: string | null;
  allowedDiscounts?: any[] | null;
  _count?: { invoices: number };
}

interface InvoiceRowItem {
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

interface PaymentRowItem {
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

interface ProofViewerState {
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

interface AttachProofModalState {
  isOpen: boolean;
  paymentId: string;
  receiptNumber: string;
  studentName: string;
  amount: number;
}

interface OfficialReceiptData {
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

export default function FeesPage() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'accounts' | 'configs' | 'invoices' | 'payments' | 'revenue_salary'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterBillingCycle, setFilterBillingCycle] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Student Detail Modal state
  const [studentModalTab, setStudentModalTab] = useState<'payments' | 'courses'>('payments');
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);

  // Overview Data
  const [dashboardKpis, setDashboardKpis] = useState<DashboardKpis | null>(null);
  const [courseBreakdown, setCourseBreakdown] = useState<CourseBreakdownItem[]>([]);

  // Student Accounts Data
  const [studentAccounts, setStudentAccounts] = useState<StudentAccountSummary[]>([]);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentDetailedAccount | null>(null);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);

  // Course Fee Configs
  const [courseConfigs, setCourseConfigs] = useState<CourseFeeConfigItem[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);

  // Invoices & Payments
  const [invoicesList, setInvoicesList] = useState<InvoiceRowItem[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentRowItem[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<OfficialReceiptData | null>(null);

  // Adjustments & Waivers
  const [allAdjustments, setAllAdjustments] = useState<any[]>([]);

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showReversalModal, setShowReversalModal] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<PaymentRowItem | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Form States - Course Fee Config
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [replicatingConfigId, setReplicatingConfigId] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({
    name: '',
    classId: '',
    batchId: '',
    subjectId: '',
    subjectMode: 'ALL' as 'ALL' | 'SELECT' | 'SINGLE',
    subjectTier: 'ALL' as 'ALL' | 'TWO_SUBJECTS' | 'SINGLE_SUBJECT' | 'CUSTOM',
    selectedSubjectIds: [] as string[],
    amount: 3500,
    discountAmount: 0,
    billingPeriod: 'MONTHLY',
    installmentCount: 1,
    description: '',
    isActive: true,
    replicateToStudents: false,
  });

  // Form States - Payment
  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [selectedSingleInvoiceId, setSelectedSingleInvoiceId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('UPI');
  const [paymentMethodMode, setPaymentMethodMode] = useState<'CASH' | 'UPI' | 'CASH_UPI'>('UPI');
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [splitUpiAmount, setSplitUpiAmount] = useState<number>(0);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [collectionMonth, setCollectionMonth] = useState('October 2026');
  const [studentOpenInvoices, setStudentOpenInvoices] = useState<InvoiceRowItem[]>([]);
  const [multiAllocations, setMultiAllocations] = useState<{ [invoiceId: string]: number }>({});

  // Payment Proof Upload States
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string>('');
  const [paymentProofSize, setPaymentProofSize] = useState<string>('');
  const [proofError, setProofError] = useState<string | null>(null);
  const [compressingProof, setCompressingProof] = useState<boolean>(false);
  const [proofCompressionInfo, setProofCompressionInfo] = useState<{
    originalSize: string;
    compressedSize: string;
    isCompressed: boolean;
    ratio: number;
    note: string;
  } | null>(null);
  const [loadingProofUrl, setLoadingProofUrl] = useState<string | null>(null);

  // Proof Viewer Modal States (AWS S3 short-lived presigned document access)
  const [proofViewer, setProofViewer] = useState<ProofViewerState>({
    isOpen: false,
    paymentId: '',
    fileName: '',
    loading: false,
  });
  const [proofViewerZoom, setProofViewerZoom] = useState<number>(100);
  const [proofViewerRotation, setProofViewerRotation] = useState<number>(0);
  const [proofViewerDarkBg, setProofViewerDarkBg] = useState<boolean>(false);

  // Modal State for Attaching / Updating Proof to Existing Payment
  const [attachProofModal, setAttachProofModal] = useState<AttachProofModalState | null>(null);
  const [existingProofFile, setExistingProofFile] = useState<File | null>(null);
  const [existingProofPreview, setExistingProofPreview] = useState<string | null>(null);
  const [existingProofCompression, setExistingProofCompression] = useState<{
    originalSize: string;
    compressedSize: string;
    isCompressed: boolean;
    ratio: number;
    note: string;
  } | null>(null);
  const [uploadingExistingProof, setUploadingExistingProof] = useState<boolean>(false);
  const [existingProofError, setExistingProofError] = useState<string | null>(null);

  // Payment Instant Fee Discount States
  const [paymentDiscount, setPaymentDiscount] = useState<number | ''>('');
  const [paymentDiscountReason, setPaymentDiscountReason] = useState<string>('');
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Form States - Adjustment
  const [adjustmentInvoice, setAdjustmentInvoice] = useState<InvoiceRowItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'SCHOLARSHIP' | 'DISCOUNT' | 'CREDIT_ADJUSTMENT' | 'WAIVER' | 'CORRECTION'>('SCHOLARSHIP');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(5000);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Salary & Academy Revenue States
  const [revenueMetrics, setRevenueMetrics] = useState<any>(null);
  const [salaryConfig, setSalaryConfig] = useState<any>(null);
  const [salaryLedgers, setSalaryLedgers] = useState<any[]>([]);
  const [salaryExceptions, setSalaryExceptions] = useState<any[]>([]);
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    staffId: '',
    paymentMethod: 'BANK_TRANSFER',
    reference: '',
    notes: '',
  });

  // ====================================================
  // Data Fetching
  // ====================================================

  const fetchDashboardData = async () => {
    try {
      const data: any = await ApiClient.fetch('/fees/dashboard-summary');
      if (data) {
        setDashboardKpis(data.kpis);
        setCourseBreakdown(data.courseBreakdown || []);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard summary', err);
    }
  };

  const fetchStudentAccounts = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filterCourseId) params.append('classId', filterCourseId);
      if (filterSubjectId) params.append('subjectId', filterSubjectId);
      if (filterBillingCycle) params.append('billingCycle', filterBillingCycle);
      if (filterStatus) params.append('status', filterStatus);

      const data: any = await ApiClient.fetch(`/fees/student-accounts?${params.toString()}`);
      if (data && data.items) {
        setStudentAccounts(data.items);
      }
    } catch (err: any) {
      console.error('Failed to load student accounts', err);
    }
  };

  const fetchCourseConfigs = async () => {
    try {
      const data: any = await ApiClient.fetch('/fees/course-configs');
      if (data) {
        setCourseConfigs(data);
      }
    } catch (err: any) {
      console.error('Failed to load course fee configs', err);
    }
  };

  const fetchInvoices = async () => {
    try {
      const data: any = await ApiClient.fetch('/fees/invoices');
      if (data) {
        setInvoicesList(data);
        // Extract adjustments
        const adjs: any[] = [];
        data.forEach((inv: any) => {
          if (inv.adjustments && inv.adjustments.length > 0) {
            inv.adjustments.forEach((a: any) => {
              adjs.push({
                ...a,
                invoiceNumber: inv.invoiceNumber,
                studentName: `${inv.student?.firstName || ''} ${inv.student?.lastName || ''}`.trim(),
                studentCode: inv.student?.studentCode || 'N/A',
                courseName: inv.class?.name || 'Standard Course',
              });
            });
          }
        });
        setAllAdjustments(adjs);
      }
    } catch (err: any) {
      console.error('Failed to load invoices', err);
    }
  };

  const fetchPayments = async () => {
    try {
      const data: any = await ApiClient.fetch('/fees/payments');
      if (data) {
        setPaymentsList(data);
      }
    } catch (err: any) {
      console.error('Failed to load payments', err);
    }
  };

  const fetchCoursesList = async () => {
    try {
      const data: any = await ApiClient.fetch('/courses');
      if (data) {
        setAvailableCourses(data);
      }
    } catch (err: any) {
      console.error('Failed to load courses', err);
    }
  };

  const fetchSalaryRevenueData = async () => {
    try {
      const [metrics, config, ledgers, exceptions, staff]: any = await Promise.all([
        ApiClient.fetch('/salary/revenue-summary').catch(() => null),
        ApiClient.fetch('/salary/config').catch(() => null),
        ApiClient.fetch('/salary/ledger').catch(() => []),
        ApiClient.fetch('/salary/exceptions').catch(() => []),
        ApiClient.fetch('/staff').catch(() => []),
      ]);
      if (metrics) setRevenueMetrics(metrics);
      if (config) setSalaryConfig(config);
      if (ledgers) setSalaryLedgers(ledgers);
      if (exceptions) setSalaryExceptions(exceptions);
      if (staff) setStaffOptions(staff);
    } catch (err) {
      console.error('Failed to load salary revenue data', err);
    }
  };

  const reloadAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardData(),
      fetchStudentAccounts(),
      fetchCourseConfigs(),
      fetchInvoices(),
      fetchPayments(),
      fetchCoursesList(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'accounts') {
      fetchStudentAccounts();
    } else if (activeTab === 'revenue_salary') {
      fetchSalaryRevenueData();
    }
  }, [activeTab, searchQuery, filterCourseId, filterSubjectId, filterBillingCycle, filterStatus]);

  // Load detailed student account drilldown
  const handleOpenStudentDetail = async (studentId: string) => {
    try {
      setLoadingStudentDetail(true);
      const detail: any = await ApiClient.fetch(`/fees/students/${studentId}/account`);
      setSelectedStudentDetail(detail);
    } catch (err: any) {
      alert(`Could not load student account: ${err.message}`);
    } finally {
      setLoadingStudentDetail(false);
    }
  };

  // Prepare payment modal for student
  const handleOpenPaymentModalForStudent = async (studentId: string, preselectedInvoiceId?: string) => {
    setPaymentStudentId(studentId);
    setSelectedSingleInvoiceId(preselectedInvoiceId || '');
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
    setPaymentProofName('');
    setPaymentProofSize('');
    setProofError(null);
    setPaymentDiscount('');
    setPaymentDiscountReason('');
    setDiscountError(null);
    setPaymentMethodMode('UPI');
    setPaymentMethod('UPI');

    try {
      const detail: any = await ApiClient.fetch(`/fees/students/${studentId}/account`);
      const openInvs = (detail.courseFees || []).filter(
        (f: CourseFeeDetail) => f.status === 'UNPAID' || f.status === 'PARTIAL',
      );

      const formatted = openInvs.map((f: CourseFeeDetail) => ({
        id: f.invoiceId,
        invoiceNumber: f.invoiceNumber,
        class: { id: f.courseId, name: f.courseName, code: f.courseCode },
        batch: { id: f.batchId || '', name: f.batchName || 'General' },
        subject: f.subjectName ? { id: f.subjectId || '', name: f.subjectName } : null,
        totalAmount: f.totalAmount,
        paidAmount: f.paidAmount,
        balanceAmount: f.balanceAmount,
        status: f.status,
        dueDate: f.dueDate,
        lines: f.lines,
        adjustments: f.adjustments,
        discountAmount: f.discountAmount,
        student: { id: detail.student.id, firstName: detail.student.name, lastName: '', studentCode: detail.student.studentCode },
      }));

      setStudentOpenInvoices(formatted);

      if (preselectedInvoiceId) {
        setPaymentMode('SINGLE');
        const target = formatted.find((i: any) => i.id === preselectedInvoiceId);
        const targetBal = target ? target.balanceAmount : 0;
        setPaymentAmount(targetBal);
        const half = Math.round(targetBal / 2);
        setSplitCashAmount(half);
        setSplitUpiAmount(targetBal - half);
      } else if (formatted.length > 0) {
        setPaymentMode(formatted.length > 1 ? 'MULTI' : 'SINGLE');
        setSelectedSingleInvoiceId(formatted[0].id);
        const targetBal = formatted[0].balanceAmount;
        setPaymentAmount(targetBal);
        const half = Math.round(targetBal / 2);
        setSplitCashAmount(half);
        setSplitUpiAmount(targetBal - half);

        // Pre-fill multi allocations
        const allocMap: { [id: string]: number } = {};
        formatted.forEach((inv: any) => {
          allocMap[inv.id] = inv.balanceAmount;
        });
        setMultiAllocations(allocMap);
        const totalBal = formatted.reduce((sum: number, inv: any) => sum + inv.balanceAmount, 0);
        setPaymentAmount(totalBal);
      }

      setShowPaymentModal(true);
    } catch (err: any) {
      alert(`Could not load invoices for payment: ${err.message}`);
    }
  };

  // Proof of payment file handlers with adaptive client-side compression
  const handleProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressingProof(true);
      setProofError(null);
      const result = await processPaymentProofFile(file);
      setPaymentProofFile(result.file);
      setPaymentProofName(result.file.name);
      setPaymentProofSize(formatBytes(result.compressedSize));
      setPaymentProofPreview(result.previewUrl);
      setProofCompressionInfo({
        originalSize: formatBytes(result.originalSize),
        compressedSize: formatBytes(result.compressedSize),
        isCompressed: result.isCompressed,
        ratio: result.compressionRatioPercent,
        note: result.note,
      });
    } catch (err: any) {
      setProofError(err.message || 'Invalid proof document');
      setPaymentProofFile(null);
      setPaymentProofName('');
      setPaymentProofSize('');
      setPaymentProofPreview(null);
      setProofCompressionInfo(null);
    } finally {
      setCompressingProof(false);
    }
  };

  const handleRemoveProof = () => {
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
    setPaymentProofName('');
    setPaymentProofSize('');
    setProofError(null);
    setProofCompressionInfo(null);
  };

  const handleOpenProofDocument = async (
    paymentId: string,
    meta?: { receiptNumber?: string; fileName?: string; fileSize?: string | number; mimeType?: string },
  ) => {
    setProofViewer({
      isOpen: true,
      paymentId,
      receiptNumber: meta?.receiptNumber,
      fileName: meta?.fileName || 'Payment Proof Document',
      fileSize: meta?.fileSize,
      mimeType: meta?.mimeType,
      downloadUrl: null,
      loading: true,
      error: null,
    });
    setProofViewerZoom(100);
    setProofViewerRotation(0);
    setLoadingProofUrl(paymentId);

    try {
      const res: any = await ApiClient.fetch(`/fees/payments/${paymentId}/proof-url`);
      if (res?.downloadUrl) {
        setProofViewer((prev) => ({
          ...prev,
          downloadUrl: res.downloadUrl,
          fileName: res.fileName || prev.fileName,
          fileSize: res.fileSize ? formatBytes(res.fileSize) : prev.fileSize,
          mimeType: res.mimeType || prev.mimeType,
          expiresIn: res.expiresIn || 900,
          uploadedAt: res.uploadedAt,
          loading: false,
        }));
      } else {
        throw new Error('Server returned empty download URL');
      }
    } catch (err: any) {
      setProofViewer((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Could not retrieve secure download URL from AWS S3',
      }));
    } finally {
      setLoadingProofUrl(null);
    }
  };

  const handleOpenAttachProof = (payment: {
    id: string;
    receiptNumber: string;
    studentName: string;
    amount: number;
  }) => {
    setAttachProofModal({
      isOpen: true,
      paymentId: payment.id,
      receiptNumber: payment.receiptNumber,
      studentName: payment.studentName,
      amount: payment.amount,
    });
    setExistingProofFile(null);
    setExistingProofPreview(null);
    setExistingProofCompression(null);
    setExistingProofError(null);
  };

  const handleExistingProofChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setExistingProofError(null);
      const result = await processPaymentProofFile(file);
      setExistingProofFile(result.file);
      setExistingProofPreview(result.previewUrl);
      setExistingProofCompression({
        originalSize: formatBytes(result.originalSize),
        compressedSize: formatBytes(result.compressedSize),
        isCompressed: result.isCompressed,
        ratio: result.compressionRatioPercent,
        note: result.note,
      });
    } catch (err: any) {
      setExistingProofError(err.message || 'Invalid proof document');
      setExistingProofFile(null);
      setExistingProofPreview(null);
      setExistingProofCompression(null);
    }
  };

  const handleSubmitAttachProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachProofModal || !existingProofFile) {
      setExistingProofError('Please choose a proof document to upload');
      return;
    }
    try {
      setUploadingExistingProof(true);
      setExistingProofError(null);

      const formData = new FormData();
      formData.append('file', existingProofFile);

      const res: any = await ApiClient.fetch(`/fees/payments/${attachProofModal.paymentId}/proof`, {
        method: 'POST',
        body: formData,
      });

      if (res?.success) {
        setSuccessMsg(
          `Proof document attached to receipt ${attachProofModal.receiptNumber} successfully! Stored in private Amazon S3.`,
        );
        setAttachProofModal(null);
        await reloadAll();
        if (selectedStudentDetail) {
          await handleOpenStudentDetail(selectedStudentDetail.student.id);
        }
      } else {
        throw new Error('Upload response did not confirm success');
      }
    } catch (err: any) {
      setExistingProofError(err.message || 'Failed to upload proof document');
    } finally {
      setUploadingExistingProof(false);
    }
  };

  // Submit Payment Collection
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentStudentId) {
      alert('Please select a student');
      return;
    }
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than zero');
      return;
    }
    if (!paymentProofFile && !paymentProofName) {
      setProofError('Payment proof document (receipt slip, screenshot, or PDF) is required for fee updates');
      return;
    }

    const appliedDisc = Math.max(0, Number(paymentDiscount) || 0);
    if (appliedDisc > 0) {
      if (!paymentDiscountReason.trim()) {
        setDiscountError('Discount reason is mandatory when an instant fee discount is applied');
        return;
      }
      if (appliedDisc > modalTargetBalance) {
        setDiscountError(`Discount amount (₹${appliedDisc.toLocaleString()}) cannot exceed the total due fee (₹${modalTargetBalance.toLocaleString()})`);
        return;
      }
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      setProofError(null);
      setDiscountError(null);

      const monthPrefix = collectionMonth ? `[Cycle: ${collectionMonth}]` : '';

      let finalMethod: 'CASH' | 'UPI' = 'UPI';
      let finalReference = paymentReference.trim();
      let methodNote = '';

      if (paymentMethodMode === 'CASH') {
        finalMethod = 'CASH';
        methodNote = '[Payment Method: CASH]';
      } else if (paymentMethodMode === 'UPI') {
        finalMethod = 'UPI';
        methodNote = `[Payment Method: UPI]${finalReference ? ` (Ref: ${finalReference})` : ''}`;
      } else if (paymentMethodMode === 'CASH_UPI') {
        if (splitCashAmount <= 0 || splitUpiAmount <= 0) {
          alert('For Cash + UPI split payment, please specify both Cash and UPI portions');
          setLoading(false);
          return;
        }
        finalMethod = 'UPI';
        const splitBreakdown = `Split: Cash ₹${splitCashAmount.toLocaleString()} + UPI ₹${splitUpiAmount.toLocaleString()}`;
        finalReference = finalReference ? `${splitBreakdown} • Ref: ${finalReference}` : splitBreakdown;
        methodNote = `[Payment Method: CASH+UPI] (Cash: ₹${splitCashAmount.toLocaleString()}, UPI: ₹${splitUpiAmount.toLocaleString()})`;
      }

      const proofNote = paymentProofName ? `[Proof: ${paymentProofName} (${paymentProofSize})]` : '';
      const combinedNotes = [monthPrefix, methodNote, proofNote, paymentNotes.trim()].filter(Boolean).join(' ');

      let payload: any = {
        studentId: paymentStudentId,
        amount: Number(paymentAmount),
        paymentMethod: finalMethod,
        reference: finalReference || undefined,
        notes: combinedNotes || undefined,
        idempotencyKey: `PAY-UI-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      };

      if (appliedDisc > 0) {
        payload.discountAmount = appliedDisc;
        payload.discountReason = paymentDiscountReason.trim();
      }

      if (paymentMode === 'MULTI') {
        const allocArray = Object.entries(multiAllocations)
          .filter(([_, amt]) => Number(amt) > 0)
          .map(([invId, amt]) => ({
            invoiceId: invId,
            amount: Number(amt),
          }));

        const allocSum = allocArray.reduce((sum, a) => sum + a.amount, 0);
        if (allocSum !== Number(paymentAmount)) {
          alert(`The sum of course allocations (Rs. ${allocSum}) must exactly equal the total payment amount (Rs. ${paymentAmount})`);
          setLoading(false);
          return;
        }

        payload.allocations = allocArray;
      } else if (selectedSingleInvoiceId) {
        payload.invoiceId = selectedSingleInvoiceId;
      }

      const res: any = await ApiClient.fetch('/fees/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Distinguish payment-record creation from S3 proof upload
      let proofUploadSuccess = false;
      let proofUploadError: string | null = null;

      if (paymentProofFile && res?.payment?.id) {
        try {
          const formData = new FormData();
          formData.append('file', paymentProofFile);

          const uploadRes: any = await ApiClient.fetch(`/fees/payments/${res.payment.id}/proof`, {
            method: 'POST',
            body: formData,
          });

          if (uploadRes?.success) {
            proofUploadSuccess = true;
          }
        } catch (uploadErr: any) {
          proofUploadError = uploadErr.message || 'Proof document failed to upload to private S3 bucket';
        }
      }

      const discMsg = appliedDisc > 0 ? ` (with ₹${appliedDisc.toLocaleString()} discount: "${paymentDiscountReason.trim()}")` : '';

      if (paymentProofFile && !proofUploadSuccess) {
        setErrorMsg(
          `Payment registered (${res.receiptNumber}), but payment proof upload FAILED: ${proofUploadError}. Please open payment details to retry proof upload.`,
        );
      } else {
        const proofSuffix = paymentProofFile ? ' • Proof verified & encrypted in private S3' : '';
        setSuccessMsg(
          `Payment of ₹${Number(paymentAmount).toLocaleString()} recorded successfully${discMsg} for ${collectionMonth} (Receipt: ${res.receiptNumber})!${proofSuffix}`,
        );
      }

      setShowPaymentModal(false);
      setPaymentDiscount('');
      setPaymentDiscountReason('');
      setDiscountError(null);
      handleRemoveProof();

      // Auto-load receipt
      if (res.payment?.id) {
        handleViewReceipt(res.payment.id);
      }

      await reloadAll();
      if (selectedStudentDetail) {
        await handleOpenStudentDetail(selectedStudentDetail.student.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  // Open Create Fee Rule Modal
  const handleOpenCreateConfig = () => {
    setEditingConfigId(null);
    setConfigForm({
      name: '',
      classId: '',
      batchId: '',
      subjectId: '',
      subjectMode: 'ALL',
      subjectTier: 'ALL',
      selectedSubjectIds: [],
      amount: 3500,
      discountAmount: 0,
      billingPeriod: 'MONTHLY',
      installmentCount: 1,
      description: '',
      isActive: true,
      replicateToStudents: false,
    });
    setShowConfigModal(true);
  };

  // Open Edit Fee Rule Modal
  const handleOpenEditConfig = (cfg: CourseFeeConfigItem) => {
    setEditingConfigId(cfg.id);
    const bundleDiscount = (cfg.allowedDiscounts as any[])?.find(
      (d: any) =>
        d &&
        (d.tier ||
          d.type === 'ALL_SUBJECTS_BUNDLE' ||
          d.type === 'TWO_SUBJECTS_BUNDLE' ||
          d.type === 'SELECTED_SUBJECTS_BUNDLE' ||
          d.type === 'SINGLE_SUBJECT' ||
          d.type === 'BUNDLE_OFFER' ||
          d.name?.includes('Discount') ||
          d.name?.includes('Offer') ||
          Number(d.amount) > 0),
    );
    const existingSelectedIds: string[] = Array.isArray(bundleDiscount?.selectedSubjectIds) && bundleDiscount.selectedSubjectIds.length > 0
      ? bundleDiscount.selectedSubjectIds
      : cfg.subject?.id
      ? [cfg.subject.id]
      : [];

    let detectedTier: 'ALL' | 'TWO_SUBJECTS' | 'SINGLE_SUBJECT' | 'CUSTOM' = 'ALL';
    if (bundleDiscount?.tier) {
      detectedTier = bundleDiscount.tier;
    } else if (cfg.subject?.id || existingSelectedIds.length === 1 || cfg.name?.toLowerCase().includes('1 subject')) {
      detectedTier = 'SINGLE_SUBJECT';
    } else if (existingSelectedIds.length === 2 || cfg.name?.toLowerCase().includes('2 subject')) {
      detectedTier = 'TWO_SUBJECTS';
    } else if (existingSelectedIds.length > 0) {
      detectedTier = 'CUSTOM';
    }

    setConfigForm({
      name: cfg.name,
      classId: cfg.class.id,
      batchId: cfg.batch?.id || '',
      subjectId: cfg.subject?.id || existingSelectedIds[0] || '',
      subjectMode: detectedTier === 'ALL' ? 'ALL' : 'SELECT',
      subjectTier: detectedTier,
      selectedSubjectIds: existingSelectedIds,
      amount: cfg.amount,
      discountAmount: bundleDiscount?.amount ? Number(bundleDiscount.amount) : 0,
      billingPeriod: cfg.billingPeriod || 'MONTHLY',
      installmentCount: cfg.installmentCount || 1,
      description: cfg.description || '',
      isActive: cfg.isActive !== undefined ? cfg.isActive : true,
      replicateToStudents: false,
    });
    setShowConfigModal(true);
  };

  // Replicate fee rule across all eligible students
  const handleReplicateFeeConfig = async (configId: string, configName: string) => {
    try {
      setReplicatingConfigId(configId);
      setErrorMsg(null);
      const res: any = await ApiClient.fetch(`/fees/course-configs/${configId}/replicate`, {
        method: 'POST',
      });
      setSuccessMsg(
        `Fee replication complete for "${configName}": Invoiced ${res.created} students (${res.skippedExisting} already billed out of ${res.totalEligible} enrolled students).`
      );
      await fetchCourseConfigs();
      await fetchDashboardData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to replicate fee to students');
    } finally {
      setReplicatingConfigId(null);
    }
  };

  // Create or Update Course Fee Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configForm.classId || configForm.amount <= 0) {
      alert('Please select a course and enter a valid fee amount');
      return;
    }

    try {
      setLoading(true);
      const selectedCourse = availableCourses.find((c) => c.id === configForm.classId);
      const selectedBatch = selectedCourse?.batches?.find((b: any) => b.id === configForm.batchId);
      const selectedSub = selectedCourse?.subjects?.find((s: any) => s.id === configForm.subjectId);
      const periodLabel =
        configForm.billingPeriod === 'MONTHLY'
          ? 'Monthly Tuition'
          : configForm.billingPeriod === 'ANNUAL'
          ? 'Annual Tuition'
          : `${configForm.billingPeriod} Tuition`;
      const batchPart = selectedBatch ? ` (${selectedBatch.name})` : '';
      const subPart = selectedSub ? ` - ${selectedSub.name}` : '';
      const resolvedName = configForm.name.trim() || `${selectedCourse?.name || 'Course'}${batchPart}${subPart} ${periodLabel}`;

      const resolvedAcademicYearId = selectedCourse?.academicYear?.id || selectedCourse?.academicYearId;

      const isSelectMode = configForm.subjectTier !== 'ALL';
      const targetSelectedSubjectIds =
        !isSelectMode
          ? []
          : configForm.selectedSubjectIds.length > 0
          ? configForm.selectedSubjectIds
          : configForm.subjectId
          ? [configForm.subjectId]
          : [];

      const targetCount =
        configForm.subjectTier === 'TWO_SUBJECTS'
          ? 2
          : configForm.subjectTier === 'SINGLE_SUBJECT'
          ? 1
          : null;

      const bundleDiscounts = [
        {
          tier: configForm.subjectTier,
          targetSubjectCount: targetCount,
          name:
            configForm.subjectTier === 'ALL'
              ? 'All Subjects Standard Fixed Fee'
              : configForm.subjectTier === 'TWO_SUBJECTS'
              ? '2-Subjects Package Fee'
              : configForm.subjectTier === 'SINGLE_SUBJECT'
              ? 'Single Subject Fee'
              : 'Selected Subjects Package Fee',
          amount: Number(configForm.discountAmount) || 0,
          type:
            configForm.subjectTier === 'ALL'
              ? 'ALL_SUBJECTS_BUNDLE'
              : configForm.subjectTier === 'TWO_SUBJECTS'
              ? 'TWO_SUBJECTS_BUNDLE'
              : configForm.subjectTier === 'SINGLE_SUBJECT'
              ? 'SINGLE_SUBJECT'
              : 'SELECTED_SUBJECTS_BUNDLE',
          selectedSubjectIds: targetSelectedSubjectIds,
          fixedAmount: Math.max(0, (Number(configForm.amount) || 0) - (Number(configForm.discountAmount) || 0)),
        },
      ];

      if (editingConfigId) {
        // Update existing configuration via PATCH
        const updatePayload: Record<string, any> = {
          name: resolvedName,
          amount: Number(configForm.amount),
          discountAmount: Number(configForm.discountAmount) || 0,
          allowedDiscounts: bundleDiscounts,
          subjectTier: configForm.subjectTier,
          targetSubjectCount: targetCount,
          selectedSubjectIds: targetSelectedSubjectIds,
          billingPeriod: configForm.billingPeriod,
          installmentCount: Number(configForm.installmentCount),
          isActive: configForm.isActive,
          replicateToStudents: configForm.replicateToStudents,
        };

        if (configForm.classId) {
          updatePayload.classId = configForm.classId;
        }
        if (configForm.batchId) {
          updatePayload.batchId = configForm.batchId;
        }
        updatePayload.subjectId = isSelectMode && targetSelectedSubjectIds.length === 1 ? targetSelectedSubjectIds[0] : null;
        if (resolvedAcademicYearId && resolvedAcademicYearId !== 'any') {
          updatePayload.academicYearId = resolvedAcademicYearId;
        }
        if (configForm.description !== undefined) {
          updatePayload.description = configForm.description.trim() || undefined;
        }

        const res: any = await ApiClient.fetch(`/fees/course-configs/${editingConfigId}`, {
          method: 'PATCH',
          body: JSON.stringify(updatePayload),
        });

        if (res.replication) {
          setSuccessMsg(
            `Course fee rule "${resolvedName}" updated! Replicated fee to ${res.replication.created} students (${res.replication.skippedExisting} already invoiced).`
          );
        } else {
          setSuccessMsg(`Course fee rule "${resolvedName}" updated successfully!`);
        }
      } else {
        // Create new configuration via POST
        const createPayload: Record<string, any> = {
          name: resolvedName,
          classId: configForm.classId,
          amount: Number(configForm.amount),
          discountAmount: Number(configForm.discountAmount) || 0,
          allowedDiscounts: bundleDiscounts,
          subjectTier: configForm.subjectTier,
          targetSubjectCount: targetCount,
          selectedSubjectIds: targetSelectedSubjectIds,
          billingPeriod: configForm.billingPeriod,
          installmentCount: Number(configForm.installmentCount),
          replicateToStudents: configForm.replicateToStudents,
        };

        if (configForm.batchId) {
          createPayload.batchId = configForm.batchId;
        }
        if (isSelectMode && targetSelectedSubjectIds.length === 1) {
          createPayload.subjectId = targetSelectedSubjectIds[0];
        }
        if (resolvedAcademicYearId && resolvedAcademicYearId !== 'any') {
          createPayload.academicYearId = resolvedAcademicYearId;
        } else {
          createPayload.academicYearId = 'any';
        }
        if (configForm.description?.trim()) {
          createPayload.description = configForm.description.trim();
        }

        const res: any = await ApiClient.fetch('/fees/course-configs', {
          method: 'POST',
          body: JSON.stringify(createPayload),
        });

        if (res.replication) {
          setSuccessMsg(
            `Course fee rule "${configForm.name}" created! Replicated fee to ${res.replication.created} students (${res.replication.skippedExisting} already invoiced).`
          );
        } else {
          setSuccessMsg(`Course fee configuration "${configForm.name}" created successfully!`);
        }
      }

      setShowConfigModal(false);
      setEditingConfigId(null);
      setConfigForm({
        name: '',
        classId: '',
        batchId: '',
        subjectId: '',
        subjectMode: 'ALL',
        subjectTier: 'ALL',
        selectedSubjectIds: [],
        amount: 3500,
        discountAmount: 0,
        billingPeriod: 'MONTHLY',
        installmentCount: 1,
        description: '',
        isActive: true,
        replicateToStudents: true,
      });
      await fetchCourseConfigs();
      await fetchDashboardData();
    } catch (err: any) {
      alert(`Error saving fee configuration: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Apply Authorized Adjustment / Scholarship
  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentInvoice || adjustmentAmount <= 0 || !adjustmentReason.trim()) {
      alert('Please provide adjustment amount and authorized reason');
      return;
    }

    if (adjustmentAmount > adjustmentInvoice.balanceAmount) {
      alert(`Adjustment amount (Rs. ${adjustmentAmount}) cannot exceed outstanding balance (Rs. ${adjustmentInvoice.balanceAmount})`);
      return;
    }

    try {
      setLoading(true);
      await ApiClient.fetch('/fees/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          invoiceId: adjustmentInvoice.id,
          type: adjustmentType,
          amount: Number(adjustmentAmount),
          reason: adjustmentReason.trim(),
        }),
      });

      setSuccessMsg(`${adjustmentType} adjustment of Rs. ${adjustmentAmount} applied to invoice ${adjustmentInvoice.invoiceNumber}`);
      setShowAdjustmentModal(false);
      setAdjustmentInvoice(null);
      setAdjustmentReason('');
      await reloadAll();
      if (selectedStudentDetail) {
        await handleOpenStudentDetail(selectedStudentDetail.student.id);
      }
    } catch (err: any) {
      alert(`Adjustment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Reverse Payment
  const handleConfirmReversal = async () => {
    if (!reversalTarget || !reversalReason.trim()) {
      alert('Please state the authorized reason for payment reversal');
      return;
    }

    try {
      setLoading(true);
      await ApiClient.fetch(`/fees/payments/${reversalTarget.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reversalReason.trim() }),
      });

      setSuccessMsg(`Payment ${reversalTarget.receiptNumber} successfully reversed and invoice balances restored.`);
      setShowReversalModal(false);
      setReversalTarget(null);
      setReversalReason('');
      await reloadAll();
      if (selectedStudentDetail) {
        await handleOpenStudentDetail(selectedStudentDetail.student.id);
      }
    } catch (err: any) {
      alert(`Reversal failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear All Invoices
  const handleClearAllInvoices = async () => {
    if (!window.confirm('Are you sure you want to clear ALL fee invoices? This will delete all generated invoice records and cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const res: any = await ApiClient.fetch('/fees/invoices/clear-all', {
        method: 'DELETE',
      });
      setSuccessMsg(res?.message || 'All invoices have been cleared successfully.');
      await reloadAll();
      if (selectedStudentDetail) {
        await handleOpenStudentDetail(selectedStudentDetail.student.id);
      }
    } catch (err: any) {
      alert(`Failed to clear invoices: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete Single Invoice
  const handleDeleteSingleInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice "${invoiceNumber}"?`)) {
      return;
    }

    try {
      setLoading(true);
      const res: any = await ApiClient.fetch(`/fees/invoices/${invoiceId}`, {
        method: 'DELETE',
      });
      setSuccessMsg(res?.message || `Invoice ${invoiceNumber} deleted.`);
      await reloadAll();
      if (selectedStudentDetail) {
        await handleOpenStudentDetail(selectedStudentDetail.student.id);
      }
    } catch (err: any) {
      alert(`Failed to delete invoice: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete Course Fee Rule
  const handleDeleteFeeConfig = async (configId: string, configName: string) => {
    if (!window.confirm(`Are you sure you want to delete fee rule "${configName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      const res: any = await ApiClient.fetch(`/fees/course-configs/${configId}`, {
        method: 'DELETE',
      });
      setSuccessMsg(res?.message || `Fee rule "${configName}" was deleted successfully.`);
      setShowConfigModal(false);
      setEditingConfigId(null);
      await reloadAll();
    } catch (err: any) {
      alert(`Failed to delete fee rule: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // View Printable Official Receipt
  const handleViewReceipt = async (paymentId: string) => {
    try {
      const receiptData: any = await ApiClient.fetch(`/fees/payments/${paymentId}/receipt`);
      setSelectedReceipt(receiptData);
    } catch (err: any) {
      alert(`Could not load receipt: ${err.message}`);
    }
  };

  // Submit Salary Payout
  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutForm.staffId) {
      alert('Please select a staff member');
      return;
    }
    try {
      setLoading(true);
      await ApiClient.fetch('/salary/payouts', {
        method: 'POST',
        body: JSON.stringify(payoutForm),
      });
      setSuccessMsg('Salary payout approved and disbursed successfully!');
      setShowPayoutModal(false);
      await fetchSalaryRevenueData();
    } catch (err: any) {
      alert(`Payout failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Selected course object for batch/subject dropdowns in config form
  const selectedConfigCourse = availableCourses.find((c) => c.id === configForm.classId);
  const selectedConfigBatch = selectedConfigCourse?.batches?.find((b: any) => b.id === configForm.batchId);
  const selectedConfigSubject = selectedConfigCourse?.subjects?.find((s: any) => s.id === configForm.subjectId);
  const totalClassSubjectsCount = selectedConfigCourse?.subjects?.length || 0;

  // Real-time student counts strictly segregated by enrollment tier for the selected class/batch
  const {
    allSubjectsCount,
    twoSubjectsCount,
    oneSubjectCount,
    customCount,
    selectedTierStudentsCount,
  } = React.useMemo(() => {
    if (!configForm.classId) {
      return {
        allSubjectsCount: 0,
        twoSubjectsCount: 0,
        oneSubjectCount: 0,
        customCount: 0,
        selectedTierStudentsCount: 0,
      };
    }

    let allCount = 0;
    let twoCount = 0;
    let oneCount = 0;
    let customMatches = 0;

    for (const sa of studentAccounts) {
      const classEnrollments = (sa.enrolledCourses || []).filter((ec: any) => {
        if (ec.courseId !== configForm.classId) return false;
        if (configForm.batchId) {
          const selectedBatch = selectedConfigCourse?.batches?.find((b: any) => b.id === configForm.batchId);
          if (selectedBatch && ec.batchName !== selectedBatch.name && ec.batchId !== configForm.batchId) return false;
        }
        return true;
      });

      const subCount = classEnrollments.length;
      if (subCount === 0) continue;

      if (totalClassSubjectsCount > 0 && subCount >= totalClassSubjectsCount) {
        allCount++;
      } else if (totalClassSubjectsCount === 0 && subCount >= 1) {
        allCount++;
      }

      if (subCount === 2) {
        twoCount++;
      }

      if (subCount === 1) {
        if (configForm.subjectId) {
          const selectedSub = selectedConfigCourse?.subjects?.find((s: any) => s.id === configForm.subjectId);
          if (selectedSub && classEnrollments.some((e: any) => e.subjectName === selectedSub.name || e.subjectId === selectedSub.id)) {
            oneCount++;
          }
        } else {
          oneCount++;
        }
      }

      if (configForm.selectedSubjectIds.length > 0) {
        const matchesAll = configForm.selectedSubjectIds.every((sId) => {
          const subObj = selectedConfigCourse?.subjects?.find((s: any) => s.id === sId);
          return classEnrollments.some((e: any) => e.subjectId === sId || (subObj && e.subjectName === subObj.name));
        });
        if (matchesAll) customMatches++;
      }
    }

    const tierCount =
      configForm.subjectTier === 'ALL'
        ? allCount
        : configForm.subjectTier === 'TWO_SUBJECTS'
        ? twoCount
        : configForm.subjectTier === 'SINGLE_SUBJECT'
        ? oneCount
        : customMatches;

    return {
      allSubjectsCount: allCount,
      twoSubjectsCount: twoCount,
      oneSubjectCount: oneCount,
      customCount: customMatches,
      selectedTierStudentsCount: tierCount,
    };
  }, [configForm.classId, configForm.batchId, configForm.subjectId, configForm.subjectTier, configForm.selectedSubjectIds, studentAccounts, totalClassSubjectsCount, selectedConfigCourse]);

  const selectedCourseStudentsCount = selectedTierStudentsCount;

  // Course breakdown aggregate totals for single-view ledger footer
  const totalCourses = courseBreakdown.length;
  const totalEnrolled = courseBreakdown.reduce((sum, c) => sum + (c.enrolledStudentsCount || 0), 0);
  const totalCourseInvoiced = courseBreakdown.reduce((sum, c) => sum + (c.invoiced || 0), 0);
  const totalCourseCollected = courseBreakdown.reduce((sum, c) => sum + (c.collected || 0), 0);
  const totalCourseOutstanding = courseBreakdown.reduce((sum, c) => sum + (c.outstanding || 0), 0);
  const overallCollectionRate = totalCourseInvoiced > 0 ? Math.round((totalCourseCollected / totalCourseInvoiced) * 100) : 0;

  // Calculation helpers for payment collection modal (partial & full collection)
  const selectedPaymentStudent = studentAccounts.find((s) => s.id === paymentStudentId);
  const currentSelectedInvoice = studentOpenInvoices.find((i) => i.id === selectedSingleInvoiceId) || studentOpenInvoices[0];
  const modalTargetBalance = paymentMode === 'SINGLE'
    ? (currentSelectedInvoice?.balanceAmount || 0)
    : studentOpenInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
  const appliedPaymentDiscount = Math.max(0, Number(paymentDiscount) || 0);
  const modalNetPayable = Math.max(0, modalTargetBalance - appliedPaymentDiscount);
  const modalRemainingBalance = Math.max(0, modalNetPayable - (Number(paymentAmount) || 0));
  const isPartialPayment = Number(paymentAmount) > 0 && Number(paymentAmount) < modalNetPayable;
  const isFullPayment = Number(paymentAmount) >= modalNetPayable && modalNetPayable > 0;
  const isExcessPayment = Number(paymentAmount) > modalNetPayable && modalNetPayable > 0;

  // Filter available subjects dynamically from the courses
  const availableSubjectsForFilter: { id: string; name: string }[] = useMemo(() => {
    if (filterCourseId) {
      const course = availableCourses.find((c) => c.id === filterCourseId);
      return (course?.subjects || []) as { id: string; name: string }[];
    }
    const subjectMap = new Map<string, { id: string; name: string }>();
    availableCourses.forEach((c) => {
      (c.subjects || []).forEach((s: any) => {
        if (s && s.id && !subjectMap.has(s.id)) {
          subjectMap.set(s.id, { id: s.id, name: s.name });
        }
      });
    });
    return Array.from(subjectMap.values());
  }, [filterCourseId, availableCourses]);

  // Client-side instant filter on student accounts
  const filteredStudentAccounts = useMemo(() => {
    return studentAccounts.filter((account) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = account.name.toLowerCase().includes(q);
        const matchesCode = account.studentCode.toLowerCase().includes(q);
        const matchesAdm = account.admissionNumber?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesAdm) return false;
      }

      if (filterCourseId) {
        const selectedCourse = availableCourses.find((c) => c.id === filterCourseId);
        const hasCourse = account.enrolledCourses.some(
          (c: any) =>
            c.courseId === filterCourseId ||
            (selectedCourse && c.courseName?.toLowerCase() === selectedCourse.name?.toLowerCase()),
        );
        if (!hasCourse) return false;
      }

      if (filterSubjectId) {
        const selectedSubject = availableSubjectsForFilter.find((s) => s.id === filterSubjectId);
        const hasSubject = account.enrolledCourses.some(
          (c: any) =>
            c.subjectId === filterSubjectId ||
            (selectedSubject && c.subjectName?.toLowerCase() === selectedSubject.name?.toLowerCase()),
        );
        if (!hasSubject) return false;
      }

      if (filterStatus) {
        if (account.overallStatus !== filterStatus) return false;
      }

      return true;
    });
  }, [
    studentAccounts,
    searchQuery,
    filterCourseId,
    filterSubjectId,
    filterStatus,
    availableCourses,
    availableSubjectsForFilter,
  ]);

  const handleCopyReference = (refText: string, paymentId: string) => {
    if (!refText) return;
    navigator.clipboard.writeText(refText);
    setCopiedRefId(paymentId);
    setTimeout(() => setCopiedRefId(null), 2500);
  };

  return (
    <>
      <Header
        title="Fee Management & Student Billing"
        subtitle="Course-based tuition configuration, multi-course student accounts, explicit split collections, and faculty revenue sharing"
      />

      <ResponsivePageContainer>
        {/* Alerts & Notifications */}
        {errorMsg && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-sm font-semibold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <span className="text-sm font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Control Bar: Compact Single-Row Navigation & Actions */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-4 bg-white p-2 rounded-2xl border border-neutral-200/90 shadow-card">
          {/* Compact Segmented Tabs (Zero Horizontal Scrolling) */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-neutral-100/80 rounded-xl no-scrollbar scrollbar-none">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'accounts', label: 'Student Accounts', icon: GraduationCap },
              { id: 'configs', label: 'Fee Rules', icon: BookOpen },
              { id: 'invoices', label: 'Invoices', icon: FileText },
              { id: 'payments', label: 'Receipts', icon: Receipt },
              { id: 'revenue_salary', label: 'Faculty 70/30', icon: Building2 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-black shadow-2xs font-bold'
                      : 'text-neutral-600 hover:text-black hover:bg-white/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#FF8500]' : 'text-neutral-500'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
            <button
              onClick={reloadAll}
              disabled={loading}
              title="Refresh ledger data"
              className="p-2 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-600 rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleOpenCreateConfig}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 hover:border-[#FF8500]/50 hover:bg-[#FFF4E5]/50 text-neutral-700 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF8500]" />
              <span className="hidden sm:inline">Configure Fee</span>
              <span className="sm:hidden">Fee</span>
            </button>

            <button
              onClick={() => {
                if (studentAccounts.length > 0) {
                  handleOpenPaymentModalForStudent(studentAccounts[0].id);
                } else {
                  setShowPaymentModal(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-semibold rounded-xl transition shadow-subtle cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Collect Payment</span>
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* TAB 1: OVERVIEW & REAL FINANCE DASHBOARD (SINGLE VIEW) */}
        {/* ==================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Unified Executive KPI Metric Ribbon (Single Row, Height ~72px) */}
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-card p-3 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-neutral-100 gap-y-3 md:gap-y-0">
              {/* Metric 1: Total Invoiced */}
              <div className="px-3 sm:px-4 py-1 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-wider text-neutral-500">
                    Total Invoiced
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-neutral-900 mt-0.5">
                    ₹{(dashboardKpis?.totalInvoiced || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {dashboardKpis?.totalInvoicesCount || 0} course obligations
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              </div>

              {/* Metric 2: Cash Collected */}
              <div className="px-3 sm:px-4 py-1 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-wider text-neutral-500">
                    Cash Collected
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 mt-0.5">
                    ₹{(dashboardKpis?.totalCollected || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {dashboardKpis?.totalPaymentsCount || 0} processed payments
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              {/* Metric 3: Outstanding Receivables */}
              <div className="px-3 sm:px-4 py-1 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-wider text-neutral-500">
                    Outstanding Balance
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-[#CC6B00] mt-0.5">
                    ₹{(dashboardKpis?.outstandingReceivables || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    Pending student tuition
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#FFF4E5] text-[#CC6B00] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              {/* Metric 4: Overdue Tuition */}
              <div className="px-3 sm:px-4 py-1 flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-bold tracking-wider text-neutral-500">
                    Overdue Tuition
                  </div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-rose-600 mt-0.5">
                    ₹{(dashboardKpis?.overdueAmount || 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {dashboardKpis?.overdueInvoicesCount || 0} past due date
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Course-Wise Collection & Outstanding Breakdown (Single-View Table with Fixed Header & Totals Footer) */}
            <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-card overflow-hidden flex flex-col">
              {/* Header Bar */}
              <div className="px-4 py-2.5 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-2 bg-neutral-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#FFF4E5] text-[#FF8500] flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                      Course-Wise Collections & Outstanding Breakdown
                    </h3>
                    <p className="text-[11px] text-neutral-500 leading-tight">
                      Real-time academic standard breakdown & collection performance
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                    {totalCourses} Courses
                  </span>
                  {totalCourses > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Portfolio Rate: {overallCollectionRate}%
                    </span>
                  )}
                </div>
              </div>

              {/* High-Density Compact Table Container */}
              <div className="overflow-x-auto max-h-[calc(100vh-340px)] min-h-[160px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-neutral-50 shadow-[0_1px_0_0_#e5e5e5]">
                    <tr className="text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-2.5 px-3.5">Course / Standard</th>
                      <th className="py-2.5 px-3 text-center">Enrolled</th>
                      <th className="py-2.5 px-3.5 text-right">Invoiced (₹)</th>
                      <th className="py-2.5 px-3.5 text-right">Collected (₹)</th>
                      <th className="py-2.5 px-3.5 text-right">Outstanding (₹)</th>
                      <th className="py-2.5 px-3.5 w-40 text-center">Collection Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {courseBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-neutral-400">
                          No course financial records available yet.
                        </td>
                      </tr>
                    ) : (
                      courseBreakdown.map((c) => (
                        <tr key={c.courseId} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-2 px-3.5">
                            <div className="font-bold text-neutral-900 text-xs sm:text-sm">{c.courseName}</div>
                            <div className="text-[10px] text-neutral-400 font-mono">{c.courseCode}</div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 text-[11px] font-semibold">
                              {c.enrolledStudentsCount}
                            </span>
                          </td>
                          <td className="py-2 px-3.5 text-right font-mono font-medium text-xs">
                            ₹{c.invoiced.toLocaleString()}
                          </td>
                          <td className="py-2 px-3.5 text-right font-mono font-bold text-xs text-emerald-600">
                            ₹{c.collected.toLocaleString()}
                          </td>
                          <td className="py-2 px-3.5 text-right font-mono font-bold text-xs text-[#CC6B00]">
                            ₹{c.outstanding.toLocaleString()}
                          </td>
                          <td className="py-2 px-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    c.collectionRate >= 80
                                      ? 'bg-emerald-500'
                                      : c.collectionRate >= 50
                                      ? 'bg-[#FF8500]'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, c.collectionRate)}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] font-bold w-9 text-right">
                                {c.collectionRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* Summary / Aggregate Totals Row */}
                  {courseBreakdown.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10 bg-neutral-100/95 font-semibold text-neutral-900 border-t-2 border-neutral-300 shadow-[0_-1px_0_0_#d4d4d4]">
                      <tr>
                        <td className="py-2.5 px-3.5 font-bold uppercase text-[11px] tracking-wider text-neutral-700">
                          Total Portfolio ({totalCourses} Courses)
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-neutral-900">
                          {totalEnrolled}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-neutral-900">
                          ₹{totalCourseInvoiced.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700">
                          ₹{totalCourseCollected.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-[#CC6B00]">
                          ₹{totalCourseOutstanding.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-neutral-200 text-neutral-900">
                            {overallCollectionRate}% Total
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Sleek Integrated Reconciliation Status Strip */}
              <div className="px-4 py-2 bg-neutral-50/80 border-t border-neutral-100 flex flex-wrap items-center justify-between text-[11px] text-neutral-600 gap-2">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 font-semibold text-neutral-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Reconciliation:</span>
                  </span>
                  <span>
                    Refunds/Reversals: <strong className="font-mono text-rose-600">₹{(dashboardKpis?.totalReversals || 0).toLocaleString()}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Approved Adjustments: <strong className="font-mono text-[#CC6B00]">₹{(dashboardKpis?.totalDiscounts || 0).toLocaleString()}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Exceptions: <strong className="font-mono text-neutral-800">{dashboardKpis?.pendingExceptionsCount || 0}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('accounts')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#CC6B00] hover:text-[#995000] hover:underline cursor-pointer"
                  >
                    <span>View Student Accounts</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <span>•</span>
                  <button
                    onClick={() => setActiveTab('configs')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-600 hover:text-black hover:underline cursor-pointer"
                  >
                    <span>Manage Rules</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: MULTI-COURSE STUDENT ACCOUNTS */}
        {/* ==================================================================== */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-card flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by student name, code (e.g. RCA-2026-001) or admission #..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                  />
                </div>

                {/* Class / Course Filter */}
                <select
                  value={filterCourseId}
                  onChange={(e) => {
                    setFilterCourseId(e.target.value);
                    setFilterSubjectId('');
                  }}
                  className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                  title="Filter by Class / Course"
                >
                  <option value="">All Classes / Courses</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Subject-Wise Filter */}
                <select
                  value={filterSubjectId}
                  onChange={(e) => setFilterSubjectId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                  title="Filter by Enrolled Subject"
                >
                  <option value="">All Subjects</option>
                  {availableSubjectsForFilter.map((s: { id: string; name: string }) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {/* Monthly Payment Cycle Filter */}
                <select
                  value={filterBillingCycle}
                  onChange={(e) => setFilterBillingCycle(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                  title="Filter by Payment / Billing Cycle"
                >
                  <option value="">All Monthly Payment Cycles</option>
                  <option value="October 2026">October 2026</option>
                  <option value="November 2026">November 2026</option>
                  <option value="December 2026">December 2026</option>
                  <option value="January 2027">January 2027</option>
                  <option value="February 2027">February 2027</option>
                  <option value="March 2027">March 2027</option>
                  <option value="ANNUAL">Annual Tuition</option>
                  <option value="MONTHLY">Monthly Tuition</option>
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs text-black font-medium focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                >
                  <option value="">All Statuses</option>
                  <option value="PAID">Fully Paid</option>
                  <option value="PARTIAL">Partially Paid</option>
                  <option value="UNPAID">Unpaid</option>
                  <option value="OVERDUE">Overdue</option>
                </select>

                {/* Reset Filters Button */}
                {(searchQuery || filterCourseId || filterSubjectId || filterBillingCycle || filterStatus) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterCourseId('');
                      setFilterSubjectId('');
                      setFilterBillingCycle('');
                      setFilterStatus('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 text-xs font-semibold transition cursor-pointer"
                    title="Clear all active filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              <div className="text-xs text-neutral-500 self-end lg:self-auto font-medium whitespace-nowrap">
                <span className="font-bold text-black">{filteredStudentAccounts.length}</span> of {studentAccounts.length} Students
              </div>
            </div>

            {/* Student Accounts Table */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Student Identity</th>
                      <th className="py-3 px-4">Enrolled Courses</th>
                      <th className="py-3 px-4 text-right">Consolidated Billed</th>
                      <th className="py-3 px-4 text-right">Paid So Far</th>
                      <th className="py-3 px-4 text-right">Outstanding Balance</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {filteredStudentAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-neutral-400">
                          No student accounts found matching filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStudentAccounts.map((account) => (
                        <tr key={account.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-black text-sm">{account.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-[11px] text-[#CC6B00] font-semibold">
                                {account.studentCode}
                              </span>
                              <span className="text-[11px] text-neutral-400 font-mono">
                                • {account.admissionNumber}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {account.enrolledCourses.length === 0 ? (
                                <span className="text-neutral-400 italic">No active enrollments</span>
                              ) : (
                                account.enrolledCourses.map((ec, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#FFF4E5] text-[#995000] border border-[#FFD199]"
                                  >
                                    {ec.courseName}
                                    {ec.subjectName ? ` (${ec.subjectName})` : ''}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-medium">
                            ₹{account.consolidatedBilled.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-green-700">
                            ₹{account.consolidatedPaid.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#CC6B00]">
                            ₹{account.consolidatedBalance.toLocaleString()}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <Badge
                              variant={
                                account.overallStatus === 'PAID'
                                  ? 'success'
                                  : account.overallStatus === 'OVERDUE'
                                  ? 'error'
                                  : account.overallStatus === 'PARTIAL'
                                  ? 'warning'
                                  : 'neutral'
                              }
                            >
                              {account.overallStatus}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenStudentDetail(account.id)}
                              >
                                <Eye className="w-3.5 h-3.5 text-neutral-600" />
                                Inspect
                              </Button>

                              {account.consolidatedBalance > 0 && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleOpenPaymentModalForStudent(account.id)}
                                >
                                  Collect
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: COURSE FEE CONFIGURATION */}
        {/* ==================================================================== */}
        {activeTab === 'configs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-black">Course Fee Configurations</h3>
                <p className="text-xs text-neutral-500">
                  Standard tuition prices, installment rules, and effective billing periods for courses and offerings
                </p>
              </div>
              <Button size="sm" variant="primary" onClick={handleOpenCreateConfig}>
                <Plus className="w-3.5 h-3.5" />
                New Course Fee Rule
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Configuration Name</th>
                      <th className="py-3 px-4">Course / Standard</th>
                      <th className="py-3 px-4">Offering Scope</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4">Billing Period</th>
                      <th className="py-3 px-4 text-center">Installments</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {courseConfigs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-neutral-400">
                          No course fee rules configured yet. Click "New Course Fee Rule" to add one.
                        </td>
                      </tr>
                    ) : (
                      courseConfigs.map((cfg) => (
                        <tr key={cfg.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-black text-sm">
                            {cfg.name}
                            {cfg.description && (
                              <div className="text-[11px] font-normal text-neutral-400">{cfg.description}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-neutral-800">{cfg.class.name}</span>
                            <span className="text-neutral-400 font-mono text-[11px]"> ({cfg.class.code})</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              {cfg.batch ? (
                                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium text-xs">
                                  Batch: {cfg.batch.name}
                                </span>
                              ) : (
                                <span className="text-neutral-400 text-xs">All Batches</span>
                              )}
                              {(() => {
                                const tierConfig = (cfg.allowedDiscounts as any[])?.find(
                                  (d: any) =>
                                    d &&
                                    (d.tier ||
                                      d.type === 'TWO_SUBJECTS_BUNDLE' ||
                                      d.type === 'SINGLE_SUBJECT' ||
                                      d.type === 'ALL_SUBJECTS_BUNDLE'),
                                );
                                const tier =
                                  tierConfig?.tier ||
                                  (cfg.subject
                                    ? 'SINGLE_SUBJECT'
                                    : cfg.name?.toLowerCase().includes('2 subject') || cfg.name?.toLowerCase().includes('2 course')
                                    ? 'TWO_SUBJECTS'
                                    : cfg.name?.toLowerCase().includes('1 subject') || cfg.name?.toLowerCase().includes('1 course')
                                    ? 'SINGLE_SUBJECT'
                                    : 'ALL');

                                if (tier === 'TWO_SUBJECTS') {
                                  return (
                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold text-xs border border-amber-200 flex items-center gap-1">
                                      <span>✌️ 2 Subjects Package</span>
                                    </span>
                                  );
                                }
                                if (tier === 'SINGLE_SUBJECT' || cfg.subject) {
                                  return (
                                    <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold text-xs border border-purple-200 flex items-center gap-1">
                                      <span>🎯 Single Subject{cfg.subject ? `: ${cfg.subject.name}` : ''}</span>
                                    </span>
                                  );
                                }
                                return (
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-xs border border-emerald-200 flex items-center gap-1">
                                    <span>🌟 All Subjects Package</span>
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono">
                            <div className="font-bold text-base text-black">
                              ₹{cfg.amount.toLocaleString()}
                            </div>
                            {(() => {
                              const bundleDiscount = (cfg.allowedDiscounts as any[])?.find(
                                (d: any) => d.type === 'ALL_SUBJECTS_BUNDLE' || d.name?.includes('Discount') || Number(d.amount) > 0,
                              );
                              if (bundleDiscount?.amount) {
                                const net = Math.max(0, cfg.amount - Number(bundleDiscount.amount));
                                return (
                                  <div className="text-[11px] text-emerald-600 font-semibold">
                                    -₹{Number(bundleDiscount.amount).toLocaleString()} disc → ₹{net.toLocaleString()} net
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-neutral-700">
                            {cfg.billingPeriod}
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium">
                            {cfg.installmentCount} Part{cfg.installmentCount > 1 ? 's' : ''}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={cfg.isActive ? 'success' : 'neutral'}>
                              {cfg.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={replicatingConfigId === cfg.id}
                                onClick={() => handleReplicateFeeConfig(cfg.id, cfg.name)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-[#FF8500]/30 text-[#CC6B00] bg-[#FFF4E5] hover:bg-[#FFE8CC] transition cursor-pointer disabled:opacity-50"
                                title="Replicate fee rule to generate invoices for all enrolled students in this course/batch"
                              >
                                {replicatingConfigId === cfg.id ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Replicating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Users className="w-3.5 h-3.5 text-[#FF8500]" />
                                    <span>Replicate to Students</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEditConfig(cfg)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-neutral-200 text-neutral-700 hover:text-[#FF8500] hover:border-[#FF8500] hover:bg-[#FFF4E5]/40 transition cursor-pointer"
                                title="Edit fee rule"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#FF8500]" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteFeeConfig(cfg.id, cfg.name)}
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title={`Delete fee rule ${cfg.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: INVOICES & OBLIGATIONS */}
        {/* ==================================================================== */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-black">Course Fee Invoices</h3>
                <p className="text-xs text-neutral-500">
                  Individual enrollment billing records, balance tracking, and authorized scholarship adjustments
                </p>
              </div>
              {invoicesList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllInvoices}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition cursor-pointer"
                  title="Clear all generated fee invoices"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Invoices</span>
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Course / Offering</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4 text-right">Invoiced (₹)</th>
                      <th className="py-3 px-4 text-right">Paid (₹)</th>
                      <th className="py-3 px-4 text-right">Balance (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {invoicesList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-neutral-400">
                          No invoices generated yet.
                        </td>
                      </tr>
                    ) : (
                      invoicesList.map((inv) => (
                        <tr key={inv.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-black">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-black">
                              {inv.student.firstName} {inv.student.lastName}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono">
                              {inv.student.studentCode}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-neutral-900">
                              {inv.class?.name || 'Course Standard'}
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              {inv.batch?.name || ''} {inv.subject ? `• ${inv.subject.name}` : ''}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-neutral-600">
                            {new Date(inv.dueDate).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium">
                            ₹{inv.totalAmount.toLocaleString()}
                            {inv.discountAmount > 0 && (
                              <div className="text-[10px] text-green-700">
                                -₹{inv.discountAmount.toLocaleString()} disc
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-green-700">
                            ₹{inv.paidAmount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#CC6B00]">
                            ₹{inv.balanceAmount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge
                              variant={
                                inv.status === 'PAID'
                                  ? 'success'
                                  : inv.status === 'PARTIAL'
                                  ? 'warning'
                                  : 'error'
                              }
                            >
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {inv.balanceAmount > 0 && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleOpenPaymentModalForStudent(inv.student.id, inv.id)}
                                >
                                  Collect
                                </Button>
                              )}
                              {inv.paidAmount === 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSingleInvoice(inv.id, inv.invoiceNumber)}
                                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title={`Delete invoice ${inv.invoiceNumber}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: COLLECTIONS & RECEIPTS */}
        {/* ==================================================================== */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-black">Payment Collections & Receipts</h3>
                <p className="text-xs text-neutral-500">
                  Transaction-safe payments, multi-course split allocations, and official receipts
                </p>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  if (studentAccounts.length > 0) {
                    handleOpenPaymentModalForStudent(studentAccounts[0].id);
                  } else {
                    setShowPaymentModal(true);
                  }
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Record Collection
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Receipt #</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4">Method & Ref</th>
                      <th className="py-3 px-4">Allocated Courses</th>
                      <th className="py-3 px-4">Recorded By</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {paymentsList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-neutral-400">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      paymentsList.map((pay) => (
                        <tr key={pay.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-black">
                            {pay.receiptNumber}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-neutral-600">
                            {new Date(pay.paidAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-black">
                              {pay.student.firstName} {pay.student.lastName}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono">
                              {pay.student.studentCode}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-base text-black">
                            ₹{pay.amount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold">{pay.paymentMethod}</span>
                            {pay.reference && (
                              <div className="text-[11px] text-neutral-400 font-mono truncate max-w-xs">
                                Ref: {pay.reference}
                              </div>
                            )}
                            {pay.notes && (
                              <div className="text-[10px] text-[#CC6B00] font-semibold truncate max-w-xs mt-0.5">
                                {pay.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="space-y-0.5">
                              {pay.allocations.map((a) => (
                                <div key={a.id} className="text-[11px] font-mono text-neutral-600 flex justify-between gap-2">
                                  <span className="truncate">{a.invoice?.class?.name || a.invoice?.invoiceNumber}:</span>
                                  <strong className="text-black">₹{a.allocatedAmount.toLocaleString()}</strong>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-neutral-600">
                            {pay.recordedBy?.firstName} {pay.recordedBy?.lastName}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={pay.status === 'COMPLETED' ? 'success' : 'neutral'}>
                              {pay.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {pay.proofObjectKey || pay.proofFileName ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleOpenProofDocument(pay.id, {
                                      receiptNumber: pay.receiptNumber,
                                      fileName: pay.proofFileName || 'Payment Proof Document',
                                      fileSize: pay.proofFileSize || undefined,
                                      mimeType: pay.proofMimeType || undefined,
                                    })
                                  }
                                  className="text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                                  title="View verified proof document stored in private AWS S3"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                  Proof
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleOpenAttachProof({
                                      id: pay.id,
                                      receiptNumber: pay.receiptNumber,
                                      studentName: `${pay.student.firstName} ${pay.student.lastName}`,
                                      amount: pay.amount,
                                    })
                                  }
                                  className="text-neutral-500 hover:text-neutral-700"
                                  title="Upload and attach payment proof slip to AWS S3"
                                >
                                  <Upload className="w-3.5 h-3.5" />
                                  Attach
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewReceipt(pay.id)}
                              >
                                <Printer className="w-3.5 h-3.5 text-neutral-600" />
                                Receipt
                              </Button>

                              {pay.status === 'COMPLETED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setReversalTarget(pay);
                                    setReversalReason('');
                                    setShowReversalModal(true);
                                  }}
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: FACULTY 70/30 REVENUE SHARING */}
        {/* ==================================================================== */}
        {activeTab === 'revenue_salary' && (
          <div className="space-y-6">
            {/* Dual Staff Model & Finance Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-card">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Eligible Collections
                </span>
                <div className="text-xl font-bold font-mono text-black mt-1.5">
                  ₹{(revenueMetrics?.totalCollectedFees || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">From student fee payments</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-card">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Faculty Pool (70%)
                </span>
                <div className="text-xl font-bold font-mono text-[#CC6B00] mt-1.5">
                  ₹{(revenueMetrics?.facultyCompensationAccrued ?? revenueMetrics?.staffCompensationAccrued ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">Paid: ₹{(revenueMetrics?.facultyPaid || 0).toLocaleString()}</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-card">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Faculty Payable
                </span>
                <div className="text-xl font-bold font-mono text-blue-700 mt-1.5">
                  ₹{(revenueMetrics?.outstandingFacultyPayable ?? revenueMetrics?.outstandingStaffPayable ?? 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">Pending 70% disbursements</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-card">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Fixed Salary Payable
                </span>
                <div className="text-xl font-bold font-mono text-purple-700 mt-1.5">
                  ₹{(revenueMetrics?.outstandingFixedPayable || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">Accrued: ₹{(revenueMetrics?.fixedSalaryAccrued || 0).toLocaleString()}</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-card">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Academy Share (30%)
                </span>
                <div className="text-xl font-bold font-mono text-emerald-700 mt-1.5">
                  ₹{(revenueMetrics?.academyShareAccrued || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">Gross share (before expenses)</div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-card">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Reversals & Refunds
                </span>
                <div className="text-xl font-bold font-mono text-rose-600 mt-1.5">
                  ₹{(revenueMetrics?.totalRefunds || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">{revenueMetrics?.unallocatedCollectionsCount || 0} unallocated items</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-black">Dual Staff Compensation & Revenue Ledger</h4>
                <p className="text-xs text-neutral-500">
                  Unified auditable records for Faculty Revenue Sharing (70%) and General Staff Fixed Salary Accruals
                </p>
              </div>
              <Button size="sm" variant="primary" onClick={() => setShowPayoutModal(true)}>
                Disburse Payout
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Model</th>
                      <th className="py-3 px-4">Course / Offering</th>
                      <th className="py-3 px-4">Subject / Period</th>
                      <th className="py-3 px-4">Reference / Receipt</th>
                      <th className="py-3 px-4 text-right">Collected / Incurred (₹)</th>
                      <th className="py-3 px-4 text-right">Staff Earnings (₹)</th>
                      <th className="py-3 px-4 text-right">Academy 30% (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {salaryLedgers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-neutral-400">
                          No compensation revenue entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      salaryLedgers.map((l) => (
                        <tr key={l.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-black">
                            {l.user?.firstName} {l.user?.lastName}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              l.compensationModel === 'FIXED_SALARY'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {l.compensationModel === 'FIXED_SALARY' ? 'Fixed Salary' : 'Faculty 70%'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-neutral-800">
                            {l.class?.name || (l.compensationModel === 'FIXED_SALARY' ? 'Fixed Staff Accrual' : 'General Offering')}
                          </td>
                          <td className="py-3.5 px-4 text-neutral-600">
                            {l.subject?.name || (l.payPeriod ? `Period: ${l.payPeriod}` : '—')}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-neutral-700">
                            {l.receiptNumber || l.ruleApplied || 'ACCRUAL'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium">
                            {l.compensationModel === 'FIXED_SALARY'
                              ? '—'
                              : `₹${Number(l.collectedAmount).toLocaleString()}`}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#CC6B00]">
                            ₹{Number(l.earnedAmount || l.staffPoolAmount).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                            {l.compensationModel === 'FIXED_SALARY'
                              ? '—'
                              : `₹${Number(l.academyShareAmount || 0).toLocaleString()}`}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={l.status === 'ACCRUED' ? 'warning' : l.status === 'CANCELLED' ? 'error' : 'success'}>
                              {l.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 1: STUDENT CONSOLIDATED ACCOUNT DRILLDOWN */}
        {/* ==================================================================== */}
        <Modal
          isOpen={!!selectedStudentDetail}
          onClose={() => setSelectedStudentDetail(null)}
          title={`Student Consolidated Account: ${selectedStudentDetail?.student.name || ''}`}
          description={`Student Code: ${selectedStudentDetail?.student.studentCode || ''} • Admission: ${selectedStudentDetail?.student.admissionNumber || ''}`}
          maxWidth="5xl"
        >
          {selectedStudentDetail && (
            <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
              {/* Consolidated Metrics Bar */}
              <div className="bg-[#FFF4E5] border border-[#FFD199] p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <span className="text-[11px] text-neutral-500 font-semibold uppercase">Enrolled Courses</span>
                  <div className="text-lg font-bold text-black">
                    {selectedStudentDetail.consolidatedAccount.totalCoursesEnrolled}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500 font-semibold uppercase">Total Invoiced</span>
                  <div className="text-lg font-bold font-mono text-black">
                    ₹{selectedStudentDetail.consolidatedAccount.consolidatedTotalBilled.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500 font-semibold uppercase">Total Paid</span>
                  <div className="text-lg font-bold font-mono text-green-700">
                    ₹{selectedStudentDetail.consolidatedAccount.consolidatedPaid.toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-neutral-500 font-semibold uppercase">Consolidated Balance</span>
                  <div className="text-lg font-bold font-mono text-[#CC6B00]">
                    ₹{selectedStudentDetail.consolidatedAccount.consolidatedBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Sub-Tabs: Payment History vs Course Obligations */}
              <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
                <button
                  type="button"
                  onClick={() => setStudentModalTab('payments')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    studentModalTab === 'payments'
                      ? 'bg-[#FF8500] text-white shadow-sm'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Payment History & Proofs</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      studentModalTab === 'payments' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {selectedStudentDetail.payments?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStudentModalTab('courses')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    studentModalTab === 'courses'
                      ? 'bg-[#FF8500] text-white shadow-sm'
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Course Invoices & Obligations</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      studentModalTab === 'courses' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {selectedStudentDetail.courseFees.length}
                  </span>
                </button>
              </div>

              {/* TAB 1: FULL PAYMENT HISTORY & PROOFS */}
              {studentModalTab === 'payments' && (
                <div className="space-y-3">
                  {!selectedStudentDetail.payments || selectedStudentDetail.payments.length === 0 ? (
                    <div className="p-8 text-center text-neutral-400 bg-neutral-50 rounded-xl border border-neutral-200">
                      <Receipt className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="font-semibold text-neutral-600">No payment records found for this student yet.</p>
                      <p className="text-xs text-neutral-400 mt-1">
                        Payments recorded via &apos;Collect Payment&apos; will display here with full receipt, transaction UTR, and uploaded verification proof.
                      </p>
                    </div>
                  ) : (
                    selectedStudentDetail.payments.map((p) => (
                      <div
                        key={p.id}
                        className="bg-white p-4 rounded-xl border border-neutral-200 shadow-subtle hover:border-[#FF8500]/40 transition space-y-3"
                      >
                        {/* Payment Card Header */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => handleViewReceipt(p.id)}
                              className="font-mono font-bold text-xs text-[#CC6B00] hover:text-[#995000] bg-[#FFF4E5] px-2.5 py-1 rounded-lg border border-[#FFD199] hover:underline flex items-center gap-1.5 transition cursor-pointer"
                              title="Click to view and print official receipt"
                            >
                              <Receipt className="w-3.5 h-3.5 text-[#FF8500]" />
                              <span>{p.receiptNumber}</span>
                            </button>

                            <span className="text-neutral-300 text-xs">•</span>

                            <div className="flex items-center gap-1 text-xs text-neutral-500 font-mono">
                              <Clock className="w-3.5 h-3.5 text-neutral-400" />
                              <span>{new Date(p.paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            </div>

                            {p.cycle && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                <Calendar className="w-3 h-3 text-blue-500" />
                                {p.cycle}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className="text-sm font-bold font-mono text-emerald-700">
                              ₹{p.amount.toLocaleString()}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                p.paymentMethod === 'UPI'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : p.paymentMethod === 'CASH'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {p.paymentMethod === 'UPI' && <Smartphone className="w-3 h-3 text-purple-600" />}
                              {p.paymentMethod === 'CASH' && <Banknote className="w-3 h-3 text-emerald-600" />}
                              {p.paymentMethod}
                            </span>

                            <Badge variant={p.status === 'COMPLETED' ? 'success' : 'error'}>
                              {p.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Transaction Reference & Proof Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Box 1: Transaction Number / Reference with 1-Click Copy */}
                          <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-1">
                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                              Transaction Number / UTR Reference
                            </span>
                            {p.reference ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold text-neutral-800 break-all select-all">
                                  {p.reference}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyReference(p.reference || '', p.id)}
                                  className="shrink-0 p-1.5 rounded hover:bg-neutral-200 text-neutral-500 hover:text-black transition cursor-pointer"
                                  title="Copy transaction number / reference"
                                >
                                  {copiedRefId === p.id ? (
                                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-0.5">
                                      <Check className="w-3 h-3 text-green-600" /> Copied!
                                    </span>
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-neutral-400 italic">No reference / UTR provided (Direct Collection)</span>
                            )}
                          </div>

                          {/* Box 2: Payment Proof Attachment */}
                          <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                                Payment Proof Document
                              </span>
                              {p.hasRealProof && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                  <Shield className="w-3 h-3 text-blue-600" /> S3 Encrypted
                                </span>
                              )}
                            </div>
                            {p.proofName ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Paperclip className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                                  <span className="font-medium text-neutral-800 truncate text-xs" title={p.proofName}>
                                    {p.proofName}
                                  </span>
                                  {p.proofSize && (
                                    <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                                      ({p.proofSize})
                                    </span>
                                  )}
                                </div>
                                {p.hasRealProof || p.proofObjectKey ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenProofDocument(p.id, {
                                        receiptNumber: p.receiptNumber,
                                        fileName: p.proofName || p.proofFileName || 'Payment Proof Document',
                                        fileSize: p.proofSize || undefined,
                                        mimeType: p.proofMimeType || undefined,
                                      })
                                    }
                                    disabled={loadingProofUrl === p.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#FF8500] hover:bg-[#e07500] text-white shadow-2xs transition cursor-pointer shrink-0 disabled:opacity-50"
                                    title="Open secure verified proof file from AWS S3"
                                  >
                                    {loadingProofUrl === p.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <ExternalLink className="w-3 h-3" />
                                    )}
                                    <span>View Proof</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                                      Legacy Note
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenAttachProof({
                                          id: p.id,
                                          receiptNumber: p.receiptNumber,
                                          studentName: selectedStudentDetail.student.name,
                                          amount: p.amount,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-300 transition cursor-pointer"
                                      title="Upload and encrypt proof file in AWS S3"
                                    >
                                      <Upload className="w-3 h-3" />
                                      <span>Upload Proof</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-neutral-400 italic text-xs">No proof file attached</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenAttachProof({
                                      id: p.id,
                                      receiptNumber: p.receiptNumber,
                                      studentName: selectedStudentDetail.student.name,
                                      amount: p.amount,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-300 transition cursor-pointer shrink-0"
                                  title="Attach proof file to S3"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>Attach Proof</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Staff & Allocations Row */}
                        <div className="pt-2 border-t border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-neutral-500">
                          <div>
                            Recorded by: <span className="font-semibold text-neutral-700">{p.recordedBy}</span>
                          </div>

                          {p.allocations && p.allocations.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-neutral-400">Allocated to:</span>
                              {p.allocations.map((alloc) => (
                                <span
                                  key={alloc.allocationId}
                                  className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-[10px] border border-neutral-200"
                                >
                                  {alloc.courseName || 'Course'}{alloc.subjectName ? ` (${alloc.subjectName})` : ''}: <strong>₹{alloc.allocatedAmount.toLocaleString()}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: COURSE OBLIGATIONS & INVOICES */}
              {studentModalTab === 'courses' && (
                <div className="space-y-4">
                  {selectedStudentDetail.courseFees.length === 0 ? (
                    <div className="p-6 text-center text-neutral-400 bg-neutral-50 rounded-xl border border-neutral-200">
                      No course invoices generated for this student yet.
                    </div>
                  ) : (
                    selectedStudentDetail.courseFees.map((course) => (
                      <div
                        key={course.invoiceId}
                        className="bg-white p-4 rounded-xl border border-neutral-200 shadow-subtle space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                          <div>
                            <div className="font-bold text-black text-sm flex items-center gap-2">
                              <span>{course.courseName}</span>
                              {course.subjectName && (
                                <Badge variant="neutral" className="text-[10px]">
                                  {course.subjectName}
                                </Badge>
                              )}
                              <span className="text-xs text-neutral-400 font-mono">({course.batchName})</span>
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                              Invoice: {course.invoiceNumber} • Period: {course.billingPeriod} • Due: {course.dueDate}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Badge
                              variant={
                                course.status === 'PAID'
                                  ? 'success'
                                  : course.status === 'PARTIAL'
                                  ? 'warning'
                                  : 'error'
                              }
                            >
                              {course.status}
                            </Badge>

                            {course.balanceAmount > 0 && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  handleOpenPaymentModalForStudent(
                                    selectedStudentDetail.student.id,
                                    course.invoiceId,
                                  );
                                }}
                              >
                                Pay This Course
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Course financial row */}
                        <div className="grid grid-cols-3 gap-2 text-xs bg-neutral-50 p-2.5 rounded-lg font-mono">
                          <div>
                            <span className="text-neutral-500 text-[10px] uppercase block">Course Fee</span>
                            <strong className="text-black">₹{course.totalAmount.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500 text-[10px] uppercase block">Paid So Far</span>
                            <strong className="text-green-700">₹{course.paidAmount.toLocaleString()}</strong>
                          </div>
                          <div>
                            <span className="text-neutral-500 text-[10px] uppercase block">Outstanding</span>
                            <strong className="text-[#CC6B00]">₹{course.balanceAmount.toLocaleString()}</strong>
                          </div>
                        </div>

                        {/* Course Allocations History */}
                        {course.allocations.length > 0 && (
                          <div className="mt-2 text-xs">
                            <span className="text-[11px] font-semibold text-neutral-600 block mb-1">
                              Recorded Collections:
                            </span>
                            <div className="space-y-1">
                              {course.allocations.map((alloc) => (
                                <div
                                  key={alloc.allocationId}
                                  className="flex items-center justify-between py-1 px-2 rounded bg-neutral-50 border border-neutral-100 text-[11px]"
                                >
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleViewReceipt(alloc.paymentId)}
                                      className="font-mono font-bold text-[#CC6B00] hover:underline"
                                    >
                                      {alloc.receiptNumber}
                                    </button>
                                    <span className="text-neutral-500 font-mono">
                                      • {new Date(alloc.paymentDate).toLocaleDateString()}
                                    </span>
                                    <span className="text-neutral-400">({alloc.paymentMethod})</span>
                                  </div>
                                  <strong className="font-mono text-black">
                                    ₹{alloc.allocatedAmount.toLocaleString()}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-neutral-100">
                <Button variant="outline" onClick={() => setSelectedStudentDetail(null)}>
                  Close
                </Button>

                {selectedStudentDetail.consolidatedAccount.consolidatedBalance > 0 && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      handleOpenPaymentModalForStudent(selectedStudentDetail.student.id);
                    }}
                  >
                    <CreditCard className="w-4 h-4" />
                    Record Multi-Course Payment (₹{selectedStudentDetail.consolidatedAccount.consolidatedBalance.toLocaleString()})
                  </Button>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* ==================================================================== */}
        {/* MODAL 2: RECORD PAYMENT (MONTHLY COLLECTION & PARTIAL PAYMENT) */}
        {/* ==================================================================== */}
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title="Record Fee Collection"
          description="Collect tuition via Cash, UPI, or Cash+UPI with live settlement and verified proof upload"
          maxWidth="5xl"
        >
          <form onSubmit={handleSubmitPayment} className="space-y-3">
            {/* Top Compact Strip: Student Profile & Billing Cycle */}
            <div className="bg-gradient-to-r from-orange-50/70 via-neutral-50 to-neutral-50 p-2.5 rounded-xl border border-neutral-200 flex flex-wrap items-center justify-between gap-2">
              {selectedPaymentStudent ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center text-[#FF8500] font-bold text-xs shrink-0 shadow-2xs">
                    {selectedPaymentStudent.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-neutral-900 truncate">
                      {selectedPaymentStudent.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-neutral-700 border border-neutral-200 font-semibold">
                      {selectedPaymentStudent.studentCode}
                    </span>
                    {selectedPaymentStudent.admissionNumber && (
                      <span className="text-[10px] font-mono text-neutral-500">
                        Adm: #{selectedPaymentStudent.admissionNumber}
                      </span>
                    )}
                    <span className="text-neutral-300">•</span>
                    <span className="text-[11px] text-neutral-500">
                      Total Due:{' '}
                      <strong className="text-amber-700 font-mono">
                        ₹{selectedPaymentStudent.consolidatedBalance.toLocaleString()}
                      </strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-64">
                  <select
                    value={paymentStudentId}
                    onChange={(e) => handleOpenPaymentModalForStudent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  >
                    <option value="">-- Choose Student --</option>
                    {studentAccounts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.studentCode}) • Balance: ₹{s.consolidatedBalance.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Cycle:</span>
                  <select
                    value={collectionMonth}
                    onChange={(e) => setCollectionMonth(e.target.value)}
                    className="px-2 py-1 bg-white border border-neutral-300 rounded-md text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  >
                    <option value="October 2026">October 2026 (Current)</option>
                    <option value="November 2026">November 2026</option>
                    <option value="December 2026">December 2026</option>
                    <option value="January 2027">January 2027</option>
                    <option value="September 2026">September 2026</option>
                    <option value="Annual / Lump-Sum">Annual / Lump-Sum</option>
                  </select>
                </div>

                {selectedPaymentStudent && studentAccounts.length > 1 && (
                  <select
                    value={paymentStudentId}
                    onChange={(e) => handleOpenPaymentModalForStudent(e.target.value)}
                    className="px-2 py-1 bg-white border border-neutral-300 rounded-md text-[11px] font-semibold text-neutral-700 focus:outline-none focus:ring-1 focus:ring-[#FF8500] cursor-pointer"
                  >
                    {studentAccounts.map((s) => (
                      <option key={s.id} value={s.id}>
                        Switch: {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Course Switcher Tabs if student has multiple enrolled courses */}
            {studentOpenInvoices.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider shrink-0">Target Course:</span>
                {studentOpenInvoices.map((inv) => {
                  const isSel = (currentSelectedInvoice?.id === inv.id);
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        setSelectedSingleInvoiceId(inv.id);
                        setPaymentAmount(inv.balanceAmount);
                        const half = Math.round(inv.balanceAmount / 2);
                        setSplitCashAmount(half);
                        setSplitUpiAmount(inv.balanceAmount - half);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-left border transition-all text-xs shrink-0 cursor-pointer ${
                        isSel
                          ? 'bg-orange-50 border-[#FF8500] text-black font-bold shadow-2xs'
                          : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-700'
                      }`}
                    >
                      <span>{inv.class?.name}</span>
                      <span className="ml-1 text-[10px] font-mono text-neutral-500 font-normal">
                        (Due: ₹{inv.balanceAmount.toLocaleString()})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* MAIN SIDE-BY-SIDE 2-COLUMN VIEW (NO SCROLL NEEDED) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* LEFT COLUMN (5 cols on lg): Course Overview, Proof Upload, Remarks */}
              <div className="lg:col-span-5 space-y-2.5">
                {/* Course Details Card */}
                {currentSelectedInvoice && (
                  <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
                    <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 text-[#FF8500] shrink-0" />
                        <span className="font-bold text-xs text-neutral-900 truncate">
                          {currentSelectedInvoice.class?.name || 'Class Course'}
                        </span>
                        {currentSelectedInvoice.batch?.name && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            {currentSelectedInvoice.batch.name}
                          </span>
                        )}
                        {currentSelectedInvoice.subject?.name && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            {currentSelectedInvoice.subject.name}
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                        currentSelectedInvoice.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {currentSelectedInvoice.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 divide-x divide-neutral-100 text-center text-xs py-2 bg-white">
                      <div>
                        <span className="text-[9px] text-neutral-400 block uppercase">Total</span>
                        <span className="font-mono font-bold text-neutral-800 text-xs">
                          ₹{currentSelectedInvoice.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block uppercase">Disc</span>
                        <span className="font-mono font-bold text-neutral-600 text-xs">
                          ₹{currentSelectedInvoice.discountAmount.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-400 block uppercase">Paid</span>
                        <span className="font-mono font-bold text-emerald-700 text-xs">
                          ₹{currentSelectedInvoice.paidAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-amber-50/60">
                        <span className="text-[9px] text-amber-800 block uppercase font-bold">Balance</span>
                        <span className="font-mono font-extrabold text-amber-700 text-xs">
                          ₹{currentSelectedInvoice.balanceAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Proof of Payment Upload Widget (Required & Compressed <= 150KB) */}
                <div className={`p-3 rounded-xl border transition-all ${
                  paymentProofFile
                    ? 'bg-emerald-50/60 border-emerald-300'
                    : proofError
                    ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-300'
                    : 'bg-neutral-50/80 border-dashed border-neutral-300 hover:border-neutral-400'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-[#FF8500]" />
                      Payment Proof Document <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider bg-neutral-200/60 px-1.5 py-0.2 rounded">
                      Private S3 Encrypted
                    </span>
                  </div>

                  {compressingProof ? (
                    <div className="flex items-center justify-center gap-2.5 p-4 bg-white rounded-lg border border-neutral-200 text-xs text-neutral-600">
                      <Loader2 className="w-4 h-4 animate-spin text-[#FF8500]" />
                      <span className="font-semibold">Optimizing proof image to target ≤ 150 KB...</span>
                    </div>
                  ) : paymentProofFile ? (
                    <div className="p-2.5 bg-white rounded-lg border border-emerald-200 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {paymentProofPreview ? (
                            <img
                              src={paymentProofPreview}
                              alt="Proof Preview"
                              className="w-11 h-11 rounded-md object-cover border border-neutral-200 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-md bg-emerald-100 flex flex-col items-center justify-center text-emerald-800 font-bold text-[10px] shrink-0 border border-emerald-300">
                              <FileText className="w-4 h-4 text-emerald-700 mb-0.5" />
                              PDF
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-neutral-900 truncate text-xs max-w-[170px]" title={paymentProofName}>
                                {paymentProofName}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                READY FOR S3
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono block mt-0.5">
                              {paymentProofSize}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveProof}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                          title="Remove attached proof"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Compression transparency notice */}
                      {proofCompressionInfo && (
                        <div className="pt-1.5 border-t border-neutral-100 flex items-center justify-between text-[10px] font-medium">
                          {proofCompressionInfo.isCompressed ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <Zap className="w-3 h-3 text-emerald-600" />
                              Compressed from {proofCompressionInfo.originalSize} to {proofCompressionInfo.compressedSize} ({proofCompressionInfo.ratio}% saved)
                            </span>
                          ) : (
                            <span className="text-neutral-500 flex items-center gap-1">
                              <FileText className="w-3 h-3 text-neutral-400" />
                              {proofCompressionInfo.note}
                            </span>
                          )}
                          <span className="text-neutral-400 font-mono">Max 10MB</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-neutral-300 hover:border-[#FF8500] rounded-lg cursor-pointer bg-white transition group">
                        <Upload className="w-5 h-5 text-neutral-400 group-hover:text-[#FF8500] transition mb-1" />
                        <span className="text-xs font-semibold text-neutral-700 group-hover:text-[#FF8500]">
                          Click to Upload Proof Slip / Screenshot / PDF
                        </span>
                        <span className="text-[10px] text-neutral-400 mt-0.5 text-center">
                          Auto-compressed to ≤ 150 KB for instant loading • PDFs kept crisp & uncompressed
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={handleProofChange}
                          className="hidden"
                        />
                      </label>
                      {proofError && (
                        <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-semibold mt-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{proofError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Remarks & Memo (Compact) */}
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Remarks / Transaction Memo (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. October monthly installment tuition"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs text-black focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN (7 cols on lg): Concession/Discount, Payment Mode, Amounts, Settlement & Actions */}
              <div className="lg:col-span-7 space-y-3 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
                {/* Instant Fee Concession & Discount Card */}
                <div className="bg-white p-3 rounded-xl border border-neutral-200/90 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-[#FF8500]" />
                      <span>Instant Fee Concession / Discount</span>
                    </label>
                    {appliedPaymentDiscount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        -₹{appliedPaymentDiscount.toLocaleString()} Concession
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-400 font-medium">Optional</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Discount Amount */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-neutral-700">Discount Amount (₹)</span>
                        {appliedPaymentDiscount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentDiscount('');
                              setPaymentDiscountReason('');
                              setDiscountError(null);
                              setPaymentAmount(modalTargetBalance);
                              if (paymentMethodMode === 'CASH_UPI') {
                                const half = Math.round(modalTargetBalance / 2);
                                setSplitCashAmount(half);
                                setSplitUpiAmount(modalTargetBalance - half);
                              }
                            }}
                            className="text-[10px] text-neutral-400 hover:text-rose-600 underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-xs">₹</span>
                        <input
                          type="number"
                          min="0"
                          max={modalTargetBalance}
                          placeholder="0 (Optional)"
                          value={paymentDiscount}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const val = raw === '' ? '' : Math.max(0, Number(raw));
                            setPaymentDiscount(val);
                            const disc = typeof val === 'number' ? val : 0;
                            if (disc > modalTargetBalance) {
                              setDiscountError(`Discount cannot exceed total fee (₹${modalTargetBalance.toLocaleString()})`);
                            } else {
                              setDiscountError(null);
                            }
                            const net = Math.max(0, modalTargetBalance - disc);
                            setPaymentAmount(net);
                            if (paymentMethodMode === 'CASH_UPI') {
                              const half = Math.round(net / 2);
                              setSplitCashAmount(half);
                              setSplitUpiAmount(net - half);
                            }
                          }}
                          className={`w-full pl-6 pr-2.5 py-1.5 bg-neutral-50 border rounded-lg font-mono font-bold text-xs text-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8500] ${
                            discountError ? 'border-rose-300 ring-1 ring-rose-300' : 'border-neutral-300'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Discount Reason (MANDATORY if discount > 0) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-neutral-700 flex items-center gap-1">
                          Discount Reason
                          {appliedPaymentDiscount > 0 ? (
                            <span className="text-rose-600 font-bold">*</span>
                          ) : (
                            <span className="text-neutral-400 font-normal">(if discount)</span>
                          )}
                        </span>
                        {appliedPaymentDiscount > 0 && (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                            Mandatory
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder={appliedPaymentDiscount > 0 ? 'Reason required (e.g. Sibling waiver)' : 'e.g. Scholarship, Sibling concession'}
                        value={paymentDiscountReason}
                        onChange={(e) => {
                          setPaymentDiscountReason(e.target.value);
                          if (discountError && e.target.value.trim()) {
                            setDiscountError(null);
                          }
                        }}
                        className={`w-full px-2.5 py-1.5 bg-neutral-50 border rounded-lg text-xs text-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8500] ${
                          appliedPaymentDiscount > 0 && !paymentDiscountReason.trim()
                            ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300'
                            : 'border-neutral-300'
                        }`}
                        required={appliedPaymentDiscount > 0}
                      />
                    </div>
                  </div>

                  {discountError && (
                    <div className="flex items-center gap-1 text-rose-600 text-[11px] font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{discountError}</span>
                    </div>
                  )}

                  {appliedPaymentDiscount > 0 && (
                    <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-200 text-[11px] flex items-center justify-between">
                      <span className="text-amber-900 font-medium">
                        Fee: <strong className="font-mono">₹{modalTargetBalance.toLocaleString()}</strong> − Discount: <strong className="font-mono text-amber-700">₹{appliedPaymentDiscount.toLocaleString()}</strong>
                      </span>
                      <span className="text-emerald-800 font-bold">
                        Net Amount to Pay: <strong className="font-mono text-emerald-700 text-xs">₹{modalNetPayable.toLocaleString()}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* 3 Payment Mode Buttons (ONLY Cash, UPI, Cash+UPI) */}
                <div>
                  <label className="text-xs font-bold text-neutral-800 block mb-1.5">
                    Payment Channel (Cash / UPI / Cash + UPI)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethodMode('CASH');
                        setPaymentMethod('CASH');
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethodMode === 'CASH'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-500/20'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethodMode('UPI');
                        setPaymentMethod('UPI');
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethodMode === 'UPI'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-500/20'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethodMode('CASH_UPI');
                        setPaymentMethod('UPI');
                        if (splitCashAmount === 0 && splitUpiAmount === 0 && modalNetPayable > 0) {
                          const half = Math.round(modalNetPayable / 2);
                          setSplitCashAmount(half);
                          setSplitUpiAmount(modalNetPayable - half);
                          setPaymentAmount(modalNetPayable);
                        }
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        paymentMethodMode === 'CASH_UPI'
                          ? 'bg-[#FF8500] text-white border-orange-600 shadow-xs ring-2 ring-orange-500/20'
                          : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                      }`}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>Cash + UPI</span>
                    </button>
                  </div>
                </div>

                {/* Amount Inputs for CASH, UPI, or CASH_UPI */}
                {paymentMethodMode === 'CASH_UPI' ? (
                  /* Cash + UPI Split Mode */
                  <div className="space-y-2 bg-white p-3 rounded-xl border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-[#FF8500]" />
                        <span>Split Distribution:</span>
                      </span>
                      {/* Presets for Split based on Net Payable */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const half = Math.round(modalNetPayable / 2);
                            setSplitCashAmount(half);
                            setSplitUpiAmount(modalNetPayable - half);
                            setPaymentAmount(modalNetPayable);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition cursor-pointer"
                        >
                          50/50 Equal Split
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSplitCashAmount(modalNetPayable);
                            setSplitUpiAmount(0);
                            setPaymentAmount(modalNetPayable);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition cursor-pointer"
                        >
                          All Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSplitCashAmount(0);
                            setSplitUpiAmount(modalNetPayable);
                            setPaymentAmount(modalNetPayable);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition cursor-pointer"
                        >
                          All UPI
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                          Cash Portion (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={splitCashAmount || ''}
                          onChange={(e) => {
                            const cVal = Math.max(0, Number(e.target.value));
                            setSplitCashAmount(cVal);
                            setPaymentAmount(cVal + Number(splitUpiAmount));
                          }}
                          placeholder="e.g. 1500"
                          className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono font-bold text-sm text-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                          UPI Portion (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={splitUpiAmount || ''}
                          onChange={(e) => {
                            const uVal = Math.max(0, Number(e.target.value));
                            setSplitUpiAmount(uVal);
                            setPaymentAmount(Number(splitCashAmount) + uVal);
                          }}
                          placeholder="e.g. 1500"
                          className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono font-bold text-sm text-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                        UPI Transaction Ref / UTR # <span className="text-neutral-400 font-normal">(for UPI portion)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UPI/REF/998877 or GPay Ref"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                      />
                    </div>
                  </div>
                ) : (
                  /* Standard Cash or UPI Mode */
                  <div className="space-y-2 bg-white p-3 rounded-xl border border-neutral-200">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-neutral-800">
                        {paymentMethodMode === 'CASH' ? 'Cash Collection Amount (₹)' : 'UPI Collection Amount (₹)'}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(modalNetPayable)}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition cursor-pointer"
                        >
                          Full (₹{modalNetPayable.toLocaleString()})
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentAmount(Math.round(modalNetPayable / 2))}
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer"
                        >
                          50% Partial
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-neutral-400 text-sm">₹</span>
                      <input
                        type="number"
                        min="1"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(Number(e.target.value))}
                        placeholder="Enter collection amount"
                        className="w-full pl-7 pr-3 py-1.5 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-sm text-black focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        required
                      />
                    </div>

                    {paymentMethodMode === 'UPI' && (
                      <div>
                        <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                          UPI Ref / UTR # / Transaction ID
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. UPI/998877 or PhonePe UTR"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Compact Live Settlement Strip with Discount Overview */}
                <div className={`p-2.5 rounded-xl border text-xs transition-all ${
                  isExcessPayment
                    ? 'bg-rose-50 border-rose-200 text-rose-950'
                    : isPartialPayment
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                    : isFullPayment
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-white border-neutral-200 text-neutral-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] flex items-center gap-1.5">
                      {isExcessPayment ? (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-rose-700">Amount exceeds net payable</span>
                        </>
                      ) : isPartialPayment ? (
                        <span className="text-amber-800">PARTIAL PAYMENT</span>
                      ) : isFullPayment ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="text-emerald-800">
                            {appliedPaymentDiscount > 0 ? 'SETTLED WITH CONCESSION' : 'FULL SETTLEMENT'}
                          </span>
                        </>
                      ) : (
                        <span>Settlement Summary</span>
                      )}
                    </span>
                    <span className="text-[11px] font-mono">
                      Status: <strong>{isPartialPayment ? 'PARTIAL' : isFullPayment ? 'PAID' : 'PENDING'}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mt-1.5 pt-1.5 border-t border-black/10 text-center">
                    <div className="bg-white/90 p-1 rounded-md border border-black/5">
                      <span className="text-[9px] text-neutral-500 uppercase block">Fee Due</span>
                      <span className="font-mono font-bold text-neutral-900 text-xs">
                        ₹{modalTargetBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white/90 p-1 rounded-md border border-black/5">
                      <span className="text-[9px] text-neutral-500 uppercase block">Discount</span>
                      <span className="font-mono font-bold text-amber-700 text-xs">
                        {appliedPaymentDiscount > 0 ? `-₹${appliedPaymentDiscount.toLocaleString()}` : '₹0'}
                      </span>
                    </div>
                    <div className="bg-white/90 p-1 rounded-md border border-black/5">
                      <span className="text-[9px] text-neutral-500 uppercase block">Paying Now</span>
                      <span className="font-mono font-bold text-[#CC6B00] text-xs">
                        ₹{(Number(paymentAmount) || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-white/90 p-1 rounded-md border border-black/5">
                      <span className="text-[9px] text-neutral-500 uppercase block">Remaining</span>
                      <span className={`font-mono font-bold text-xs ${modalRemainingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        ₹{modalRemainingBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
                  <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      loading ||
                      isExcessPayment ||
                      Number(paymentAmount) <= 0 ||
                      (!paymentProofFile && !paymentProofName) ||
                      (appliedPaymentDiscount > 0 && !paymentDiscountReason.trim()) ||
                      Boolean(discountError)
                    }
                  >
                    {loading
                      ? 'Processing...'
                      : appliedPaymentDiscount > 0 && !paymentDiscountReason.trim()
                      ? 'Provide Reason for Discount'
                      : (!paymentProofFile && !paymentProofName)
                      ? 'Upload Proof to Record'
                      : isPartialPayment
                      ? `Record Partial Collection (₹${(Number(paymentAmount) || 0).toLocaleString()})`
                      : `Record Settlement (₹${(Number(paymentAmount) || 0).toLocaleString()})`}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </Modal>

        {/* ==================================================================== */}
        {/* MODAL 3: CREATE COURSE FEE CONFIGURATION */}
        {/* ==================================================================== */}
        <Modal
          isOpen={showConfigModal}
          onClose={() => {
            setShowConfigModal(false);
            setEditingConfigId(null);
          }}
          title={editingConfigId ? 'Edit Course Fee Pricing Rule' : 'Configure Course Fee Pricing Rule'}
          description={
            editingConfigId
              ? 'Update tuition fee pricing parameters, bundle offer discounts, and payment schedule'
              : 'Define course tuition fee rules, package offer discounts, and pricing catalog used for student payments (does not mass-create invoices)'
          }
          maxWidth="6xl"
        >
          <form onSubmit={handleSaveConfig} className="space-y-4">
            {/* 2-Column Grid with Increased Spaciousness */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left Column: Course, Cohort & Subject Scope */}
              <div className="space-y-4 bg-neutral-50/70 p-4 rounded-xl border border-neutral-200">
                <div className="flex items-center gap-2 pb-2.5 border-b border-neutral-200">
                  <div className="w-6 h-6 rounded-md bg-[#FFF4E5] text-[#FF8500] flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                      Course & Curriculum Scope
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Select target course and configure full-package vs single-subject billing
                    </span>
                  </div>
                </div>

                {/* 1. Course / Standard Selection with Setup Detailing */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700">
                      Course / Standard <span className="text-red-500">*</span>
                    </label>
                    {selectedConfigCourse && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedConfigCourse.category === 'SKILL'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedConfigCourse.category === 'SKILL' ? 'Skill Course' : 'Academic Standard'}
                      </span>
                    )}
                  </div>
                  <select
                    value={configForm.classId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const course = availableCourses.find((c) => c.id === selectedId);
                      const periodLabel =
                        configForm.billingPeriod === 'MONTHLY'
                          ? 'Monthly Tuition'
                          : configForm.billingPeriod === 'ANNUAL'
                          ? 'Annual Tuition'
                          : `${configForm.billingPeriod} Tuition`;
                      const autoName = course ? `${course.name} All Subjects ${periodLabel}` : '';
                      setConfigForm((prev) => ({
                        ...prev,
                        classId: selectedId,
                        batchId: '',
                        subjectId: '',
                        subjectMode: 'ALL',
                        name: autoName,
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                    required
                  >
                    <option value="">-- Select Course / Standard --</option>
                    {availableCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) • {c.category === 'SKILL' ? 'Skill Course' : 'Academic Standard'} ({c.batches?.length || 0} Cohorts, {c.subjects?.length || 0} Subjects)
                      </option>
                    ))}
                  </select>

                  {/* Course Setup Detailing Card */}
                  {selectedConfigCourse && (
                    <div className="p-2.5 bg-white rounded-lg border border-neutral-200 shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                          <GraduationCap className="w-3.5 h-3.5 text-[#FF8500]" />
                          <span>{selectedConfigCourse.name}</span>
                          <span className="font-mono text-[10px] text-neutral-500 font-semibold bg-neutral-100 px-1.5 py-0.5 rounded">
                            {selectedConfigCourse.code}
                          </span>
                        </span>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {selectedConfigCourse.totalEnrolled ?? selectedCourseStudentsCount} Students in Course
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-500 pt-1.5 border-t border-neutral-100">
                        <div>
                          <span className="text-neutral-400 block">Academic Year:</span>
                          <span className="text-neutral-700 font-semibold">{selectedConfigCourse.academicYear?.name || '2026-2027'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">Curriculum Subjects:</span>
                          <span className="text-neutral-700 font-semibold">{selectedConfigCourse.subjects?.length || 0} Subjects Configured</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Specific Cohort Batch Offering with Setup Detailing */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700">
                      Cohort / Batch Offering <span className="text-neutral-400 font-normal">(Scope)</span>
                    </label>
                    {selectedConfigCourse && (
                      <span className="text-[10px] text-neutral-500 font-medium">
                        {configForm.batchId ? 'Targeted Cohort' : 'Universal Course Scope'}
                      </span>
                    )}
                  </div>
                  <select
                    value={configForm.batchId}
                    disabled={!selectedConfigCourse || !selectedConfigCourse.batches?.length}
                    onChange={(e) => {
                      const selectedBatchId = e.target.value;
                      const course = availableCourses.find((c) => c.id === configForm.classId);
                      const batch = course?.batches?.find((b: any) => b.id === selectedBatchId);
                      const sub = course?.subjects?.find((s: any) => s.id === configForm.subjectId);
                      const periodLabel =
                        configForm.billingPeriod === 'MONTHLY'
                          ? 'Monthly Tuition'
                          : configForm.billingPeriod === 'ANNUAL'
                          ? 'Annual Tuition'
                          : `${configForm.billingPeriod} Tuition`;
                      const batchPart = batch ? ` (${batch.name})` : '';
                      const subPart = sub && configForm.subjectMode === 'SINGLE' ? ` - ${sub.name}` : ' All Subjects';
                      const autoName = course
                        ? `${course.name}${batchPart}${subPart} ${periodLabel}`
                        : configForm.name;
                      setConfigForm((prev) => ({
                        ...prev,
                        batchId: selectedBatchId,
                        name: autoName,
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500] disabled:bg-neutral-100 disabled:text-neutral-400 font-medium"
                  >
                    <option value="">Apply to All Cohorts / Batches ({selectedConfigCourse?.batches?.length || 0} Batches)</option>
                    {selectedConfigCourse?.batches?.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.code ? `(${b.code})` : ''} • {b.activeEnrollments ?? 0} Enrolled Students
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Subject Curriculum Scope & Tier Selection */}
                <div className="space-y-3 pt-2 border-t border-neutral-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-neutral-800 block">
                        Enrollment Tier & Pricing Mode <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] text-neutral-500">
                        Separate fee amounts for all subjects, 2 subjects, or single subject (not mixed during replication)
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-600 uppercase px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200">
                      {configForm.subjectTier === 'ALL'
                        ? 'All Subjects Fixed'
                        : configForm.subjectTier === 'TWO_SUBJECTS'
                        ? '2-Subjects Package'
                        : configForm.subjectTier === 'SINGLE_SUBJECT'
                        ? 'Single Subject'
                        : 'Custom Bundle'}
                    </span>
                  </div>

                  {/* 3 Tier Segmented Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Card 1: All Subjects */}
                    <button
                      type="button"
                      onClick={() => {
                        const course = availableCourses.find((c) => c.id === configForm.classId);
                        const batch = course?.batches?.find((b: any) => b.id === configForm.batchId);
                        const periodLabel =
                          configForm.billingPeriod === 'MONTHLY'
                            ? 'Monthly Tuition'
                            : configForm.billingPeriod === 'ANNUAL'
                            ? 'Annual Tuition'
                            : `${configForm.billingPeriod} Tuition`;
                        const batchPart = batch ? ` (${batch.name})` : '';
                        const autoName = course ? `${course.name}${batchPart} All Subjects ${periodLabel}` : configForm.name;
                        setConfigForm((prev) => ({
                          ...prev,
                          subjectTier: 'ALL',
                          subjectMode: 'ALL',
                          subjectId: '',
                          selectedSubjectIds: [],
                          name: autoName,
                        }));
                      }}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                        configForm.subjectTier === 'ALL'
                          ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-300/40 shadow-xs'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <Layers className={`w-4 h-4 ${configForm.subjectTier === 'ALL' ? 'text-emerald-600' : 'text-neutral-400'}`} />
                            <span>All Subjects</span>
                          </span>
                          {configForm.subjectTier === 'ALL' && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <p className="text-[11px] leading-snug text-neutral-500">
                          Full course package. Standard fixed amount for all {totalClassSubjectsCount || ''} subjects.
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-neutral-200/60 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-neutral-400">Target Cohort</span>
                        <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                          {allSubjectsCount} Joined
                        </span>
                      </div>
                    </button>

                    {/* Card 2: 2 Subjects Package */}
                    <button
                      type="button"
                      disabled={!selectedConfigCourse || (totalClassSubjectsCount > 0 && totalClassSubjectsCount < 2)}
                      onClick={() => {
                        const course = availableCourses.find((c) => c.id === configForm.classId);
                        const batch = course?.batches?.find((b: any) => b.id === configForm.batchId);
                        const periodLabel =
                          configForm.billingPeriod === 'MONTHLY'
                            ? 'Monthly Tuition'
                            : configForm.billingPeriod === 'ANNUAL'
                            ? 'Annual Tuition'
                            : `${configForm.billingPeriod} Tuition`;
                        const batchPart = batch ? ` (${batch.name})` : '';
                        const autoName = course ? `${course.name}${batchPart} 2 Subjects Package ${periodLabel}` : configForm.name;
                        setConfigForm((prev) => ({
                          ...prev,
                          subjectTier: 'TWO_SUBJECTS',
                          subjectMode: 'SELECT',
                          subjectId: '',
                          selectedSubjectIds: prev.selectedSubjectIds.length === 2 ? prev.selectedSubjectIds : [],
                          name: autoName,
                        }));
                      }}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        configForm.subjectTier === 'TWO_SUBJECTS'
                          ? 'bg-amber-50/90 border-amber-500 text-amber-950 ring-2 ring-amber-300/40 shadow-xs'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <Zap className={`w-4 h-4 ${configForm.subjectTier === 'TWO_SUBJECTS' ? 'text-amber-600' : 'text-neutral-400'}`} />
                            <span>2 Subjects Bundle</span>
                          </span>
                          {configForm.subjectTier === 'TWO_SUBJECTS' && (
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                          )}
                        </div>
                        <p className="text-[11px] leading-snug text-neutral-500">
                          Separate fixed fee for students who joined 2 subjects. Replicates only to them.
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-neutral-200/60 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-neutral-400">Target Cohort</span>
                        <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                          {twoSubjectsCount} Joined
                        </span>
                      </div>
                    </button>

                    {/* Card 3: Single Subject (1 Subject) */}
                    <button
                      type="button"
                      disabled={!selectedConfigCourse || !selectedConfigCourse.subjects?.length}
                      onClick={() => {
                        const course = availableCourses.find((c) => c.id === configForm.classId);
                        const firstSub = course?.subjects?.[0];
                        const batch = course?.batches?.find((b: any) => b.id === configForm.batchId);
                        const periodLabel =
                          configForm.billingPeriod === 'MONTHLY'
                            ? 'Monthly Tuition'
                            : configForm.billingPeriod === 'ANNUAL'
                            ? 'Annual Tuition'
                            : `${configForm.billingPeriod} Tuition`;
                        const batchPart = batch ? ` (${batch.name})` : '';
                        const subPart = firstSub ? ` - ${firstSub.name}` : ' Single Subject';
                        const autoName = course ? `${course.name}${batchPart}${subPart} ${periodLabel}` : configForm.name;
                        setConfigForm((prev) => ({
                          ...prev,
                          subjectTier: 'SINGLE_SUBJECT',
                          subjectMode: 'SELECT',
                          subjectId: firstSub?.id || '',
                          selectedSubjectIds: firstSub ? [firstSub.id] : [],
                          name: autoName,
                        }));
                      }}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        configForm.subjectTier === 'SINGLE_SUBJECT'
                          ? 'bg-purple-50/90 border-purple-500 text-purple-950 ring-2 ring-purple-300/40 shadow-xs'
                          : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1.5 font-bold text-xs">
                            <BookOpen className={`w-4 h-4 ${configForm.subjectTier === 'SINGLE_SUBJECT' ? 'text-purple-600' : 'text-neutral-400'}`} />
                            <span>Single Subject (1)</span>
                          </span>
                          {configForm.subjectTier === 'SINGLE_SUBJECT' && (
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                          )}
                        </div>
                        <p className="text-[11px] leading-snug text-neutral-500">
                          Separate fee for students who joined only 1 subject. Will not mix with other tiers.
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-neutral-200/60 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-neutral-400">Target Cohort</span>
                        <span className="text-xs font-mono font-bold text-purple-800 bg-purple-100/80 px-2 py-0.5 rounded">
                          {oneSubjectCount} Joined
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Detailed Panel based on Tier */}
                  {configForm.subjectTier === 'ALL' && (
                    <div className="p-3 bg-white rounded-lg border border-emerald-200/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>All Standard Subjects Included in Full Fee</span>
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {totalClassSubjectsCount || 'Core'} Subjects
                        </span>
                      </div>
                      {selectedConfigCourse?.subjects && selectedConfigCourse.subjects.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {selectedConfigCourse.subjects.map((s: any) => (
                            <span
                              key={s.id}
                              className="px-2 py-0.5 bg-neutral-100 hover:bg-neutral-200 rounded text-[10px] font-semibold text-neutral-700 flex items-center gap-1 border border-neutral-200"
                            >
                              <BookOpen className="w-3 h-3 text-neutral-500" />
                              {s.name} {s.code ? `(${s.code})` : ''}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {configForm.subjectTier === 'TWO_SUBJECTS' && (
                    <div className="space-y-3 p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/90 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-amber-950 block">
                            2-Subjects Bundle Scope <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[11px] text-amber-800/80">
                            Configure whether this price applies to any 2 subjects or specific subjects
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          {configForm.selectedSubjectIds.length === 2 ? 'Pair-Specific' : 'Any 2 Subjects'}
                        </span>
                      </div>

                      {/* Mode Switcher: Any 2 Subjects vs Specific Pair */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const course = availableCourses.find((c) => c.id === configForm.classId);
                            const batch = course?.batches?.find((b: any) => b.id === configForm.batchId);
                            const periodLabel =
                              configForm.billingPeriod === 'MONTHLY'
                                ? 'Monthly Tuition'
                                : configForm.billingPeriod === 'ANNUAL'
                                ? 'Annual Tuition'
                                : `${configForm.billingPeriod} Tuition`;
                            const batchPart = batch ? ` (${batch.name})` : '';
                            const autoName = course ? `${course.name}${batchPart} 2 Subjects Package ${periodLabel}` : configForm.name;
                            setConfigForm((prev) => ({
                              ...prev,
                              selectedSubjectIds: [],
                              name: autoName,
                            }));
                          }}
                          className={`p-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            configForm.selectedSubjectIds.length !== 2
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-amber-50'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Any 2 Subjects ({twoSubjectsCount} Students)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (selectedConfigCourse?.subjects && selectedConfigCourse.subjects.length >= 2) {
                              const pair = [selectedConfigCourse.subjects[0].id, selectedConfigCourse.subjects[1].id];
                              const course = availableCourses.find((c) => c.id === configForm.classId);
                              const batch = course?.batches?.find((b: any) => b.id === configForm.batchId);
                              const subNames = course?.subjects
                                ?.filter((sub: any) => pair.includes(sub.id))
                                .map((sub: any) => sub.name)
                                .join(', ');
                              const periodLabel =
                                configForm.billingPeriod === 'MONTHLY'
                                  ? 'Monthly Tuition'
                                  : configForm.billingPeriod === 'ANNUAL'
                                  ? 'Annual Tuition'
                                  : `${configForm.billingPeriod} Tuition`;
                              const batchPart = batch ? ` (${batch.name})` : '';
                              const autoName = course ? `${course.name}${batchPart} - ${subNames} ${periodLabel}` : configForm.name;
                              setConfigForm((prev) => ({
                                ...prev,
                                selectedSubjectIds: pair,
                                name: autoName,
                              }));
                            }
                          }}
                          className={`p-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            configForm.selectedSubjectIds.length === 2
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white text-neutral-700 border-neutral-300 hover:bg-amber-50'
                          }`}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Choose Specific 2 Subjects</span>
                        </button>
                      </div>

                      {/* Subject Selection Pills if Specific Pair is chosen */}
                      {configForm.selectedSubjectIds.length === 2 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                            Pick the 2 subjects for this bundle:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {selectedConfigCourse?.subjects?.map((s: any) => {
                              const isSelected = configForm.selectedSubjectIds.includes(s.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    const current = [...configForm.selectedSubjectIds];
                                    let updated: string[];
                                    if (isSelected) {
                                      updated = current.filter((id) => id !== s.id);
                                    } else {
                                      updated = current.length >= 2 ? [current[1], s.id] : [...current, s.id];
                                    }
                                    const course = availableCourses.find((c) => c.id === configForm.classId);
                                    const batch = course?.batches?.find((b: any) => b.id === configForm.batchId);
                                    const periodLabel =
                                      configForm.billingPeriod === 'MONTHLY'
                                        ? 'Monthly Tuition'
                                        : configForm.billingPeriod === 'ANNUAL'
                                        ? 'Annual Tuition'
                                        : `${configForm.billingPeriod} Tuition`;
                                    const batchPart = batch ? ` (${batch.name})` : '';
                                    const subNames = course?.subjects
                                      ?.filter((sub: any) => updated.includes(sub.id))
                                      .map((sub: any) => sub.name)
                                      .join(', ');
                                    const subPart = subNames ? ` - ${subNames}` : ' 2 Subjects Package';
                                    const autoName = course ? `${course.name}${batchPart}${subPart} ${periodLabel}` : configForm.name;

                                    setConfigForm((prev) => ({
                                      ...prev,
                                      selectedSubjectIds: updated,
                                      name: autoName,
                                    }));
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-amber-50'
                                  }`}
                                >
                                  <BookOpen className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-neutral-400'}`} />
                                  <span>{s.name}</span>
                                  {isSelected && <span className="font-bold text-xs ml-0.5">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tier Isolation Notice */}
                      <div className="p-2.5 bg-white rounded-lg border border-amber-300/80 text-[11px] text-amber-950 flex items-start gap-2 shadow-2xs">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold">
                            {configForm.selectedSubjectIds.length === 2
                              ? `Applies only to students taking this exact 2-subject combination.`
                              : `Applies automatically to any student enrolled in 2 subjects (${twoSubjectsCount} students).`}
                          </strong>
                          <span className="text-neutral-500 block mt-0.5">
                            🚫 <strong>Not applicable to all-subject students</strong>: Students enrolled in all {totalClassSubjectsCount || 3} subjects ({allSubjectsCount} students) or 1 subject ({oneSubjectCount} students) will <strong>never</strong> be charged this price.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {configForm.subjectTier === 'SINGLE_SUBJECT' && (
                    <div className="space-y-2.5 p-3 bg-white rounded-lg border border-purple-200 shadow-2xs">
                      <div>
                        <label className="text-xs font-bold text-purple-950 block">
                          Single Subject Selection <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[11px] text-neutral-500">
                          Choose the specific subject for this rule, or apply to any 1-subject enrollment
                        </span>
                      </div>

                      <select
                        value={configForm.subjectId}
                        onChange={(e) => {
                          const subId = e.target.value;
                          const course = availableCourses.find((c) => c.id === configForm.classId);
                          const batch = course?.batches?.find((b: any) => b.id === configForm.batchId);
                          const sub = course?.subjects?.find((s: any) => s.id === subId);
                          const periodLabel =
                            configForm.billingPeriod === 'MONTHLY'
                              ? 'Monthly Tuition'
                              : configForm.billingPeriod === 'ANNUAL'
                              ? 'Annual Tuition'
                              : `${configForm.billingPeriod} Tuition`;
                          const batchPart = batch ? ` (${batch.name})` : '';
                          const subPart = sub ? ` - ${sub.name}` : ' Single Subject';
                          const autoName = course ? `${course.name}${batchPart}${subPart} ${periodLabel}` : configForm.name;
                          setConfigForm((prev) => ({
                            ...prev,
                            subjectId: subId,
                            selectedSubjectIds: subId ? [subId] : [],
                            name: autoName,
                          }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Apply to Any Single Subject ({oneSubjectCount} Students)</option>
                        {selectedConfigCourse?.subjects?.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name} {s.code ? `(${s.code})` : ''}
                          </option>
                        ))}
                      </select>

                      <div className="p-2 bg-purple-50/70 rounded border border-purple-200 text-[11px] text-purple-900 leading-relaxed">
                        Students taking 2 subjects or all subjects are <strong>strictly excluded</strong> from this rule.
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto-Assigned Rule Name Indicator */}
                {configForm.classId && (
                  <div className="p-2.5 bg-neutral-100/80 rounded-lg text-xs text-neutral-600 flex items-center justify-between border border-neutral-200">
                    <span className="text-[11px] font-semibold text-neutral-500">Auto Rule Title:</span>
                    <span className="text-xs font-bold text-neutral-900 font-mono">
                      {configForm.name || 'Tuition Fee Rule'}
                    </span>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">
                    Description & Inclusions (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Includes study materials, laboratory fees, and term exams"
                    value={configForm.description}
                    onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs text-black"
                  />
                </div>
              </div>

              {/* Right Column: Pricing, Package Discounts & Terms */}
              <div className="space-y-4 bg-neutral-50/70 p-4 rounded-xl border border-neutral-200">
                <div className="flex items-center gap-2 pb-2.5 border-b border-neutral-200">
                  <div className="w-6 h-6 rounded-md bg-[#FFF4E5] text-[#FF8500] flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider block">
                      Pricing & Package Offer Discounts
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      Set standard base amount, apply package offer discount, and verify net fixed payable fee
                    </span>
                  </div>
                </div>

                {/* Base Fee Amount (₹) */}
                <div>
                  <label className="text-xs font-semibold text-neutral-700 block mb-1">
                    {configForm.subjectMode === 'ALL'
                      ? 'Base Course Tuition Fee (₹ / Billing Period)'
                      : 'Base Fee for Selected Subject(s) (₹ / Billing Period)'}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={configForm.amount}
                      onChange={(e) => setConfigForm({ ...configForm, amount: Number(e.target.value) })}
                      className="w-full pl-8 pr-3 py-2.5 bg-white border border-neutral-300 rounded-lg font-mono font-bold text-base text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                      required
                    />
                  </div>
                </div>

                {/* Package Offer Discount Amount (Active for BOTH All Subjects & Select Subject) */}
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-300/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-amber-600" />
                      <label className="text-xs font-bold text-amber-950">
                        {configForm.subjectMode === 'ALL'
                          ? 'All-Subjects Combo Offer / Discount (₹)'
                          : 'Selected Subjects Package Offer / Discount (₹)'}
                      </label>
                    </div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                      Offer Applied
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Apply a package offer discount to reduce the payable tuition. The student will pay the fixed net amount instead of paying per subject.
                  </p>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-700">
                      -₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={configForm.amount}
                      value={configForm.discountAmount}
                      onChange={(e) =>
                        setConfigForm({
                          ...configForm,
                          discountAmount: Math.min(Number(configForm.amount) || 0, Math.max(0, Number(e.target.value))),
                        })
                      }
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-amber-300 rounded-lg font-mono font-bold text-sm text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-amber-900 block">
                      Quick Discount Shortcuts:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfigForm((prev) => ({ ...prev, discountAmount: 0 }))}
                        className={`px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                          configForm.discountAmount === 0
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                        }`}
                      >
                        No Discount
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfigForm((prev) => ({ ...prev, discountAmount: 500 }))}
                        className="px-2 py-1 rounded text-[11px] font-bold bg-white text-neutral-700 border border-neutral-300 hover:bg-amber-100 cursor-pointer"
                      >
                        ₹500 OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfigForm((prev) => ({ ...prev, discountAmount: 1000 }))}
                        className="px-2 py-1 rounded text-[11px] font-bold bg-white text-neutral-700 border border-neutral-300 hover:bg-amber-100 cursor-pointer"
                      >
                        ₹1,000 OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const disc = Math.round((Number(configForm.amount) || 0) * 0.1);
                          setConfigForm((prev) => ({ ...prev, discountAmount: disc }));
                        }}
                        className="px-2 py-1 rounded text-[11px] font-bold bg-white text-neutral-700 border border-neutral-300 hover:bg-amber-100 cursor-pointer"
                      >
                        10% OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const disc = Math.round((Number(configForm.amount) || 0) * 0.15);
                          setConfigForm((prev) => ({ ...prev, discountAmount: disc }));
                        }}
                        className="px-2 py-1 rounded text-[11px] font-bold bg-white text-neutral-700 border border-neutral-300 hover:bg-amber-100 cursor-pointer"
                      >
                        15% OFF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const disc = Math.round((Number(configForm.amount) || 0) * 0.2);
                          setConfigForm((prev) => ({ ...prev, discountAmount: disc }));
                        }}
                        className="px-2 py-1 rounded text-[11px] font-bold bg-white text-neutral-700 border border-neutral-300 hover:bg-amber-100 cursor-pointer"
                      >
                        20% OFF
                      </button>
                    </div>
                  </div>

                  {/* Live Price Reduction Card */}
                  <div className="p-3 bg-white rounded-lg border border-amber-200/90 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <span>Standard Base Fee:</span>
                      <span className="font-mono font-semibold">₹{(Number(configForm.amount) || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold">
                      <span>Applied Package Offer Discount:</span>
                      <span className="font-mono">-₹{(Number(configForm.discountAmount) || 0).toLocaleString()}</span>
                    </div>
                    <div className="pt-1.5 border-t border-neutral-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900">
                        Fixed Net Payable Fee (Admin Config):
                      </span>
                      <span className="font-mono font-extrabold text-base text-emerald-700">
                        ₹{Math.max(0, (Number(configForm.amount) || 0) - (Number(configForm.discountAmount) || 0)).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Students enrolled in the selected course/subjects will pay a single fixed amount of ₹{Math.max(0, (Number(configForm.amount) || 0) - (Number(configForm.discountAmount) || 0)).toLocaleString()} per {configForm.billingPeriod.toLowerCase()}. No separate per-subject fee is charged.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Billing Period & Installments */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">
                      Billing Period <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={configForm.billingPeriod}
                      onChange={(e) => {
                        const newPeriod = e.target.value;
                        const course = availableCourses.find((c) => c.id === configForm.classId);
                        const batch = course?.batches?.find((b: any) => b.id === configForm.batchId);
                        const sub = course?.subjects?.find((s: any) => s.id === configForm.subjectId);
                        let updatedName = configForm.name;
                        if (course) {
                          const periodLabel =
                            newPeriod === 'MONTHLY'
                              ? 'Monthly Tuition'
                              : newPeriod === 'ANNUAL'
                              ? 'Annual Tuition'
                              : `${newPeriod} Tuition`;
                          const batchPart = batch ? ` (${batch.name})` : '';
                          const subPart = sub && configForm.subjectMode === 'SINGLE' ? ` - ${sub.name}` : ' All Subjects';
                          updatedName = `${course.name}${batchPart}${subPart} ${periodLabel}`;
                        }
                        setConfigForm((prev) => ({
                          ...prev,
                          billingPeriod: newPeriod,
                          name: updatedName,
                        }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="ANNUAL">Annual (Full Year)</option>
                      <option value="TERM_1">Term 1 (Semester 1)</option>
                      <option value="TERM_2">Term 2 (Semester 2)</option>
                      <option value="ONE_TIME">One Time (Admission / Registration)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">
                      Installments
                    </label>
                    <select
                      value={configForm.installmentCount}
                      onChange={(e) => setConfigForm({ ...configForm, installmentCount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs text-black"
                    >
                      <option value={1}>1 (Full Payment)</option>
                      <option value={2}>2 Installments (50% / 50%)</option>
                      <option value={3}>3 Installments</option>
                      <option value={4}>4 Quarterly Installments</option>
                    </select>
                  </div>
                </div>

                {/* Active / Inactive Status */}
                {editingConfigId ? (
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-neutral-200">
                    <div>
                      <span className="text-xs font-semibold text-neutral-800 block">Rule Status</span>
                      <span className="text-[11px] text-neutral-500">
                        {configForm.isActive ? 'Active and applied for tuition billing' : 'Inactive / archived'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfigForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                        configForm.isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                      }`}
                    >
                      {configForm.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50/50 rounded-lg border border-emerald-200 flex items-center justify-between text-xs text-emerald-800">
                    <span className="font-semibold">Initial Status: Active</span>
                    <span className="text-[11px] text-emerald-600">Applied automatically</span>
                  </div>
                )}
              </div>
            </div>

            {/* Fee Replication to Enrolled Students Section */}
            <div className="p-4 bg-gradient-to-r from-orange-50/90 to-amber-50/90 rounded-xl border border-orange-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FF8500] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">
                      Fee Replication & Student Invoicing
                    </h4>
                    <p className="text-[11px] text-neutral-600">
                      Synchronize this course fee structure directly to enrolled students
                    </p>
                  </div>
                </div>

                {configForm.classId ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-orange-200 shadow-sm text-xs font-bold text-neutral-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{selectedCourseStudentsCount} Active Eligible Student(s)</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-neutral-500 bg-neutral-100">
                    Select a course to preview students
                  </div>
                )}
              </div>

              <div className="p-3 bg-neutral-100 rounded-xl border border-neutral-200">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={configForm.replicateToStudents}
                    onChange={(e) => setConfigForm((prev) => ({ ...prev, replicateToStudents: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded text-[#FF8500] focus:ring-[#FF8500] border-neutral-300 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-neutral-800 block">
                      Mass-generate invoices for {selectedTierStudentsCount} qualifying {configForm.subjectTier === 'TWO_SUBJECTS' ? '2-subject' : configForm.subjectTier === 'SINGLE_SUBJECT' ? '1-subject' : 'all-subjects'} enrolled students now
                    </span>
                    <span className="text-[11px] text-neutral-500 block mt-0.5 leading-relaxed">
                      Strict tier separation: Students joined for {configForm.subjectTier === 'TWO_SUBJECTS' ? '1 subject or all subjects' : configForm.subjectTier === 'SINGLE_SUBJECT' ? '2 subjects or all subjects' : '1 or 2 subjects'} will <strong>NOT</strong> be billed by this rule.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
              <div className="flex items-center gap-3">
                {editingConfigId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFeeConfig(editingConfigId, configForm.name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition cursor-pointer"
                    title="Delete this fee rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Rule</span>
                  </button>
                )}
                <span className="text-[11px] text-neutral-500">
                  {configForm.replicateToStudents && configForm.classId && selectedCourseStudentsCount > 0
                    ? `Will create invoices for up to ${selectedCourseStudentsCount} student(s)`
                    : 'Fee rule will be saved to pricing rules catalog'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowConfigModal(false);
                    setEditingConfigId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading
                    ? 'Saving...'
                    : editingConfigId
                    ? configForm.replicateToStudents
                      ? 'Update & Replicate Fee'
                      : 'Save Rule Changes'
                    : configForm.replicateToStudents && selectedCourseStudentsCount > 0
                    ? `Save & Invoice ${selectedCourseStudentsCount} Students`
                    : 'Save Fee Rule'}
                </Button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ==================================================================== */}
        {/* MODAL 4: PRINTABLE OFFICIAL RECEIPT */}
        {/* ==================================================================== */}
        <Modal
          isOpen={!!selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          title={`Official Fee Receipt: ${selectedReceipt?.receiptNumber || ''}`}
          maxWidth="lg"
        >
          {selectedReceipt && (() => {
            const receiptAllocations = selectedReceipt.allocations || [];
            const receiptRemainingDue = receiptAllocations.reduce((acc, a) => acc + (Number(a.invoiceRemainingBalance) || 0), 0);
            const isReceiptPartial = receiptRemainingDue > 0;

            return (
              <div className="space-y-4 text-xs font-sans">
                {/* Receipt Header */}
                <div className="text-center pb-3 border-b border-neutral-200">
                  <h2 className="text-base font-bold text-black tracking-tight">{selectedReceipt.academy.name}</h2>
                  <p className="text-[11px] text-neutral-500">{selectedReceipt.academy.tagline}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{selectedReceipt.academy.address} • {selectedReceipt.academy.contact}</p>

                  <div className="flex items-center justify-center gap-2 mt-2">
                    {isReceiptPartial ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        PARTIAL PAYMENT RECEIPT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        FULL SETTLEMENT RECEIPT
                      </span>
                    )}
                  </div>
                </div>

                {/* Student & Receipt Meta */}
                <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">Student Name</span>
                    <strong className="text-black text-sm">{selectedReceipt.student.name}</strong>
                    <div className="text-[11px] font-mono text-neutral-600 mt-0.5">
                      Code: {selectedReceipt.student.studentCode} • Adm: {selectedReceipt.student.admissionNumber}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 block">Receipt Number</span>
                    <strong className="font-mono text-sm text-[#CC6B00]">{selectedReceipt.receiptNumber}</strong>
                    <div className="text-[11px] font-mono text-neutral-600 mt-0.5">
                      Date: {new Date(selectedReceipt.paymentDate).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Explicit Course Allocations */}
                <div>
                  <span className="text-xs font-bold text-black uppercase tracking-wider block mb-1.5">
                    Course Fee Allocations Breakdown:
                  </span>
                  <table className="w-full text-left border-collapse text-xs border border-neutral-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-neutral-100 text-neutral-600 font-semibold text-[11px]">
                        <th className="py-2 px-3">Invoice #</th>
                        <th className="py-2 px-3">Course / Subject</th>
                        <th className="py-2 px-3 text-right">Allocated (₹)</th>
                        <th className="py-2 px-3 text-right">Remaining Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {selectedReceipt.allocations.map((a, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono font-bold text-neutral-800">{a.invoiceNumber}</td>
                          <td className="py-2 px-3 font-medium text-black">
                            {a.courseName} {a.subjectName ? `(${a.subjectName})` : ''}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-green-700">
                            ₹{a.allocatedAmount.toLocaleString()}
                          </td>
                          <td className={`py-2 px-3 text-right font-mono ${a.invoiceRemainingBalance > 0 ? 'text-amber-700 font-bold' : 'text-neutral-500'}`}>
                            ₹{a.invoiceRemainingBalance.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-neutral-50 font-bold border-t border-neutral-200">
                        <td colSpan={2} className="py-2 px-3 text-black">Total Paid in this Collection:</td>
                        <td className="py-2 px-3 text-right font-mono text-sm text-green-700">
                          ₹{selectedReceipt.payment.amount.toLocaleString()}
                        </td>
                        <td className={`py-2 px-3 text-right font-mono text-sm ${receiptRemainingDue > 0 ? 'text-amber-700' : 'text-neutral-500'}`}>
                          ₹{receiptRemainingDue.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {isReceiptPartial && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 flex items-center justify-between">
                    <span>Outstanding Remaining Balance: <strong className="font-mono text-amber-800 font-bold">₹{receiptRemainingDue.toLocaleString()}</strong></span>
                    <span className="text-[11px] font-semibold text-amber-800">Due for upcoming monthly cycle</span>
                  </div>
                )}

                {/* Payment Details */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                  <div>
                    <span className="text-neutral-500">Method: </span>
                    <strong>{selectedReceipt.payment.paymentMethod}</strong>
                    {selectedReceipt.payment.reference && (
                      <span className="text-neutral-400 font-mono ml-2">({selectedReceipt.payment.reference})</span>
                    )}
                    {selectedReceipt.payment.notes && (
                      <div className="text-[11px] text-[#CC6B00] font-semibold mt-0.5">
                        Collection Cycle: {selectedReceipt.payment.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-500">Cashier: </span>
                    <strong>{selectedReceipt.payment.recordedBy}</strong>
                  </div>
                </div>

                {/* Proof Document Attachment */}
                {(selectedReceipt.payment.hasProofAttachment || selectedReceipt.payment.proofFileName) && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 bg-blue-50/60 border border-blue-200/80 rounded-lg text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-neutral-900 truncate block text-xs">
                          Proof Document: {selectedReceipt.payment.proofFileName || 'Attached Payment Voucher'}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Stored in private Amazon S3 bucket
                        </span>
                      </div>
                    </div>
                    {selectedReceipt.payment.id && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenProofDocument(selectedReceipt.payment.id!, {
                            receiptNumber: selectedReceipt.receiptNumber,
                            fileName: selectedReceipt.payment.proofFileName || 'Payment Proof Document',
                            fileSize: selectedReceipt.payment.proofFileSize || undefined,
                            mimeType: selectedReceipt.payment.proofMimeType || undefined,
                          })
                        }
                        disabled={loadingProofUrl === selectedReceipt.payment.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#FF8500] hover:bg-[#e07500] text-white shadow-2xs transition cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {loadingProofUrl === selectedReceipt.payment.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5" />
                        )}
                        <span>Open Verified Proof</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-3 border-t border-neutral-100">
                  <Button variant="outline" onClick={() => setSelectedReceipt(null)}>
                    Close
                  </Button>
                  <Button variant="primary" onClick={() => window.print()}>
                    <Printer className="w-4 h-4" />
                    Print Official Receipt
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* ==================================================================== */}
        {/* MODAL 6: REVERSAL CONFIRMATION */}
        {/* ==================================================================== */}
        <Modal
          isOpen={showReversalModal}
          onClose={() => setShowReversalModal(false)}
          title={`Reverse Payment: ${reversalTarget?.receiptNumber || ''}`}
          description="Reversing this transaction will restore student course balances and reverse faculty revenue shares."
          maxWidth="sm"
        >
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Reason for Reversal / Rejection
              </label>
              <textarea
                rows={3}
                placeholder="State the audit reason (e.g. bounce, erroneous collection entry)..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs text-black"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowReversalModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmReversal} disabled={loading}>
                Confirm Reversal
              </Button>
            </div>
          </div>
        </Modal>

        {/* ==================================================================== */}
        {/* MODAL 7: SALARY PAYOUT */}
        {/* ==================================================================== */}
        <Modal
          isOpen={showPayoutModal}
          onClose={() => setShowPayoutModal(false)}
          title="Disburse Faculty Salary Payout"
          maxWidth="sm"
        >
          <form onSubmit={handleSubmitPayout} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">Staff Member</label>
              <select
                value={payoutForm.staffId}
                onChange={(e) => setPayoutForm({ ...payoutForm, staffId: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs text-black"
                required
              >
                <option value="">-- Choose Faculty --</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">Payment Method</label>
              <select
                value={payoutForm.paymentMethod}
                onChange={(e) => setPayoutForm({ ...payoutForm, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs text-black"
              >
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">Bank Reference</label>
              <input
                type="text"
                placeholder="NEFT transaction ref..."
                value={payoutForm.reference}
                onChange={(e) => setPayoutForm({ ...payoutForm, reference: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg text-xs text-black"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowPayoutModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                Authorize Disbursal
              </Button>
            </div>
          </form>
        </Modal>

        {/* ==================================================================== */}
        {/* MODAL 8: AWS S3 SECURE PAYMENT PROOF VIEWER */}
        {/* ==================================================================== */}
        <Modal
          isOpen={proofViewer.isOpen}
          onClose={() => setProofViewer((prev) => ({ ...prev, isOpen: false }))}
          title={`Verified Payment Proof: ${proofViewer.receiptNumber || 'Receipt Document'}`}
          description="Retrieved via short-lived AWS S3 presigned URL with EC2 IAM role authentication."
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* S3 Security & Metadata Bar */}
            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/90 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>AWS S3 Private (AES256)</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Expires in 15 mins</span>
                </span>
                {proofViewer.mimeType === 'application/pdf' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-neutral-200 text-neutral-800 border border-neutral-300">
                    <FileText className="w-3 h-3 text-neutral-600" />
                    <span>PDF Document (Uncompressed)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Zap className="w-3 h-3 text-amber-600" />
                    <span>Auto-Optimized (≤ 150 KB Target)</span>
                  </span>
                )}
              </div>

              <div className="text-[11px] font-mono text-neutral-600 flex items-center gap-2">
                <span className="truncate max-w-[200px]" title={proofViewer.fileName}>
                  {proofViewer.fileName}
                </span>
                {proofViewer.fileSize && (
                  <span className="text-neutral-400">({proofViewer.fileSize})</span>
                )}
              </div>
            </div>

            {/* Viewer Stage */}
            <div className="min-h-[380px] max-h-[560px] flex flex-col justify-center items-center rounded-xl overflow-hidden border border-neutral-200 relative bg-neutral-100">
              {proofViewer.loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Loader2 className="w-8 h-8 text-[#FF8500] animate-spin mb-3" />
                  <p className="text-xs font-semibold text-neutral-700">
                    Generating authorized short-lived download URL from AWS S3...
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Authenticating via EC2 IAM Role (RCA2-EC2-PaymentProofs-Role)
                  </p>
                </div>
              ) : proofViewer.error ? (
                <div className="flex flex-col items-center justify-center p-8 text-center max-w-md">
                  <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                  <h4 className="text-sm font-bold text-neutral-900">Could Not Retrieve Document</h4>
                  <p className="text-xs text-rose-600 mt-1 mb-4">{proofViewer.error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleOpenProofDocument(proofViewer.paymentId, {
                        receiptNumber: proofViewer.receiptNumber,
                        fileName: proofViewer.fileName,
                        fileSize: proofViewer.fileSize || undefined,
                        mimeType: proofViewer.mimeType || undefined,
                      })
                    }
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry S3 Access
                  </Button>
                </div>
              ) : proofViewer.downloadUrl ? (
                proofViewer.mimeType === 'application/pdf' ||
                proofViewer.fileName.toLowerCase().endsWith('.pdf') ? (
                  <div className="w-full h-[520px] flex flex-col">
                    <iframe
                      src={proofViewer.downloadUrl}
                      className="w-full h-full border-0 rounded-b-xl"
                      title="Payment Proof PDF Document"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col">
                    {/* Image Viewer Toolbar */}
                    <div className="flex items-center justify-between px-3 py-1.5 bg-white/90 backdrop-blur border-b border-neutral-200 z-10 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setProofViewerZoom((z) => Math.max(50, z - 25))}
                          className="p-1 rounded hover:bg-neutral-100 text-neutral-600 transition cursor-pointer"
                          title="Zoom out"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="font-mono text-[11px] font-bold text-neutral-700 min-w-[42px] text-center">
                          {proofViewerZoom}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setProofViewerZoom((z) => Math.min(300, z + 25))}
                          className="p-1 rounded hover:bg-neutral-100 text-neutral-600 transition cursor-pointer"
                          title="Zoom in"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProofViewerZoom(100)}
                          className="px-2 py-0.5 text-[10px] rounded hover:bg-neutral-100 text-neutral-500 cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProofViewerRotation((r) => (r + 90) % 360)}
                          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-100 text-neutral-600 transition cursor-pointer text-[11px]"
                          title="Rotate 90 degrees"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Rotate</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProofViewerDarkBg((d) => !d)}
                          className="p-1 rounded hover:bg-neutral-100 text-neutral-600 transition cursor-pointer"
                          title="Toggle backdrop theme"
                        >
                          {proofViewerDarkBg ? (
                            <Sun className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Moon className="w-4 h-4 text-neutral-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Image Canvas Container */}
                    <div
                      className={`flex-1 overflow-auto p-4 flex items-center justify-center min-h-[420px] transition-colors ${
                        proofViewerDarkBg ? 'bg-neutral-900' : 'bg-neutral-100'
                      }`}
                    >
                      <img
                        src={proofViewer.downloadUrl}
                        alt="Verified Fee Payment Proof"
                        className="max-w-full object-contain rounded shadow-lg transition-transform"
                        style={{
                          transform: `scale(${proofViewerZoom / 100}) rotate(${proofViewerRotation}deg)`,
                          transformOrigin: 'center center',
                        }}
                      />
                    </div>
                  </div>
                )
              ) : null}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-neutral-200">
              <span className="text-[11px] text-neutral-400">
                Encrypted with SSE-S3. Presigned URLs are cryptographically signed.
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {proofViewer.downloadUrl && (
                  <>
                    <a
                      href={proofViewer.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-300 hover:bg-neutral-50 text-neutral-700 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in New Tab</span>
                    </a>
                    <a
                      href={proofViewer.downloadUrl}
                      download={proofViewer.fileName || 'payment-proof'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FF8500] hover:bg-[#e07500] text-white shadow-2xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </a>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => setProofViewer((prev) => ({ ...prev, isOpen: false }))}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>

        {/* ==================================================================== */}
        {/* MODAL 9: ATTACH PROOF DOCUMENT TO EXISTING PAYMENT */}
        {/* ==================================================================== */}
        <Modal
          isOpen={!!attachProofModal?.isOpen}
          onClose={() => setAttachProofModal(null)}
          title={`Attach Proof: ${attachProofModal?.receiptNumber || ''}`}
          description={`Upload verified payment voucher or deposit slip for ${attachProofModal?.studentName || 'student'} (₹${attachProofModal?.amount.toLocaleString() || '0'}).`}
          maxWidth="md"
        >
          <form onSubmit={handleSubmitAttachProof} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Select Proof Document (Slip, Screenshot, or PDF)
              </label>

              {existingProofFile ? (
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {existingProofPreview ? (
                        <img
                          src={existingProofPreview}
                          alt="Proof preview"
                          className="w-12 h-12 object-cover rounded-md border border-neutral-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-emerald-100 flex flex-col items-center justify-center text-emerald-800 font-bold text-[10px] shrink-0 border border-emerald-300">
                          <FileText className="w-5 h-5 text-emerald-700 mb-0.5" />
                          PDF
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-neutral-900 truncate block text-xs" title={existingProofFile.name}>
                          {existingProofFile.name}
                        </span>
                        <span className="text-[11px] text-neutral-500 font-mono mt-0.5 block">
                          {formatBytes(existingProofFile.size)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setExistingProofFile(null);
                        setExistingProofPreview(null);
                        setExistingProofCompression(null);
                        setExistingProofError(null);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {existingProofCompression && (
                    <div className="pt-2 border-t border-neutral-200/80 text-[11px] font-medium text-emerald-700 flex items-center gap-1.5">
                      {existingProofCompression.isCompressed ? (
                        <>
                          <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{existingProofCompression.note}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          <span className="text-neutral-600">{existingProofCompression.note}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-300 hover:border-[#FF8500] rounded-xl cursor-pointer bg-white transition group">
                  <Upload className="w-6 h-6 text-neutral-400 group-hover:text-[#FF8500] transition mb-1.5" />
                  <span className="text-xs font-bold text-neutral-700 group-hover:text-[#FF8500]">
                    Click to Select Proof File
                  </span>
                  <span className="text-[11px] text-neutral-400 mt-1 text-center">
                    JPG, PNG, WebP (auto-compressed to ≤ 150 KB) or PDF (uncompressed)
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleExistingProofChange}
                    className="hidden"
                  />
                </label>
              )}

              {existingProofError && (
                <div className="flex items-center gap-1.5 text-rose-600 text-xs font-semibold mt-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{existingProofError}</span>
                </div>
              )}
            </div>

            <div className="p-2.5 bg-blue-50/70 rounded-lg border border-blue-200/80 text-[11px] text-blue-900 space-y-0.5">
              <span className="font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>AWS S3 Enterprise Security</span>
              </span>
              <p className="text-blue-700">
                Uploaded file is encrypted with AES-256 and stored in private bucket <code className="font-mono text-blue-900 bg-blue-100 px-1 rounded">rca2-payment-proofs</code>.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAttachProofModal(null)}
                disabled={uploadingExistingProof}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!existingProofFile || uploadingExistingProof}
              >
                {uploadingExistingProof ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading to S3...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload & Encrypt Proof</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      </ResponsivePageContainer>
    </>
  );
}
