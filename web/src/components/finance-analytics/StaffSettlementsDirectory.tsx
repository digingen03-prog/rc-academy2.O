'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Calendar,
  Filter,
  RefreshCw,
  Info,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Receipt,
  FileText,
  Clock,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { ApiClient } from '@/lib/api/api-client';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface StaffSettlementRow {
  staffId: string;
  staffName: string;
  courses: { courseId: string; courseName: string }[];
  tiers: {
    all: { students: number; rate: number; entitlement: number };
    two: { students: number; rate: number; entitlement: number };
    single: { students: number; rate: number; entitlement: number };
  };
  totalStudents: number;
  eligibleStudents?: number;
  amountPerStudent?: number;
  totalEntitlement: number;
  realizedAmount: number;
  pendingAmount: number;
  settledAmount?: number;
  payableBalance?: number;
  marginPct: number;
  reversalCount?: number;
  isGeneralStaff?: boolean;
  proration?: {
    fullMonthlySalary: number;
    daysInMonth: number;
    daysWorked: number;
    proratedSalary: number;
    isProrated: boolean;
    joiningDate: string;
    month: string;
  };
}

export interface StudentHistoryItem {
  studentId: string;
  studentName: string;
  tier: string;
  studentFee: number;
  staffAmount: number;
  payments: {
    date: string;
    invoiceId: string;
    amountPaid: number;
    status: string;
    ledgerId: string;
    accrualAmount: number;
  }[];
  staffRealized: number;
  staffPending: number;
}

export interface AccrualLedgerNode {
  at: string;
  studentId: string;
  studentName: string;
  tier: string;
  type: 'ACCRUAL' | 'REVERSAL' | 'TRUE_UP';
  amount: number;
  invoiceId?: string;
  note?: string;
}

export interface RunningTotalNode {
  at: string;
  cumulative: number;
}

export interface StaffHistoryDetail {
  staff: { id: string; name: string; courses: { courseId: string; courseName: string }[] };
  summary: {
    totalEntitlement: number;
    realizedAmount: number;
    pendingAmount: number;
    settledAmount?: number;
    payableBalance?: number;
  };
  students: StudentHistoryItem[];
  accrualLedger: AccrualLedgerNode[];
  runningTotal: RunningTotalNode[];
}

