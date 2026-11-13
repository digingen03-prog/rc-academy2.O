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
  PieChart,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Calendar,
  Download,
  RefreshCw,
  FileText,
  Wallet,
  Receipt,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  FileCheck2,
  DollarSign,
  TrendingUp,
  X,
  CreditCard,
  Building2,
  ShieldCheck,
  Eye,
} from 'lucide-react';

interface ReportTransaction {
  id: string;
  date: string;
  type: 'FEE_COLLECTION' | 'STAFF_PAYOUT' | 'EXPENSE' | 'REVERSAL';
  typeLabel: string;
  reference: string;
  title: string;
  party: string;
  partySubtitle?: string;
  flow: 'INFLOW' | 'OUTFLOW';
  amount: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  recordedBy?: string;
  category?: string;
  hasProof?: boolean;
  proofUrl?: string | null;
}

interface ReportSummary {
  totalReceived: number;
  receivedCount: number;
  totalSettled: number;
  settledCount: number;
  totalExpenses: number;
  expensesCount: number;
  totalReversals: number;
  reversalsCount: number;
  netCashFlow: number;
  totalTransactionsCount: number;
}

export default function AdminFinancialReportsPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuthUser();

  const isAuthorizedAdmin =
    user?.roles?.includes('SUPER_ADMIN') ||
    user?.roles?.includes('ACADEMY_ADMIN') ||
    user?.roles?.includes('ACCOUNTANT') ||
    role === 'SUPER_ADMIN' ||
    role === 'ACADEMY_ADMIN' ||
    role === 'ACCOUNTANT';

  // Data State
  const [transactions, setTransactions] = useState<ReportTransaction[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    totalReceived: 0,
    receivedCount: 0,
    totalSettled: 0,
    settledCount: 0,
    totalExpenses: 0,
    expensesCount: 0,
    totalReversals: 0,
    reversalsCount: 0,
    netCashFlow: 0,
    totalTransactionsCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');

  // Period / Month
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [periodPreset, setPeriodPreset] = useState<'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM' | 'ALL'>('THIS_MONTH');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Proof Preview Modal
  const [previewTransaction, setPreviewTransaction] = useState<ReportTransaction | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);

  // Fetch Report Data
  const loadReportsData = async () => {
    try {
      setErrorMsg(null);
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', '50');

      if (periodPreset === 'ALL') {
        params.append('month', 'ALL');
      } else if (periodPreset === 'CUSTOM') {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      } else {
        if (monthFilter) params.append('month', monthFilter);
      }

      if (typeFilter !== 'ALL') params.append('type', typeFilter);
      if (paymentMethodFilter !== 'ALL') params.append('paymentMethod', paymentMethodFilter);
      if (search.trim()) params.append('search', search.trim());

      const res: any = await ApiClient.fetch(`/finance-analytics/reports/transactions?${params.toString()}`);
      if (res) {
        setTransactions(res.items || []);
        if (res.summary) setSummary(res.summary);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalItems(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate financial reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthorizedAdmin) {
      loadReportsData();
    } else if (!authLoading && !isAuthorizedAdmin) {
      setLoading(false);
    }
  }, [authLoading, isAuthorizedAdmin, currentPage, typeFilter, paymentMethodFilter, monthFilter, startDate, endDate, periodPreset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadReportsData();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReportsData();
  };

  // Quick Preset Selection
  const applyPreset = (preset: 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM' | 'ALL') => {
    setPeriodPreset(preset);
    setCurrentPage(1);
    const now = new Date();

    if (preset === 'THIS_MONTH') {
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setMonthFilter(ym);
      setStartDate('');
      setEndDate('');
    } else if (preset === 'LAST_MONTH') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ym = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
      setMonthFilter(ym);
      setStartDate('');
      setEndDate('');
    } else if (preset === 'ALL') {
      setMonthFilter('');
      setStartDate('');
      setEndDate('');
    }
  };

  // Export Full Report to CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('No transactions to export for the selected filter.');
      return;
    }

    const headers = [
      'Date & Time',
      'Transaction Type',
      'Reference / Receipt #',
      'Party / Name',
      'Description',
      'Cash Flow Direction',
      'Amount (INR)',
      'Payment Method',
      'Status',
      'Recorded By',
    ];

    const rows = transactions.map((t) => [
      `"${new Date(t.date).toLocaleString('en-IN')}"`,
      `"${t.typeLabel}"`,
      `"${t.reference}"`,
      `"${t.party}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.flow}"`,
      t.amount,
      `"${t.paymentMethod}"`,
      `"${t.status}"`,
      `"${t.recordedBy || 'N/A'}"`,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
      '',
      `"SUMMARY TOTALS"`,
      `"Total Fee Collections Received",${summary.totalReceived}`,
      `"Total Staff Settlements Paid",${summary.totalSettled}`,
      `"Total Approved Institutional Expenses",${summary.totalExpenses}`,
      `"Total Fee Reversals Deducted",${summary.totalReversals}`,
      `"Net Operating Cash Flow Surplus",${summary.netCashFlow}`,
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rca2_financial_report_${periodPreset}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Proof Preview Modal Open
  const handleViewProof = async (tx: ReportTransaction) => {
    try {
      setPreviewTransaction(tx);
      setPreviewLoading(true);
      if (tx.type === 'EXPENSE') {
        const expenseId = tx.id.replace('exp-', '');
        const res: any = await ApiClient.fetch(`/expenses/${expenseId}/proof-url`);
        setPreviewProofUrl(res?.downloadUrl || tx.proofUrl);
      } else {
        setPreviewProofUrl(tx.proofUrl || null);
      }
    } catch (err: any) {
      alert(`Could not open proof: ${err.message}`);
      setPreviewTransaction(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) + ' ' + d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Unauthorized Access Screen
  if (!authLoading && !isAuthorizedAdmin) {
    return (
      <ResponsivePageContainer>
        <div className="py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-black">Administrator Access Required</h2>
          <p className="text-xs text-neutral-600 leading-relaxed">
            The Financial Reports & Transaction Audit Ledger is strictly restricted to Academy Administrators,
            Accountants, and the Super Admin.
          </p>
          <Button variant="primary" onClick={() => router.push('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </ResponsivePageContainer>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-neutral-50/50">
      <Header
        title="Financial Reports & Transaction Ledger"
        subtitle="Complete audit trail of student collections, faculty payouts, approved operational expenses, and net surplus"
      />

      <ResponsivePageContainer className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Institutional Financial Reports
              </h1>
              <Badge variant="primary" className="text-[11px] font-bold">
                Admin Audit Ledger
              </Badge>
            </div>
            <p className="text-xs text-neutral-500">
              Real-time reconciled cash flow across all student fee receipts, staff compensation payouts, and approved expenses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#FF8500]' : ''}`} />
              <span>Refresh</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleExportCSV}
              disabled={transactions.length === 0}
              className="text-xs bg-[#FF8500] hover:bg-[#e67700] text-white font-semibold shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              <span>Export CSV Report</span>
            </Button>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-100 rounded text-rose-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TOP SUMMARY KPI CARDS: INFLOWS, OUTFLOWS & NET SURPLUS */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Fee Collections Received */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-subtle relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Total Fees Received
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-950 mt-2">
              {formatCurrency(summary.totalReceived)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{summary.receivedCount} fee collection receipts (Inflow)</span>
            </div>
          </div>

          {/* 2. Total Staff Settlements Paid */}
          <div className="bg-white p-5 rounded-2xl border border-purple-200/80 shadow-subtle relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                Total Staff Settled
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-purple-950 mt-2">
              {formatCurrency(summary.totalSettled)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-purple-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>{summary.settledCount} faculty & staff compensation payouts</span>
            </div>
          </div>

          {/* 3. Operational Expenses (Approved) */}
          <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-subtle relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Operational Expenses
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-950 mt-2">
              {formatCurrency(summary.totalExpenses)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-800 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{summary.expensesCount} Super Admin approved expenses</span>
            </div>
          </div>

          {/* 4. Net Retained Cash Flow / Surplus */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-subtle relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                Net Operating Cash Flow
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-xs ${
                summary.netCashFlow >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
              }`}>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono mt-2 ${
              summary.netCashFlow >= 0 ? 'text-blue-900' : 'text-rose-700'
            }`}>
              {formatCurrency(summary.netCashFlow)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-500 font-medium">
              <span>Received minus Settlements, Expenses & Reversals</span>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* COMPREHENSIVE FILTER & SEARCH TOOLBAR */}
        {/* ==================================================================== */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-subtle space-y-3">
          {/* Row 1: Search & Period Preset */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference # (REC, PAY, EXP), student, staff, notes..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] bg-neutral-50/50"
              />
            </form>

            {/* Quick Period Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mr-1">Period:</span>
              <button
                type="button"
                onClick={() => applyPreset('THIS_MONTH')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  periodPreset === 'THIS_MONTH'
                    ? 'bg-[#FF8500] text-white border-[#FF8500] shadow-sm'
                    : 'bg-neutral-50 hover:bg-[#FFF4E5] hover:text-[#CC6B00] border-neutral-200 text-neutral-700'
                }`}
              >
                This Month
              </button>

              <button
                type="button"
                onClick={() => applyPreset('LAST_MONTH')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  periodPreset === 'LAST_MONTH'
                    ? 'bg-[#FF8500] text-white border-[#FF8500] shadow-sm'
                    : 'bg-neutral-50 hover:bg-[#FFF4E5] hover:text-[#CC6B00] border-neutral-200 text-neutral-700'
                }`}
              >
                Last Month
              </button>

              <button
                type="button"
                onClick={() => applyPreset('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  periodPreset === 'ALL'
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                    : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                }`}
              >
                All Time
              </button>

              <button
                type="button"
                onClick={() => applyPreset('CUSTOM')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  periodPreset === 'CUSTOM'
                    ? 'bg-[#FF8500] text-white border-[#FF8500] shadow-sm'
                    : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                }`}
              >
                Custom Range
              </button>
            </div>
          </div>

          {/* Row 2: Secondary Filters (Month Picker, Custom Dates, Payment Method) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100">
            <div className="flex flex-wrap items-center gap-2">
              {/* Month Picker (when preset is not custom and not all) */}
              {periodPreset !== 'CUSTOM' && periodPreset !== 'ALL' && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  <input
                    type="month"
                    value={monthFilter}
                    onChange={(e) => {
                      setMonthFilter(e.target.value);
                      setPeriodPreset('THIS_MONTH');
                      setCurrentPage(1);
                    }}
                    className="bg-transparent text-xs text-neutral-800 font-bold focus:outline-none cursor-pointer"
                  />
                </div>
              )}

              {/* Custom Date Range Picker */}
              {periodPreset === 'CUSTOM' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs">
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">From:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-transparent text-xs text-neutral-800 font-medium focus:outline-none"
                    />
                  </div>
                  <span className="text-neutral-400 text-xs">to</span>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50 text-xs">
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">To:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="bg-transparent text-xs text-neutral-800 font-medium focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Payment Channel Filter */}
              <select
                value={paymentMethodFilter}
                onChange={(e) => {
                  setPaymentMethodFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 text-xs rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700 font-medium focus:outline-none focus:border-[#FF8500]"
              >
                <option value="ALL">All Payment Channels</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CARD">Debit / Credit Card</option>
              </select>

              {/* Reset Filters */}
              {(search || typeFilter !== 'ALL' || paymentMethodFilter !== 'ALL' || periodPreset !== 'THIS_MONTH') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setTypeFilter('ALL');
                    setPaymentMethodFilter('ALL');
                    applyPreset('THIS_MONTH');
                  }}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-neutral-600 hover:text-black hover:bg-neutral-100 transition"
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Scope Pill Badge */}
            <Badge variant="outline" className="text-[11px] font-semibold bg-neutral-50 border-neutral-200 text-neutral-600">
              Showing {summary.totalTransactionsCount} total records in selected window
            </Badge>
          </div>

          {/* Row 3: Transaction Type Filter Tabs */}
          <div className="flex items-center gap-1.5 border-t border-neutral-100 pt-3 overflow-x-auto">
            {[
              { id: 'ALL', label: 'All Transactions', count: summary.totalTransactionsCount },
              { id: 'FEE_COLLECTION', label: 'Student Fees Received', count: summary.receivedCount },
              { id: 'STAFF_PAYOUT', label: 'Staff Settlements Paid', count: summary.settledCount },
              { id: 'EXPENSE', label: 'Operational Expenses', count: summary.expensesCount },
              { id: 'REVERSAL', label: 'Fee Reversals & Refunds', count: summary.reversalsCount },
            ].map((tab) => {
              const isActive = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTypeFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/40 shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-[#FF8500] text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* UNIFIED ALL TRANSACTIONS AUDIT TABLE */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/70 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reference #</th>
                  <th className="py-3 px-4">Party & Description</th>
                  <th className="py-3 px-4">Payment Channel</th>
                  <th className="py-3 px-4 text-right">Inflow / Outflow Amount</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4 text-center">Receipt / Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-neutral-400">
                      <div className="inline-flex items-center gap-2 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#FF8500]" />
                        Compiling reconciled transaction ledger...
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-neutral-400">
                      <div className="space-y-2">
                        <Receipt className="w-8 h-8 text-neutral-300 mx-auto" />
                        <div className="font-medium text-neutral-600">No transactions recorded</div>
                        <p className="text-xs text-neutral-400">
                          Try broadening your date filter or reset search queries to view all transactions.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
                    const isInflow = tx.flow === 'INFLOW';
                    const isCollection = tx.type === 'FEE_COLLECTION';
                    const isPayout = tx.type === 'STAFF_PAYOUT';
                    const isExpense = tx.type === 'EXPENSE';
                    const isReversal = tx.type === 'REVERSAL';

                    return (
                      <tr key={tx.id} className="hover:bg-neutral-50/60 transition-colors">
                        {/* Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap text-neutral-700 font-medium font-mono text-[11px]">
                          {formatDateTime(tx.date)}
                        </td>

                        {/* Transaction Type Badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isCollection && (
                            <Badge variant="success" className="text-[10px] font-bold">
                              Fee Collection
                            </Badge>
                          )}
                          {isPayout && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              Staff Payout
                            </span>
                          )}
                          {isExpense && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Expense
                            </span>
                          )}
                          {isReversal && (
                            <Badge variant="error" className="text-[10px] font-bold">
                              Reversal / Refund
                            </Badge>
                          )}
                        </td>

                        {/* Reference Number */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-neutral-900 font-semibold text-xs">
                          {tx.reference}
                        </td>

                        {/* Party & Description */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900">{tx.party}</div>
                          {tx.partySubtitle && (
                            <div className="text-[10px] text-neutral-500 font-medium">
                              {tx.partySubtitle}
                            </div>
                          )}
                          {tx.notes && (
                            <div className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1 italic" title={tx.notes}>
                              {tx.notes}
                            </div>
                          )}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3 px-4 whitespace-nowrap text-neutral-700 font-medium">
                          {tx.paymentMethod.replace(/_/g, ' ')}
                        </td>

                        {/* Amount & Cash Flow Direction */}
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <div
                            className={`font-mono font-bold text-sm ${
                              isInflow ? 'text-emerald-700' : isExpense ? 'text-amber-800' : 'text-neutral-900'
                            }`}
                          >
                            {isInflow ? '+' : '-'} {formatCurrency(tx.amount)}
                          </div>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                              isInflow ? 'text-emerald-600' : 'text-neutral-400'
                            }`}
                          >
                            {tx.flow}
                          </span>
                        </td>

                        {/* Recorded By */}
                        <td className="py-3 px-4 whitespace-nowrap text-neutral-600 text-[11px]">
                          {tx.recordedBy || 'System'}
                        </td>

                        {/* Receipt / Proof Button */}
                        <td className="py-3 px-4 whitespace-nowrap text-center">
                          {tx.hasProof ? (
                            <button
                              type="button"
                              onClick={() => handleViewProof(tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#CC6B00] text-[11px] font-semibold transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#FF8500]" />
                              <span>Proof</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-300">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
              <div>
                Showing page <strong className="font-semibold text-black">{currentPage}</strong> of{' '}
                <strong className="font-semibold text-black">{totalPages}</strong> ({totalItems} total transactions)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </ResponsivePageContainer>

      {/* Proof Preview Modal */}
      <Modal
        isOpen={Boolean(previewTransaction)}
        onClose={() => {
          setPreviewTransaction(null);
          setPreviewProofUrl(null);
        }}
        title="Transaction Proof Attachment"
        description={previewTransaction ? `${previewTransaction.reference} • ${formatCurrency(previewTransaction.amount)}` : ''}
        maxWidth="3xl"
      >
        <div className="space-y-4 pt-2 text-xs">
          {previewLoading ? (
            <div className="py-16 text-center text-neutral-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#FF8500] mb-2" />
              Loading attachment proof...
            </div>
          ) : previewProofUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl text-neutral-700 border border-neutral-200">
                <span className="font-semibold">Attached Document Proof</span>
                <a
                  href={previewProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FF8500] hover:bg-[#e67700] text-white font-semibold text-xs shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Open in Fullscreen</span>
                </a>
              </div>

              <div className="max-h-[60vh] overflow-auto rounded-xl border border-neutral-200 bg-neutral-900/5 flex items-center justify-center p-2">
                {previewProofUrl.includes('.pdf') ? (
                  <iframe
                    src={previewProofUrl}
                    className="w-full h-[55vh] rounded-lg border-0 bg-white"
                    title="Proof PDF Preview"
                  />
                ) : (
                  <img
                    src={previewProofUrl}
                    alt="Receipt Proof"
                    className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-sm"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-neutral-400">
              No proof document available for this record.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

