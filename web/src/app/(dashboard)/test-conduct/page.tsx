'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Send,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Edit3,
  ExternalLink,
  Users,
  BookOpen,
  MapPin,
  Filter,
  Layers,
  Sparkles,
  Info,
  X,
  Search,
  CalendarCheck,
  ShieldAlert,
  Play,
  CheckSquare,
  MessageSquare,
  UserCheck,
  ArrowRight,
  Share2,
} from 'lucide-react';
import { ApiClient } from '@/lib/api/api-client';
import { useAuthUser } from '@/lib/auth/use-role';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface InvigilatorInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  attendanceCode?: string | null;
  designation?: string | null;
}

interface ConductExamination {
  id: string;
  title: string;
  examType: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  venue?: string | null;
  instructions?: string | null;
  invigilatorInstructions?: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'EVALUATION' | 'PUBLISHED';
  invigilatorStatus: 'NOT_ASSIGNED' | 'ASSIGNED' | 'ACKNOWLEDGEMENT_PENDING' | 'ACKNOWLEDGED';
  invigilatorId?: string | null;
  invigilator?: InvigilatorInfo | null;
  invigilatorNotes?: string | null;
  invigilatorAcknowledgedAt?: string | null;
  announcementStatus: 'DRAFT' | 'READY_TO_SHARE' | 'OPENED_FOR_SHARING' | 'CONFIRMED_SHARED' | 'CANCELLED';
  announcementSharedAt?: string | null;
  announcementMessageSnapshot?: string | null;
  class: { id: string; name: string; code?: string };
  batch?: { id: string; name: string } | null;
  subject: { id: string; name: string; code?: string };
}

interface ConductMetrics {
  upcomingTests: number;
  todayTests: number;
  unassignedInvigilators: number;
  awaitingAnnouncements: number;
  completedTests: number;
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  attendanceCode?: string;
  designation?: string;
  userRoles?: Array<{ role: { name: string } }>;
}

interface CourseOption {
  id: string;
  name: string;
  code?: string;
  batches?: Array<{ id: string; name: string }>;
  subjects?: Array<{ id: string; name: string }>;
}

