'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import { ApiClient } from '@/lib/api/api-client';
import { useAuthUser } from '@/lib/auth/use-role';
import {
  LuUsers,
  LuCheckCircle2,
  LuWallet,
  LuFileCheck2,
  LuActivity,
  LuArrowRight,
  LuQrCode,
  LuBookOpen,
  LuUserCheck,
  LuUserPlus,
  LuLayers,
  LuCalendarClock,
} from '@/components/icons';
import {
  IndianRupee,
  Phone,
  PhoneCall,
  MessageSquare,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  UserX,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

interface Metrics {
  activeStudents: number;
  todayAttendance: {
    present: number;
    total: number;
    rate: number;
  };
  finance: {
    totalOutstanding: number;
    pendingInvoicesCount: number;
    currentMonthPending?: number;
    currentMonthInvoicesCount?: number;
    pendingStudentsCount?: number;
    monthName?: string;
  } | null;
  academics: {
    upcomingExams: number;
    pendingTeacherReviews: number;
  } | null;
  systemHealth: {
    apiStatus: string;
    aiServiceStatus: string;
    lastUpdated: string;
  };
  assignedStats?: {
    assignedCoursesCount: number;
    assignedBatchesCount: number;
  };
}

interface MissedSession {
  date: string;
  className: string;
  batchName: string;
  subjectName?: string;
  status: string;
}

interface ConsecutiveAbsentStudent {
  studentId: string;
  studentName: string;
  studentCode: string;
  admissionNumber: string;
  attendanceCode?: string | null;
  classId: string;
  className: string;
  classCode: string;
  batchName: string;
  studentPhone?: string | null;
  parentPhone?: string | null;
  parentName?: string | null;
  parentRelationship?: string | null;
  primaryContactPhone?: string | null;
  consecutiveAbsences: number;
  isConsecutiveAbsent: boolean;
  isCritical: boolean;
  isAtRisk: boolean;
  lastAttendedDate?: string | null;
  missedSessions: MissedSession[];
  totalSessionsEvaluated: number;
  attendanceRate: number;
}

interface AttendanceAnalyticsSummary {
  totalStudentsEvaluated: number;
  criticalAbsenteesCount: number;
  atRiskCount: number;
  thresholdUsed: number;
  filteredCount: number;
}

interface AttendanceAnalyticsResponse {
  summary: AttendanceAnalyticsSummary;
  availableClasses: Array<{ id: string; name: string; code: string }>;
  students: ConsecutiveAbsentStudent[];
  allEvaluatedCount: number;
}

export default function DashboardPage() {
  const { role, isAuthorized } = useAuthUser();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Attendance Analytics & Consecutive Absences State
  const [analyticsData, setAnalyticsData] = useState<AttendanceAnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [analyticsThreshold, setAnalyticsThreshold] = useState<number>(3);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState<string>('');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  const isStaffRole = role === 'STAFF' || role === 'TEACHER';

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ApiClient.fetch<Metrics>('/dashboard/metrics');
      setMetrics(data);
    } catch (e: any) {
      setError(e.message || 'Unable to connect to live metrics API.');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceAnalytics = async (threshold = analyticsThreshold, classId = selectedClassFilter) => {
    try {
      setLoadingAnalytics(true);
      const queryParams = new URLSearchParams();
      if (threshold > 0) queryParams.set('consecutiveThreshold', threshold.toString());
      if (classId && classId !== 'ALL') queryParams.set('classId', classId);

      const res = await ApiClient.fetch<AttendanceAnalyticsResponse>(
        `/dashboard/attendance-analytics?${queryParams.toString()}`
      );
      setAnalyticsData(res);
    } catch (e: any) {
      console.error('Failed to load attendance analytics', e);
      setAnalyticsData(null);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleCopyPhone = (id: string, phone: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(phone);
      setCopiedPhoneId(id);
      setTimeout(() => setCopiedPhoneId(null), 2000);
    }
  };

  const cleanPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const getWhatsAppUrl = (phone: string, studentName: string, count: number, dates: string[]) => {
    const formattedPhone = cleanPhone(phone);
    const dateStr = dates.slice(0, 3).join(', ');
    const message = encodeURIComponent(
      `Hello, this is regarding ${studentName}'s attendance at RCA. ${studentName} has missed ${count} consecutive classes (${dateStr}). Please confirm their status and let us know if assistance is needed.`
    );
    return `https://wa.me/${formattedPhone}?text=${message}`;
  };

  useEffect(() => {
    loadData();
    loadAttendanceAnalytics(3, 'ALL');
  }, []);

  const filteredStudents = (analyticsData?.students || []).filter((s) => {
    if (!attendanceSearchQuery.trim()) return true;
    const q = attendanceSearchQuery.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q) ||
      (s.attendanceCode && s.attendanceCode.includes(q)) ||
      (s.studentPhone && s.studentPhone.includes(q)) ||
      (s.parentPhone && s.parentPhone.includes(q)) ||
      (s.parentName && s.parentName.toLowerCase().includes(q)) ||
      s.className.toLowerCase().includes(q) ||
      s.batchName.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Header
        title="Operations Dashboard"
        subtitle={
          isStaffRole
            ? 'Real-time overview of your assigned courses, students, and daily schedules'
            : 'Real-time operational summary across admissions, attendance, finance and evaluations'
        }
      />

      <ResponsivePageContainer>
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div>
              <span className="font-semibold text-rose-900">Metrics Unavailable: </span>
              {error}
            </div>
            <button
              onClick={loadData}
              className="text-xs font-semibold text-rose-700 hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4 Core Operational Summary Panels (2x2 Grid on Mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {/* Active Students */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {isStaffRole ? 'My Students' : 'Active Students'}
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center shrink-0">
                <LuUsers className="w-4 h-4 text-[#FF8500]" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold text-black tracking-tight leading-none">
                {loading ? '—' : error ? '—' : (metrics?.activeStudents ?? 0)}
              </div>
              <div className="text-xs text-neutral-500 mt-1.5">
                {loading
                  ? 'Loading records...'
                  : error
                  ? 'Data unavailable'
                  : isStaffRole
                  ? 'Assigned student enrollments'
                  : 'Verified enrollments'}
              </div>
            </div>
          </div>

          {/* Attendance Rate */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {isStaffRole ? "Class Attendance" : "Today's Attendance"}
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center shrink-0">
                <LuCheckCircle2 className="w-4 h-4 text-[#FF8500]" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold text-black tracking-tight leading-none">
                {loading ? '—' : error ? '—' : `${metrics?.todayAttendance?.rate ?? 0}%`}
              </div>
              <div className="text-xs text-neutral-500 mt-1.5 flex items-center justify-between gap-1 flex-wrap">
                <span>
                  {loading
                    ? 'Loading records...'
                    : error
                    ? 'Attendance data unavailable'
                    : isStaffRole
                    ? `${metrics?.todayAttendance?.present ?? 0} present in assigned classes`
                    : `${metrics?.todayAttendance?.present ?? 0} marked present today`}
                </span>
                {(analyticsData?.summary?.criticalAbsenteesCount ?? 0) > 0 && (
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    {analyticsData?.summary?.criticalAbsenteesCount} consecutive absent (3+)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Current Month Pending Dues (Admin/Accountant) OR Assigned Courses (Staff/Teacher) */}
          {metrics?.finance ? (
            <Link
              href="/fees"
              className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full hover:border-[#FF8500] transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider group-hover:text-[#CC6B00] transition-colors">
                  Current Month Pending
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center shrink-0 group-hover:bg-[#FF8500] group-hover:text-white transition-colors">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-black tracking-tight leading-none">
                  {loading
                    ? '—'
                    : error
                    ? '—'
                    : `₹${(metrics.finance.currentMonthPending ?? 0).toLocaleString('en-IN')}`}
                </div>
                <div className="text-xs text-neutral-500 mt-1.5 flex items-center justify-between gap-1 flex-wrap">
                  <span>
                    {loading
                      ? 'Loading records...'
                      : error
                      ? 'Fee data unavailable'
                      : `${metrics.finance.pendingStudentsCount ?? metrics.finance.currentMonthInvoicesCount ?? 0} student(s) pending`}
                  </span>
                  {metrics.finance.totalOutstanding > (metrics.finance.currentMonthPending ?? 0) && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      ₹{metrics.finance.totalOutstanding.toLocaleString('en-IN')} total
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Assigned Courses
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center shrink-0">
                  <LuBookOpen className="w-4 h-4 text-[#FF8500]" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-black tracking-tight leading-none">
                  {loading ? '—' : error ? '—' : (metrics?.assignedStats?.assignedCoursesCount ?? 0)}
                </div>
                <div className="text-xs text-neutral-500 mt-1.5">
                  {loading ? 'Loading records...' : error ? 'Data unavailable' : `${metrics?.assignedStats?.assignedBatchesCount ?? 0} active batch assignment(s)`}
                </div>
              </div>
            </div>
          )}

          {/* AI Review Queue OR System Status */}
          {metrics?.academics ? (
            <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  AI Evaluation Queue
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center shrink-0">
                  <LuFileCheck2 className="w-4 h-4 text-[#FF8500]" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-black tracking-tight leading-none">
                  {loading ? '—' : error ? '—' : (metrics.academics.pendingTeacherReviews ?? 0)}
                </div>
                <div className="text-xs text-neutral-500 mt-1.5">
                  {loading ? 'Loading records...' : error ? 'Review queue unavailable' : 'Pending teacher sign-offs'}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  System Status
                </span>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <LuCheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-bold text-black tracking-tight leading-none">
                  {loading ? '—' : (metrics?.systemHealth?.apiStatus || 'ONLINE')}
                </div>
                <div className="text-xs text-neutral-500 mt-1.5">
                  All local services operating normally
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* ATTENDANCE ANALYTICS: CONSECUTIVE ABSENTEEISM TRACKER (3+ CALL LIST) */}
        {/* ==================================================================== */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
          {/* Header Bar with Filters */}
          <div className="p-4 sm:p-5 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-neutral-50/60">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-neutral-900 text-base leading-tight">
                    Attendance Analytics: Consecutive Absenteeism Alert
                  </h3>
                  {(analyticsData?.summary?.criticalAbsenteesCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                      {analyticsData?.summary?.criticalAbsenteesCount} Critical (3+ Missed)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Attendance Regular
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Real-time tracker of continuous missed classes across courses for immediate guardian follow-up & phone calls
                </p>
              </div>
            </div>

            {/* Quick Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Threshold Selector */}
              <div className="inline-flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-100 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setAnalyticsThreshold(3);
                    loadAttendanceAnalytics(3, selectedClassFilter);
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    analyticsThreshold === 3
                      ? 'bg-rose-600 text-white font-bold shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  3+ Missed (Urgent)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnalyticsThreshold(2);
                    loadAttendanceAnalytics(2, selectedClassFilter);
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    analyticsThreshold === 2
                      ? 'bg-amber-600 text-white font-bold shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  2+ Missed (At Risk)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnalyticsThreshold(1);
                    loadAttendanceAnalytics(1, selectedClassFilter);
                  }}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    analyticsThreshold === 1
                      ? 'bg-neutral-800 text-white font-bold shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  All Streaks
                </button>
              </div>

              {/* Class Filter Dropdown */}
              <div className="relative">
                <select
                  value={selectedClassFilter}
                  onChange={(e) => {
                    const newClass = e.target.value;
                    setSelectedClassFilter(newClass);
                    loadAttendanceAnalytics(analyticsThreshold, newClass);
                  }}
                  className="appearance-none bg-white border border-neutral-200 text-neutral-800 text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FF8500] cursor-pointer"
                >
                  <option value="ALL">All Classes & Standards</option>
                  {(analyticsData?.availableClasses || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Reload Button */}
              <button
                type="button"
                onClick={() => loadAttendanceAnalytics(analyticsThreshold, selectedClassFilter)}
                title="Refresh Attendance Analytics"
                className="w-8 h-8 rounded-lg border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 text-neutral-600 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin text-[#FF8500]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search Bar & Aggregate Strip */}
          <div className="px-4 sm:px-5 py-2.5 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name, code, phone number, or course..."
                value={attendanceSearchQuery}
                onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#FF8500]"
              />
            </div>

            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span>
                Evaluated: <strong className="text-neutral-900 font-mono">{analyticsData?.summary?.totalStudentsEvaluated || 0}</strong> students
              </span>
              <span>•</span>
              <span className="text-rose-700 font-medium">
                3+ Consecutive: <strong className="font-mono text-rose-800">{analyticsData?.summary?.criticalAbsenteesCount || 0}</strong>
              </span>
              <span>•</span>
              <span>
                Listed: <strong className="text-neutral-900 font-mono">{filteredStudents.length}</strong>
              </span>
            </div>
          </div>

          {/* Content: High-Density Table */}
          {loadingAnalytics ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-8 h-8 border-2 border-[#FF8500] border-t-transparent rounded-full animate-spin mb-3" />
              <div className="text-xs font-semibold text-neutral-700">Analyzing consecutive class attendance...</div>
              <div className="text-[11px] text-neutral-400 mt-1">Cross-referencing sessions across all academic courses</div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-100">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h4 className="text-sm font-bold text-neutral-900">
                No Continuous Absences Found
              </h4>
              <p className="text-xs text-neutral-500 max-w-md mt-1">
                {analyticsThreshold > 1
                  ? `Zero students currently have ${analyticsThreshold}+ consecutive missed classes in this selection. Attendance health is regular.`
                  : 'No attendance streaks found matching the current search criteria.'}
              </p>
              {analyticsThreshold > 2 && (analyticsData?.summary?.atRiskCount || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAnalyticsThreshold(2);
                    loadAttendanceAnalytics(2, selectedClassFilter);
                  }}
                  className="mt-3 text-xs font-semibold text-[#CC6B00] hover:underline"
                >
                  View {analyticsData?.summary?.atRiskCount} student(s) with 2 consecutive missed classes
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-neutral-50 shadow-[0_1px_0_0_#e5e5e5]">
                  <tr className="text-neutral-600 uppercase font-semibold text-[11px] tracking-wider">
                    <th className="py-2.5 px-3 text-center w-12">S.No</th>
                    <th className="py-2.5 px-3.5 min-w-[200px]">Student Details</th>
                    <th className="py-2.5 px-3.5 min-w-[150px]">Course & Batch</th>
                    <th className="py-2.5 px-3.5 text-center min-w-[150px]">Consecutive Missed</th>
                    <th className="py-2.5 px-3.5 min-w-[150px]">Missed Class Dates</th>
                    <th className="py-2.5 px-3.5 min-w-[120px]">Last Attended</th>
                    <th className="py-2.5 px-3.5 min-w-[210px]">Phone & Contacts</th>
                    <th className="py-2.5 px-3.5 text-right min-w-[140px]">Quick Follow-up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-neutral-800">
                  {filteredStudents.map((s, idx) => (
                    <tr key={s.studentId} className="hover:bg-neutral-50/70 transition-colors">
                      {/* S.No */}
                      <td className="py-3 px-3 text-center font-mono text-neutral-500 font-semibold text-xs">
                        {idx + 1}
                      </td>

                      {/* Student Details */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-neutral-900 text-sm">
                          {s.studentName}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{s.admissionNumber}</span>
                          <span>•</span>
                          <span>{s.studentCode}</span>
                          {s.attendanceCode && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FFF4E5] text-[#CC6B00] border border-[#FFE0B2]">
                              Code: {s.attendanceCode}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Course & Batch */}
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-neutral-900 text-xs">
                          {s.className}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                          {s.batchName}
                        </div>
                      </td>

                      {/* Consecutive Missed Classes */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                              s.consecutiveAbsences >= 3
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            {s.consecutiveAbsences} Missed in a Row
                          </span>
                          {s.consecutiveAbsences >= 3 && (
                            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tight mt-1">
                              Urgent Call Needed
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Missed Class Dates */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {s.missedSessions.slice(0, 4).map((ms, mIdx) => (
                            <span
                              key={mIdx}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-100 font-semibold"
                            >
                              {ms.date}
                            </span>
                          ))}
                          {s.missedSessions.length > 4 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-neutral-100 text-neutral-600">
                              +{s.missedSessions.length - 4} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Attended */}
                      <td className="py-3 px-3.5 text-xs text-neutral-600">
                        {s.lastAttendedDate ? (
                          <div className="flex items-center gap-1 font-mono font-medium">
                            <Clock className="w-3 h-3 text-neutral-400" />
                            {s.lastAttendedDate}
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic text-[11px]">No recent record</span>
                        )}
                        <div className="text-[10px] text-neutral-400 mt-0.5">
                          Rate: <strong className="text-neutral-700">{s.attendanceRate}%</strong>
                        </div>
                      </td>

                      {/* Contact Numbers (Student & Parent) */}
                      <td className="py-3 px-3.5">
                        <div className="space-y-1">
                          {/* Student Phone */}
                          {s.studentPhone ? (
                            <div className="flex items-center justify-between gap-1 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100">
                              <div className="flex items-center gap-1.5 font-mono text-xs text-neutral-800">
                                <Phone className="w-3 h-3 text-neutral-500" />
                                <span>{s.studentPhone}</span>
                                <span className="text-[9px] uppercase font-bold text-neutral-400">(Student)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyPhone(`s-${s.studentId}`, s.studentPhone!)}
                                title="Copy student phone"
                                className="text-neutral-400 hover:text-neutral-700 p-0.5"
                              >
                                {copiedPhoneId === `s-${s.studentId}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : null}

                          {/* Parent Phone */}
                          {s.parentPhone ? (
                            <div className="flex items-center justify-between gap-1 bg-[#FFF4E5]/40 px-2 py-1 rounded-md border border-[#FFE0B2]">
                              <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[#CC6B00]">
                                <PhoneCall className="w-3 h-3 text-[#FF8500]" />
                                <span>{s.parentPhone}</span>
                                <span className="text-[9px] uppercase font-bold text-[#CC6B00]">
                                  ({s.parentRelationship || 'Parent'})
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyPhone(`p-${s.studentId}`, s.parentPhone!)}
                                title="Copy parent phone"
                                className="text-neutral-400 hover:text-neutral-700 p-0.5"
                              >
                                {copiedPhoneId === `p-${s.studentId}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : null}

                          {!s.studentPhone && !s.parentPhone && (
                            <span className="text-neutral-400 italic text-[11px]">No contact number saved</span>
                          )}
                        </div>
                      </td>

                      {/* Quick Action Buttons */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Direct Phone Call Button */}
                          {s.primaryContactPhone ? (
                            <a
                              href={`tel:${s.primaryContactPhone}`}
                              title={`Call ${s.parentPhone ? 'Parent' : 'Student'} (${s.primaryContactPhone})`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF8500] hover:bg-[#CC6B00] text-white font-semibold text-xs transition-colors shadow-sm"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call</span>
                            </a>
                          ) : null}

                          {/* WhatsApp Follow-up Button */}
                          {s.primaryContactPhone ? (
                            <a
                              href={getWhatsAppUrl(
                                s.primaryContactPhone,
                                s.studentName,
                                s.consecutiveAbsences,
                                s.missedSessions.map((m) => m.date)
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Send WhatsApp Absence Inquiry"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Operational Quick Actions & System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
          <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-black text-sm tracking-tight uppercase text-neutral-500">
                  Operational Workflows
                </h3>
                <span className="text-[11px] font-medium text-neutral-400">
                  Direct navigation
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Workflow 1: Smart Attendance */}
                <Link
                  href="/attendance"
                  className="p-4 rounded-xl border border-neutral-200 hover:border-[#FF8500] hover:bg-[#FFF4E5]/20 transition-all text-left group flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center mb-3">
                      <LuQrCode className="w-4 h-4 text-[#FF8500]" />
                    </div>
                    <div className="font-bold text-black text-sm group-hover:text-[#CC6B00] transition-colors">
                      Smart Attendance
                    </div>
                    <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Rapid 3-digit & barcode scanner mode
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#CC6B00]">
                    Launch Scanner <LuArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>

                {/* Workflow 2: Students */}
                <Link
                  href="/students"
                  className="p-4 rounded-xl border border-neutral-200 hover:border-[#FF8500] hover:bg-[#FFF4E5]/20 transition-all text-left group flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center mb-3">
                      <LuUserPlus className="w-4 h-4 text-[#FF8500]" />
                    </div>
                    <div className="font-bold text-black text-sm group-hover:text-[#CC6B00] transition-colors">
                      {isStaffRole ? 'My Students' : 'Student Admissions'}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      {isStaffRole
                        ? 'Directory of students in your assigned classes'
                        : 'Register students, batches & guardians'}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#CC6B00]">
                    {isStaffRole ? 'View Students' : 'Directory & Register'}{' '}
                    <LuArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>

                {/* Workflow 3: Role-specific 3rd action */}
                {role === 'ACCOUNTANT' ? (
                  <Link
                    href="/fees"
                    className="p-4 rounded-xl border border-neutral-200 hover:border-[#FF8500] hover:bg-[#FFF4E5]/20 transition-all text-left group flex flex-col justify-between h-full"
                  >
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center mb-3">
                        <LuWallet className="w-4 h-4 text-[#FF8500]" />
                      </div>
                      <div className="font-bold text-black text-sm group-hover:text-[#CC6B00] transition-colors">
                        Fees & Finance
                      </div>
                      <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        Invoices, collections & fee adjustments
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#CC6B00]">
                      Open Fees <LuArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ) : isStaffRole && role !== 'TEACHER' ? (
                  <Link
                    href="/schedule"
                    className="p-4 rounded-xl border border-neutral-200 hover:border-[#FF8500] hover:bg-[#FFF4E5]/20 transition-all text-left group flex flex-col justify-between h-full"
                  >
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center mb-3">
                        <LuCalendarClock className="w-4 h-4 text-[#FF8500]" />
                      </div>
                      <div className="font-bold text-black text-sm group-hover:text-[#CC6B00] transition-colors">
                        Class Schedule
                      </div>
                      <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        Daily timetables & WhatsApp updates
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#CC6B00]">
                      View Schedule <LuArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ) : (
                  <Link
                    href="/examinations"
                    className="p-4 rounded-xl border border-neutral-200 hover:border-[#FF8500] hover:bg-[#FFF4E5]/20 transition-all text-left group flex flex-col justify-between h-full"
                  >
                    <div>
                      <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center mb-3">
                        <LuBookOpen className="w-4 h-4 text-[#FF8500]" />
                      </div>
                      <div className="font-bold text-black text-sm group-hover:text-[#CC6B00] transition-colors">
                        Exam Paper Engine
                      </div>
                      <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
                        AI generation & printable papers
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#CC6B00]">
                      Manage Papers <LuArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Local AI System Health */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-black text-sm tracking-tight flex items-center gap-2">
                  <LuActivity className="w-4 h-4 text-[#FF8500]" />
                  System Health
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                  On-Premise
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500 text-xs">NestJS API</span>
                  <span className="font-medium text-xs text-black flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${metrics?.systemHealth?.apiStatus === 'ONLINE' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    {metrics?.systemHealth?.apiStatus || (loading ? 'Checking...' : 'Unavailable')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                  <span className="text-neutral-500 text-xs">Ollama Inference</span>
                  <span className="font-medium text-xs text-black flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${metrics?.systemHealth?.aiServiceStatus === 'ONLINE' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    {metrics?.systemHealth?.aiServiceStatus || (loading ? 'Checking...' : 'Unavailable')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-neutral-500 text-xs">Active Local Model</span>
                  <span className="font-mono text-xs font-medium text-neutral-800">
                    {metrics ? 'qwen2.5:3b' : (loading ? 'Checking...' : 'Unavailable')}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-neutral-500 mt-4 pt-3 border-t border-neutral-100 leading-normal">
              Student data and exams stay strictly on local hardware. Zero external cloud LLM dependencies.
            </div>
          </div>
        </div>
      </ResponsivePageContainer>
    </>
  );
}

