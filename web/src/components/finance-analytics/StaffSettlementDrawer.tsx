'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CheckCircle2,
  Receipt,
  RefreshCw,
  X,
} from 'lucide-react';
import { ApiClient } from '@/lib/api/api-client';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export interface StudentHistoryItem {
  studentId: string;
  studentName: string;
  studentCode?: string;
  courseName?: string;
  enrolledSubjects?: string;
  tier: string;
  studentFee: number;
  staffAmount: number;
  payments: {
    date: string;
    receiptNumber?: string;
    invoiceId: string;
    paymentMethod?: string;
    cycleLabel?: string;
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
  studentFeePaid?: number;
  staffRealized?: number;
  invoiceId?: string;
  note?: string;
}

export interface RunningTotalNode {
  at: string;
  cumulative: number;
}

export interface StaffHistoryDetail {
  staff: { id: string; name: string; courses: { courseId: string; courseName: string }[] };
  payPeriod?: string;
  cycleLabel?: string;
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

export interface StaffSettlementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string | null;
  staffName?: string;
  month?: string;
  marginPct?: number;
  onMonthChange?: (month: string) => void;
}

function formatMonthDisplay(ym: string): string {
  const [y, m] = (ym || '').split('-');
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const idx = parseInt(m, 10) - 1;
  if (idx >= 0 && idx < 12 && y) {
    return `${names[idx]} ${y}`;
  }
  return ym;
}

function formatTierBadge(tier: string): string {
  if (tier === 'ALL') return 'All Subjects';
  if (tier === 'TWO_SUBJECTS') return '2 Subjects';
  if (tier === 'SINGLE' || tier === 'SINGLE_SUBJECT') return '1 Subject';
  return tier;
}

export function StaffSettlementDrawer({
  isOpen,
  onClose,
  staffId,
  staffName,
  month,
  marginPct,
  onMonthChange,
}: StaffSettlementDrawerProps) {
  const selectedMonth = month || new Date().toISOString().slice(0, 7);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<StaffHistoryDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !staffId) {
      setDetail(null);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data: StaffHistoryDetail = await ApiClient.fetch(
          `/finance-analytics/staff-settlements/${staffId}/history?month=${selectedMonth}`,
        );
        if (isMounted) {
          setDetail(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to load staff payout history details');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, staffId, selectedMonth]);

  if (!isOpen) return null;

  const displayName = staffName || detail?.staff?.name || 'Faculty Member';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-neutral-200 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 bg-gradient-to-r from-orange-50/40 via-neutral-50 to-white flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#FF8500]" />
                  <span>Settlement & Monthly Share — {displayName}</span>
                </h3>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/30">
                  {detail?.cycleLabel || formatMonthDisplay(selectedMonth)}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Monthly cycle breakdown of student fee collections and faculty revenue share realization.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onMonthChange && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#FF8500] cursor-pointer"
                  title="Switch monthly cycle"
                />
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {loading ? (
              <div className="py-20 text-center text-neutral-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#FF8500]" />
                <p className="text-xs font-semibold">Loading fresh payout history...</p>
              </div>
            ) : errorMsg ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {errorMsg}
              </div>
            ) : detail ? (
              <>
                {/* SECTION A: Summary Cards (Entitlement | Realized | Pending | Settled | Payable | Margin %) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider block">
                      Total Entitlement
                    </span>
                    <div className="text-lg font-bold font-mono text-neutral-900 mt-1">
                      {inr.format(detail.summary.totalEntitlement)}
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      Monthly cycle ({detail.students.length} students)
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider block">
                      Realized Share
                    </span>
                    <div className="text-lg font-bold font-mono text-emerald-700 mt-1">
                      {inr.format(detail.summary.realizedAmount)}
                    </div>
                    <span className="text-[10px] text-emerald-600">
                      {detail.students.filter((s) => s.payments.length > 0).length}/
                      {detail.students.length} students paid in cycle
                    </span>
                  </div>

                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider block">
                      Pending Realization
                    </span>
                    <div className="text-lg font-bold font-mono text-amber-700 mt-1">
                      {inr.format(detail.summary.pendingAmount)}
                    </div>
                    <span className="text-[10px] text-amber-600">Awaiting student fees</span>
                  </div>

                  <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-blue-800 tracking-wider block">
                      Settled Amount
                    </span>
                    <div className="text-lg font-bold font-mono text-blue-700 mt-1">
                      {inr.format(detail.summary.settledAmount || 0)}
                    </div>
                    <span className="text-[10px] text-blue-600">Paid out to faculty</span>
                  </div>

                  <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-purple-800 tracking-wider block">
                      Payable Balance
                    </span>
                    <div className="text-lg font-bold font-mono text-purple-700 mt-1">
                      {inr.format(detail.summary.payableBalance || 0)}
                    </div>
                    <span className="text-[10px] text-purple-600">Realized - Settled</span>
                  </div>

                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-neutral-600 tracking-wider block">
                      Academy Margin
                    </span>
                    <div className="text-lg font-bold font-mono text-neutral-800 mt-1">
                      {marginPct ?? 0}%
                    </div>
                    <span className="text-[10px] text-neutral-500">Retained net share</span>
                  </div>
                </div>

                {/* SECTION B: Student Breakdown Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#FF8500]" />
                      <span>
                        Student Entitlement & Monthly Share Breakdown ({detail.cycleLabel || formatMonthDisplay(selectedMonth)})
                      </span>
                    </h4>
                  </div>

                  <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase font-semibold text-[10px]">
                          <th className="py-2.5 px-3">Student</th>
                          <th className="py-2.5 px-3">Tier</th>
                          <th className="py-2.5 px-3">Student Fee</th>
                          <th className="py-2.5 px-3">Faculty Share</th>
                          <th className="py-2.5 px-3">Monthly Cycle Paid?</th>
                          <th className="py-2.5 px-3 text-right">Share Realized</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {detail.students.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-neutral-400 text-xs">
                              No enrolled students in this pay period.
                            </td>
                          </tr>
                        ) : (
                          detail.students.map((std) => {
                            const totalPaidInCycle = std.payments.reduce(
                              (s, p) => s + p.amountPaid,
                              0,
                            );
                            const isFullyPaid = totalPaidInCycle >= std.studentFee && std.studentFee > 0;
                            const latestReceipt =
                              std.payments[0]?.receiptNumber || std.payments[0]?.invoiceId;
                            return (
                              <tr key={std.studentId} className="hover:bg-neutral-50/60">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-neutral-900">
                                    {std.studentName}
                                  </div>
                                  {(std.enrolledSubjects || std.courseName) && (
                                    <div className="text-[10px] text-neutral-400 mt-0.5">
                                      {std.courseName ? `${std.courseName}` : ''}
                                      {std.courseName && std.enrolledSubjects ? ' • ' : ''}
                                      {std.enrolledSubjects || ''}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/25">
                                    {formatTierBadge(std.tier)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-neutral-700 font-semibold">
                                  {inr.format(std.studentFee)}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-neutral-900">
                                  {inr.format(std.staffAmount)}
                                </td>
                                <td className="py-2.5 px-3">
                                  {std.payments.length > 0 && totalPaidInCycle > 0 ? (
                                    <div className="flex flex-col items-start gap-0.5">
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                          isFullyPaid
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}
                                      >
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        {isFullyPaid ? 'Paid' : 'Partial'} {inr.format(totalPaidInCycle)}
                                      </span>
                                      {latestReceipt && (
                                        <span className="text-[9.5px] font-mono text-neutral-400">
                                          {latestReceipt}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 text-neutral-500">
                                      Unpaid
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono">
                                  <div
                                    className={`font-bold ${
                                      std.staffRealized > 0 ? 'text-emerald-700' : 'text-neutral-400'
                                    }`}
                                  >
                                    {inr.format(std.staffRealized)}
                                  </div>
                                  {std.staffPending > 0 ? (
                                    <div className="text-[9.5px] font-sans text-amber-600">
                                      Pending {inr.format(std.staffPending)}
                                    </div>
                                  ) : std.staffRealized > 0 ? (
                                    <div className="text-[9.5px] font-sans text-emerald-600">
                                      Shared
                                    </div>
                                  ) : null}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {detail.students.length > 0 && (
                        <tfoot>
                          <tr className="bg-neutral-50 border-t border-neutral-200 font-bold text-xs">
                            <td className="py-2.5 px-3 text-neutral-900" colSpan={2}>
                              Monthly Cycle Total ({detail.students.length} students)
                            </td>
                            <td className="py-2.5 px-3 font-mono text-neutral-700">
                              {inr.format(
                                detail.students.reduce((s, st) => s + st.studentFee, 0),
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-neutral-900">
                              {inr.format(detail.summary.totalEntitlement)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-emerald-700">
                              {inr.format(
                                detail.students.reduce(
                                  (s, st) =>
                                    s + st.payments.reduce((ps, p) => ps + p.amountPaid, 0),
                                  0,
                                ),
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                              {inr.format(detail.summary.realizedAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
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
                    {detail.accrualLedger.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic">No timeline events recorded.</p>
                    ) : (
                      detail.accrualLedger.map((node, idx) => {
                        const runningCumulative = detail.runningTotal[idx]?.cumulative ?? 0;
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
              onClick={onClose}
              className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Close History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