export default function StaffSettlementsDirectory() {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [filterType, setFilterType] = useState<'ALL' | 'PENDING' | 'REVERSALS'>('ALL');
  const [loading, setLoading] = useState(false);
  const [settlements, setSettlements] = useState<StaffSettlementRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStaffForDrawer, setSelectedStaffForDrawer] = useState<StaffSettlementRow | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerDetail, setDrawerDetail] = useState<StaffHistoryDetail | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const data: StaffSettlementRow[] = await ApiClient.fetch(
        `/finance-analytics/staff-settlements?month=${selectedMonth}`,
      );
      setSettlements(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load staff settlements');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  // Initial fetch and on month change
  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  // Window focus & interval re-fetch (every 60s) so new payments visibly increase totals
  useEffect(() => {
    const handleFocus = () => {
      fetchSettlements();
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(fetchSettlements, 60000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [fetchSettlements]);

  // Open drawer and fetch fresh detail
  const handleOpenDrawer = async (row: StaffSettlementRow) => {
    setSelectedStaffForDrawer(row);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerDetail(null);

    try {
      const detail: StaffHistoryDetail = await ApiClient.fetch(
        `/finance-analytics/staff-settlements/${row.staffId}/history?month=${selectedMonth}`,
      );
      setDrawerDetail(detail);
    } catch (err: any) {
      setDrawerError(err.message || 'Failed to load payout history details');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Filtered rows
  const filteredRows = settlements.filter((row) => {
    if (filterType === 'PENDING') return row.pendingAmount > 0;
    if (filterType === 'REVERSALS') return (row.reversalCount || 0) > 0;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Control Bar: Month Picker, Filters, and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700">
            <Calendar className="w-4 h-4 text-[#FF8500]" />
            <span>Pay Period:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || currentMonthStr)}
              className="bg-transparent font-bold text-neutral-900 border-none outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1 bg-neutral-100/80 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'ALL' ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600 hover:text-black'
              }`}
            >
              All Staff ({settlements.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('PENDING')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'PENDING' ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600 hover:text-black'
              }`}
            >
              With Pending ({settlements.filter((s) => s.pendingAmount > 0).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('REVERSALS')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'REVERSALS' ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600 hover:text-black'
              }`}
            >
              Reversals ({settlements.filter((s) => (s.reversalCount || 0) > 0).length})
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSettlements}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Directory Table */}
      <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Assigned Courses</th>
                <th className="py-3 px-4">All Subjects</th>
                <th className="py-3 px-4">2-Subject</th>
                <th className="py-3 px-4">Single Sub</th>
                <th className="py-3 px-4 text-center">Total Students</th>
                <th className="py-3 px-4">Total Payout</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-neutral-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-xs font-semibold text-neutral-700">No settlements for this month yet.</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Entitlement accrues automatically when students enroll into assigned courses.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.staffId} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-neutral-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-[#CC6B00] flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
                          {row.staffName ? row.staffName.charAt(0) : 'S'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-neutral-900">{row.staffName}</div>
                          {row.reversalCount && row.reversalCount > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              <AlertTriangle className="w-2.5 h-2.5" /> Reversal Logged
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {row.courses.length === 0 ? (
                          <span className="text-neutral-400 text-[11px] italic">General Staff</span>
                        ) : (
                          row.courses.map((c) => (
                            <span
                              key={c.courseId}
                              className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200/60"
                            >
                              {c.courseName}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {row.totalStudents === 0 && row.totalEntitlement > 0 ? (
                      <td colSpan={3} className="py-3.5 px-4 font-mono text-neutral-600">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-neutral-800">
                            {row.isGeneralStaff ? 'Fixed Monthly Agreement' : 'Base Monthly Salary'}
                          </span>
                          {row.proration?.isProrated ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Prorated ({row.proration.daysWorked}/{row.proration.daysInMonth} days from {row.proration.joiningDate})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Full Month ({inr.format(row.proration?.fullMonthlySalary || row.totalEntitlement)})
                            </span>
                          )}
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-neutral-900">{row.tiers.all.students} std</span>
                          <div className="text-[10px] text-neutral-500">→ {inr.format(row.tiers.all.entitlement)}</div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-neutral-900">{row.tiers.two.students} std</span>
                          <div className="text-[10px] text-neutral-500">→ {inr.format(row.tiers.two.entitlement)}</div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="font-bold text-neutral-900">{row.tiers.single.students} std</span>
                          <div className="text-[10px] text-neutral-500">→ {inr.format(row.tiers.single.entitlement)}</div>
                        </td>
                      </>
                    )}

                    <td className="py-3.5 px-4 text-center font-bold text-sm font-mono text-neutral-900">
                      {row.totalStudents}
                    </td>

                    {/* Total Payout Cell (Primary Entitlement, Secondary Realized / Pending) */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-sm font-mono text-[#CC6B00]">
                        {inr.format(row.totalEntitlement)}
                      </div>
                      <div className="text-[10.5px] font-mono text-neutral-500 mt-0.5">
                        <span className="text-emerald-700 font-semibold">Realized {inr.format(row.realizedAmount)}</span>
                        <span className="text-neutral-300 mx-1">/</span>
                        <span className="text-amber-700 font-semibold">Pending {inr.format(row.pendingAmount)}</span>
                      </div>
                      {typeof row.payableBalance === 'number' && (
                        <div className="text-[10px] font-mono text-purple-700 font-semibold mt-0.5">
                          Payable: {inr.format(row.payableBalance)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDrawer(row)}
                        title="View Payout History & Timeline"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-neutral-200 hover:border-[#FF8500] hover:bg-orange-50/70 text-neutral-700 hover:text-[#CC6B00] font-bold text-xs transition cursor-pointer shadow-2xs"
                      >
                        <Info className="w-3.5 h-3.5 text-[#FF8500]" />
                        <span>History</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right-Side Drawer (Not a Modal) for Payout History */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-neutral-200 flex flex-col animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-neutral-200 bg-gradient-to-r from-orange-50/40 via-neutral-50 to-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#FF8500]" />
                    Payout History — {selectedStaffForDrawer?.staffName} — {selectedMonth}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Live audit trail of enrollment entitlements, student payments, and realization timeline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {drawerLoading ? (
                  <div className="py-20 text-center text-neutral-400 space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#FF8500]" />
                    <p className="text-xs font-semibold">Loading fresh payout history...</p>
                  </div>
                ) : drawerError ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {drawerError}
                  </div>
                ) : drawerDetail ? (
                  <>
                    {/* SECTION A: Summary Cards (Entitlement | Realized | Pending | Settled | Payable | Margin %) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider block">
                          Total Entitlement
                        </span>
                        <div className="text-lg font-bold font-mono text-neutral-900 mt-1">
                          {inr.format(drawerDetail.summary.totalEntitlement)}
                        </div>
                        <span className="text-[10px] text-neutral-400">Fixed amount owed</span>
                      </div>

                      <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block">
                          Realized Amount
                        </span>
                        <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                          {inr.format(drawerDetail.summary.realizedAmount)}
                        </div>
                        <span className="text-[10px] text-emerald-600">Unlocked by fees</span>
                      </div>

                      <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider block">
                          Pending Realization
                        </span>
                        <div className="text-lg font-bold font-mono text-amber-700 mt-1">
                          {inr.format(drawerDetail.summary.pendingAmount)}
                        </div>
                        <span className="text-[10px] text-amber-600">Awaiting student fees</span>
                      </div>

                      <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-blue-800 tracking-wider block">
                          Settled Amount
                        </span>
                        <div className="text-lg font-bold font-mono text-blue-700 mt-1">
                          {inr.format(drawerDetail.summary.settledAmount || 0)}
                        </div>
                        <span className="text-[10px] text-blue-600">Paid out to faculty</span>
                      </div>

                      <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-purple-800 tracking-wider block">
                          Payable Balance
                        </span>
                        <div className="text-lg font-bold font-mono text-purple-700 mt-1">
                          {inr.format(drawerDetail.summary.payableBalance || 0)}
                        </div>
                        <span className="text-[10px] text-purple-600">Realized - Settled</span>
                      </div>

                      <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                        <span className="text-[10px] font-bold uppercase text-neutral-600 tracking-wider block">
                          Academy Margin
                        </span>
                        <div className="text-lg font-bold font-mono text-neutral-800 mt-1">
                          {selectedStaffForDrawer?.marginPct ?? 0}%
                        </div>
                        <span className="text-[10px] text-neutral-500">Retained net share</span>
                      </div>
                    </div>

                    {/* SECTION B: Student Breakdown Table */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#FF8500]" />
                        <span>Student Entitlement & Fee Breakdown</span>
                      </h4>

                      <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase font-semibold text-[10px]">
                              <th className="py-2.5 px-3">Student</th>
                              <th className="py-2.5 px-3">Tier</th>
                              <th className="py-2.5 px-3">Student Fee</th>
                              <th className="py-2.5 px-3">Staff Amount</th>
                              <th className="py-2.5 px-3">Paid?</th>
                              <th className="py-2.5 px-3 text-right">Staff Realized</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100">
                            {drawerDetail.students.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-6 text-center text-neutral-400 text-xs">
                                  No enrolled students in this pay period.
                                </td>
                              </tr>
                            ) : (
                              drawerDetail.students.map((std) => (
                                <tr key={std.studentId} className="hover:bg-neutral-50/60">
                                  <td className="py-2 px-3 font-semibold text-neutral-900">{std.studentName}</td>
                                  <td className="py-2 px-3">
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                                      {std.tier}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 font-mono text-neutral-600">{inr.format(std.studentFee)}</td>
                                  <td className="py-2 px-3 font-mono font-bold text-neutral-900">{inr.format(std.staffAmount)}</td>
                                  <td className="py-2 px-3">
                                    {std.payments.length > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        {inr.format(std.payments.reduce((s, p) => s + p.amountPaid, 0))}
                                      </span>
                                    ) : (
                                      <span className="text-neutral-400 text-[10px] italic">Unpaid</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                    {inr.format(std.staffRealized)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* SECTION C: Payment / Accrual Vertical Timeline */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#FF8500]" />
                        <span>Payment / Accrual Monotonic Timeline</span>
                      </h4>

                      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
                        {drawerDetail.accrualLedger.length === 0 ? (
                          <p className="text-xs text-neutral-400 italic">No timeline events recorded.</p>
                        ) : (
                          drawerDetail.accrualLedger.map((node, idx) => {
                            const runningCumulative = drawerDetail.runningTotal[idx]?.cumulative ?? 0;
                            const isAccrual = node.type === 'ACCRUAL';

                            return (
                              <div key={`${node.at}-${idx}`} className="relative group">
                                {/* Dot indicator */}
                                <div
                                  className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                                    isAccrual ? 'bg-emerald-500' : 'bg-amber-500'
                                  }`}
                                />

                                <div className="p-3 bg-neutral-50/80 hover:bg-neutral-50 border border-neutral-200/80 rounded-xl transition space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10.5px] font-mono text-neutral-400">
                                        {new Date(node.at).toLocaleDateString('en-IN', {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: true,
                                        })}
                                      </span>
                                      <span className="font-bold text-neutral-900">{node.studentName}</span>
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-neutral-200/80 text-neutral-700">
                                        {node.tier}
                                      </span>
                                    </div>

                                    {isAccrual ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        Accrued {inr.format(node.amount)}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                        Reversal logged
                                      </span>
                                    )}
                                  </div>

                                  {node.note && (
                                    <p className="text-[11px] text-neutral-500 italic">{node.note}</p>
                                  )}

                                  {/* Cumulative Running Total */}
                                  <div className="pt-1 border-t border-neutral-200/60 flex items-center justify-between text-[11px]">
                                    <span className="text-neutral-500 font-medium">Running Total:</span>
                                    <span className="font-mono font-black text-neutral-900 text-xs">
                                      {inr.format(runningCumulative)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-neutral-200 bg-neutral-50/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Close History
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