export default function ExaminationsSchedulePage() {
  const { user } = useAuthUser();

  const isSuperOrAdmin = Boolean(
    user?.roles?.includes('SUPER_ADMIN') || user?.roles?.includes('ACADEMY_ADMIN'),
  );

  // Data states
  const [examinations, setExaminations] = useState<ConductExamination[]>([]);
  const [metrics, setMetrics] = useState<ConductMetrics>({
    upcomingTests: 0,
    todayTests: 0,
    unassignedInvigilators: 0,
    awaitingAnnouncements: 0,
    completedTests: 0,
  });
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);

  // Page lifecycle
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Filters & Search
  const [search, setSearch] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'UPCOMING' | 'NEEDS_INVIGILATOR' | 'UNSHARED'>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Fast 1-click clipboard tracking (tracks examId that was copied)
  const [quickCopiedExamId, setQuickCopiedExamId] = useState<string | null>(null);

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState<boolean>(false);
  const [isCreatingNewExam, setIsCreatingNewExam] = useState<boolean>(false);
  const [invigilatorModalOpen, setInvigilatorModalOpen] = useState<boolean>(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState<boolean>(false);

  // Selected item for modals
  const [selectedExam, setSelectedExam] = useState<ConductExamination | null>(null);

  // Schedule Modal Form (Supports both updating an existing exam and creating a new scheduled exam)
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    classId: '',
    batchId: '',
    subjectId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:30',
    durationMinutes: 90,
    venue: '',
    instructions: '',
    invigilatorInstructions: '',
    invigilatorId: '',
  });
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Invigilator Modal Form
  const [invigilatorForm, setInvigilatorForm] = useState({
    invigilatorId: '',
    invigilatorStatus: 'ASSIGNED',
    invigilatorNotes: '',
    invigilatorInstructions: '',
  });
  const [invigilatorSubmitting, setInvigilatorSubmitting] = useState(false);
  const [invigilatorError, setInvigilatorError] = useState<string | null>(null);

  // Announcement Modal Form
  const [announcementMessage, setAnnouncementMessage] = useState<string>('');
  const [announcementUrl, setAnnouncementUrl] = useState<string>('');
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [announcementLoading, setAnnouncementLoading] = useState<boolean>(false);
  const [announcementSubmitting, setAnnouncementSubmitting] = useState<boolean>(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  // ----------------------------------------------------
  // Dynamic End Time Calculator
  // ----------------------------------------------------
  const calculatedEndTime = useMemo(() => {
    try {
      const [hoursStr, minsStr] = (scheduleForm.startTime || '09:30').split(':');
      let totalMinutes = parseInt(hoursStr, 10) * 60 + parseInt(minsStr, 10) + Number(scheduleForm.durationMinutes || 90);
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMins = totalMinutes % 60;
      return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
    } catch {
      return '--:--';
    }
  }, [scheduleForm.startTime, scheduleForm.durationMinutes]);

  // ----------------------------------------------------
  // Fetch Overview Data (Zero fabricated figures)
  // ----------------------------------------------------
  const fetchConductData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedClassId) params.append('classId', selectedClassId);
      if (selectedSubjectId) params.append('subjectId', selectedSubjectId);

      if (datePreset === 'TODAY') {
        const todayStr = new Date().toISOString().split('T')[0];
        params.append('date', todayStr);
      } else if (datePreset === 'NEEDS_INVIGILATOR') {
        params.append('invigilatorStatus', 'NOT_ASSIGNED');
      } else if (datePreset === 'UNSHARED') {
        params.append('announcementStatus', 'READY_TO_SHARE');
      }

      const res = await ApiClient.fetch<{ metrics: ConductMetrics; examinations: ConductExamination[] }>(
        `/examinations/conduct?${params.toString()}`,
      );

      setMetrics(
        res.metrics || {
          upcomingTests: 0,
          todayTests: 0,
          unassignedInvigilators: 0,
          awaitingAnnouncements: 0,
          completedTests: 0,
        },
      );
      setExaminations(res.examinations || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load examination schedules');
    } finally {
      setLoading(false);
    }
  }, [search, selectedClassId, selectedSubjectId, datePreset]);

  // Initial load: Fetch courses & staff metadata
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [coursesData, staffData] = await Promise.all([
          ApiClient.fetch<CourseOption[]>('/courses').catch(() => []),
          ApiClient.fetch<StaffOption[]>('/staff').catch(() => []),
        ]);
        setCourses(coursesData || []);
        setStaffList(staffData || []);
      } catch (_) {}
    };
    loadMetadata();
  }, []);

  // Fetch on filter changes
  useEffect(() => {
    fetchConductData();
  }, [fetchConductData]);

  // ----------------------------------------------------
  // Formatted Announcement Builder (Fast Local Fallback)
  // ----------------------------------------------------
  const buildWhatsAppNotice = useCallback((exam: ConductExamination) => {
    const formattedDate = new Date(exam.date).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const startTime = exam.startTime || '09:30';
    const endTime = exam.endTime || '11:00';
    const invigilatorName = exam.invigilator
      ? `${exam.invigilator.firstName} ${exam.invigilator.lastName}${
          exam.invigilator.attendanceCode ? ` (${exam.invigilator.attendanceCode})` : ''
        }`
      : 'Staff to be assigned';
    const batchText = exam.batch?.name ? exam.batch.name : 'All Batches';
    const instructions =
      exam.instructions?.trim() ||
      'Please arrive at least 15 minutes before the exam starts with required stationery and admit card. Mobile phones and smart devices are prohibited in the exam hall.';

    return `*RC Academy — Examination Schedule Announcement*
📅 *Date:* ${formattedDate}

Dear Students & Parents,

Please note the scheduled details for the upcoming examination:

📝 *Examination:* ${exam.title}
📚 *Class:* ${exam.class.name}
👥 *Batch:* ${batchText}
📘 *Subject:* ${exam.subject.name}
🕘 *Time:* ${startTime} – ${endTime} (${exam.durationMinutes} mins)
👨‍🏫 *Invigilator:* ${invigilatorName}

📌 *Instructions for Candidates:*
${instructions}

Wishing all students the very best!
— *RC Academy Administration*`;
  }, []);

  // ----------------------------------------------------
  // 1-Click Instant Copy to Clipboard (Direct on Schedule Item)
  // ----------------------------------------------------
  const handleQuickCopy = async (exam: ConductExamination) => {
    try {
      const message = buildWhatsAppNotice(exam);
      await navigator.clipboard.writeText(message);
      setQuickCopiedExamId(exam.id);
      setActionNotice({
        type: 'success',
        message: `WhatsApp notice for "${exam.title}" copied to clipboard! Ready to paste into groups.`,
      });
      setTimeout(() => {
        setQuickCopiedExamId(null);
      }, 2500);
    } catch (_) {
      setActionNotice({
        type: 'error',
        message: 'Could not write to clipboard automatically. Click "Preview Notice" to copy manually.',
      });
    }
  };

  // ----------------------------------------------------
  // Direct WhatsApp Share (Opens Web/App & Tracks Status)
  // ----------------------------------------------------
  const handleQuickWhatsAppShare = async (exam: ConductExamination) => {
    const message = buildWhatsAppNotice(exam);
    await handleQuickCopy(exam);

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    try {
      await ApiClient.fetch(`/examinations/${exam.id}/announcement/share-status`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'OPENED_FOR_SHARING',
          messageSnapshot: message,
        }),
      });
      await fetchConductData();
    } catch (_) {}
  };

  // ----------------------------------------------------
  // Schedule Modal Handlers (Create New or Edit Schedule)
  // ----------------------------------------------------
  const handleOpenScheduleModal = (exam?: ConductExamination) => {
    setScheduleError(null);
    if (exam) {
      setIsCreatingNewExam(false);
      setSelectedExam(exam);
      setScheduleForm({
        title: exam.title,
        classId: exam.class.id,
        batchId: exam.batch?.id || '',
        subjectId: exam.subject.id,
        date: exam.date ? exam.date.split('T')[0] : new Date().toISOString().split('T')[0],
        startTime: exam.startTime || '09:30',
        durationMinutes: exam.durationMinutes || 90,
        venue: exam.venue || '',
        instructions: exam.instructions || '',
        invigilatorInstructions: exam.invigilatorInstructions || '',
        invigilatorId: exam.invigilatorId || '',
      });
    } else {
      setIsCreatingNewExam(true);
      setSelectedExam(null);
      const defaultCourse = courses[0];
      setScheduleForm({
        title: '',
        classId: defaultCourse?.id || '',
        batchId: defaultCourse?.batches?.[0]?.id || '',
        subjectId: defaultCourse?.subjects?.[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:30',
        durationMinutes: 90,
        venue: '',
        instructions: 'Arrive 15 minutes early with writing stationery and student ID.',
        invigilatorInstructions: 'Verify student ID and sign attendance sheets before distributing question papers.',
        invigilatorId: '',
      });
    }
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setScheduleSubmitting(true);
      setScheduleError(null);

      let targetExamId = selectedExam?.id;

      // If creating a brand new examination
      if (isCreatingNewExam) {
        const created = await ApiClient.fetch<any>('/examinations', {
          method: 'POST',
          body: JSON.stringify({
            title: scheduleForm.title.trim(),
            examType: 'UNIT_TEST',
            classId: scheduleForm.classId,
            batchId: scheduleForm.batchId || undefined,
            subjectId: scheduleForm.subjectId,
            date: scheduleForm.date,
            durationMinutes: Number(scheduleForm.durationMinutes),
            totalMarks: 100,
            passMarks: 35,
            instructions: scheduleForm.instructions || undefined,
          }),
        });
        targetExamId = created.id;
      }

      if (!targetExamId) {
        throw new Error('No examination selected for scheduling.');
      }

      // Schedule the date, time, venue and invigilator
      await ApiClient.fetch(`/examinations/${targetExamId}/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          date: scheduleForm.date,
          startTime: scheduleForm.startTime,
          durationMinutes: Number(scheduleForm.durationMinutes),
          venue: scheduleForm.venue || undefined,
          instructions: scheduleForm.instructions || undefined,
          invigilatorInstructions: scheduleForm.invigilatorInstructions || undefined,
          invigilatorId: scheduleForm.invigilatorId || undefined,
        }),
      });

      setScheduleModalOpen(false);
      setActionNotice({
        type: 'success',
        message: isCreatingNewExam
          ? `Examination "${scheduleForm.title}" scheduled successfully!`
          : `Schedule for "${scheduleForm.title || selectedExam?.title}" updated successfully!`,
      });
      await fetchConductData();
    } catch (err: any) {
      setScheduleError(err?.message || 'Failed to save examination schedule');
    } finally {
      setScheduleSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Invigilator Assignment Handlers
  // ----------------------------------------------------
  const handleOpenInvigilatorModal = (exam: ConductExamination) => {
    setSelectedExam(exam);
    setInvigilatorError(null);
    setInvigilatorForm({
      invigilatorId: exam.invigilatorId || '',
      invigilatorStatus: exam.invigilatorStatus || 'ASSIGNED',
      invigilatorNotes: exam.invigilatorNotes || '',
      invigilatorInstructions: exam.invigilatorInstructions || '',
    });
    setInvigilatorModalOpen(true);
  };

  const handleSaveInvigilator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExam || !invigilatorForm.invigilatorId) return;

    try {
      setInvigilatorSubmitting(true);
      setInvigilatorError(null);

      await ApiClient.fetch(`/examinations/${selectedExam.id}/invigilator`, {
        method: 'PATCH',
        body: JSON.stringify({
          invigilatorId: invigilatorForm.invigilatorId,
          invigilatorStatus: invigilatorForm.invigilatorStatus,
          invigilatorNotes: invigilatorForm.invigilatorNotes || undefined,
          invigilatorInstructions: invigilatorForm.invigilatorInstructions || undefined,
        }),
      });

      setInvigilatorModalOpen(false);
      setActionNotice({
        type: 'success',
        message: `Invigilator assigned for "${selectedExam.title}".`,
      });
      await fetchConductData();
    } catch (err: any) {
      setInvigilatorError(err?.message || 'Failed to assign invigilator');
    } finally {
      setInvigilatorSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Full Announcement Modal Handlers
  // ----------------------------------------------------
  const handleOpenAnnouncementModal = async (exam: ConductExamination) => {
    setSelectedExam(exam);
    setAnnouncementError(null);
    setCopiedSuccess(false);
    setAnnouncementModalOpen(true);

    // Initial local fallback
    const fallbackMessage = buildWhatsAppNotice(exam);
    setAnnouncementMessage(fallbackMessage);
    setAnnouncementUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(fallbackMessage)}`);

    try {
      setAnnouncementLoading(true);
      const data = await ApiClient.fetch<{ message: string; whatsappUrl: string }>(
        `/examinations/${exam.id}/announcement`,
      );
      if (data?.message) {
        setAnnouncementMessage(data.message);
        setAnnouncementUrl(data.whatsappUrl);
      }
    } catch (_) {
      // Keep local fallback
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleCopyFromModal = async () => {
    try {
      await navigator.clipboard.writeText(announcementMessage);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    } catch (_) {
      alert('Failed to copy to clipboard.');
    }
  };

  const handleConfirmShared = async () => {
    if (!selectedExam) return;
    try {
      setAnnouncementSubmitting(true);
      await ApiClient.fetch(`/examinations/${selectedExam.id}/announcement/share-status`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'CONFIRMED_SHARED',
          messageSnapshot: announcementMessage,
          notes: 'Manually verified and shared to student WhatsApp group.',
        }),
      });

      setAnnouncementModalOpen(false);
      setActionNotice({
        type: 'success',
        message: `Marked "${selectedExam.title}" announcement as confirmed shared!`,
      });
      await fetchConductData();
    } catch (err: any) {
      setAnnouncementError(err?.message || 'Failed to record share status');
    } finally {
      setAnnouncementSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Conduct Lifecycle Updates (Start / Mark Complete)
  // ----------------------------------------------------
  const handleUpdateStatus = async (exam: ConductExamination, newStatus: string) => {
    const label = newStatus === 'IN_PROGRESS' ? 'Start Test' : 'Mark as Completed';
    if (!confirm(`Are you sure you want to ${label} for "${exam.title}"?`)) return;

    try {
      await ApiClient.fetch(`/examinations/${exam.id}/conduct-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setActionNotice({
        type: 'success',
        message: `Updated "${exam.title}" status to ${newStatus}.`,
      });
      await fetchConductData();
    } catch (err: any) {
      alert(err?.message || `Failed to update status`);
    }
  };

  return (
    <>
      <Header
        title="Examinations"
        subtitle="Schedule test dates, times, assign invigilators, and instantly share WhatsApp announcements with 1-click copy."
      />

      <ResponsivePageContainer>
        {/* Banner: Quick link to Question Papers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl shadow-subtle gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FF8500]/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#FF8500]" />
            </div>
            <div>
              <span className="text-xs font-semibold block text-white">Need to create or print question papers?</span>
              <p className="text-[11px] text-neutral-300">
                Author exam questions, manage the question bank, and generate printable question papers in the Question Papers module.
              </p>
            </div>
          </div>
          <Link
            href="/examinations"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF8500] hover:bg-[#CC6B00] text-white text-xs font-semibold rounded-lg transition-colors shrink-0"
          >
            Open Question Papers <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Global Feedback Banner */}
        {actionNotice && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-150 ${
              actionNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : actionNotice.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-neutral-100 text-neutral-800 border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-neutral-600 shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="p-1 text-neutral-400 hover:text-black rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button onClick={fetchConductData} variant="outline" size="sm">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        )}

        {/* Executive Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Scheduled Exams
            </span>
            <div className="text-2xl font-bold text-black mt-2">
              {loading && examinations.length === 0 ? '—' : metrics.upcomingTests}
            </div>
            <span className="text-xs text-neutral-500 mt-1 block">Active timetable entries</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Today&apos;s Tests
            </span>
            <div className="text-2xl font-bold text-[#FF8500] mt-2">
              {loading && examinations.length === 0 ? '—' : metrics.todayTests}
            </div>
            <span className="text-xs text-neutral-500 mt-1 block">Running or upcoming today</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Invigilator Coverage
            </span>
            <div className="text-2xl font-bold text-black mt-2">
              {loading && examinations.length === 0
                ? '—'
                : metrics.unassignedInvigilators === 0
                ? '100%'
                : `${metrics.unassignedInvigilators} Pending`}
            </div>
            <span className="text-xs text-neutral-500 mt-1 block">
              {metrics.unassignedInvigilators === 0 ? 'All staff assigned' : 'Need invigilator assignment'}
            </span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              WhatsApp Sharing
            </span>
            <div className="text-2xl font-bold text-emerald-600 mt-2">
              {loading && examinations.length === 0
                ? '—'
                : metrics.awaitingAnnouncements === 0
                ? 'All Shared'
                : `${metrics.awaitingAnnouncements} Unshared`}
            </div>
            <span className="text-xs text-neutral-500 mt-1 block">Student group announcements</span>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Action */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-card space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search examination name, subject, or invigilator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500] focus:bg-white transition-all"
              />
            </div>

            {/* Filter Dropdowns & New Schedule Button */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* Class Filter */}
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              >
                <option value="">All Classes</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* View Toggle */}
              <div className="flex items-center border border-neutral-200 rounded-lg p-0.5 bg-neutral-50">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                    viewMode === 'cards' ? 'bg-white text-black shadow-subtle' : 'text-neutral-500 hover:text-black'
                  }`}
                  title="Card View"
                >
                  Cards
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                    viewMode === 'table' ? 'bg-white text-black shadow-subtle' : 'text-neutral-500 hover:text-black'
                  }`}
                  title="Table View"
                >
                  Table
                </button>
              </div>

              {/* Primary Action: Schedule Examination */}
              {isSuperOrAdmin && (
                <Button
                  onClick={() => handleOpenScheduleModal()}
                  variant="primary"
                  size="sm"
                  className="whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Schedule Examination
                </Button>
              )}
            </div>
          </div>

          {/* Preset Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-neutral-100">
            {(
              [
                { id: 'ALL', label: 'All Schedules' },
                { id: 'TODAY', label: "Today's Tests" },
                { id: 'UPCOMING', label: 'Upcoming' },
                { id: 'NEEDS_INVIGILATOR', label: 'Needs Invigilator' },
                { id: 'UNSHARED', label: 'Unshared WhatsApp' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => setDatePreset(preset.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  datePreset === preset.id
                    ? 'bg-neutral-900 text-white shadow-subtle'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-black'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading Indicator */}
        {loading && examinations.length === 0 && (
          <div className="p-12 text-center bg-white rounded-xl border border-neutral-200">
            <RefreshCw className="w-6 h-6 animate-spin text-[#FF8500] mx-auto mb-2" />
            <p className="text-xs text-neutral-500 font-medium">Loading examination schedules...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && examinations.length === 0 && (
          <div className="p-12 text-center bg-white rounded-xl border border-neutral-200 shadow-card">
            <CalendarCheck className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-black">No examinations scheduled</h4>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              There are no examinations matching your current filters. Click &apos;Schedule Examination&apos; to set up an examination date, invigilator, and WhatsApp announcement.
            </p>
            {isSuperOrAdmin && (
              <Button
                onClick={() => handleOpenScheduleModal()}
                variant="primary"
                size="sm"
                className="mt-4 inline-flex"
              >
                <Plus className="w-3.5 h-3.5" /> Schedule First Examination
              </Button>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------------------- */}
        {/* VIEW 1: EXECUTIVE SCHEDULE CARDS (Default)                                */}
        {/* -------------------------------------------------------------------------- */}
        {viewMode === 'cards' && examinations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examinations.map((exam) => {
              const formattedDate = new Date(exam.date).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              });

              const isToday =
                new Date(exam.date).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
              const isCopied = quickCopiedExamId === exam.id;

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-xl border border-neutral-200 shadow-card hover:border-[#FF8500]/50 transition-all p-5 flex flex-col justify-between"
                >
                  {/* Top Bar: Class & Subject + Status Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/20">
                          {exam.subject.name}
                        </span>
                        <span className="text-xs font-semibold text-neutral-600">
                          {exam.class.name} • <strong>{exam.batch?.name || 'General Batch'}</strong>
                        </span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                            TODAY
                          </span>
                        )}
                      </div>

                      <Badge
                        variant={
                          exam.status === 'COMPLETED'
                            ? 'neutral'
                            : exam.status === 'IN_PROGRESS'
                            ? 'primary'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {exam.status}
                      </Badge>
                    </div>

                    {/* Examination Title */}
                    <h3 className="text-base font-bold text-black tracking-tight">{exam.title}</h3>

                    {/* Detailed Schedule Metrics Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100 text-xs">
                      {/* Examination Date */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-[#FF8500]" />
                          <span>Examination Date</span>
                        </div>
                        <div className="font-bold text-black font-medium">
                          {formattedDate}
                        </div>
                      </div>

                      {/* Time Interval & Duration */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-neutral-500 font-medium">
                          <Clock className="w-3.5 h-3.5 text-[#FF8500]" />
                          <span>Time ({exam.durationMinutes} mins)</span>
                        </div>
                        <div className="font-bold text-black font-mono">
                          {exam.startTime || '09:30'} – {exam.endTime || '11:00'}
                        </div>
                      </div>
                    </div>

                    {/* Invigilator Assignment Box */}
                    <div className="mt-3 p-3 rounded-lg border border-neutral-200 bg-white flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                          <UserCheck className="w-4 h-4 text-neutral-600" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-semibold text-neutral-400 block tracking-wider">
                            Invigilator
                          </span>
                          {exam.invigilator ? (
                            <div className="text-xs font-bold text-black truncate">
                              {exam.invigilator.firstName} {exam.invigilator.lastName}
                              {exam.invigilator.attendanceCode && (
                                <span className="ml-1 text-[10px] font-mono font-normal text-neutral-500">
                                  ({exam.invigilator.attendanceCode})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-amber-600 block">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Invigilator Status Badge or Assign Action */}
                      {isSuperOrAdmin && (
                        <button
                          onClick={() => handleOpenInvigilatorModal(exam)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-neutral-100 hover:bg-neutral-200 text-black transition-colors shrink-0"
                        >
                          {exam.invigilator ? 'Change' : 'Assign Staff'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Footer: WhatsApp & Controls */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-col gap-2">
                    {/* WhatsApp Status & Quick Share Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {exam.announcementStatus === 'CONFIRMED_SHARED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Shared on WhatsApp
                          </span>
                        ) : exam.announcementStatus === 'OPENED_FOR_SHARING' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" /> Opened for Sharing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                            <MessageSquare className="w-3 h-3 text-neutral-500" /> Ready to Share
                          </span>
                        )}
                      </div>

                      {/* 1-Click Quick Copy Button */}
                      <button
                        onClick={() => handleQuickCopy(exam)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-600 text-white shadow-subtle'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                        title="1-click copy formatted WhatsApp schedule notice to clipboard"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Quick Copy
                          </>
                        )}
                      </button>
                    </div>

                    {/* Secondary Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100 text-xs">
                      <div className="flex items-center gap-2">
                        {/* Direct WhatsApp Web launcher */}
                        <button
                          onClick={() => handleQuickWhatsAppShare(exam)}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Share WhatsApp
                        </button>

                        <span className="text-neutral-300">•</span>

                        {/* Preview Notice Modal */}
                        <button
                          onClick={() => handleOpenAnnouncementModal(exam)}
                          className="text-neutral-600 hover:text-black font-medium cursor-pointer"
                        >
                          Preview Notice
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSuperOrAdmin && (
                          <button
                            onClick={() => handleOpenScheduleModal(exam)}
                            className="inline-flex items-center gap-1 text-neutral-600 hover:text-black font-semibold cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        )}

                        {exam.status === 'SCHEDULED' && (
                          <button
                            onClick={() => handleUpdateStatus(exam, 'IN_PROGRESS')}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-neutral-900 hover:bg-black text-white transition-colors cursor-pointer"
                          >
                            Start Test
                          </button>
                        )}

                        {exam.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleUpdateStatus(exam, 'COMPLETED')}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* -------------------------------------------------------------------------- */}
        {/* VIEW 2: HIGH-DENSITY TIMETABLE VIEW                                        */}
        {/* -------------------------------------------------------------------------- */}
        {viewMode === 'table' && examinations.length > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-black">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Examination & Subject</th>
                    <th className="px-6 py-3.5">Class / Batch</th>
                    <th className="px-6 py-3.5">Date & Time</th>
                    <th className="px-6 py-3.5">Invigilator</th>
                    <th className="px-6 py-3.5">WhatsApp Sharing</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {examinations.map((exam) => {
                    const formattedDate = new Date(exam.date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'UTC',
                    });
                    const isCopied = quickCopiedExamId === exam.id;

                    return (
                      <tr key={exam.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-black">{exam.title}</div>
                          <div className="text-xs text-[#CC6B00] font-semibold mt-0.5">
                            {exam.subject.name}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs text-neutral-700">
                          {exam.class.name} • <strong>{exam.batch?.name || 'General'}</strong>
                        </td>

                        <td className="px-6 py-4 text-xs">
                          <div className="font-semibold text-black">{formattedDate}</div>
                          <div className="text-neutral-500 font-mono mt-0.5">
                            {exam.startTime || '09:30'} – {exam.endTime || '11:00'} ({exam.durationMinutes}m)
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs">
                          {exam.invigilator ? (
                            <div>
                              <span className="font-bold text-black block">
                                {exam.invigilator.firstName} {exam.invigilator.lastName}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                {exam.invigilator.attendanceCode || exam.invigilator.designation}
                              </span>
                            </div>
                          ) : (
                            <span className="text-amber-600 font-semibold">Unassigned</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {/* 1-Click Quick Copy Button */}
                            <button
                              onClick={() => handleQuickCopy(exam)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {isCopied ? 'Copied' : 'Copy'}
                            </button>

                            <button
                              onClick={() => handleQuickWhatsAppShare(exam)}
                              className="p-1 text-emerald-600 hover:text-emerald-800 rounded"
                              title="Share via WhatsApp"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenAnnouncementModal(exam)}
                              className="px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-black"
                            >
                              Notice
                            </button>
                            {isSuperOrAdmin && (
                              <button
                                onClick={() => handleOpenScheduleModal(exam)}
                                className="px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-black"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ResponsivePageContainer>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 1: SCHEDULE EXAMINATION (CREATE OR UPDATE)                           */}
      {/* -------------------------------------------------------------------------- */}
      <Modal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={isCreatingNewExam ? 'Schedule New Examination' : `Edit Schedule — ${selectedExam?.title}`}
        description="Establish test date, start time, calculated duration, and assign staff invigilator."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          {scheduleError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{scheduleError}</span>
            </div>
          )}

          {/* Exam Title (Required if creating new) */}
          {isCreatingNewExam && (
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Examination Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Physics Mid-Term Examination 2026"
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>
          )}

          {/* Class, Batch & Subject (If creating new) */}
          {isCreatingNewExam && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-black block mb-1">Class / Course *</label>
                <select
                  required
                  value={scheduleForm.classId}
                  onChange={(e) => {
                    const cId = e.target.value;
                    const course = courses.find((c) => c.id === cId);
                    setScheduleForm({
                      ...scheduleForm,
                      classId: cId,
                      batchId: course?.batches?.[0]?.id || '',
                      subjectId: course?.subjects?.[0]?.id || '',
                    });
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-black block mb-1">Batch</label>
                <select
                  value={scheduleForm.batchId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, batchId: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                >
                  <option value="">All Batches</option>
                  {courses
                    .find((c) => c.id === scheduleForm.classId)
                    ?.batches?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-black block mb-1">Subject *</label>
                <select
                  required
                  value={scheduleForm.subjectId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, subjectId: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                >
                  {courses
                    .find((c) => c.id === scheduleForm.classId)
                    ?.subjects?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Date & Time Settings Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Examination Date *</label>
              <input
                type="date"
                required
                value={scheduleForm.date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-black block mb-1">Start Time (24h) *</label>
              <input
                type="time"
                required
                value={scheduleForm.startTime}
                onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-black block mb-1">Duration (Minutes) *</label>
              <input
                type="number"
                min="15"
                max="360"
                required
                value={scheduleForm.durationMinutes}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, durationMinutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>
          </div>

          {/* Calculated End Time Indicator */}
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center justify-between text-xs">
            <span className="text-neutral-600 font-medium">Calculated Schedule Interval:</span>
            <span className="font-bold text-black font-mono">
              {scheduleForm.startTime} – {calculatedEndTime} ({scheduleForm.durationMinutes} mins)
            </span>
          </div>

          {/* Assign Invigilator */}
          <div>
            <label className="text-xs font-semibold text-black block mb-1">Assign Invigilator</label>
            <select
              value={scheduleForm.invigilatorId}
              onChange={(e) => setScheduleForm({ ...scheduleForm, invigilatorId: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            >
              <option value="">No Invigilator (Assign later)</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.firstName} {st.lastName}
                  {st.attendanceCode ? ` (${st.attendanceCode})` : ''} — {st.designation || 'Staff'}
                </option>
              ))}
            </select>
          </div>

          {/* Instructions for Students */}
          <div>
            <label className="text-xs font-semibold text-black block mb-1">Candidate Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Arrive 15 minutes prior to the exam with writing stationery and admit card. Mobile devices are prohibited."
              value={scheduleForm.instructions}
              onChange={(e) => setScheduleForm({ ...scheduleForm, instructions: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
            <Button
              type="button"
              onClick={() => setScheduleModalOpen(false)}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={scheduleSubmitting} variant="primary" size="sm">
              {scheduleSubmitting ? 'Saving Schedule...' : 'Save & Publish Schedule'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 2: ASSIGN INVIGILATOR                                                */}
      {/* -------------------------------------------------------------------------- */}
      <Modal
        isOpen={invigilatorModalOpen}
        onClose={() => setInvigilatorModalOpen(false)}
        title={`Assign Invigilator — ${selectedExam?.title}`}
        description="Select a qualified staff member to supervise candidate conduct and examination protocol."
        maxWidth="md"
      >
        <form onSubmit={handleSaveInvigilator} className="space-y-4">
          {invigilatorError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{invigilatorError}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-black block mb-1">Select Staff Member *</label>
            <select
              required
              value={invigilatorForm.invigilatorId}
              onChange={(e) =>
                setInvigilatorForm({ ...invigilatorForm, invigilatorId: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            >
              <option value="">Choose invigilator from staff directory...</option>
              {staffList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.firstName} {st.lastName}
                  {st.attendanceCode ? ` (${st.attendanceCode})` : ''} — {st.designation || 'Staff'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-black block mb-1">Special Invigilation Notes</label>
            <textarea
              rows={3}
              placeholder="e.g. Verify student ID cards before handing out question papers. Collect all papers promptly at bell."
              value={invigilatorForm.invigilatorNotes}
              onChange={(e) =>
                setInvigilatorForm({ ...invigilatorForm, invigilatorNotes: e.target.value })
              }
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
            <Button
              type="button"
              onClick={() => setInvigilatorModalOpen(false)}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={invigilatorSubmitting || !invigilatorForm.invigilatorId}
              variant="primary"
              size="sm"
            >
              {invigilatorSubmitting ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 3: WHATSAPP NOTICE PREVIEW & EASY COPY                                */}
      {/* -------------------------------------------------------------------------- */}
      <Modal
        isOpen={announcementModalOpen}
        onClose={() => setAnnouncementModalOpen(false)}
        title="WhatsApp Examination Announcement"
        description="Formatted message ready for student & parent WhatsApp groups with 1-click clipboard copy."
        maxWidth="lg"
      >
        <div className="space-y-4">
          {announcementError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {announcementError}
            </div>
          )}

          {/* WhatsApp Chat Simulation Card */}
          <div className="bg-[#EFEAE2] p-4 rounded-xl border border-neutral-300 shadow-inner">
            <div className="bg-emerald-700 text-white p-2.5 rounded-t-lg flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span>WhatsApp Group Announcement Preview</span>
              </div>
              <span className="text-[10px] text-emerald-200 uppercase tracking-wider font-mono">
                RC Academy
              </span>
            </div>

            <div className="bg-white p-4 rounded-b-lg shadow-sm font-sans text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed max-h-[340px] overflow-y-auto select-text">
              {announcementMessage}
            </div>
          </div>

          {/* Action Row: Copy & WhatsApp Web Launch */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyFromModal}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  copiedSuccess
                    ? 'bg-emerald-600 text-white shadow-subtle'
                    : 'bg-neutral-900 hover:bg-black text-white'
                }`}
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy WhatsApp Message
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  window.open(announcementUrl, '_blank', 'noopener,noreferrer');
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Open WhatsApp Web
              </button>
            </div>

            {/* Confirm Shared Button */}
            <Button
              onClick={handleConfirmShared}
              disabled={announcementSubmitting}
              variant="outline"
              size="sm"
            >
              {announcementSubmitting ? 'Recording...' : 'Mark as Shared to Group'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
