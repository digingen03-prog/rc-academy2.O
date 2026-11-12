'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ApiClient } from '@/lib/api/api-client';
import { useAuthUser } from '@/lib/auth/use-role';
import {
  TrendingUp,
  Wallet,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  RefreshCw,
  FileText,
  CreditCard,
  Building2,
  Percent,
  ShieldAlert,
  Search,
  Filter,
  Check,
  ChevronRight,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import StaffSettlementsDirectory from '@/components/finance-analytics/StaffSettlementsDirectory';
import { formatDateTime12h } from '@/lib/utils/time-format';

interface FinanceAnalyticsKPIs {
  totalCollected: number;
  netCollections: number;
  totalInvoiced: number;
  totalOutstanding: number;
  overdueAmount: number;
  totalDiscounts: number;
  totalReversals: number;

  facultyAccrued: number;
  facultyPaid: number;
  fixedAccrued: number;
  fixedPaid: number;
  totalStaffAccrued: number;
  totalStaffPaid: number;
  pendingStaffSettlement: number;
  academyShareAccrued: number;

  totalExpensesPaid: number;
  approvedExpensesAmount?: number;
  approvedExpensesCount?: number;
  netAcademyProfit: number;
  profitMargin: number;
  collectionEfficiency: number;

  invoicesCount: number;
  paymentsCount: number;
  overdueCount: number;
}

interface PaymentMethodsData {
  cash: { amount: number; count: number };
  upi: { amount: number; count: number };
  other: { amount: number; count: number };
}

interface MonthlyTrendItem {
  month: string;
  collected: number;
  payouts: number;
}

interface CourseBreakdownItem {
  classId: string;
  className: string;
  code: string;
  invoiced: number;
  paid: number;
  collected?: number;
  balance: number;
  collectionRate: number;
}

interface StaffSettlementItem {
  staffId: string;
  name: string;
  email: string;
  roles: string[];
  designation: string;
  compensationModel: string;
  fixedSalaryAmount: number | null;
  assignedCoursesCount: number;
  totalEarned: number;
  totalPaid: number;
  pendingSettlement: number;
  unsettledEntriesCount: number;
  hasPendingSettlement: boolean;
  dateOfJoining?: string;
  isProrated?: boolean;
  daysWorked?: number;
  daysInMonth?: number;
  fullSalaryAmount?: number;
}

interface PayoutRecord {
  id: string;
  payoutNumber: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  totalAmount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  approvedAt: string;
  approvedBy: string;
  paidAt: string | null;
  paidBy: string | null;
  entriesCount: number;
}

interface LedgerEntry {
  id: string;
  receiptNumber: string | null;
  compensationModel: string;
  payPeriod: string | null;
  notes: string | null;
  staffId: string;
  staffName: string;
  staffEmail: string;
  className: string;
  classCode: string;
  subjectName: string;
  collectedAmount: number;
  staffPoolRate: number;
  academyShareRate: number;
  staffPoolAmount: number;
  academyShareAmount: number;
  earnedAmount: number;
  ruleApplied: string;
  status: string;
  createdAt: string;
}

export default function FinanceAnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthUser();
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN') ?? false;

  const [activeTab, setActiveTab] = useState<'overview' | 'settlements' | 'payouts' | 'ledger'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Core Data States
  const [kpis, setKpis] = useState<FinanceAnalyticsKPIs | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodsData | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrendItem[]>([]);
  const [courseBreakdown, setCourseBreakdown] = useState<CourseBreakdownItem[]>([]);
  const [staffSettlements, setStaffSettlements] = useState<StaffSettlementItem[]>([]);
  const [payoutsList, setPayoutsList] = useState<PayoutRecord[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  // Search & Filters
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('');
  const [ledgerModelFilter, setLedgerModelFilter] = useState('');

  // Settlement Processing Modal
  const [settlingStaff, setSettlingStaff] = useState<StaffSettlementItem | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<'BANK_TRANSFER' | 'UPI' | 'CASH' | 'CHEQUE'>('BANK_TRANSFER');
  const [settlementRef, setSettlementRef] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settlingSubmitting, setSettlingSubmitting] = useState(false);

  // Load all analytics data
  const loadFinanceData = async () => {
    try {
      setErrorMsg(null);
      const [analyticsRes, settlementsRes, payoutsRes, ledgerRes] = await Promise.all([
        ApiClient.fetch<any>('/salary/analytics'),
        ApiClient.fetch<any>('/salary/staff-settlements'),
        ApiClient.fetch<any>('/salary/payouts'),
        ApiClient.fetch<any>('/salary/ledger'),
      ]);

      if (analyticsRes?.kpis) {
        setKpis(analyticsRes.kpis);
        setPaymentMethods(analyticsRes.paymentMethods || null);
        setMonthlyTrends(analyticsRes.monthlyTrends || []);
        setCourseBreakdown(analyticsRes.courseBreakdown || []);
      }

      if (Array.isArray(settlementsRes)) {
        setStaffSettlements(settlementsRes);
      }

      if (Array.isArray(payoutsRes)) {
        setPayoutsList(payoutsRes);
      }

      if (Array.isArray(ledgerRes)) {
        setLedgerEntries(ledgerRes);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load executive finance analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (isSuperAdmin) {
        loadFinanceData();
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, isSuperAdmin]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFinanceData();
  };

  // Open Direct Settlement Modal
  const handleOpenSettleModal = (staff: StaffSettlementItem) => {
    setSettlingStaff(staff);
    setSettlementMethod('BANK_TRANSFER');
    setSettlementRef('');
    setSettlementNotes(`Monthly compensation settlement for ${staff.name} - ${new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`);
  };

  // Submit Settlement Payout
  const handleExecuteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingStaff) return;

    try {
      setSettlingSubmitting(true);
      await ApiClient.fetch('/salary/settle-staff', {
        method: 'POST',
        body: JSON.stringify({
          staffId: settlingStaff.staffId,
          paymentMethod: settlementMethod,
          reference: settlementRef.trim() || undefined,
          notes: settlementNotes.trim() || undefined,
        }),
      });

      setSuccessMsg(`Successfully settled ₹${settlingStaff.pendingSettlement.toLocaleString()} for ${settlingStaff.name}!`);
      setSettlingStaff(null);
      await loadFinanceData();
    } catch (err: any) {
      alert(`Settlement failed: ${err.message}`);
    } finally {
      setSettlingSubmitting(false);
    }
  };

  // Export Financial Summary to CSV
  const handleExportCSV = () => {
    if (!kpis) return;
    const rows = [
      ['RCA2.O EXECUTIVE FINANCE & SETTLEMENT REPORT', new Date().toISOString()],
      [''],
      ['--- KEY FINANCIAL METRICS ---'],
      ['Metric', 'Amount (INR)'],
      ['Total Student Fees Collected', kpis.totalCollected],
      ['Total Invoiced (Gross Billed)', kpis.totalInvoiced],
      ['Outstanding Dues & Receivables', kpis.totalOutstanding],
      ['Overdue Dues', kpis.overdueAmount],
      ['Scholarships / Adjustments', kpis.totalDiscounts],
      ['Reversals & Refunds', kpis.totalReversals],
      ['Net Student Collections', kpis.netCollections],
      ['Collection Efficiency (%)', `${kpis.collectionEfficiency}%`],
      [''],
      ['--- STAFF COMPENSATION & SETTLEMENTS ---'],
      ['Faculty Revenue Share Accrued', kpis.facultyAccrued],
      ['Faculty Revenue Share Paid', kpis.facultyPaid],
      ['Fixed Salary Accrued', kpis.fixedAccrued],
      ['Fixed Salary Paid', kpis.fixedPaid],
      ['Total Staff Compensation Accrued', kpis.totalStaffAccrued],
      ['Total Staff Settlements Paid', kpis.totalStaffPaid],
      ['Pending Staff Settlements Payable', kpis.pendingStaffSettlement],
      ['Top-Line Academy Share Accrued', kpis.academyShareAccrued],
      [''],
      ['--- PROFITABILITY & EXPENSES ---'],
      ['Super Admin Approved Operational Expenses', kpis.approvedExpensesAmount || 0],
      ['Total Operational Expenses Paid', kpis.totalExpensesPaid],
      ['Net Academy Retained Profit', kpis.netAcademyProfit],
      ['Profit Margin (%)', `${kpis.profitMargin}%`],
      [''],
      ['--- STAFF SETTLEMENT DIRECTORY ---'],
      ['Staff Name', 'Email', 'Role', 'Compensation Model', 'Total Earned', 'Total Paid', 'Pending Settlement'],
      ...staffSettlements.map((s) => [
        s.name,
        s.email,
        s.roles.join('/'),
        s.compensationModel,
        s.totalEarned,
        s.totalPaid,
        s.pendingSettlement,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RCA_Finance_Settlements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffSettlements.filter((s) => {
      const q = staffSearchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.compensationModel.toLowerCase().includes(q) ||
        s.designation.toLowerCase().includes(q)
      );
    });
  }, [staffSettlements, staffSearchQuery]);

  // Filtered ledger entries
  const filteredLedger = useMemo(() => {
    return ledgerEntries.filter((l) => {
      const matchesSearch =
        !ledgerSearchQuery ||
        l.staffName.toLowerCase().includes(ledgerSearchQuery.toLowerCase()) ||
        l.className.toLowerCase().includes(ledgerSearchQuery.toLowerCase()) ||
        (l.receiptNumber && l.receiptNumber.toLowerCase().includes(ledgerSearchQuery.toLowerCase()));

      const matchesStatus = !ledgerStatusFilter || l.status === ledgerStatusFilter;
      const matchesModel = !ledgerModelFilter || l.compensationModel === ledgerModelFilter;

      return matchesSearch && matchesStatus && matchesModel;
    });
  }, [ledgerEntries, ledgerSearchQuery, ledgerStatusFilter, ledgerModelFilter]);

  // Access Control Guard
  if (!authLoading && !isSuperAdmin) {
    return (
      <ResponsivePageContainer>
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-neutral-200 rounded-2xl p-8 text-center shadow-card space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#FF8500]">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-black tracking-tight">Access Restricted</h2>
            <p className="text-sm text-neutral-600 leading-relaxed">
              The <strong>Finance Analytics & Staff Settlements</strong> module contains confidential institutional revenue,
              faculty earnings, and net academy profit statements and is strictly reserved for the <strong>Super Administrator</strong>.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </ResponsivePageContainer>
    );
  }

  return (
    <ResponsivePageContainer>
      <div className="space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-black">
                Finance Analytics & Settlements
              </h1>
              <Badge variant="outline" className="border-[#FF8500]/30 text-[#FF8500] bg-orange-50/50 text-[11px] font-semibold">
                Super Admin Only
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Consolidated institutional revenue, faculty settlement pool, operating expense outflows, and academy net profit statements
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#FF8500]' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleExportCSV}
              disabled={!kpis}
              className="text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 font-bold">×</button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800 font-bold">×</button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* EXECUTIVE FINANCIAL KPI GRID */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Total Collections */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Gross Collections</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-black">
              ₹{kpis ? kpis.totalCollected.toLocaleString() : '...'}
            </div>
            <div className="text-[11px] text-neutral-500 flex items-center gap-1 font-mono">
              <span className="text-emerald-700 font-semibold">{kpis?.paymentsCount || 0}</span> receipts
            </div>
          </div>

          {/* 2. Total Invoiced */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Total Billed</span>
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-black">
              ₹{kpis ? kpis.totalInvoiced.toLocaleString() : '...'}
            </div>
            <div className="text-[11px] text-neutral-500 flex items-center gap-1">
              <span>Efficiency:</span>
              <span className="font-mono font-semibold text-black">{kpis?.collectionEfficiency || 0}%</span>
            </div>
          </div>

          {/* 3. Outstanding Receivables */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Outstanding Dues</span>
              <div className="w-6 h-6 rounded-lg bg-amber-50 text-[#CC6B00] flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-[#CC6B00]">
              ₹{kpis ? kpis.totalOutstanding.toLocaleString() : '...'}
            </div>
            <div className="text-[11px] text-neutral-500 font-mono">
              Overdue: <span className="text-red-600 font-semibold">₹{kpis?.overdueAmount.toLocaleString() || '0'}</span>
            </div>
          </div>

          {/* 4. Total Staff Compensation Accrued */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Staff Accrued Pool</span>
              <div className="w-6 h-6 rounded-lg bg-orange-50 text-[#FF8500] flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-black">
              ₹{kpis ? kpis.totalStaffAccrued.toLocaleString() : '...'}
            </div>
            <div className="text-[11px] text-neutral-500 flex items-center gap-1 font-mono">
              <span>Paid:</span>
              <span className="text-emerald-700 font-semibold">₹{kpis?.totalStaffPaid.toLocaleString() || '0'}</span>
            </div>
          </div>

          {/* 5. Pending Staff Settlement */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Pending Settlements</span>
              <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-purple-700">
              ₹{kpis ? kpis.pendingStaffSettlement.toLocaleString() : '...'}
            </div>
            <div className="text-[11px] text-neutral-500">
              {staffSettlements.filter((s) => s.hasPendingSettlement).length} staff with dues
            </div>
          </div>

          {/* 6. Net Academy Retained Profit */}
          <div className="bg-white p-4 rounded-2xl border-2 border-emerald-300 shadow-card space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Net Academy Profit</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold font-mono text-emerald-800">
              ₹{kpis ? kpis.netAcademyProfit.toLocaleString() : '...'}
            </div>
            <div className="text-[11px] text-neutral-600 font-semibold font-mono">
              Margin: <span className="text-emerald-700">{kpis?.profitMargin || 0}%</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-200 text-sm overflow-x-auto pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 font-semibold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'border-[#FF8500] text-[#FF8500]'
                : 'border-transparent text-neutral-600 hover:text-black'
            }`}
          >
            P&L Overview & Health
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settlements')}
            className={`px-4 py-2.5 font-semibold transition border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settlements'
                ? 'border-[#FF8500] text-[#FF8500]'
                : 'border-transparent text-neutral-600 hover:text-black'
            }`}
          >
            <span>Staff Settlements</span>
            {staffSettlements.filter((s) => s.hasPendingSettlement).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                {staffSettlements.filter((s) => s.hasPendingSettlement).length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2.5 font-semibold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'payouts'
                ? 'border-[#FF8500] text-[#FF8500]'
                : 'border-transparent text-neutral-600 hover:text-black'
            }`}
          >
            Payouts & Expenses Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2.5 font-semibold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'ledger'
                ? 'border-[#FF8500] text-[#FF8500]'
                : 'border-transparent text-neutral-600 hover:text-black'
            }`}
          >
            Settlement Audit Ledger
          </button>
        </div>

        {/* ==================================================================== */}
        {/* TAB 1: P&L OVERVIEW & HEALTH */}
        {/* ==================================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 3-Column Visual Financial Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Revenue Allocation Model */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <h3 className="text-sm font-bold text-black flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#FF8500]" />
                    Revenue & Allocation Split
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-mono">70 / 30 Standard</Badge>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-neutral-50">
                    <span className="text-neutral-500">Gross Student Collections</span>
                    <strong className="font-mono text-black">₹{kpis?.totalCollected.toLocaleString()}</strong>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-neutral-50">
                    <span className="text-neutral-500">Faculty Revenue Share (70%)</span>
                    <strong className="font-mono text-[#FF8500]">₹{kpis?.facultyAccrued.toLocaleString()}</strong>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-neutral-50">
                    <span className="text-neutral-500">Fixed Staff Salaries</span>
                    <strong className="font-mono text-neutral-800">₹{kpis?.fixedAccrued.toLocaleString()}</strong>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-neutral-50">
                    <span className="text-neutral-500">Gross Academy Top-Line Share</span>
                    <strong className="font-mono text-blue-700">₹{kpis?.academyShareAccrued.toLocaleString()}</strong>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-neutral-50">
                    <span className="text-neutral-500">Reversals & Refunds Deducted</span>
                    <strong className="font-mono text-red-600">-₹{kpis?.totalReversals.toLocaleString()}</strong>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-neutral-50">
                    <span className="text-neutral-500">Approved Institutional Expenses</span>
                    <strong className="font-mono text-amber-700">
                      -₹{(kpis?.approvedExpensesAmount || 0).toLocaleString()}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center pt-2 font-bold text-sm bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                    <span className="text-emerald-900">Net Academy Profit</span>
                    <span className="font-mono text-emerald-800">₹{kpis?.netAcademyProfit.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Payment Collection Channels */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <h3 className="text-sm font-bold text-black flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#FF8500]" />
                    Collection Channels
                  </h3>
                  <span className="text-xs text-neutral-400 font-mono">Breakdown</span>
                </div>

                <div className="space-y-4">
                  {/* UPI */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        UPI / QR Instant Payments
                      </span>
                      <strong className="font-mono text-black">₹{paymentMethods?.upi.amount.toLocaleString() || '0'}</strong>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${kpis && kpis.totalCollected > 0 ? ((paymentMethods?.upi.amount || 0) / kpis.totalCollected) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5 block font-mono">
                      {paymentMethods?.upi.count || 0} transactions verified
                    </span>
                  </div>

                  {/* Cash */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        Cash Desk Collections
                      </span>
                      <strong className="font-mono text-black">₹{paymentMethods?.cash.amount.toLocaleString() || '0'}</strong>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${kpis && kpis.totalCollected > 0 ? ((paymentMethods?.cash.amount || 0) / kpis.totalCollected) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5 block font-mono">
                      {paymentMethods?.cash.count || 0} counter receipts
                    </span>
                  </div>

                  {/* Other / Bank */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                        Bank Transfers & Cheques
                      </span>
                      <strong className="font-mono text-black">₹{paymentMethods?.other.amount.toLocaleString() || '0'}</strong>
                    </div>
                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{
                          width: `${kpis && kpis.totalCollected > 0 ? ((paymentMethods?.other.amount || 0) / kpis.totalCollected) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5 block font-mono">
                      {paymentMethods?.other.count || 0} wire / bank credits
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Outflows & Settlement Status */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <h3 className="text-sm font-bold text-black flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#FF8500]" />
                    Settlement Status
                  </h3>
                  <Badge variant={kpis && kpis.pendingStaffSettlement > 0 ? 'warning' : 'success'} className="text-[10px]">
                    {kpis && kpis.pendingStaffSettlement > 0 ? 'Pending Dues' : 'Fully Settled'}
                  </Badge>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-neutral-50 rounded-xl space-y-1">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold block">Total Expense Outflows (Paid)</span>
                    <div className="text-lg font-bold font-mono text-black">
                      ₹{kpis?.totalExpensesPaid.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-neutral-400">
                      Faculty payouts + payment reversals + Super Admin approved operational expenses
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-amber-800 uppercase font-semibold block">Approved Operational Expenses</span>
                      <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.5 rounded-full font-bold">
                        {kpis?.approvedExpensesCount || 0} approved
                      </span>
                    </div>
                    <div className="text-lg font-bold font-mono text-amber-900">
                      ₹{(kpis?.approvedExpensesAmount || 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-amber-700">Calculated directly into net academy surplus</p>
                  </div>

                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1">
                    <span className="text-[10px] text-purple-700 uppercase font-semibold block">Outstanding Faculty Payable</span>
                    <div className="text-lg font-bold font-mono text-purple-800">
                      ₹{kpis?.pendingStaffSettlement.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-purple-600">Earned commission ready to settle via bank payout</p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveTab('settlements')}
                    className="w-full text-xs"
                  >
                    Manage Staff Settlements
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Monthly Trend Timeline */}
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-black">Monthly Collections vs Settlements Trend</h3>
                  <p className="text-xs text-neutral-400">Institutional collection inflow vs staff payout distributions</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Collections
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF8500] inline-block" /> Settlements
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {monthlyTrends.map((m, idx) => (
                  <div key={idx} className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 space-y-2">
                    <div className="font-semibold text-xs text-neutral-800">{m.month}</div>
                    <div className="space-y-1 text-xs font-mono">
                      <div className="text-emerald-700 font-bold">₹{m.collected.toLocaleString()}</div>
                      <div className="text-neutral-500 text-[11px]">Paid: ₹{m.payouts.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Course Revenue Breakdown */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-black">Offering & Course Revenue Distribution</h3>
                  <p className="text-xs text-neutral-400">Invoiced obligations and collection performance across standards</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Standard / Course</th>
                      <th className="py-3 px-4 text-right">Invoiced (₹)</th>
                      <th className="py-3 px-4 text-right">Collected (₹)</th>
                      <th className="py-3 px-4 text-right">Outstanding (₹)</th>
                      <th className="py-3 px-4 text-center">Collection %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {courseBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-neutral-400">No course billing records found.</td>
                      </tr>
                    ) : (
                      courseBreakdown.map((c) => (
                        <tr key={c.classId} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-black block">{c.className}</span>
                            <span className="text-[11px] text-neutral-400 font-mono">{c.code}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium">₹{c.invoiced.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">₹{(c.paid ?? c.collected ?? 0).toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#CC6B00]">₹{c.balance.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={c.collectionRate >= 80 ? 'success' : c.collectionRate >= 50 ? 'warning' : 'error'}>
                              {c.collectionRate}%
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
        {/* TAB 2: STAFF SETTLEMENTS DIRECTORY */}
        {/* ==================================================================== */}
        {activeTab === 'settlements' && (
          <div className="space-y-6">
            <StaffSettlementsDirectory />

            <div className="pt-6 border-t border-neutral-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-black">Direct Staff Disbursal & Bank Payout Execution</h3>
                  <p className="text-xs text-neutral-500">
                    Execute one-click bank/UPI disbursements for accumulated staff balances
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search faculty or role..."
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-[#FF8500]"
                  />
                </div>
              </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Faculty / Staff Member</th>
                      <th className="py-3 px-4">Role & Model</th>
                      <th className="py-3 px-4 text-right">Total Accrued (₹)</th>
                      <th className="py-3 px-4 text-right">Settled (₹)</th>
                      <th className="py-3 px-4 text-right">Pending Settlement (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-neutral-400">
                          No staff settlement records matching search.
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((s) => (
                        <tr key={s.staffId} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-black block">{s.name}</span>
                            <span className="text-[11px] text-neutral-400">{s.email}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-neutral-800 block">{s.designation}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] mt-0.5 ${
                                s.compensationModel.includes('FIXED')
                                  ? 'border-blue-200 text-blue-700 bg-blue-50/50'
                                  : 'border-[#FF8500]/30 text-[#FF8500] bg-orange-50/40'
                              }`}
                            >
                              {s.compensationModel.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium">
                            <div>₹{s.totalEarned.toLocaleString()}</div>
                            {s.isProrated && s.daysWorked !== undefined && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 inline-block font-sans mt-0.5">
                                Prorated ({s.daysWorked}/{s.daysInMonth}d)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">₹{s.totalPaid.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-purple-700">₹{s.pendingSettlement.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={s.pendingSettlement > 0 ? 'warning' : 'success'}>
                              {s.pendingSettlement > 0 ? 'Due' : 'Settled'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {s.pendingSettlement > 0 ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleOpenSettleModal(s)}
                                className="text-xs shadow-xs"
                              >
                                Settle Now
                              </Button>
                            ) : (
                              <span className="text-xs text-neutral-400 font-semibold flex items-center justify-end gap-1">
                                <Check className="w-3.5 h-3.5 text-emerald-600" /> Settled
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* ==================================================================== */}
        {/* TAB 3: PAYOUTS & EXPENSES LOG */}
        {/* ==================================================================== */}
        {activeTab === 'payouts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-black">Institutional Payouts & Expense Register</h3>
                <p className="text-xs text-neutral-500">Official payout certificates, bank references, and audit approvals</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Payout #</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4 text-right">Amount (₹)</th>
                      <th className="py-3 px-4">Method & Ref</th>
                      <th className="py-3 px-4">Approved By</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {payoutsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-neutral-400">
                          No institutional staff salary payouts generated yet.
                        </td>
                      </tr>
                    ) : (
                      payoutsList.map((p) => (
                        <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-black">{p.payoutNumber}</td>
                          <td className="py-3.5 px-4 font-mono text-neutral-600">
                            {formatDateTime12h(p.paidAt || p.approvedAt)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-black block">{p.staffName}</span>
                            <span className="text-[11px] text-neutral-400">{p.staffEmail}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-800 text-sm">
                            ₹{p.totalAmount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-neutral-800 block">{p.paymentMethod}</span>
                            <span className="text-[11px] text-neutral-400 font-mono">{p.reference || 'Ref: Direct'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-neutral-600">{p.approvedBy}</td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={p.status === 'PAID' ? 'success' : 'warning'}>
                              {p.status}
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
        {/* TAB 4: SETTLEMENT AUDIT LEDGER */}
        {/* ==================================================================== */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-black">Itemized Settlement Audit Ledger</h3>
                <p className="text-xs text-neutral-500">Atomic, immutable record of fee payment allocations to faculty compensation</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={ledgerStatusFilter}
                  onChange={(e) => setLedgerStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-[#FF8500] bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="ACCRUED">Accrued / Due</option>
                  <option value="PAID">Paid / Settled</option>
                </select>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search staff, course or receipt..."
                    value={ledgerSearchQuery}
                    onChange={(e) => setLedgerSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-[#FF8500]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3 px-4">Receipt #</th>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Offering / Course</th>
                      <th className="py-3 px-4 text-right">Student Fee (₹)</th>
                      <th className="py-3 px-4 text-center">Split %</th>
                      <th className="py-3 px-4 text-right">Staff Earned (₹)</th>
                      <th className="py-3 px-4 text-right">Academy Retained (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-800">
                    {filteredLedger.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-neutral-400">
                          No ledger records matching filters.
                        </td>
                      </tr>
                    ) : (
                      filteredLedger.map((l) => (
                        <tr key={l.id} className="hover:bg-neutral-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-neutral-800">
                            {l.receiptNumber || 'FIXED-ACCRUAL'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-black block">{l.staffName}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">{l.compensationModel}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-neutral-800 block">{l.className}</span>
                            <span className="text-[11px] text-neutral-400">{l.subjectName}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-medium">₹{l.collectedAmount.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-semibold">
                            {l.compensationModel === 'FIXED_SALARY' ? 'Fixed' : `${l.staffPoolRate} / ${l.academyShareRate}`}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#FF8500]">₹{l.earnedAmount.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">₹{l.academyShareAmount.toLocaleString()}</td>
                          <td className="py-3.5 px-4 text-center">
                            <Badge variant={l.status === 'PAID' ? 'success' : 'warning'}>
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
        {/* DIRECT SETTLEMENT EXECUTION MODAL */}
        {/* ==================================================================== */}
        <Modal
          isOpen={!!settlingStaff}
          onClose={() => setSettlingStaff(null)}
          title={`Execute Staff Settlement: ${settlingStaff?.name || ''}`}
          description="Execute direct bank transfer or UPI payout to settle outstanding faculty compensations"
          maxWidth="lg"
        >
          {settlingStaff && (
            <form onSubmit={handleExecuteSettlement} className="space-y-4">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-1">
                <span className="text-[11px] uppercase font-bold text-[#FF8500] tracking-wider block">Pending Settlement Amount</span>
                <div className="text-2xl font-bold font-mono text-black">
                  ₹{settlingStaff.pendingSettlement.toLocaleString()}
                </div>
                <p className="text-xs text-neutral-600">
                  Staff Role: <strong>{settlingStaff.designation}</strong> ({settlingStaff.compensationModel})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={settlementMethod}
                  onChange={(e: any) => setSettlementMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FF8500]"
                >
                  <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT / IMPS)</option>
                  <option value="UPI">UPI Instant Payout</option>
                  <option value="CASH">Cash Voucher</option>
                  <option value="CHEQUE">Bank Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Transaction Reference / UTR #
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-20261029-987654"
                  value={settlementRef}
                  onChange={(e) => setSettlementRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FF8500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Settlement Notes / Narration
                </label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FF8500]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSettlingStaff(null)}
                  disabled={settlingSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={settlingSubmitting || settlingStaff.pendingSettlement <= 0}
                  className="flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{settlingSubmitting ? 'Processing Payout...' : 'Confirm & Settle Payout'}</span>
                </Button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </ResponsivePageContainer>
  );
}
