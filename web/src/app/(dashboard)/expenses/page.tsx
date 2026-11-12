'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ApiClient } from '@/lib/api/api-client';
import { useAuthUser } from '@/lib/auth/use-role';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Clock,
  ArrowUpRight,
  Download,
  Trash2,
  FileText,
  FileCheck2,
  Eye,
  RefreshCw,
  Building2,
  Upload,
  X,
  ShieldCheck,
  Check,
  File,
} from 'lucide-react';

interface ExpenseUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation?: string | null;
}

interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number | string;
  expenseDate: string;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  proofUrl: string | null;
  proofObjectKey: string | null;
  proofFileName: string | null;
  proofFileSize: number | null;
  proofMimeType: string | null;
  proofUploadedAt: string | null;
  createdById: string;
  createdBy?: ExpenseUser;
  approvedById: string | null;
  approvedBy?: ExpenseUser | null;
  approvedAt: string | null;
  createdAt: string;
}

interface ExpenseSummary {
  totalAmount: number;
  totalCount: number;
  approvedAmount: number;
  approvedCount: number;
  pendingAmount: number;
  pendingCount: number;
  rejectedAmount: number;
  rejectedCount: number;
}

const CATEGORIES = [
  { value: 'RENT', label: 'Rent & Lease' },
  { value: 'UTILITIES', label: 'Utilities (Electricity, Water, Internet)' },
  { value: 'MAINTENANCE', label: 'Repairs & Maintenance' },
  { value: 'OFFICE_SUPPLIES', label: 'Office & Classroom Supplies' },
  { value: 'EQUIPMENT', label: 'IT & Lab Equipment' },
  { value: 'SALARIES', label: 'Staff & Operational Wages' },
  { value: 'MARKETING', label: 'Marketing & Advertising' },
  { value: 'EVENT', label: 'Academy Events & Workshops' },
  { value: 'TRAVEL', label: 'Travel & Conveyance' },
  { value: 'OTHER', label: 'Other Operational Expenses' },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI / QR' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Debit / Credit Card' },
  { value: 'OTHER', label: 'Other' },
];

