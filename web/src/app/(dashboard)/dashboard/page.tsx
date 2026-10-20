'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import { ApiClient } from '@/lib/api/api-client';
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
  LuUserPlus
} from '@/components/icons';
import { IndianRupee } from 'lucide-react';

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
  };
  academics: {
    upcomingExams: number;
    pendingTeacherReviews: number;
  };
  systemHealth: {
    apiStatus: string;
    aiServiceStatus: string;
    lastUpdated: string;
  };
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadData();
  }, []);

  return (
    <>
      <Header
        title="Operations Dashboard"
        subtitle="Real-time operational summary across admissions, attendance, finance and evaluations"
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
                Active Students
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
                {loading ? 'Loading records...' : error ? 'Data unavailable' : 'Verified enrollments'}
              </div>
            </div>
          </div>

          {/* Attendance Rate */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Today&apos;s Attendance
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center shrink-0">
                <LuCheckCircle2 className="w-4 h-4 text-[#FF8500]" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold text-black tracking-tight leading-none">
                {loading ? '—' : error ? '—' : `${metrics?.todayAttendance?.rate ?? 0}%`}
              </div>
              <div className="text-xs text-neutral-500 mt-1.5">
                {loading ? 'Loading records...' : error ? 'Attendance data unavailable' : `${metrics?.todayAttendance?.present ?? 0} marked present today`}
              </div>
            </div>
          </div>

          {/* Pending Dues */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Pending Dues
              </span>
              <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center shrink-0">
                <IndianRupee className="w-4 h-4 text-[#FF8500]" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold text-black tracking-tight leading-none">
                {loading ? '—' : error ? '—' : `₹${(metrics?.finance?.totalOutstanding ?? 0).toLocaleString('en-IN')}`}
              </div>
              <div className="text-xs text-neutral-500 mt-1.5">
                {loading ? 'Loading records...' : error ? 'Invoice data unavailable' : `${metrics?.finance?.pendingInvoicesCount ?? 0} open invoice(s)`}
              </div>
            </div>
          </div>

          {/* AI Review Queue */}
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
                {loading ? '—' : error ? '—' : (metrics?.academics?.pendingTeacherReviews ?? 0)}
              </div>
              <div className="text-xs text-neutral-500 mt-1.5">
                {loading ? 'Loading records...' : error ? 'Review queue unavailable' : 'Pending teacher sign-offs'}
              </div>
            </div>
          </div>
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

                <Link
                  href="/students"
                  className="p-4 rounded-xl border border-neutral-200 hover:border-[#FF8500] hover:bg-[#FFF4E5]/20 transition-all text-left group flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="w-9 h-9 rounded-lg bg-[#FF8500]/10 text-[#FF8500] flex items-center justify-center mb-3">
                      <LuUserPlus className="w-4 h-4 text-[#FF8500]" />
                    </div>
                    <div className="font-bold text-black text-sm group-hover:text-[#CC6B00] transition-colors">
                      Student Admissions
                    </div>
                    <div className="text-xs text-neutral-500 mt-1 leading-relaxed">
                      Register students, batches & guardians
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#CC6B00]">
                    Directory & Register <LuArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>

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

