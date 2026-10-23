'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import { ApiClient } from '@/lib/api/api-client';
import {
  Calendar,
  Clock,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Users,
  BookOpen,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Play,
  Check,
  Lock,
  Edit2,
  Briefcase,
  UserCheck,
  UserX,
  FileText,
  Info,
  CalendarDays,
  X,
  Sparkles,
  GraduationCap,
  Phone,
  Copy,
  MessageCircle
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// ----------------------------------------------------
// TYPES
// ----------------------------------------------------

interface QuickMarkStudentResult {
  id: string;
  studentCode: string;
  admissionNumber: string;
  attendanceCode?: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string;
  phone?: string | null;
  status: string;
  currentBatch?: {
    id: string;
    name: string;
    code?: string | null;
    class: {
      id: string;
      name: string;
      code: string;
    };
  } | null;
  enrollments: Array<{
    id: string;
    batchId: string;
    batchName: string;
    batchCode?: string | null;
    classId: string;
    className: string;
    classCode: string;
    subjectId?: string | null;
    subjectName?: string | null;
    subjectCode?: string | null;
  }>;
}

interface TodaySummary {
  classesScheduledToday: number;
  sessionsCompleted: number;
  sessionsInProgress: number;
  upcomingSessions: number;
  totalEligibleStudents: number;
  totalPresentStudents: number;
  overallAttendanceRate: number;
}

interface ScheduledClassItem {
  id: string;
  scheduleId: string | null;
  exceptionId?: string | null;
  classId: string;
  className: string;
  classCode: string;
  subjectId?: string | null;
  subjectName?: string | null;
  subjectCode?: string | null;
  batchId?: string | null;
  batchName: string;
  teacherId?: string | null;
  teacherName: string;
  teacherEmail?: string | null;
  startTime: string;
  endTime: string;
  room?: string | null;
  isCancelled: boolean;
  cancellationReason?: string | null;
  isSpecialClass?: boolean;
  isSubstituted?: boolean;
  sessionId?: string | null;
  sessionStatus: 'NOT_STARTED' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  eligibleStudentCount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  unmarkedCount: number;
  attendanceRate: number;
}

interface StudentRosterItem {
  id: string;
  studentId: string;
  studentCode: string;
  attendanceCode?: string | null;
  studentName: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'UNMARKED';
  recordedAt?: string;
  recordedBy?: string;
}

interface ActiveSessionData {
  session: {
    id: string;
    batchId: string;
    batchName: string;
    classId: string;
    className: string;
    subjectId?: string | null;
    subjectName?: string | null;
    classScheduleId?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    teacherName?: string | null;
    date: string;
    sessionType: string;
    status: 'OPEN' | 'CLOSED';
  };
  summary: {
    totalEnrolled: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    unmarkedCount: number;
    attendanceRate: number;
  };
  records: Array<{
    id: string;
    studentId: string;
    studentCode: string;
    attendanceCode?: string | null;
    studentName: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    recordedAt: string;
    recordedBy: string;
    corrections?: any[];
  }>;
  unmarkedStudents: Array<{
    id: string;
    studentCode: string;
    attendanceCode?: string | null;
    studentName: string;
    gender: string;
  }>;
}

interface HistoryRecord {
  id: string;
  sessionId: string;
  sessionDate: string;
  sessionType: string;
  sessionStatus: 'OPEN' | 'CLOSED';
  startTime?: string | null;
  endTime?: string | null;
  className: string;
  classCode: string;
  subjectName: string;
  batchName: string;
  teacherName?: string | null;
  studentId: string;
  studentName: string;
  studentCode: string;
  attendanceCode?: string | null;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  recordedAt: string;
  recordedBy: string;
  corrections?: any[];
}

interface StaffRecord {
  id: string;
  date: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status: string;
  durationHours?: number | null;
  notes?: string | null;
  user: {
    id: string;
    name: string;
    designation?: string | null;
    attendanceCode?: string | null;
    email: string;
  };
}

export default function AttendancePage() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'SCANNER' | 'HISTORY' | 'STAFF'>('SCANNER');

  // Today's classes state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dateFormatted, setDateFormatted] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [todaySummary, setTodaySummary] = useState<TodaySummary>({
    classesScheduledToday: 0,
    sessionsCompleted: 0,
    sessionsInProgress: 0,
    upcomingSessions: 0,
    totalEligibleStudents: 0,
    totalPresentStudents: 0,
    overallAttendanceRate: 0,
  });
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClassItem[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);

  // Active session modal / scanner state
  const [activeSessionModalOpen, setActiveSessionModalOpen] = useState(false);
  const [activeSessionData, setActiveSessionData] = useState<ActiveSessionData | null>(null);
  const [scannerInputCode, setScannerInputCode] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<QuickMarkStudentResult[]>([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [selectedQuickMarkSessionId, setSelectedQuickMarkSessionId] = useState<string>('');
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);
  const [lastScanFeedback, setLastScanFeedback] = useState<{
    success: boolean;
    alreadyMarked?: boolean;
    message: string;
    studentName?: string;
    studentCode?: string;
    attendanceCode?: string;
    status?: string;
  } | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'UNMARKED'>('ALL');
  const [openingScheduleId, setOpeningScheduleId] = useState<string | null>(null);
  const [isBulkMarking, setIsBulkMarking] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showGroupLinkModal, setShowGroupLinkModal] = useState<{ batchId: string; batchName: string } | null>(null);
  const [groupLinkInput, setGroupLinkInput] = useState('');
  const [selectedTodayAttendanceClass, setSelectedTodayAttendanceClass] = useState<ScheduledClassItem | null>(null);
  const [todayAttendanceStudents, setTodayAttendanceStudents] = useState<Array<{ id: string; studentId: string; name: string; code: string; status: 'PRESENT' | 'ABSENT' }>>([]);
  const [loadingTodayAttendance, setLoadingTodayAttendance] = useState(false);
  const [submittingTodayAttendance, setSubmittingTodayAttendance] = useState(false);
  const [todayAttendanceSearch, setTodayAttendanceSearch] = useState('');
  const [submittedAbsenteeModalData, setSubmittedAbsenteeModalData] = useState<{
    classItem: ScheduledClassItem;
    message: string;
    absentees: Array<{ name: string; code: string }>;
    presentCount: number;
    absentCount: number;
    totalCount: number;
  } | null>(null);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [closeSessionModalOpen, setCloseSessionModalOpen] = useState(false);
  const [markUnmarkedAsAbsent, setMarkUnmarkedAsAbsent] = useState(true);

  // History state
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [historySummary, setHistorySummary] = useState({
    totalRecords: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    excusedCount: 0,
    attendanceRate: 0,
  });
  const [historyFilters, setHistoryFilters] = useState({
    startDate: '',
    endDate: '',
    studentQuery: '',
    classId: '',
    batchId: '',
    attendanceStatus: '',
    sessionStatus: '',
  });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Filter options
  const [classesList, setClassesList] = useState<any[]>([]);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [staffUsersList, setStaffUsersList] = useState<any[]>([]);

  // Correction modal state
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [targetCorrectionRecord, setTargetCorrectionRecord] = useState<HistoryRecord | null>(null);
  const [correctionNewStatus, setCorrectionNewStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Staff Attendance state
  const [staffRecords, setStaffRecords] = useState<StaffRecord[]>([]);
  const [staffCodeInput, setStaffCodeInput] = useState('');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [staffScanFeedback, setStaffScanFeedback] = useState<{
    success: boolean;
    type?: string;
    message: string;
    staffName?: string;
    time?: string;
  } | null>(null);
  const [manualStaffModalOpen, setManualStaffModalOpen] = useState(false);
  const [manualStaffForm, setManualStaffForm] = useState({
    userId: '',
    date: '',
    checkInAt: '',
    checkOutAt: '',
    status: 'PRESENT',
    notes: '',
  });

  const scanInputRef = useRef<HTMLInputElement>(null);
  const staffScanInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // DATA FETCHING
  // ----------------------------------------------------

  const loadTodayData = useCallback(async (dateParam?: string) => {
    setLoadingToday(true);
    try {
      const url = dateParam ? `/attendance/today?date=${dateParam}` : '/attendance/today';
      const data = await ApiClient.fetch<any>(url);
      if (data) {
        setSelectedDate(data.date);
        setDateFormatted(data.dateFormatted);
        setTimezone(data.timezone || 'Asia/Kolkata');
        setTodaySummary(data.summary || {});
        setScheduledClasses(data.classes || []);
      }
    } catch (err: any) {
      console.error('Failed to load today attendance data:', err);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const loadHistoryData = useCallback(async (page: number = 1) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (historyFilters.startDate) params.set('startDate', historyFilters.startDate);
      if (historyFilters.endDate) params.set('endDate', historyFilters.endDate);
      if (historyFilters.studentQuery) params.set('studentQuery', historyFilters.studentQuery);
      if (historyFilters.classId) params.set('classId', historyFilters.classId);
      if (historyFilters.batchId) params.set('batchId', historyFilters.batchId);
      if (historyFilters.attendanceStatus) params.set('attendanceStatus', historyFilters.attendanceStatus);
      if (historyFilters.sessionStatus) params.set('sessionStatus', historyFilters.sessionStatus);

      const res = await ApiClient.fetch<any>(`/attendance/history?${params.toString()}`);
      if (res) {
        setHistoryRecords(res.records || []);
        setHistoryPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
        setHistorySummary(res.summary || {});
      }
    } catch (err: any) {
      console.error('Failed to load attendance history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilters]);

  const loadStaffRecords = useCallback(async (dateParam?: string) => {
    try {
      const targetDate = dateParam || selectedDate;
      const url = targetDate ? `/attendance/staff/records?date=${targetDate}` : '/attendance/staff/records';
      const data = await ApiClient.fetch<StaffRecord[]>(url);
      setStaffRecords(data || []);
    } catch (err: any) {
      console.error('Failed to load staff records:', err);
    }
  }, [selectedDate]);

  const loadFilterOptions = async () => {
    try {
      const [classes, batches, staff] = await Promise.all([
        ApiClient.fetch<any[]>('/courses').catch(() => []),
        ApiClient.fetch<any[]>('/courses/batches').catch(() => []),
        ApiClient.fetch<any[]>('/staff').catch(() => []),
      ]);
      setClassesList(classes || []);
      setBatchesList(batches || []);
      setStaffUsersList(staff || []);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  useEffect(() => {
    loadTodayData();
    loadFilterOptions();
  }, [loadTodayData]);

  useEffect(() => {
    if (activeTab === 'HISTORY') {
      loadHistoryData(1);
    } else if (activeTab === 'STAFF') {
      loadStaffRecords(selectedDate);
    }
  }, [activeTab, loadHistoryData, loadStaffRecords, selectedDate]);

  // Focus scan input when modal opens
  useEffect(() => {
    if (activeSessionModalOpen && scanInputRef.current) {
      setTimeout(() => scanInputRef.current?.focus(), 150);
    }
  }, [activeSessionModalOpen]);

  // ----------------------------------------------------
  // SESSION ACTIONS
  // ----------------------------------------------------

  const handleStartOrOpenSession = async (item: ScheduledClassItem) => {
    setOpeningScheduleId(item.id);
    try {
      let sessionId = item.sessionId;

      if (!sessionId) {
        // Transparently initialize/fetch attendance session for this schedule
        const res = await ApiClient.fetch<any>('/attendance/sessions/start-class', {
          method: 'POST',
          body: JSON.stringify({
            scheduleId: item.scheduleId,
            batchId: item.batchId,
            classId: item.classId,
            subjectId: item.subjectId,
            startTime: item.startTime,
            endTime: item.endTime,
            date: selectedDate,
          }),
        });
        sessionId = res.id;
      }

      if (sessionId) {
        // Load full attendance roster
        const sessionDetails = await ApiClient.fetch<ActiveSessionData>(`/attendance/sessions/${sessionId}`);
        setActiveSessionData(sessionDetails);
        setActiveSessionModalOpen(true);
        setLastScanFeedback(null);
        setScannerInputCode('');
        setRosterSearch('');
        setRosterStatusFilter('ALL');
        // Refresh today summary in background
        loadTodayData(selectedDate);
      }
    } catch (err: any) {
      alert(`Could not open attendance: ${err?.message || 'Error occurred'}`);
    } finally {
      setOpeningScheduleId(null);
    }
  };

  const handleBulkMarkAllPresent = async () => {
    if (!activeSessionData || isBulkMarking) return;
    setIsBulkMarking(true);
    try {
      await ApiClient.fetch<any>('/attendance/bulk-mark', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSessionData.session.id,
          status: 'PRESENT',
        }),
      });
      const updated = await ApiClient.fetch<ActiveSessionData>(`/attendance/sessions/${activeSessionData.session.id}`);
      setActiveSessionData(updated);
      loadTodayData(selectedDate);
    } catch (err: any) {
      alert(`Could not mark all present: ${err?.message || 'Error occurred'}`);
    } finally {
      setIsBulkMarking(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const generateAbsenteeMessage = (data: {
    date: string;
    className: string;
    batchName: string;
    subjectName?: string;
    startTime?: string;
    endTime?: string;
    teacherName?: string;
    presentCount: number;
    absentCount: number;
    totalEnrolled: number;
    attendanceRate: number;
    absentees: Array<{ name: string; code: string }>;
  }) => {
    if (data.absentees.length === 0) {
      return 'All students are present.';
    }

    let msg = `Absent Students:\n`;
    data.absentees.forEach((s, idx) => {
      msg += `${idx + 1}. ${s.name}\n`;
    });

    return msg.trim();
  };

  const handleShareAbsentees = async (item: ScheduledClassItem, action: 'copy' | 'whatsapp') => {
    try {
      let absentList: Array<{ name: string; code: string }> = [];
      let presentCount = item.presentCount;
      let absentCount = item.absentCount;
      let totalEnrolled = item.eligibleStudentCount;
      let attendanceRate = item.attendanceRate;

      if (item.sessionId) {
        const sessionDetails = await ApiClient.fetch<ActiveSessionData>(`/attendance/sessions/${item.sessionId}`);
        const absentRecords = sessionDetails.records.filter((r) => r.status === 'ABSENT');
        absentList = absentRecords.map((r) => ({
          name: r.studentName,
          code: r.attendanceCode || r.studentCode || '',
        }));
        presentCount = sessionDetails.summary.presentCount;
        absentCount = sessionDetails.summary.absentCount;
        totalEnrolled = sessionDetails.summary.totalEnrolled;
        attendanceRate = sessionDetails.summary.attendanceRate;
      }

      const message = generateAbsenteeMessage({
        date: selectedDate,
        className: item.className,
        batchName: item.batchName,
        subjectName: item.subjectName || undefined,
        startTime: item.startTime,
        endTime: item.endTime,
        teacherName: item.teacherName,
        presentCount,
        absentCount,
        totalEnrolled,
        attendanceRate,
        absentees: absentList,
      });

      await navigator.clipboard.writeText(message);

      if (action === 'copy') {
        showToast(`Copied ${absentList.length} absentees to clipboard!`);
      } else {
        const savedGroupLink = typeof window !== 'undefined' ? localStorage.getItem(`rca_wa_group_${item.batchId}`) : null;
        if (savedGroupLink && savedGroupLink.trim().startsWith('http')) {
          showToast('Copied absentees & opening batch WhatsApp group...');
          window.open(savedGroupLink.trim(), '_blank');
        } else {
          showToast('Copied absentees & opening WhatsApp...');
          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, '_blank');
        }
      }
    } catch (err: any) {
      alert(`Could not process absentee list: ${err?.message || 'Error occurred'}`);
    }
  };

  const handleShareModalAbsentees = async (action: 'copy' | 'whatsapp') => {
    if (!activeSessionData) return;

    const absentRecords = activeSessionData.records.filter((r) => r.status === 'ABSENT');
    const absentList = absentRecords.map((r) => ({
      name: r.studentName,
      code: r.attendanceCode || r.studentCode || '',
    }));

    const message = generateAbsenteeMessage({
      date: activeSessionData.session.date,
      className: activeSessionData.session.className,
      batchName: activeSessionData.session.batchName,
      subjectName: activeSessionData.session.subjectName || undefined,
      startTime: activeSessionData.session.startTime || undefined,
      endTime: activeSessionData.session.endTime || undefined,
      teacherName: activeSessionData.session.teacherName || undefined,
      presentCount: activeSessionData.summary.presentCount,
      absentCount: activeSessionData.summary.absentCount,
      totalEnrolled: activeSessionData.summary.totalEnrolled,
      attendanceRate: activeSessionData.summary.attendanceRate,
      absentees: absentList,
    });

    try {
      await navigator.clipboard.writeText(message);
      if (action === 'copy') {
        showToast(`Copied ${absentList.length} absentees to clipboard!`);
      } else {
        const savedGroupLink = typeof window !== 'undefined' ? localStorage.getItem(`rca_wa_group_${activeSessionData.session.batchId}`) : null;
        if (savedGroupLink && savedGroupLink.trim().startsWith('http')) {
          showToast('Copied absentees & opening batch WhatsApp group...');
          window.open(savedGroupLink.trim(), '_blank');
        } else {
          showToast('Copied absentees & opening WhatsApp...');
          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, '_blank');
        }
      }
    } catch {
      if (action === 'whatsapp') {
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }
    }
  };

  const handleSelectClassForTodayAttendance = async (item: ScheduledClassItem) => {
    setSelectedTodayAttendanceClass(item);
    setLoadingTodayAttendance(true);
    try {
      let sessionId = item.sessionId;

      if (!sessionId) {
        const res = await ApiClient.fetch<any>('/attendance/sessions/start-class', {
          method: 'POST',
          body: JSON.stringify({
            scheduleId: item.scheduleId,
            batchId: item.batchId || undefined,
            classId: item.classId,
            subjectId: item.subjectId || undefined,
            startTime: item.startTime,
            endTime: item.endTime,
            date: selectedDate,
          }),
        });
        sessionId = res.id;
        item.sessionId = res.id;
      }

      const sessionDetails = await ApiClient.fetch<ActiveSessionData>(`/attendance/sessions/${sessionId}`);
      setActiveSessionData(sessionDetails);

      const list: Array<{ id: string; studentId: string; name: string; code: string; status: 'PRESENT' | 'ABSENT' }> = [];

      // Add recorded students
      sessionDetails.records.forEach((r) => {
        list.push({
          id: r.id,
          studentId: r.studentId,
          name: r.studentName,
          code: r.attendanceCode || r.studentCode || '',
          status: r.status === 'ABSENT' ? 'ABSENT' : 'PRESENT',
        });
      });

      // Add unmarked students (defaulted to 'PRESENT' so all are checked Present initially)
      sessionDetails.unmarkedStudents.forEach((u: any) => {
        list.push({
          id: `unmarked-${u.id}`,
          studentId: u.id,
          name: u.studentName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Student',
          code: u.attendanceCode || u.studentCode || u.admissionNumber || '',
          status: 'PRESENT',
        });
      });

      list.sort((a, b) => a.name.localeCompare(b.name));
      setTodayAttendanceStudents(list);
    } catch (err: any) {
      alert(`Could not load class students: ${err?.message || 'Error occurred'}`);
    } finally {
      setLoadingTodayAttendance(false);
    }
  };

  const handleToggleStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setTodayAttendanceStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  const handleSetAllStudentsStatus = (status: 'PRESENT' | 'ABSENT') => {
    setTodayAttendanceStudents((prev) => prev.map((s) => ({ ...s, status })));
  };

  const handleSubmitTodayAttendance = async () => {
    if (!selectedTodayAttendanceClass || todayAttendanceStudents.length === 0 || submittingTodayAttendance) return;
    setSubmittingTodayAttendance(true);

    try {
      let sessionId = selectedTodayAttendanceClass.sessionId;
      if (!sessionId && activeSessionData) {
        sessionId = activeSessionData.session.id;
      }

      const presentIds = todayAttendanceStudents.filter((s) => s.status === 'PRESENT').map((s) => s.studentId);
      const absentStudents = todayAttendanceStudents.filter((s) => s.status === 'ABSENT');
      const absentIds = absentStudents.map((s) => s.studentId);

      if (presentIds.length > 0) {
        await ApiClient.fetch<any>('/attendance/bulk-mark', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            status: 'PRESENT',
            studentIds: presentIds,
          }),
        });
      }

      if (absentIds.length > 0) {
        await ApiClient.fetch<any>('/attendance/bulk-mark', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            status: 'ABSENT',
            studentIds: absentIds,
          }),
        });
      }

      loadTodayData(selectedDate);
      if (sessionId) {
        const updated = await ApiClient.fetch<ActiveSessionData>(`/attendance/sessions/${sessionId}`);
        setActiveSessionData(updated);
      }

      const absentList = absentStudents.map((s) => ({
        name: s.name,
        code: s.code,
      }));

      const message = generateAbsenteeMessage({
        date: selectedDate,
        className: selectedTodayAttendanceClass.className,
        batchName: selectedTodayAttendanceClass.batchName,
        subjectName: selectedTodayAttendanceClass.subjectName || undefined,
        startTime: selectedTodayAttendanceClass.startTime,
        endTime: selectedTodayAttendanceClass.endTime,
        teacherName: selectedTodayAttendanceClass.teacherName,
        presentCount: presentIds.length,
        absentCount: absentIds.length,
        totalEnrolled: todayAttendanceStudents.length,
        attendanceRate: todayAttendanceStudents.length > 0 ? Math.round((presentIds.length / todayAttendanceStudents.length) * 100) : 0,
        absentees: absentList,
      });

      try {
        await navigator.clipboard.writeText(message);
      } catch {
        // clipboard may be restricted
      }

      setSubmittedAbsenteeModalData({
        classItem: selectedTodayAttendanceClass,
        message,
        absentees: absentList,
        presentCount: presentIds.length,
        absentCount: absentIds.length,
        totalCount: todayAttendanceStudents.length,
      });

      showToast(`Attendance saved! Generated absentee report for ${absentList.length} absentees.`);
    } catch (err: any) {
      alert(`Could not submit attendance: ${err?.message || 'Error occurred'}`);
    } finally {
      setSubmittingTodayAttendance(false);
    }
  };

  // Live typing student search for Student Quick Mark scanner
  useEffect(() => {
    const q = scannerInputCode.trim();
    if (!q) {
      setLiveSearchResults([]);
      setIsSearchingStudents(false);
      return;
    }

    setIsSearchingStudents(true);
    const timer = setTimeout(async () => {
      try {
        const res = await ApiClient.fetch<{ items: QuickMarkStudentResult[] }>(
          `/students?search=${encodeURIComponent(q)}&limit=15`
        );
        setLiveSearchResults(res.items || []);
      } catch (err) {
        console.error('Failed to search students in scanner:', err);
        setLiveSearchResults([]);
      } finally {
        setIsSearchingStudents(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [scannerInputCode]);

  const handleQuickMarkSubmit = async (e?: React.FormEvent, directCodeOrId?: string) => {
    if (e) e.preventDefault();
    const codeToSubmit = (directCodeOrId || scannerInputCode).trim();
    if (!codeToSubmit || isSubmittingScan) return;
    setIsSubmittingScan(true);

    try {
      const payload: any = {
        studentCode: codeToSubmit,
      };

      const targetSessionId = activeSessionData?.session?.id || (selectedQuickMarkSessionId ? selectedQuickMarkSessionId : undefined);
      if (targetSessionId) {
        payload.sessionId = targetSessionId;
      }

      const res = await ApiClient.fetch<any>('/attendance/quick-mark', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.alreadyMarked) {
        setLastScanFeedback({
          success: true,
          alreadyMarked: true,
          message: res.message,
          studentName: res.student?.name,
          studentCode: res.student?.studentCode,
          attendanceCode: res.student?.attendanceCode,
          status: res.record?.status,
        });
      } else {
        setLastScanFeedback({
          success: true,
          alreadyMarked: false,
          message: res.message,
          studentName: res.student?.name,
          studentCode: res.student?.studentCode,
          attendanceCode: res.student?.attendanceCode,
          status: res.record?.status,
        });
      }

      // Reload active session
      if (activeSessionData?.session?.id) {
        const updated = await ApiClient.fetch<ActiveSessionData>(`/attendance/sessions/${activeSessionData.session.id}`);
        setActiveSessionData(updated);
      }
      loadTodayData(selectedDate);
      if (!directCodeOrId) {
        setScannerInputCode('');
      }
    } catch (err: any) {
      setLastScanFeedback({
        success: false,
        message: err?.message || `Failed to mark student with code '${codeToSubmit}'`,
      });
    } finally {
      setIsSubmittingScan(false);
      setTimeout(() => scanInputRef.current?.focus(), 50);
    }
  };

  const handleManualMarkStudent = async (studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED') => {
    if (!activeSessionData) return;

    try {
      await ApiClient.fetch<any>('/attendance/mark-student', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSessionData.session.id,
          studentId,
          status,
        }),
      });

      const updated = await ApiClient.fetch<ActiveSessionData>(`/attendance/sessions/${activeSessionData.session.id}`);
      setActiveSessionData(updated);
      loadTodayData(selectedDate);
    } catch (err: any) {
      alert(`Could not mark student: ${err?.message || 'Error'}`);
    }
  };

  const handleCloseSessionConfirm = async () => {
    if (!activeSessionData || isClosingSession) return;
    setIsClosingSession(true);

    try {
      await ApiClient.fetch<any>(`/attendance/sessions/${activeSessionData.session.id}/close`, {
        method: 'PATCH',
        body: JSON.stringify({
          markUnmarkedAsAbsent,
        }),
      });

      // Reload
      const updated = await ApiClient.fetch<ActiveSessionData>(`/attendance/sessions/${activeSessionData.session.id}`);
      setActiveSessionData(updated);
      setCloseSessionModalOpen(false);
      loadTodayData(selectedDate);
    } catch (err: any) {
      alert(`Could not close session: ${err?.message || 'Error'}`);
    } finally {
      setIsClosingSession(false);
    }
  };

  // ----------------------------------------------------
  // CORRECTIONS
  // ----------------------------------------------------

  const openCorrectionModal = (record: HistoryRecord) => {
    setTargetCorrectionRecord(record);
    setCorrectionNewStatus(record.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
    setCorrectionReason('');
    setCorrectionModalOpen(true);
  };

  const handleSubmitCorrection = async () => {
    if (!targetCorrectionRecord || !correctionReason.trim() || submittingCorrection) return;
    setSubmittingCorrection(true);

    try {
      await ApiClient.fetch<any>('/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({
          recordId: targetCorrectionRecord.id,
          newStatus: correctionNewStatus,
          reason: correctionReason.trim(),
        }),
      });

      setCorrectionModalOpen(false);
      loadHistoryData(historyPagination.page);
      loadTodayData(selectedDate);
    } catch (err: any) {
      alert(`Correction failed: ${err?.message || 'Error'}`);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // ----------------------------------------------------
  // STAFF ATTENDANCE
  // ----------------------------------------------------

  const handleStaffQuickMarkSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!staffCodeInput.trim() || isSubmittingStaff) return;

    const code = staffCodeInput.trim();
    setIsSubmittingStaff(true);

    try {
      const res = await ApiClient.fetch<any>('/attendance/staff/quick-mark', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });

      setStaffScanFeedback({
        success: true,
        type: res.type,
        message: res.message,
        staffName: res.staff?.name,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      setStaffCodeInput('');
      loadStaffRecords(selectedDate);
    } catch (err: any) {
      setStaffScanFeedback({
        success: false,
        message: err?.message || `Failed to record staff scan for code '${code}'`,
      });
    } finally {
      setIsSubmittingStaff(false);
      setTimeout(() => staffScanInputRef.current?.focus(), 50);
    }
  };

  const handleManualStaffSubmit = async () => {
    if (!manualStaffForm.userId || !manualStaffForm.date) {
      alert('Please select staff member and date');
      return;
    }

    try {
      await ApiClient.fetch<any>('/attendance/staff/manual', {
        method: 'POST',
        body: JSON.stringify({
          userId: manualStaffForm.userId,
          date: manualStaffForm.date,
          checkInAt: manualStaffForm.checkInAt ? `${manualStaffForm.date}T${manualStaffForm.checkInAt}:00Z` : undefined,
          checkOutAt: manualStaffForm.checkOutAt ? `${manualStaffForm.date}T${manualStaffForm.checkOutAt}:00Z` : undefined,
          status: manualStaffForm.status,
          notes: manualStaffForm.notes,
        }),
      });

      setManualStaffModalOpen(false);
      loadStaffRecords(selectedDate);
    } catch (err: any) {
      alert(`Manual staff attendance failed: ${err?.message || 'Error'}`);
    }
  };

  // Date Shift Helper
  const shiftDate = (days: number) => {
    if (!selectedDate) return;
    const current = new Date(`${selectedDate}T00:00:00Z`);
    current.setUTCDate(current.getUTCDate() + days);
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, '0');
    const d = String(current.getUTCDate()).padStart(2, '0');
    const newDateStr = `${y}-${m}-${d}`;
    setSelectedDate(newDateStr);
    loadTodayData(newDateStr);
    if (activeTab === 'STAFF') loadStaffRecords(newDateStr);
  };

  // Computed roster for active session modal
  const combinedRoster: StudentRosterItem[] = React.useMemo(() => {
    if (!activeSessionData) return [];

    const recorded: StudentRosterItem[] = activeSessionData.records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentCode: r.studentCode,
      attendanceCode: r.attendanceCode,
      studentName: r.studentName,
      status: r.status,
      recordedAt: r.recordedAt,
      recordedBy: r.recordedBy,
    }));

    const unmarked: StudentRosterItem[] = activeSessionData.unmarkedStudents.map((u) => ({
      id: `unmarked-${u.id}`,
      studentId: u.id,
      studentCode: u.studentCode,
      attendanceCode: u.attendanceCode,
      studentName: u.studentName,
      status: 'UNMARKED',
    }));

    let all = [...recorded, ...unmarked];

    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      all = all.filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          (s.attendanceCode && s.attendanceCode.includes(q)),
      );
    }

    if (rosterStatusFilter !== 'ALL') {
      all = all.filter((s) => s.status === rosterStatusFilter);
    }

    return all.sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [activeSessionData, rosterSearch, rosterStatusFilter]);

  const renderStudentAttendanceSheet = () => {
    if (!selectedTodayAttendanceClass) return null;

    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-in fade-in duration-200 mt-6">
        {/* Header with Title & Stats */}
        <div className="border-b border-gray-200 bg-gray-50/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">
                  {selectedTodayAttendanceClass.className} – {selectedTodayAttendanceClass.batchName}
                </h3>
                {selectedTodayAttendanceClass.subjectName && (
                  <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-bold text-[#FF8500]">
                    {selectedTodayAttendanceClass.subjectName}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                {selectedTodayAttendanceClass.startTime} – {selectedTodayAttendanceClass.endTime}
                {selectedTodayAttendanceClass.teacherName && (
                  <>
                    <span>•</span>
                    <span>Faculty: {selectedTodayAttendanceClass.teacherName}</span>
                  </>
                )}
              </p>
            </div>

            {/* Stats pills & Close */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 shadow-2xs">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Total:</span>
                <span className="text-xs font-bold text-gray-800">{todayAttendanceStudents.length}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 shadow-2xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-xs text-emerald-700">Present:</span>
                <span className="text-xs font-bold text-emerald-800">
                  {todayAttendanceStudents.filter((s) => s.status === 'PRESENT').length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 shadow-2xs">
                <XCircle className="h-4 w-4 text-rose-600" />
                <span className="text-xs text-rose-700">Absent:</span>
                <span className="text-xs font-bold text-rose-800">
                  {todayAttendanceStudents.filter((s) => s.status === 'ABSENT').length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTodayAttendanceClass(null);
                  setTodayAttendanceStudents([]);
                }}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 bg-white shadow-2xs transition"
                title="Close student sheet"
              >
                <X className="h-3.5 w-3.5" />
                Close Sheet
              </button>
            </div>
          </div>

          {/* Actions & Search Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
            <div className="relative min-w-[240px] max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={todayAttendanceSearch}
                onChange={(e) => setTodayAttendanceSearch(e.target.value)}
                placeholder="Search student by name or code..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-[#FF8500]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetAllStudentsStatus('PRESENT')}
                className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition active:scale-95 flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => handleSetAllStudentsStatus('ABSENT')}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition active:scale-95 flex items-center gap-1.5"
              >
                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                Mark All Absent
              </button>
            </div>
          </div>
        </div>

        {/* Table Body */}
        {loadingTodayAttendance ? (
          <div className="py-16 text-center text-gray-400 space-y-2">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#FF8500]" />
            <p className="text-xs font-medium">Loading enrolled students...</p>
          </div>
        ) : todayAttendanceStudents.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-600">No students enrolled</p>
            <p className="text-xs text-gray-400">There are no active student enrollments for this class/batch.</p>
          </div>
        ) : (
          <div>
            {/* MOBILE RESPONSIVE VIEW (sm:hidden) */}
            {/* Clean layout: Name as title, Red and Green Dots, no code/admission */}
            <div className="block sm:hidden">
              {/* Header with Title and Red/Green Dot labels */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100/90 border-b border-gray-200 text-xs font-bold text-gray-700">
                <span>Student Name</span>
                <div className="flex items-center gap-4 pr-1">
                  <span className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 inline-block" />
                    Present
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700 text-xs font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200 inline-block" />
                    Absent
                  </span>
                </div>
              </div>

              {/* Student Rows */}
              <div className="divide-y divide-gray-100 bg-white">
                {todayAttendanceStudents
                  .filter((s) => {
                    if (!todayAttendanceSearch.trim()) return true;
                    const q = todayAttendanceSearch.toLowerCase();
                    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
                  })
                  .map((student, idx) => {
                    const isPresent = student.status === 'PRESENT';
                    return (
                      <div
                        key={student.studentId}
                        className={`flex items-center justify-between px-4 py-3.5 transition-colors ${
                          !isPresent ? 'bg-rose-50/40' : 'hover:bg-gray-50/60'
                        }`}
                      >
                        {/* Student Name as the title (No code or admission number on mobile) */}
                        <div className="flex items-center gap-2.5 min-w-0 pr-3">
                          <span className="text-xs font-bold text-gray-400 w-5 shrink-0 text-right">
                            {idx + 1}.
                          </span>
                          <p className="font-bold text-gray-900 text-sm truncate">
                            {student.name}
                          </p>
                        </div>

                        {/* Interactive Green and Red Dots */}
                        <div className="flex items-center gap-3.5 shrink-0">
                          {/* Green Dot (Present) */}
                          <button
                            type="button"
                            onClick={() => handleToggleStudentStatus(student.studentId, 'PRESENT')}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                              isPresent
                                ? 'bg-emerald-500 text-white shadow-md ring-4 ring-emerald-100 scale-105'
                                : 'bg-gray-100 text-gray-300 hover:bg-emerald-100 hover:text-emerald-600'
                            }`}
                            title="Mark Present"
                            aria-label={`Mark ${student.name} Present`}
                          >
                            <Check className={`w-5 h-5 stroke-[2.5] ${isPresent ? 'text-white opacity-100' : 'text-gray-400 opacity-40'}`} />
                          </button>

                          {/* Red Dot (Absent) */}
                          <button
                            type="button"
                            onClick={() => handleToggleStudentStatus(student.studentId, 'ABSENT')}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                              !isPresent
                                ? 'bg-rose-500 text-white shadow-md ring-4 ring-rose-100 scale-105'
                                : 'bg-gray-100 text-gray-300 hover:bg-rose-100 hover:text-rose-600'
                            }`}
                            title="Mark Absent"
                            aria-label={`Mark ${student.name} Absent`}
                          >
                            <X className={`w-5 h-5 stroke-[2.5] ${!isPresent ? 'text-white opacity-100' : 'text-gray-400 opacity-40'}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* DESKTOP TABLE VIEW (hidden sm:block) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100/70 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Code / Admission</th>
                    <th className="py-3 px-4 text-center w-56">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {todayAttendanceStudents
                    .filter((s) => {
                      if (!todayAttendanceSearch.trim()) return true;
                      const q = todayAttendanceSearch.toLowerCase();
                      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
                    })
                    .map((student, idx) => {
                      const isPresent = student.status === 'PRESENT';
                      return (
                        <tr
                          key={student.studentId}
                          className={`transition-colors hover:bg-gray-50/80 ${
                            !isPresent ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center font-medium text-gray-400 text-xs">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isPresent
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {student.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm">{student.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {student.code || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleStudentStatus(student.studentId, 'PRESENT')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer ${
                                  isPresent
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200'
                                }`}
                              >
                                <CheckCircle2 className={`h-3.5 w-3.5 ${isPresent ? 'text-white' : 'text-emerald-500'}`} />
                                Present
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleStudentStatus(student.studentId, 'ABSENT')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer ${
                                  !isPresent
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-700 border border-gray-200'
                                }`}
                              >
                                <XCircle className={`h-3.5 w-3.5 ${!isPresent ? 'text-white' : 'text-rose-500'}`} />
                                Absent
                              </button>
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

        {/* Bottom Submit Bar */}
        <div className="border-t border-gray-200 bg-gray-50/80 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-600">
            <span className="font-bold text-gray-900">{todayAttendanceStudents.length}</span> total students:{' '}
            <span className="font-bold text-emerald-700">
              {todayAttendanceStudents.filter((s) => s.status === 'PRESENT').length} Present
            </span>
            ,{' '}
            <span className="font-bold text-rose-700">
              {todayAttendanceStudents.filter((s) => s.status === 'ABSENT').length} Absent
            </span>
          </div>

          <Button
            onClick={handleSubmitTodayAttendance}
            disabled={submittingTodayAttendance || todayAttendanceStudents.length === 0}
            className="bg-[#FF8500] hover:bg-[#e67700] text-white font-bold text-xs px-6 py-2.5 shadow-md flex items-center gap-2 transition"
          >
            {submittingTodayAttendance ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Submitting Attendance...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Submit Attendance & Generate Absentee Message</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24 text-black">
      {/* Top Header */}
      <Header
        title="Attendance Management"
        subtitle="Today's scheduled classes, live session scanner, historical records & staff terminal"
      />

      <ResponsivePageContainer>
        {/* Navigation Tabs Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <button
              onClick={() => {
                setActiveTab('SCANNER');
                if (!selectedTodayAttendanceClass && scheduledClasses.length > 0) {
                  handleSelectClassForTodayAttendance(scheduledClasses[0]);
                }
              }}
              className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'SCANNER'
                  ? 'bg-[#FF8500] text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <UserCheck className="h-4 w-4 shrink-0" />
              <span>Today Attendance</span>
            </button>

            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-[#FF8500] text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>Attendance History</span>
            </button>

            <button
              onClick={() => setActiveTab('STAFF')}
              className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'STAFF'
                  ? 'bg-[#FF8500] text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Briefcase className="h-4 w-4 shrink-0" />
              <span>Staff Terminal</span>
            </button>
          </div>

          {/* Academy Timezone & Date Indicator */}
          <div className="flex items-center gap-2 self-start sm:self-auto rounded-lg bg-white px-2.5 py-1 text-[11px] sm:text-xs font-medium text-gray-600 border border-gray-200 shadow-sm shrink-0">
            <Clock className="h-3.5 w-3.5 text-[#FF8500]" />
            <span>Timezone: <strong className="text-black">{timezone}</strong></span>
          </div>
        </div>

        {/* ==================================================== */}
        {/* TAB 2: TODAY ATTENDANCE (CLASS LIST & STUDENT MARK)   */}
        {/* ==================================================== */}
        {activeTab === 'SCANNER' && (
          <div className="space-y-6">
            {/* Date Navigator Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#FF8500]">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {dateFormatted || 'Academy Schedule'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Operating under academy-local timetable ({timezone})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => shiftDate(-1)}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
                  title="Previous Day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    loadTodayData(e.target.value);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 focus:border-[#FF8500] focus:outline-none"
                />

                <button
                  onClick={() => shiftDate(1)}
                  className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50 hover:text-black transition-colors"
                  title="Next Day"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTodayData(selectedDate)}
                  disabled={loadingToday}
                  className="text-xs ml-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingToday ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
            {/* Class Selection Section */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-[#FF8500]" />
                    Today's Classes ({scheduledClasses.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Click any class below to open all enrolled students and mark attendance.
                  </p>
                </div>
                {selectedTodayAttendanceClass && (
                  <button
                    onClick={() => {
                      setSelectedTodayAttendanceClass(null);
                      setTodayAttendanceStudents([]);
                    }}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Deselect Class
                  </button>
                )}
              </div>

              {loadingToday ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#FF8500]" />
                  <p className="text-xs font-medium">Loading today's scheduled classes...</p>
                </div>
              ) : scheduledClasses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-600 mt-2">No Scheduled Classes Today</p>
                  <p className="text-xs text-gray-400 mt-0.5">Check class timetables or create a schedule for this date.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {scheduledClasses.map((item) => {
                    const isSelected =
                      selectedTodayAttendanceClass?.scheduleId === item.scheduleId &&
                      selectedTodayAttendanceClass?.batchId === item.batchId;
                    const isOpen = item.sessionStatus === 'OPEN';
                    const isClosed = item.sessionStatus === 'CLOSED';

                    return (
                      <div
                        key={`${item.scheduleId}-${item.batchId}`}
                        onClick={() => handleSelectClassForTodayAttendance(item)}
                        className={`cursor-pointer rounded-xl border p-4 transition-all duration-150 flex flex-col justify-between ${
                          isSelected
                            ? 'border-[#FF8500] ring-2 ring-[#FF8500]/20 bg-orange-50/40 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-[#FF8500]/50 hover:bg-orange-50/10 hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-sm text-gray-900 group-hover:text-[#FF8500] line-clamp-1">
                              {item.className}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                isOpen
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isClosed
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isOpen ? 'Live' : isClosed ? 'Closed' : 'Scheduled'}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="font-medium text-gray-800">{item.batchName}</span>
                            {item.subjectName && (
                              <>
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-500">{item.subjectName}</span>
                              </>
                            )}
                          </div>

                          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span>{item.startTime} – {item.endTime}</span>
                          </div>

                          {item.teacherName && (
                            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1.5">
                              <span className="text-gray-400 font-medium">Faculty:</span>
                              <span className="truncate">{item.teacherName}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-gray-400" />
                            {item.eligibleStudentCount || 0} enrolled
                          </span>
                          <span
                            className={`text-xs font-bold px-2.5 py-1 rounded-md transition ${
                              isSelected
                                ? 'bg-[#FF8500] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-[#FF8500] hover:text-white'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Open Sheet →'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Student Attendance Marking Sheet */}
            {renderStudentAttendanceSheet()}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: ATTENDANCE HISTORY & ANALYTICS                */}
        {/* ==================================================== */}
        {activeTab === 'HISTORY' && (
          <div className="space-y-6">
            {/* Filter Toolbar */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#FF8500]" />
                  Filter Historical Attendance
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHistoryFilters({
                      startDate: '',
                      endDate: '',
                      studentQuery: '',
                      classId: '',
                      batchId: '',
                      attendanceStatus: '',
                      sessionStatus: '',
                    });
                  }}
                  className="text-xs"
                >
                  Reset Filters
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase">From Date</label>
                  <input
                    type="date"
                    value={historyFilters.startDate}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, startDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-[#FF8500] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase">To Date</label>
                  <input
                    type="date"
                    value={historyFilters.endDate}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, endDate: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-[#FF8500] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase">Student Search</label>
                  <input
                    type="text"
                    placeholder="Name or Roll No..."
                    value={historyFilters.studentQuery}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, studentQuery: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-[#FF8500] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase">Standard / Class</label>
                  <select
                    value={historyFilters.classId}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, classId: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-[#FF8500] focus:outline-none"
                  >
                    <option value="">All Classes</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-600 uppercase">Attendance Status</label>
                  <select
                    value={historyFilters.attendanceStatus}
                    onChange={(e) => setHistoryFilters({ ...historyFilters, attendanceStatus: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-[#FF8500] focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="LATE">LATE</option>
                    <option value="EXCUSED">EXCUSED</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={() => loadHistoryData(1)}
                    className="w-full bg-[#FF8500] hover:bg-[#e67700] text-white text-xs font-bold"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </div>

            {/* Filter Summary Metrics */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-lg bg-white p-3 border border-gray-200">
                <span className="text-[11px] font-semibold text-gray-500 uppercase">Total Records</span>
                <p className="text-xl font-black text-gray-900">{historySummary.totalRecords}</p>
              </div>

              <div className="rounded-lg bg-white p-3 border border-gray-200">
                <span className="text-[11px] font-semibold text-emerald-600 uppercase">Present</span>
                <p className="text-xl font-black text-emerald-600">{historySummary.presentCount}</p>
              </div>

              <div className="rounded-lg bg-white p-3 border border-gray-200">
                <span className="text-[11px] font-semibold text-rose-600 uppercase">Absent</span>
                <p className="text-xl font-black text-rose-600">{historySummary.absentCount}</p>
              </div>

              <div className="rounded-lg bg-white p-3 border border-gray-200">
                <span className="text-[11px] font-semibold text-amber-600 uppercase">Late</span>
                <p className="text-xl font-black text-amber-600">{historySummary.lateCount}</p>
              </div>

              <div className="rounded-lg bg-white p-3 border border-gray-200">
                <span className="text-[11px] font-semibold text-blue-600 uppercase">Excused</span>
                <p className="text-xl font-black text-blue-600">{historySummary.excusedCount}</p>
              </div>

              <div className="rounded-lg bg-white p-3 border border-gray-200">
                <span className="text-[11px] font-semibold text-gray-700 uppercase">Rate</span>
                <p className="text-xl font-black text-gray-900">{historySummary.attendanceRate}%</p>
              </div>
            </div>

            {/* Records Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {loadingHistory ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#FF8500] mb-2" />
                  Loading historical records...
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="p-12 text-center text-sm text-gray-500">
                  No attendance records matched the filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Class & Subject</th>
                        <th className="px-4 py-3">Batch</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Marked At</th>
                        <th className="px-4 py-3">Recorded By</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                      {historyRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold text-gray-900">{r.sessionDate}</span>
                            {r.startTime && (
                              <span className="block text-[11px] text-gray-500">
                                {r.startTime} – {r.endTime}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-gray-900">{r.className}</span>
                            <span className="block text-[11px] text-gray-500">{r.subjectName}</span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-700">{r.batchName}</td>
                          <td className="px-4 py-3 font-bold text-gray-900">{r.studentName}</td>
                          <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                            {r.attendanceCode || r.studentCode}
                          </td>
                          <td className="px-4 py-3">
                            {r.status === 'PRESENT' ? (
                              <Badge variant="success" className="text-[10px] font-bold">PRESENT</Badge>
                            ) : r.status === 'LATE' ? (
                              <Badge variant="warning" className="text-[10px] font-bold">LATE</Badge>
                            ) : r.status === 'EXCUSED' ? (
                              <Badge variant="neutral" className="text-[10px] font-bold bg-blue-100 text-blue-800 border-blue-200">EXCUSED</Badge>
                            ) : (
                              <Badge variant="error" className="text-[10px] font-bold">ABSENT</Badge>
                            )}
                            {r.corrections && r.corrections.length > 0 && (
                              <span className="ml-1 inline-block rounded bg-purple-100 px-1 text-[9px] font-bold text-purple-700" title="Has corrected audit entry">
                                Corrected
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{r.recordedBy}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCorrectionModal(r)}
                              className="text-[11px] h-7 px-2 font-semibold"
                            >
                              <Edit2 className="h-3 w-3 mr-1" />
                              Correct
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              {historyPagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs">
                  <span className="text-gray-500">
                    Showing page <strong>{historyPagination.page}</strong> of{' '}
                    <strong>{historyPagination.totalPages}</strong> (Total {historyPagination.total} records)
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPagination.page <= 1}
                      onClick={() => loadHistoryData(historyPagination.page - 1)}
                      className="text-xs"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPagination.page >= historyPagination.totalPages}
                      onClick={() => loadHistoryData(historyPagination.page + 1)}
                      className="text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: STAFF ATTENDANCE TERMINAL                     */}
        {/* ==================================================== */}
        {activeTab === 'STAFF' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left Column: Staff Check-In Scanner (Check-In Only, Auto Check-Out at 9:30 PM) */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-[#FF8500] mb-3">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">
                    Staff Check-In Terminal
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Check-In only. Check-out is automated at 09:30 PM.
                  </p>
                </div>

                {/* Auto Check-out Policy Banner */}
                <div className="rounded-xl bg-orange-50/80 border border-orange-200 p-3.5 text-xs text-orange-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-orange-950">
                    <Clock className="h-4 w-4 text-[#FF8500]" />
                    <span>Auto Check-Out Policy: 09:30 PM</span>
                  </div>
                  <p className="text-[11px] text-orange-800 leading-relaxed">
                    Faculty and staff only need to scan or enter their 3-digit code to <strong>Check In</strong>. Check-out is automatically logged for all on-duty staff at <strong>09:30 PM</strong>.
                  </p>
                </div>

                <form onSubmit={handleStaffQuickMarkSubmit} className="space-y-3">
                  <input
                    ref={staffScanInputRef}
                    type="text"
                    placeholder="Enter Staff 3-Digit Code (e.g. 101 or STF-01)..."
                    value={staffCodeInput}
                    onChange={(e) => setStaffCodeInput(e.target.value)}
                    disabled={isSubmittingStaff}
                    className="w-full rounded-xl border-2 border-gray-300 py-3 px-4 text-sm font-bold text-gray-900 focus:border-[#FF8500] focus:outline-none"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    disabled={isSubmittingStaff || !staffCodeInput.trim()}
                    className="w-full bg-[#FF8500] hover:bg-[#E67700] text-white font-bold text-xs py-2.5 flex items-center justify-center gap-2"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>{isSubmittingStaff ? 'Recording Check-In...' : 'Record Check-In'}</span>
                  </Button>
                </form>

                {staffScanFeedback && (
                  <div
                    className={`rounded-xl border p-4 text-xs ${
                      staffScanFeedback.success
                        ? staffScanFeedback.type === 'ALREADY_CHECKED_IN'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    <p className="font-bold">{staffScanFeedback.message}</p>
                    {staffScanFeedback.staffName && (
                      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-700 font-semibold border-t border-gray-200/50 pt-1.5">
                        <span>{staffScanFeedback.staffName}</span>
                        <span className="text-[#CC6B00]">Auto Check-Out: 09:30 PM</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-100 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManualStaffForm({
                        userId: '',
                        date: selectedDate || new Date().toISOString().split('T')[0],
                        checkInAt: '09:00',
                        checkOutAt: '21:30',
                        status: 'PRESENT',
                        notes: 'Auto Check-Out on 09:30 PM',
                      });
                      setManualStaffModalOpen(true);
                    }}
                    className="w-full text-xs font-semibold"
                  >
                    + Manual Staff Entry (Admin)
                  </Button>
                </div>
              </div>

              {/* Right Column: Today's Staff Attendance Table */}
              <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Staff Daily Log
                    </h3>
                    <p className="text-xs text-gray-500">
                      Staff check-ins with automated 09:30 PM check-out for {selectedDate}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadStaffRecords(selectedDate)}
                    className="text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[11px] font-bold text-gray-600 uppercase border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2.5">Staff Member</th>
                        <th className="px-3 py-2.5">Role</th>
                        <th className="px-3 py-2.5">3-Digit Code</th>
                        <th className="px-3 py-2.5">Check In</th>
                        <th className="px-3 py-2.5">Check Out (Auto)</th>
                        <th className="px-3 py-2.5">Duty Hours</th>
                        <th className="px-3 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                      {staffRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-gray-500">
                            No staff attendance records logged for this date.
                          </td>
                        </tr>
                      ) : (
                        staffRecords.map((s) => {
                          const isToday = !selectedDate || selectedDate === new Date().toISOString().split('T')[0];
                          const nowHours = new Date().getHours();
                          const nowMins = new Date().getMinutes();
                          const isPast930PM = !isToday || nowHours > 21 || (nowHours === 21 && nowMins >= 30);

                          return (
                            <tr key={s.id} className="hover:bg-gray-50/70">
                              <td className="px-3 py-2.5 font-bold text-gray-900">
                                <div>{s.user.name}</div>
                                <div className="text-[10px] text-gray-400 font-normal">{s.user.email}</div>
                              </td>
                              <td className="px-3 py-2.5 text-gray-600">{s.user.designation || 'Faculty'}</td>
                              <td className="px-3 py-2.5">
                                {s.user.attendanceCode ? (
                                  <span className="font-mono text-xs font-bold text-[#CC6B00] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                                    {s.user.attendanceCode}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-emerald-700 font-semibold font-mono text-xs">
                                {s.checkInAt ? new Date(s.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                  <Clock className="h-3 w-3 text-[#FF8500]" />
                                  09:30 PM (Auto)
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-bold text-gray-800">
                                {s.durationHours ? `${s.durationHours} hrs` : '—'}
                              </td>
                              <td className="px-3 py-2.5">
                                {isPast930PM ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                                    <CheckCircle2 className="h-3 w-3 text-blue-600" />
                                    CHECKED OUT (Auto 9:30 PM)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                    ON DUTY (Auto 9:30 PM)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODAL: ATTENDANCE ROSTER & MARKING                   */}
        {/* ==================================================== */}
        {activeSessionModalOpen && activeSessionData && (
          <Modal
            isOpen={activeSessionModalOpen}
            onClose={() => setActiveSessionModalOpen(false)}
            title={`Attendance: ${activeSessionData.session.className} – ${activeSessionData.session.batchName}`}
            maxWidth="4xl"
          >
            <div className="space-y-4">
              {/* Header Overview Card */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[#FF8500] bg-orange-100 px-2.5 py-1 rounded-md">
                      {activeSessionData.session.className}
                    </span>
                    <span className="text-xs font-bold text-gray-800 bg-white border border-gray-200 px-2.5 py-1 rounded-md shadow-2xs">
                      {activeSessionData.session.batchName}
                    </span>
                    {activeSessionData.session.subjectName && (
                      <span className="text-xs font-semibold text-gray-700 bg-gray-200 px-2.5 py-1 rounded-md">
                        {activeSessionData.session.subjectName}
                      </span>
                    )}
                    <span className="text-xs text-gray-600 flex items-center gap-1 ml-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <strong>{activeSessionData.session.date}</strong>
                    </span>
                    {activeSessionData.session.teacherName && (
                      <span className="text-xs text-gray-600 flex items-center gap-1 ml-1">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        {activeSessionData.session.teacherName}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleShareModalAbsentees('whatsapp')}
                      title="Share absent list to WhatsApp"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs shadow-sm transition active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareModalAbsentees('copy')}
                      title="Copy absent students list"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs shadow-2xs transition active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                      <span>Copy Absent</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBulkMarkAllPresent}
                      disabled={isBulkMarking || activeSessionData.summary.unmarkedCount === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBulkMarking ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Marking...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark All Present</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Stats Counter */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-white p-2 border border-gray-200 shadow-2xs">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Total Students</span>
                    <p className="text-base font-black text-gray-900">{activeSessionData.summary.totalEnrolled}</p>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] text-emerald-600 uppercase font-bold">Present</span>
                    <p className="text-base font-black text-emerald-600">{activeSessionData.summary.presentCount}</p>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-rose-200 shadow-2xs">
                    <span className="text-[10px] text-rose-600 uppercase font-bold">Absent</span>
                    <p className="text-base font-black text-rose-600">{activeSessionData.summary.absentCount}</p>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-amber-200 shadow-2xs">
                    <span className="text-[10px] text-amber-600 uppercase font-bold">Late</span>
                    <p className="text-base font-black text-amber-600">{activeSessionData.summary.lateCount}</p>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-lg bg-white p-2 border border-gray-200 shadow-2xs">
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Unmarked</span>
                    <p className="text-base font-black text-gray-600">{activeSessionData.summary.unmarkedCount}</p>
                  </div>
                </div>
              </div>

              {/* Quick Barcode / Code Scanner Bar */}
              <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3">
                <form onSubmit={handleQuickMarkSubmit} className="flex gap-2">
                  <input
                    ref={scanInputRef}
                    type="text"
                    placeholder="Scan barcode or enter 3-digit student code..."
                    value={scannerInputCode}
                    onChange={(e) => setScannerInputCode(e.target.value)}
                    disabled={isSubmittingScan}
                    className="flex-1 rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:border-[#FF8500] focus:outline-none"
                  />
                  <Button
                    type="submit"
                    disabled={isSubmittingScan || !scannerInputCode.trim()}
                    className="bg-[#FF8500] hover:bg-[#e67700] text-white font-bold text-xs px-4"
                  >
                    {isSubmittingScan ? 'Marking...' : 'Scan / Mark'}
                  </Button>
                </form>

                {lastScanFeedback && (
                  <div
                    className={`mt-2 rounded-lg p-2 text-xs font-semibold ${
                      lastScanFeedback.success
                        ? lastScanFeedback.alreadyMarked
                          ? 'bg-amber-100 text-amber-900 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        : 'bg-rose-100 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {lastScanFeedback.message}
                  </div>
                )}
              </div>

              {/* Student Roster Filter & Table */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-bold text-gray-700">Filter:</span>
                    {(['ALL', 'UNMARKED', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setRosterStatusFilter(st)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                          rosterStatusFilter === st
                            ? 'bg-[#FF8500] text-white shadow-2xs'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search student or code..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-[#FF8500] focus:outline-none w-56"
                    />
                  </div>
                </div>

                <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase border-b border-gray-200 z-10">
                      <tr>
                        <th className="px-4 py-2.5">Student Details</th>
                        <th className="px-3 py-2.5 hidden sm:table-cell">Code / Admission</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Quick Mark Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {combinedRoster.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-gray-400">
                            No students match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        combinedRoster.map((s) => {
                          const isPresent = s.status === 'PRESENT';
                          const isAbsent = s.status === 'ABSENT';
                          const isLate = s.status === 'LATE';
                          const isExcused = s.status === 'EXCUSED';

                          return (
                            <tr key={s.id} className="hover:bg-gray-50/70 transition">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-orange-50 border border-orange-200 text-[#FF8500] font-bold text-xs flex items-center justify-center shrink-0">
                                    {s.studentName.slice(0, 2).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-gray-900 text-xs sm:text-sm">
                                    {s.studentName}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-gray-600 hidden sm:table-cell">
                                {s.attendanceCode || s.studentCode}
                              </td>
                              <td className="px-3 py-2.5">
                                {isPresent ? (
                                  <Badge variant="success" className="text-[10px] font-bold">PRESENT</Badge>
                                ) : isLate ? (
                                  <Badge variant="warning" className="text-[10px] font-bold">LATE</Badge>
                                ) : isAbsent ? (
                                  <Badge variant="error" className="text-[10px] font-bold">ABSENT</Badge>
                                ) : isExcused ? (
                                  <Badge variant="neutral" className="text-[10px] font-bold bg-blue-100 text-blue-800 border-blue-200">EXCUSED</Badge>
                                ) : (
                                  <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">UNMARKED</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleManualMarkStudent(s.studentId, 'PRESENT')}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                                      isPresent
                                        ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                    }`}
                                    title="Mark Present"
                                  >
                                    P
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleManualMarkStudent(s.studentId, 'ABSENT')}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                                      isAbsent
                                        ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300'
                                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                    }`}
                                    title="Mark Absent"
                                  >
                                    A
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleManualMarkStudent(s.studentId, 'LATE')}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                                      isLate
                                        ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                    }`}
                                    title="Mark Late"
                                  >
                                    L
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleManualMarkStudent(s.studentId, 'EXCUSED')}
                                    className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 ${
                                      isExcused
                                        ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                    }`}
                                    title="Mark Excused"
                                  >
                                    E
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Bottom Footer */}
              <div className="pt-2 flex items-center justify-between border-t border-gray-100 text-xs text-gray-500">
                <span>
                  Showing <strong>{combinedRoster.length}</strong> of <strong>{activeSessionData.summary.totalEnrolled}</strong> students
                </span>
                <Button
                  onClick={() => setActiveSessionModalOpen(false)}
                  className="bg-black hover:bg-neutral-800 text-white text-xs font-bold px-4 py-2"
                >
                  Done
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* ==================================================== */}
        {/* MODAL: CLOSE SESSION CONFIRMATION                    */}
        {/* ==================================================== */}
        {closeSessionModalOpen && (
          <Modal
            isOpen={closeSessionModalOpen}
            onClose={() => setCloseSessionModalOpen(false)}
            title="Confirm Session Closure"
            maxWidth="sm"
          >
            <div className="space-y-4 text-xs text-gray-700">
              <p>
                Closing this session locks attendance records. Subsequent quick-marking scans will be rejected.
              </p>

              <label className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markUnmarkedAsAbsent}
                  onChange={(e) => setMarkUnmarkedAsAbsent(e.target.checked)}
                  className="rounded text-[#FF8500] focus:ring-[#FF8500]"
                />
                <span className="font-semibold text-gray-800">
                  Automatically mark remaining unmarked students as <strong>ABSENT</strong>
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCloseSessionModalOpen(false)}
                  disabled={isClosingSession}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleCloseSessionConfirm}
                  disabled={isClosingSession}
                  className="font-bold"
                >
                  {isClosingSession ? 'Closing...' : 'Confirm & Close'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* ==================================================== */}
        {/* MODAL: ATTENDANCE CORRECTION & AUDIT                 */}
        {/* ==================================================== */}
        {correctionModalOpen && targetCorrectionRecord && (
          <Modal
            isOpen={correctionModalOpen}
            onClose={() => setCorrectionModalOpen(false)}
            title="Authorized Attendance Correction"
            maxWidth="md"
          >
            <div className="space-y-4 text-xs">
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200 space-y-1">
                <div>Student: <strong className="text-gray-900">{targetCorrectionRecord.studentName}</strong> ({targetCorrectionRecord.studentCode})</div>
                <div>Session Date: <strong className="text-gray-900">{targetCorrectionRecord.sessionDate}</strong></div>
                <div>Current Status: <strong className="text-gray-900">{targetCorrectionRecord.status}</strong></div>
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase">New Corrected Status</label>
                <select
                  value={correctionNewStatus}
                  onChange={(e) => setCorrectionNewStatus(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs font-bold text-gray-900 focus:border-[#FF8500] focus:outline-none"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="EXCUSED">EXCUSED</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase">
                  Correction Reason (Mandatory Audit Requirement)
                </label>
                <textarea
                  rows={3}
                  placeholder="Explain why this status is being corrected (e.g., Medical exemption verified, Scanner issue)..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs text-gray-900 focus:border-[#FF8500] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCorrectionModalOpen(false)}
                  disabled={submittingCorrection}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitCorrection}
                  disabled={submittingCorrection || !correctionReason.trim()}
                  className="bg-[#FF8500] hover:bg-[#e67700] text-white font-bold"
                >
                  {submittingCorrection ? 'Saving...' : 'Save Correction'}
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* ==================================================== */}
        {/* MODAL: MANUAL STAFF ATTENDANCE ENTRY                */}
        {/* ==================================================== */}
        {manualStaffModalOpen && (
          <Modal
            isOpen={manualStaffModalOpen}
            onClose={() => setManualStaffModalOpen(false)}
            title="Manual Staff Attendance Entry"
            maxWidth="md"
          >
            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 uppercase">Select Staff Member</label>
                <select
                  value={manualStaffForm.userId}
                  onChange={(e) => setManualStaffForm({ ...manualStaffForm, userId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs font-semibold text-gray-900 focus:border-[#FF8500] focus:outline-none"
                >
                  <option value="">-- Choose Faculty / Staff Member --</option>
                  {staffUsersList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 uppercase">Date</label>
                  <input
                    type="date"
                    value={manualStaffForm.date}
                    onChange={(e) => setManualStaffForm({ ...manualStaffForm, date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs text-gray-900 focus:border-[#FF8500] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 uppercase">Status</label>
                  <select
                    value={manualStaffForm.status}
                    onChange={(e) => setManualStaffForm({ ...manualStaffForm, status: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs font-semibold text-gray-900 focus:border-[#FF8500] focus:outline-none"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="ON_DUTY">ON DUTY</option>
                    <option value="HALF_DAY">HALF DAY</option>
                    <option value="LEAVE">LEAVE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 uppercase">Check-In Time</label>
                  <input
                    type="time"
                    value={manualStaffForm.checkInAt}
                    onChange={(e) => setManualStaffForm({ ...manualStaffForm, checkInAt: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs text-gray-900 focus:border-[#FF8500] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 uppercase">Check-Out Time (Auto Policy: 09:30 PM)</label>
                  <input
                    type="time"
                    value={manualStaffForm.checkOutAt}
                    onChange={(e) => setManualStaffForm({ ...manualStaffForm, checkOutAt: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs text-gray-900 focus:border-[#FF8500] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Special lab session, invigilation duty..."
                  value={manualStaffForm.notes}
                  onChange={(e) => setManualStaffForm({ ...manualStaffForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-xs text-gray-900 focus:border-[#FF8500] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManualStaffModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleManualStaffSubmit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Save Staff Record
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* WhatsApp Group Link Modal */}
        {showGroupLinkModal && (
          <Modal
            isOpen={!!showGroupLinkModal}
            onClose={() => setShowGroupLinkModal(null)}
            title={`WhatsApp Group Link: ${showGroupLinkModal.batchName}`}
            maxWidth="md"
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-600">
                Paste the invite link for this batch’s WhatsApp group (e.g. <code>https://chat.whatsapp.com/...</code>).
                When configured, clicking the WhatsApp button will open this group directly and copy the absentee report to your clipboard.
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  WhatsApp Group Invite Link
                </label>
                <input
                  type="url"
                  value={groupLinkInput}
                  onChange={(e) => setGroupLinkInput(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem(`rca_wa_group_${showGroupLinkModal.batchId}`);
                    setShowGroupLinkModal(null);
                    showToast('WhatsApp group link cleared');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Clear Link
                </button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowGroupLinkModal(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (groupLinkInput.trim()) {
                        localStorage.setItem(`rca_wa_group_${showGroupLinkModal.batchId}`, groupLinkInput.trim());
                        showToast('WhatsApp group link saved!');
                      } else {
                        localStorage.removeItem(`rca_wa_group_${showGroupLinkModal.batchId}`);
                      }
                      setShowGroupLinkModal(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                  >
                    Save Group Link
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Modal: Generated Absentee Message on Attendance Submit */}
        {submittedAbsenteeModalData && (
          <Modal
            isOpen={true}
            onClose={() => setSubmittedAbsenteeModalData(null)}
            title="Attendance Saved & Absentee Message Generated"
            maxWidth="xl"
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900">
                      Attendance Successfully Saved!
                    </h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {submittedAbsenteeModalData.classItem.className} – {submittedAbsenteeModalData.classItem.batchName}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-emerald-800 pt-2 border-t border-emerald-200/60">
                  <span>Total: <strong>{submittedAbsenteeModalData.totalCount}</strong></span>
                  <span>Present: <strong className="text-emerald-700">{submittedAbsenteeModalData.presentCount}</strong></span>
                  <span>Absent: <strong className="text-rose-700">{submittedAbsenteeModalData.absentCount}</strong></span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4 text-[#FF8500]" />
                    Formatted Absentee Notice (WhatsApp Ready)
                  </label>
                  <span className="text-[11px] font-medium text-gray-400">
                    {submittedAbsenteeModalData.absentees.length} Absent Student(s)
                  </span>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={submittedAbsenteeModalData.message}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 p-3 font-mono text-xs text-gray-800 leading-relaxed focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSubmittedAbsenteeModalData(null)}
                  className="text-xs"
                >
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(submittedAbsenteeModalData.message);
                      showToast('Copied absentee message to clipboard!');
                    }}
                    className="text-xs flex items-center gap-1.5 font-bold text-gray-700 hover:text-black"
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-500" />
                    <span>Copy Message</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(submittedAbsenteeModalData.message);
                      const savedGroupLink = typeof window !== 'undefined'
                        ? localStorage.getItem(`rca_wa_group_${submittedAbsenteeModalData.classItem.batchId}`)
                        : null;
                      if (savedGroupLink && savedGroupLink.trim().startsWith('http')) {
                        showToast('Copied message & opening batch WhatsApp group...');
                        window.open(savedGroupLink.trim(), '_blank');
                      } else {
                        showToast('Copied message & opening WhatsApp...');
                        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(submittedAbsenteeModalData.message)}`;
                        window.open(url, '_blank');
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Send via WhatsApp</span>
                  </Button>
                </div>
              </div>
            </div>
          </Modal>
        )}

        {/* Floating Toast Notification */}
        {toastMsg && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-gray-900 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-in slide-in-from-bottom-5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}
      </ResponsivePageContainer>
    </div>
  );
}