export default function ExpensesPage() {
  const { user, role, loading: authLoading } = useAuthUser();
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN') || role === 'SUPER_ADMIN';

  // State
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    totalAmount: 0,
    totalCount: 0,
    approvedAmount: 0,
    approvedCount: 0,
    pendingAmount: 0,
    pendingCount: 0,
    rejectedAmount: 0,
    rejectedCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Add Expense Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('OTHER');
  const [formAmount, setFormAmount] = useState('');
  const [formExpenseDate, setFormExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPaymentMethod, setFormPaymentMethod] = useState('CASH');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reject Modal
  const [rejectingExpense, setRejectingExpense] = useState<ExpenseItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);

  // Proof Preview Modal
  const [previewExpense, setPreviewExpense] = useState<ExpenseItem | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProofData, setPreviewProofData] = useState<{
    downloadUrl: string;
    fileName: string;
    mimeType: string;
  } | null>(null);

  // Load Expenses Data
  const loadExpenses = async () => {
    try {
      setErrorMsg(null);
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', '20');

      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (monthFilter) params.append('month', monthFilter);

      const res: any = await ApiClient.fetch(`/expenses?${params.toString()}`);
      if (res) {
        setExpenses(res.items || []);
        if (res.summary) setSummary(res.summary);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadExpenses();
    }
  }, [authLoading, currentPage, statusFilter, categoryFilter, monthFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadExpenses();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
  };

  // Reset form
  const resetForm = () => {
    setFormTitle('');
    setFormCategory('OTHER');
    setFormAmount('');
    setFormExpenseDate(new Date().toISOString().split('T')[0]);
    setFormPaymentMethod('CASH');
    setFormReferenceNumber('');
    setFormNotes('');
    setSelectedProofFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Create Expense Submission
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formAmount);
    if (!formTitle.trim()) {
      alert('Please provide an expense title');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid amount greater than ₹0');
      return;
    }

    try {
      setSubmittingExpense(true);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append('title', formTitle.trim());
      formData.append('category', formCategory);
      formData.append('amount', String(parsedAmount));
      formData.append('expenseDate', formExpenseDate);
      formData.append('paymentMethod', formPaymentMethod);
      if (formReferenceNumber.trim()) {
        formData.append('referenceNumber', formReferenceNumber.trim());
      }
      if (formNotes.trim()) {
        formData.append('notes', formNotes.trim());
      }
      if (selectedProofFile) {
        formData.append('proof', selectedProofFile);
      }

      await ApiClient.fetch('/expenses', {
        method: 'POST',
        body: formData,
      });

      setSuccessMsg(`Expense "${formTitle}" recorded successfully in PENDING review status!`);
      setIsAddModalOpen(false);
      resetForm();
      await loadExpenses();
    } catch (err: any) {
      alert(`Failed to save expense: ${err.message}`);
    } finally {
      setSubmittingExpense(false);
    }
  };

  // Super Admin Approve Expense
  const handleApproveExpense = async (expense: ExpenseItem) => {
    if (!isSuperAdmin) return;
    const confirmApprove = window.confirm(
      `Approve expense "${expense.title}" for ₹${Number(expense.amount).toLocaleString()}?\n\nOnce approved, this amount will be immediately calculated into the Executive Finance & Settlements page.`,
    );
    if (!confirmApprove) return;

    try {
      await ApiClient.fetch(`/expenses/${expense.id}/approve`, {
        method: 'PATCH',
      });
      setSuccessMsg(`Expense "${expense.title}" approved! Added to Finance & Settlements.`);
      await loadExpenses();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  // Super Admin Reject Expense
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingExpense || !isSuperAdmin) return;

    try {
      setSubmittingRejection(true);
      await ApiClient.fetch(`/expenses/${rejectingExpense.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      setSuccessMsg(`Expense "${rejectingExpense.title}" was marked as REJECTED.`);
      setRejectingExpense(null);
      setRejectionReason('');
      await loadExpenses();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    } finally {
      setSubmittingRejection(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (expense: ExpenseItem) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete expense "${expense.title}"?`,
    );
    if (!confirmDelete) return;

    try {
      await ApiClient.fetch(`/expenses/${expense.id}`, {
        method: 'DELETE',
      });
      setSuccessMsg(`Expense deleted successfully.`);
      await loadExpenses();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  // Open Proof Preview Modal
  const handleOpenProofPreview = async (expense: ExpenseItem) => {
    try {
      setPreviewExpense(expense);
      setPreviewLoading(true);
      const res: any = await ApiClient.fetch(`/expenses/${expense.id}/proof-url`);
      setPreviewProofData(res);
    } catch (err: any) {
      alert(`Could not load proof attachment: ${err.message}`);
      setPreviewExpense(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return `₹${num.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getCategoryLabel = (cat: string) => {
    return CATEGORIES.find((c) => c.value === cat)?.label || cat;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-neutral-50/50">
      <Header
        title="Institutional Expenses"
        subtitle="Record academy operational expenses with attachment proofs and manage Super Admin approvals"
      />

      <ResponsivePageContainer className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Banner Alert for Super Admin Workflow */}
        <div className="p-4 bg-gradient-to-r from-orange-50 via-amber-50 to-neutral-50 border border-orange-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-subtle">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF8500] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900">Expense Approval & Settlement Policy</h2>
                <Badge variant="warning" className="text-[10px] uppercase font-bold">
                  Audit Controlled
                </Badge>
              </div>
              <p className="text-xs text-neutral-600 mt-0.5">
                Academy Admins & Accountants can submit expenses with receipt proofs. Only{' '}
                <strong className="text-neutral-900 font-semibold">Super Admin approved expenses</strong> are calculated
                into Executive Finance & Settlements (<span className="font-mono text-xs text-[#CC6B00]">/finance-analytics</span>).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs bg-[#FF8500] hover:bg-[#e67700] text-white font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="p-1 hover:bg-emerald-100 rounded-lg">
              <X className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:bg-rose-100 rounded-lg">
              <X className="w-3.5 h-3.5 text-rose-700" />
            </button>
          </div>
        )}

        {/* Top Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Approved Expenses */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-subtle relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Approved Expenses
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-900 mt-2">
              {formatCurrency(summary.approvedAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{summary.approvedCount} approved (calculated in finance)</span>
            </div>
          </div>

          {/* 2. Pending Approvals */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-subtle relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                Pending Approvals
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-900 mt-2">
              {formatCurrency(summary.pendingAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{summary.pendingCount} awaiting Super Admin</span>
            </div>
          </div>

          {/* 3. Rejected Expenses */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 shadow-subtle relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                Rejected
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-rose-900 mt-2">
              {formatCurrency(summary.rejectedAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-rose-700 font-medium">
              <span>{summary.rejectedCount} rejected entries</span>
            </div>
          </div>

          {/* 4. Total Outlay */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-subtle relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Total Expenses
              </span>
              <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-700 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-neutral-900 mt-2">
              {formatCurrency(summary.totalAmount)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-neutral-500 font-medium">
              <span>{summary.totalCount} total operational records</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-subtle space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search expense title, receipt #, notes..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] bg-neutral-50/50"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-neutral-50/50 text-neutral-700 font-medium focus:outline-none focus:border-[#FF8500]"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              {/* Month Filter */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50/50 text-xs text-neutral-700">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                <input
                  type="month"
                  value={monthFilter}
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent text-xs text-neutral-800 font-medium focus:outline-none cursor-pointer"
                />
                {monthFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setMonthFilter('');
                      setCurrentPage(1);
                    }}
                    className="p-0.5 hover:bg-neutral-200 rounded text-neutral-500"
                    title="Clear month filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Clear All Filters */}
              {(search || statusFilter !== 'ALL' || categoryFilter || monthFilter) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                    setCategoryFilter('');
                    setMonthFilter('');
                    setCurrentPage(1);
                  }}
                  className="text-xs text-neutral-600 hover:text-black"
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 border-t border-neutral-100 pt-3 overflow-x-auto">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => {
              const isActive = statusFilter === st;
              const count =
                st === 'ALL'
                  ? summary.totalCount
                  : st === 'PENDING'
                  ? summary.pendingCount
                  : st === 'APPROVED'
                  ? summary.approvedCount
                  : summary.rejectedCount;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/40 shadow-sm'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <span>{st === 'ALL' ? 'All Statuses' : st}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-[#FF8500] text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/70 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Title & Category</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment & Ref</th>
                  <th className="py-3 px-4">Proof Attachment</th>
                  <th className="py-3 px-4">Submitted By</th>
                  <th className="py-3 px-4">Status & Approval</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      <div className="inline-flex items-center gap-2 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-[#FF8500]" />
                        Loading operational expenses...
                      </div>
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      <div className="space-y-2">
                        <Receipt className="w-8 h-8 text-neutral-300 mx-auto" />
                        <div className="font-medium text-neutral-600">No expenses found</div>
                        <p className="text-xs text-neutral-400">
                          {search || statusFilter !== 'ALL' || categoryFilter || monthFilter
                            ? 'Try clearing applied filters to see all recorded expenses.'
                            : 'Click "Add Expense" above to record your first operational expense with proof.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => {
                    const hasProof = Boolean(expense.proofObjectKey || expense.proofUrl);
                    const isPending = expense.status === 'PENDING';
                    const isApproved = expense.status === 'APPROVED';
                    const isRejected = expense.status === 'REJECTED';

                    return (
                      <tr key={expense.id} className="hover:bg-neutral-50/60 transition-colors">
                        {/* Title & Category */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900">{expense.title}</div>
                          <div className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                            {getCategoryLabel(expense.category)}
                          </div>
                          {expense.notes && (
                            <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1" title={expense.notes}>
                              {expense.notes}
                            </p>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap text-neutral-700 font-medium">
                          {formatDate(expense.expenseDate)}
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-sm text-neutral-900">
                            {formatCurrency(expense.amount)}
                          </span>
                        </td>

                        {/* Payment Method & Reference */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-neutral-800 font-medium">
                            {PAYMENT_METHODS.find((p) => p.value === expense.paymentMethod)?.label ||
                              expense.paymentMethod}
                          </div>
                          {expense.referenceNumber && (
                            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                              Ref: {expense.referenceNumber}
                            </div>
                          )}
                        </td>

                        {/* Proof of Attachment */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {hasProof ? (
                            <button
                              type="button"
                              onClick={() => handleOpenProofPreview(expense)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-[#FFF4E5] border border-orange-200 text-[#CC6B00] text-[11px] font-semibold transition cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#FF8500]" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-neutral-400 italic">No proof attached</span>
                          )}
                        </td>

                        {/* Submitted By */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-neutral-800 font-medium">
                            {expense.createdBy
                              ? `${expense.createdBy.firstName} ${expense.createdBy.lastName || ''}`.trim()
                              : 'Admin'}
                          </div>
                          <div className="text-[10px] text-neutral-400">
                            {expense.createdBy?.designation || 'Staff'}
                          </div>
                        </td>

                        {/* Status & Approval */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isPending && (
                            <div className="space-y-1">
                              <Badge variant="warning" className="text-[10px] font-bold">
                                Pending Approval
                              </Badge>
                              <div className="text-[10px] text-amber-700">Awaiting Super Admin</div>
                            </div>
                          )}

                          {isApproved && (
                            <div className="space-y-0.5">
                              <Badge variant="success" className="text-[10px] font-bold">
                                Approved
                              </Badge>
                              {expense.approvedBy && (
                                <div className="text-[10px] text-emerald-800 font-medium">
                                  by {expense.approvedBy.firstName}
                                </div>
                              )}
                              {expense.approvedAt && (
                                <div className="text-[10px] text-neutral-400">
                                  {formatDate(expense.approvedAt)}
                                </div>
                              )}
                            </div>
                          )}

                          {isRejected && (
                            <div className="space-y-0.5">
                              <Badge variant="error" className="text-[10px] font-bold">
                                Rejected
                              </Badge>
                              {expense.rejectionReason && (
                                <p
                                  className="text-[10px] text-rose-700 max-w-[150px] truncate"
                                  title={expense.rejectionReason}
                                >
                                  Reason: {expense.rejectionReason}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Super Admin Approval Controls */}
                            {isSuperAdmin && isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveExpense(expense)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1 shadow-sm"
                                  title="Approve expense to calculate into Finance & Settlements"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingExpense(expense);
                                    setRejectionReason('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold text-xs transition cursor-pointer flex items-center gap-1"
                                  title="Reject expense"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {/* Delete Control (Super Admin or Pending by creator) */}
                            {(isSuperAdmin || isPending) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(expense)}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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
                <strong className="font-semibold text-black">{totalPages}</strong> ({totalCount} total)
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

      {/* ---------------------------------------------------- */}
      {/* 1. ADD EXPENSE MODAL WITH PROOF ATTACHMENT */}
      {/* ---------------------------------------------------- */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          if (!submittingExpense) {
            setIsAddModalOpen(false);
            resetForm();
          }
        }}
        title="Add Institutional Expense"
        description="Record an academy operational outlay and attach proof of receipt for Super Admin approval"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4 pt-2 text-xs">
          {/* Policy Notice Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wide text-amber-800">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
              Super Admin Approval Required
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              This expense will start in <strong className="font-semibold">PENDING</strong> status. It will only be
              calculated into the Executive Finance & Settlements (<span className="font-mono">/finance-analytics</span>)
              page once approved by a Super Admin.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-700 block">
              Expense Title / Purpose <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. November Electricity Bill, Whiteboard Markers, Projector Repair"
              className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] text-xs font-medium"
            />
          </div>

          {/* Category & Amount Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 block">
                Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FF8500] text-xs font-medium bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 block">
                Amount (₹ INR) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-neutral-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] text-xs font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Expense Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 block">
                Expense Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formExpenseDate}
                onChange={(e) => setFormExpenseDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FF8500] text-xs font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 block">
                Payment Channel <span className="text-rose-500">*</span>
              </label>
              <select
                value={formPaymentMethod}
                onChange={(e) => setFormPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FF8500] text-xs font-medium bg-white"
              >
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference / Invoice # */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-700 block">Reference / Bill / UTR Number</label>
            <input
              type="text"
              value={formReferenceNumber}
              onChange={(e) => setFormReferenceNumber(e.target.value)}
              placeholder="e.g. INV-2026-9921, UTR 93849182941"
              className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FF8500] text-xs font-mono"
            />
          </div>

          {/* Proof of Attachment (File Upload) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-neutral-700 block">
              Proof of Attachment (Bill Receipt / Invoice)
            </label>
            <div className="p-3 border-2 border-dashed border-neutral-300 hover:border-[#FF8500] rounded-xl bg-neutral-50/60 transition text-center cursor-pointer relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedProofFile(e.target.files[0]);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              {selectedProofFile ? (
                <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-neutral-200">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-[#FF8500] shrink-0" />
                    <span className="font-medium text-neutral-900 truncate">{selectedProofFile.name}</span>
                    <span className="text-[10px] text-neutral-400 shrink-0 font-mono">
                      ({(selectedProofFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProofFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 hover:bg-neutral-100 rounded text-neutral-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  <Upload className="w-5 h-5 text-neutral-400 mx-auto" />
                  <div className="text-xs font-semibold text-neutral-700">
                    Click or drag & drop bill receipt
                  </div>
                  <div className="text-[10px] text-neutral-400">
                    Supported: JPG, PNG, WebP, PDF (Max 10 MB)
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-semibold text-neutral-700 block">Additional Notes / Description</label>
            <textarea
              rows={2}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Any operational remarks or context..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:border-[#FF8500] text-xs resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={submittingExpense}
              onClick={() => {
                setIsAddModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submittingExpense}
              className="bg-[#FF8500] hover:bg-[#e67700] text-white font-semibold"
            >
              {submittingExpense ? 'Saving Expense...' : 'Submit Expense'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 2. SUPER ADMIN REJECT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        isOpen={Boolean(rejectingExpense)}
        onClose={() => {
          if (!submittingRejection) {
            setRejectingExpense(null);
            setRejectionReason('');
          }
        }}
        title="Reject Expense Submission"
        description="Provide a reason for rejecting this expense. The entry will not be counted in finance analytics."
        maxWidth="md"
      >
        {rejectingExpense && (
          <form onSubmit={handleConfirmReject} className="space-y-4 pt-2 text-xs">
            <div className="p-3 bg-neutral-50 rounded-xl space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Expense Details</span>
              <div className="font-bold text-neutral-900">{rejectingExpense.title}</div>
              <div className="font-mono text-sm text-[#CC6B00] font-bold">
                {formatCurrency(rejectingExpense.amount)}
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-700 block">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Missing valid tax invoice, duplicate submission, unapproved expenditure..."
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={submittingRejection}
                onClick={() => {
                  setRejectingExpense(null);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="sm"
                disabled={submittingRejection}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {submittingRejection ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 3. PROOF PREVIEW MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        isOpen={Boolean(previewExpense)}
        onClose={() => {
          setPreviewExpense(null);
          setPreviewProofData(null);
        }}
        title="Expense Proof Attachment"
        description={previewExpense ? `${previewExpense.title} • ${formatCurrency(previewExpense.amount)}` : ''}
        maxWidth="3xl"
      >
        <div className="space-y-4 pt-2 text-xs">
          {previewLoading ? (
            <div className="py-16 text-center text-neutral-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#FF8500] mb-2" />
              Loading proof document...
            </div>
          ) : previewProofData ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl text-neutral-700 border border-neutral-200">
                <div className="flex items-center gap-2 truncate">
                  <File className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span className="font-semibold truncate">{previewProofData.fileName}</span>
                </div>
                <a
                  href={previewProofData.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FF8500] hover:bg-[#e67700] text-white font-semibold text-xs shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Open / Download</span>
                </a>
              </div>

              {/* Visual Preview */}
              <div className="max-h-[60vh] overflow-auto rounded-xl border border-neutral-200 bg-neutral-900/5 flex items-center justify-center p-2">
                {previewProofData.mimeType?.includes('pdf') ||
                previewProofData.fileName?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewProofData.downloadUrl}
                    className="w-full h-[55vh] rounded-lg border-0 bg-white"
                    title="PDF Proof Preview"
                  />
                ) : (
                  <img
                    src={previewProofData.downloadUrl}
                    alt="Receipt Proof"
                    className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-sm"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-neutral-400">
              Could not load proof attachment.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
