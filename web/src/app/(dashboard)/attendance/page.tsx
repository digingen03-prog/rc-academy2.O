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
  MessageCircle,
  CheckSquare,
  Square,
  RotateCcw
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTime12h, formatTimeOnly12h } from '@/lib/utils/time-format';

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
  const [todayAttendanceStudents, setTodayAttendanceStudents] = useState<
    Array<{
      id: string;
      studentId: string;
      name: string;
      code: string;
      status: 'PRESENT' | 'ABSENT' | 'UNMARKED';
    }>
  >([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [todayAttendanceFilterTab, setTodayAttendanceFilterTab] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'UNMARKED'>('ALL');
  const [classFilterId, setClassFilterId] = useState<string>('');
  const [batchFilterId, setBatchFilterId] = useState<string>('');
  const [subjectFilterId, setSubjectFilterId] = useState<string>('');
  const [classSearchQuery, setClassSearchQuery] = useState<string>('');
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
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
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
      const [classes, batches, staff, subjects] = await Promise.all([
        ApiClient.fetch<any[]>('/courses').catch(() => []),
        ApiClient.fetch<any[]>('/courses/batches').catch(() => []),
        ApiClient.fetch<any[]>('/staff').catch(() => []),
        ApiClient.fetch<any[]>('/courses/subjects').catch(() => []),
      ]);
      setClassesList(classes || []);
      setBatchesList(batches || []);
      setStaffUsersList(staff || []);
      setSubjectsList(subjects || []);
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

  // Filtered batches based on selected class
  // Filtered batches based on selected class
  const availableBatches = React.useMemo(() => {
    if (!classFilterId) {
      if (batchesList.length > 0) {
        return batchesList.map((b: any) => {
          const parentClass = classesList.find((c) => c.id === b.classId);
          return {
            ...b,
            className: parentClass?.name || b.class?.name || '',
          };
        });
      }
      return classesList.flatMap((c) =>
        (c.batches || []).map((b: any) => ({
          ...b,
          classId: c.id,
          className: c.name,
        }))
      );
    }
    const selectedClass = classesList.find((c) => c.id === classFilterId);
    const fromBatchesList = batchesList.filter((b: any) => b.classId === classFilterId);
    if (fromBatchesList.length > 0) {
      return fromBatchesList.map((b: any) => ({
        ...b,
        className: selectedClass?.name || '',
      }));
    }
    return (selectedClass?.batches || []).map((b: any) => ({
      ...b,
      classId: selectedClass.id,
      className: selectedClass.name,
    }));
  }, [classesList, batchesList, classFilterId]);

  // Filtered subjects based on selected class
  const availableSubjects = React.useMemo(() => {
    if (!classFilterId) {
      return subjectsList;
    }
    return subjectsList.filter((s: any) => !s.classId || s.classId === classFilterId);
  }, [subjectsList, classFilterId]);

  const handleLoadAttendanceForFilter = async (
    targetClassId?: string,
    targetBatchId?: string,
    targetSubjectId?: string,
    targetDate?: string,
  ) => {
    const cId = targetClassId !== undefined ? targetClassId : classFilterId;
    const bId = targetBatchId !== undefined ? targetBatchId : batchFilterId;
    const sId = targetSubjectId !== undefined ? targetSubjectId : subjectFilterId;
    const dStr = targetDate || selectedDate || new Date().toISOString().split('T')[0];

    // If no filter selected at all, clear roster
    if (!cId && !bId && !sId) {
      setSelectedTodayAttendanceClass(null);
      setTodayAttendanceStudents([]);
      setSelectedStudentIds(new Set());
      return;
    }

    if (!selectedDate && dStr) {
      setSelectedDate(dStr);
    }

    setLoadingTodayAttendance(true);
    try {
      const res = await ApiClient.fetch<any>('/attendance/sessions/start-class', {
        method: 'POST',
        body: JSON.stringify({
          classId: cId || undefined,
          batchId: bId || undefined,
          subjectId: sId || undefined,
          date: dStr,
        }),
      });

      const cls = classesList.find((c) => c.id === cId) || res.class;
      const bch = availableBatches.find((b: any) => b.id === bId) || res.batch;
      const sbj = availableSubjects.find((s: any) => s.id === sId) || res.subject;

      const item: ScheduledClassItem = {
        id: res.id,
        scheduleId: res.classScheduleId || null,
        classId: cId || res.classId || '',
        className: cls?.name || res.class?.name || (bch?.className ? bch.className : 'Class'),
        classCode: cls?.code || res.class?.code || '',
        batchId: bId || res.batchId || null,
        batchName: bId ? (bch?.name || res.batch?.name || 'Batch') : 'All Batches',
        subjectId: sId || res.subjectId || null,
        subjectName: sId ? (sbj?.name || res.subject?.name || null) : 'All Subjects',
        subjectCode: sbj?.code || res.subject?.code || null,
        teacherName: bch?.teacherName || res.teacher?.name || '',
        startTime: res.startTime || '09:00',
        endTime: res.endTime || '10:00',
        isCancelled: false,
        sessionId: res.id,
        sessionStatus: 'OPEN',
        eligibleStudentCount: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        unmarkedCount: 0,
        attendanceRate: 0,
      };

      setSelectedTodayAttendanceClass(item);

      const sessionDetails = await ApiClient.fetch<ActiveSessionData>(
        `/attendance/sessions/${res.id}?batchId=${encodeURIComponent(bId || '')}&classId=${encodeURIComponent(cId || '')}&subjectId=${encodeURIComponent(sId || '')}`
      );
      setActiveSessionData(sessionDetails);

      const list: Array<{ id: string; studentId: string; name: string; code: string; status: 'PRESENT' | 'ABSENT' | 'UNMARKED' }> = [];

      // Add recorded students with their recorded status
      sessionDetails.records.forEach((r) => {
        list.push({
          id: r.id,
          studentId: r.studentId,
          name: r.studentName,
          code: r.attendanceCode || r.studentCode || '',
          status: r.status === 'ABSENT' ? 'ABSENT' : 'PRESENT',
        });
      });

      // Add unmarked students (kept as UNMARKED so admin selects status)
      sessionDetails.unmarkedStudents.forEach((u: any) => {
        list.push({
          id: `unmarked-${u.id}`,
          studentId: u.id,
          name: u.studentName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Student',
          code: u.attendanceCode || u.studentCode || u.admissionNumber || '',
          status: 'UNMARKED',
        });
      });

      list.sort((a, b) => a.name.localeCompare(b.name));
      setTodayAttendanceStudents(list);
      setSelectedStudentIds(new Set());
      setTodayAttendanceFilterTab('ALL');
    } catch (err: any) {
      alert(`Could not load class attendance: ${err?.message || 'Error occurred'}`);
    } finally {
      setLoadingTodayAttendance(false);
    }
  };

  const handleSelectClassForTodayAttendance = async (item: ScheduledClassItem) => {
    await handleLoadAttendanceForFilter(item.classId, item.batchId || undefined, item.subjectId || undefined, selectedDate);
  };

  const handleToggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAllVisibleStudents = (visibleStudentIds: string[]) => {
    setSelectedStudentIds((prev) => {
      const allSelected = visibleStudentIds.length > 0 && visibleStudentIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        visibleStudentIds.forEach((id) => next.delete(id));
      } else {
        visibleStudentIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleMarkSelectedStatus = (status: 'PRESENT' | 'ABSENT') => {
    if (selectedStudentIds.size === 0) return;
    setTodayAttendanceStudents((prev) =>
      prev.map((s) => (selectedStudentIds.has(s.studentId) ? { ...s, status } : s))
    );
    showToast(`Marked ${selectedStudentIds.size} student(s) as ${status}`);
    setSelectedStudentIds(new Set());
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const handleToggleStudentStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setTodayAttendanceStudents((prev) =>
      prev.map((s) => {
        if (s.studentId !== studentId) return s;
        return { ...s, status: s.status === status ? 'UNMARKED' : status };
      })
    );
  };

  const handleSetAllStudentsStatus = (status: 'PRESENT' | 'ABSENT') => {
    setTodayAttendanceStudents((prev) => prev.map((s) => ({ ...s, status })));
    showToast(`Marked all students as ${status}`);
  };

  const handleSubmitTodayAttendance = async () => {
    if (!selectedTodayAttendanceClass || todayAttendanceStudents.length === 0 || submittingTodayAttendance) return;

    let finalStudents = [...todayAttendanceStudents];
    const unmarkedStudents = finalStudents.filter((s) => s.status === 'UNMARKED');
    if (unmarkedStudents.length > 0) {
      const confirmAbsent = window.confirm(
        `There are ${unmarkedStudents.length} student(s) still unmarked.\n\nClick OK to mark them as ABSENT and save attendance, or Cancel to review.`
      );
      if (!confirmAbsent) return;
      finalStudents = finalStudents.map((s) => (s.status === 'UNMARKED' ? { ...s, status: 'ABSENT' as const } : s));
      setTodayAttendanceStudents(finalStudents);
    }

    setSubmittingTodayAttendance(true);

    try {
      let sessionId = selectedTodayAttendanceClass.sessionId;
      if (!sessionId && activeSessionData) {
        sessionId = activeSessionData.session.id;
      }

      const presentIds = finalStudents.filter((s) => s.status === 'PRESENT').map((s) => s.studentId);
      const absentStudents = finalStudents.filter((s) => s.status === 'ABSENT');
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
        totalEnrolled: finalStudents.length,
        attendanceRate: finalStudents.length > 0 ? Math.round((presentIds.length / finalStudents.length) * 100) : 0,
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
        totalCount: finalStudents.length,
      });

      showToast(`Attendance saved! Generated absentee report for ${absentList.length} absentees.`);
      setSelectedStudentIds(new Set());
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
        time: formatTimeOnly12h(new Date()),
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
    if (classFilterId || batchFilterId || subjectFilterId) {
      handleLoadAttendanceForFilter(classFilterId, batchFilterId, subjectFilterId, newDateStr);
    }
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

    const presentCount = todayAttendanceStudents.filter((s) => s.status === 'PRESENT').length;
    const absentCount = todayAttendanceStudents.filter((s) => s.status === 'ABSENT').length;
    const unmarkedCount = todayAttendanceStudents.filter((s) => s.status === 'UNMARKED').length;

    const visibleStudents = todayAttendanceStudents.filter((s) => {
      if (todayAttendanceFilterTab !== 'ALL' && s.status !== todayAttendanceFilterTab) {
        return false;
      }
      if (!todayAttendanceSearch.trim()) return true;
      const q = todayAttendanceSearch.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    });

    const isAllVisibleSelected =
      visibleStudents.length > 0 &&
      visibleStudents.every((s) => selectedStudentIds.has(s.studentId));

    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-in fade-in duration-200 mt-6">
        {/* Header with Title & Stats */}
        <div className="border-b border-gray-200 bg-gray-50/70 p-3.5 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                  {selectedTodayAttendanceClass.className} – {selectedTodayAttendanceClass.batchName}
                </h3>
                {selectedTodayAttendanceClass.subjectName && (
                  <span className="rounded-md bg-orange-100 px-2 py-0.5 text-xs font-bold text-[#FF8500] shrink-0">
                    {selectedTodayAttendanceClass.subjectName}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-700 border border-neutral-200 shrink-0">
                  <UserCheck className="h-3 w-3 text-[#FF8500]" /> Manual Roll Call
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span>{formatTime12h(selectedTodayAttendanceClass.startTime)} – {formatTime12h(selectedTodayAttendanceClass.endTime)}</span>
                {selectedTodayAttendanceClass.teacherName && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span>Faculty: {selectedTodayAttendanceClass.teacherName}</span>
                  </>
                )}
              </p>
            </div>

            {/* Top Right: Close button */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedTodayAttendanceClass(null);
                  setTodayAttendanceStudents([]);
                  setSelectedStudentIds(new Set());
                }}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 bg-white shadow-2xs transition"
                title="Close student sheet"
              >
                <X className="h-3.5 w-3.5" />
                Close Sheet
              </button>
            </div>
          </div>

          {/* Stats pills: 4-col grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 shadow-2xs">
              <Users className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="text-[11px] sm:text-xs text-gray-500">Total:</span>
              <span className="text-xs sm:text-sm font-bold text-gray-800">{todayAttendanceStudents.length}</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 shadow-2xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] sm:text-xs text-emerald-700">Present:</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-800">{presentCount}</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 shadow-2xs">
              <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
              <span className="text-[11px] sm:text-xs text-rose-700">Absent:</span>
              <span className="text-xs sm:text-sm font-bold text-rose-800">{absentCount}</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 shadow-2xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] sm:text-xs text-amber-700">Unmarked:</span>
              <span className="text-xs sm:text-sm font-bold text-amber-800">{unmarkedCount}</span>
            </div>
          </div>

          {/* Status Filter Tabs & Bulk Actions */}
          <div className="mt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-gray-200">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {(['ALL', 'PRESENT', 'ABSENT', 'UNMARKED'] as const).map((tab) => {
                const count =
                  tab === 'ALL'
                    ? todayAttendanceStudents.length
                    : tab === 'PRESENT'
                    ? presentCount
                    : tab === 'ABSENT'
                    ? absentCount
                    : unmarkedCount;
                const isSelected = todayAttendanceFilterTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setTodayAttendanceFilterTab(tab)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 ${
                      isSelected
                        ? tab === 'PRESENT'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : tab === 'ABSENT'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : tab === 'UNMARKED'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-gray-800 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()} ({count})
                  </button>
                );
              })}
            </div>

            {/* Quick Bulk All Actions */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button
                type="button"
                onClick={() => handleSetAllStudentsStatus('PRESENT')}
                className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => handleSetAllStudentsStatus('ABSENT')}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                <XCircle className="h-3.5 w-3.5 text-rose-600" />
                Mark All Absent
              </button>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="relative mt-2.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={todayAttendanceSearch}
              onChange={(e) => setTodayAttendanceSearch(e.target.value)}
              placeholder="Search enrolled student by name or student code..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-[#FF8500]"
            />
          </div>

          {/* Multi-Select Floating Action Bar */}
          {selectedStudentIds.size > 0 && (
            <div className="mt-3 bg-orange-50/90 border border-orange-200 rounded-lg p-2.5 px-3 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-[#FF8500]" />
                <span className="text-xs font-bold text-gray-900">
                  {selectedStudentIds.size} student{selectedStudentIds.size > 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleMarkSelectedStatus('PRESENT')}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Mark Selected Present
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkSelectedStatus('ABSENT')}
                  className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                  Mark Selected Absent
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-2 py-1"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table Body */}
        {loadingTodayAttendance ? (
          <div className="py-16 text-center text-gray-400 space-y-2">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#FF8500]" />
            <p className="text-xs font-medium">Loading enrolled students...</p>
          </div>
        ) : visibleStudents.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-600">
              {todayAttendanceStudents.length === 0
                ? 'No enrolled students found for this selection'
                : 'No students match current filter'}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              {todayAttendanceStudents.length === 0
                ? 'Try selecting a different batch, class, or choose "All Subjects" to view enrolled students.'
                : 'Try adjusting your search query or changing the status filter tab (All, Present, Absent, Unmarked).'}
            </p>
          </div>
        ) : (
          <div>
            {/* MOBILE RESPONSIVE VIEW (sm:hidden) */}
            <div className="block sm:hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-100/90 border-b border-gray-200 text-xs font-bold text-gray-700">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    onChange={() => handleSelectAllVisibleStudents(visibleStudents.map((s) => s.studentId))}
                    className="h-4 w-4 rounded border-gray-300 text-[#FF8500] focus:ring-[#FF8500]"
                  />
                  <span>Select All ({visibleStudents.length})</span>
                </div>
                <div className="flex items-center gap-2 pr-1">
                  <span className="text-[11px] font-semibold text-gray-500">Tap to Mark</span>
                </div>
              </div>

              {/* Student Rows */}
              <div className="divide-y divide-gray-100 bg-white">
                {visibleStudents.map((student, idx) => {
                  const isPresent = student.status === 'PRESENT';
                  const isAbsent = student.status === 'ABSENT';
                  const isUnmarked = student.status === 'UNMARKED';
                  const isSelected = selectedStudentIds.has(student.studentId);

                  return (
                    <div
                      key={student.studentId}
                      className={`flex items-center justify-between px-3.5 py-3 transition-colors ${
                        isSelected
                          ? 'bg-orange-50/60'
                          : isPresent
                          ? 'hover:bg-gray-50/60'
                          : isAbsent
                          ? 'bg-rose-50/30'
                          : 'bg-amber-50/20'
                      }`}
                    >
                      {/* Checkbox & Student Info */}
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(student.studentId)}
                          className="h-4 w-4 rounded border-gray-300 text-[#FF8500] focus:ring-[#FF8500] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-xs truncate">{student.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                              {student.code || 'N/A'}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                isPresent
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isAbsent
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {student.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Present & Absent Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleStudentStatus(student.studentId, 'PRESENT')}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                            isPresent
                              ? 'bg-emerald-500 text-white shadow-md ring-3 ring-emerald-100'
                              : 'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'
                          }`}
                          title="Mark Present"
                        >
                          <Check className={`w-4 h-4 stroke-[2.5] ${isPresent ? 'text-white' : 'text-gray-400'}`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStudentStatus(student.studentId, 'ABSENT')}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer ${
                            isAbsent
                              ? 'bg-rose-500 text-white shadow-md ring-3 ring-rose-100'
                              : 'bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-600'
                          }`}
                          title="Mark Absent"
                        >
                          <X className={`w-4 h-4 stroke-[2.5] ${isAbsent ? 'text-white' : 'text-gray-400'}`} />
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
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllVisibleSelected}
                        onChange={() => handleSelectAllVisibleStudents(visibleStudents.map((s) => s.studentId))}
                        className="h-4 w-4 rounded border-gray-300 text-[#FF8500] focus:ring-[#FF8500]"
                      />
                    </th>
                    <th className="py-3 px-2 w-10 text-center">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Code / Admission</th>
                    <th className="py-3 px-4 text-center">Current Status</th>
                    <th className="py-3 px-4 text-center w-56">Take Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleStudents.map((student, idx) => {
                    const isPresent = student.status === 'PRESENT';
                    const isAbsent = student.status === 'ABSENT';
                    const isUnmarked = student.status === 'UNMARKED';
                    const isSelected = selectedStudentIds.has(student.studentId);

                    return (
                      <tr
                        key={student.studentId}
                        className={`transition-colors hover:bg-gray-50/80 ${
                          isSelected
                            ? 'bg-orange-50/40'
                            : isPresent
                            ? ''
                            : isAbsent
                            ? 'bg-rose-50/25'
                            : 'bg-amber-50/15'
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectStudent(student.studentId)}
                            className="h-4 w-4 rounded border-gray-300 text-[#FF8500] focus:ring-[#FF8500]"
                          />
                        </td>
                        <td className="py-3 px-2 text-center font-medium text-gray-400 text-xs">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isPresent
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isAbsent
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-gray-900 text-xs">{student.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                            {student.code || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isPresent
                                ? 'bg-emerald-100 text-emerald-800'
                                : isAbsent
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPresent ? (
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            ) : isAbsent ? (
                              <XCircle className="h-3 w-3 text-rose-600" />
                            ) : (
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                            )}
                            {student.status}
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
                                isAbsent
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-gray-100 text-gray-600 hover:bg-rose-50 hover:text-rose-700 border border-gray-200'
                              }`}
                            >
                              <XCircle className={`h-3.5 w-3.5 ${!isPresent && !isUnmarked ? 'text-white' : 'text-rose-500'}`} />
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
        <div className="border-t border-gray-200 bg-gray-50/90 p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5 text-xs text-gray-600">
            <div>
              <span className="font-bold text-gray-900">{todayAttendanceStudents.length}</span> total students:{' '}
              <span className="font-bold text-emerald-700">{presentCount} Present</span>
              , <span className="font-bold text-rose-700">{absentCount} Absent</span>
              {unmarkedCount > 0 && (
                <span className="font-bold text-amber-700">, {unmarkedCount} Unmarked</span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <UserCheck className="h-3 w-3 text-[#FF8500] shrink-0" />
              <span>Select students or use bulk actions, then click Confirm & Make Attendance.</span>
            </p>
          </div>

          <Button
            onClick={handleSubmitTodayAttendance}
            disabled={submittingTodayAttendance || todayAttendanceStudents.length === 0}
            className="w-full sm:w-auto bg-[#FF8500] hover:bg-[#e67700] text-white font-bold text-xs sm:text-sm py-2.5 sm:py-3 px-6 shadow-md flex items-center justify-center gap-2 transition active:scale-98"
          >
            {submittingTodayAttendance ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Saving Attendance...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Confirm & Make Attendance</span>
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
        subtitle="Filter classes, select students, mark attendance records & view attendance history"
      />

      <ResponsivePageContainer>
        {/* Navigation Tabs Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab('SCANNER')}
              className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'SCANNER'
                  ? 'bg-[#FF8500] text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <UserCheck className="h-4 w-4 shrink-0" />
              <span>Take Attendance</span>
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

          {/* Academy Timezone & Mode Indicator */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[11px] sm:text-xs font-medium text-gray-600 border border-gray-200 shadow-sm shrink-0">
              <Clock className="h-3.5 w-3.5 text-[#FF8500]" />
              <span>Timezone: <strong className="text-black">{timezone}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-[11px] sm:text-xs font-bold text-[#D96B00] border border-orange-200 shadow-2xs shrink-0">
              <UserCheck className="h-3.5 w-3.5 text-[#FF8500]" />
              <span>Manual Admin Mode</span>
            </div>
          </div>
        </div>

        {/* ==================================================== */}
        {/* TAB 1: TAKE ATTENDANCE (DIRECT FILTER & ROLL CALL)   */}
        {/* ==================================================== */}
        {activeTab === 'SCANNER' && (
          <div className="space-y-6">
            {/* Direct Roll Call Filter Bar */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-[#FF8500]" />
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">Attendance Roll Call & Filters</h3>
                    <p className="text-xs text-gray-500">Filter by Class, Batch, Subject, or Date to load students and mark roll call</p>
                  </div>
                </div>
                {(classFilterId || batchFilterId || subjectFilterId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setClassFilterId('');
                      setBatchFilterId('');
                      setSubjectFilterId('');
                      setSelectedTodayAttendanceClass(null);
                      setTodayAttendanceStudents([]);
                      setSelectedStudentIds(new Set());
                    }}
                    className="text-xs text-[#FF8500] hover:text-[#d96b00] font-bold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset All Filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Date Selector */}
                <div>
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">
                    Date
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => shiftDate(-1)}
                      className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 hover:text-black transition shrink-0"
                      title="Previous Day"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        const newD = e.target.value;
                        setSelectedDate(newD);
                        loadTodayData(newD);
                        if (classFilterId || batchFilterId || subjectFilterId) {
                          handleLoadAttendanceForFilter(classFilterId, batchFilterId, subjectFilterId, newD);
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-xs font-semibold text-gray-800 focus:border-[#FF8500] focus:outline-none min-w-0"
                    />
                    <button
                      type="button"
                      onClick={() => shiftDate(1)}
                      className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50 hover:text-black transition shrink-0"
                      title="Next Day"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Standard / Class Selector */}
                <div>
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">
                    Standard / Class
                  </label>
                  <select
                    value={classFilterId}
                    onChange={(e) => {
                      const newCId = e.target.value;
                      setClassFilterId(newCId);

                      // Check if current batch belongs to the new class
                      let nextBId = batchFilterId;
                      if (newCId && batchFilterId) {
                        const bObj = batchesList.find((b: any) => b.id === batchFilterId);
                        if (bObj && bObj.classId && bObj.classId !== newCId) {
                          nextBId = '';
                          setBatchFilterId('');
                        }
                      }

                      // Check if current subject belongs to the new class
                      let nextSId = subjectFilterId;
                      if (newCId && subjectFilterId) {
                        const sObj = subjectsList.find((s: any) => s.id === subjectFilterId);
                        if (sObj && sObj.classId && sObj.classId !== newCId) {
                          nextSId = '';
                          setSubjectFilterId('');
                        }
                      }

                      if (newCId || nextBId || nextSId) {
                        handleLoadAttendanceForFilter(newCId, nextBId, nextSId, selectedDate);
                      } else {
                        setSelectedTodayAttendanceClass(null);
                        setTodayAttendanceStudents([]);
                        setSelectedStudentIds(new Set());
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:border-[#FF8500] focus:outline-none"
                  >
                    <option value="">All Classes / Standards ({classesList.length})</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Batch Selector */}
                <div>
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">
                    Batch
                  </label>
                  <select
                    value={batchFilterId}
                    onChange={(e) => {
                      const newBId = e.target.value;
                      setBatchFilterId(newBId);

                      let targetCId = classFilterId;
                      if (newBId) {
                        const foundBatch = availableBatches.find((b: any) => b.id === newBId) || batchesList.find((b: any) => b.id === newBId);
                        if (foundBatch?.classId && foundBatch.classId !== classFilterId) {
                          targetCId = foundBatch.classId;
                          setClassFilterId(targetCId);
                        }
                      }

                      if (targetCId || newBId || subjectFilterId) {
                        handleLoadAttendanceForFilter(targetCId, newBId, subjectFilterId, selectedDate);
                      } else {
                        setSelectedTodayAttendanceClass(null);
                        setTodayAttendanceStudents([]);
                        setSelectedStudentIds(new Set());
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:border-[#FF8500] focus:outline-none"
                  >
                    <option value="">All Batches {availableBatches.length > 0 ? `(${availableBatches.length})` : ''}</option>
                    {availableBatches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.className && !classFilterId ? `${b.className} - ` : ''}{b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Subject Selector */}
                <div>
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block mb-1">
                    Subject
                  </label>
                  <select
                    value={subjectFilterId}
                    onChange={(e) => {
                      const newSId = e.target.value;
                      setSubjectFilterId(newSId);

                      let targetCId = classFilterId;
                      if (newSId) {
                        const foundSubject = subjectsList.find((s: any) => s.id === newSId);
                        if (foundSubject?.classId && !classFilterId) {
                          targetCId = foundSubject.classId;
                          setClassFilterId(targetCId);
                        }
                      }

                      if (targetCId || batchFilterId || newSId) {
                        handleLoadAttendanceForFilter(targetCId, batchFilterId, newSId, selectedDate);
                      } else {
                        setSelectedTodayAttendanceClass(null);
                        setTodayAttendanceStudents([]);
                        setSelectedStudentIds(new Set());
                      }
                    }}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:border-[#FF8500] focus:outline-none"
                  >
                    <option value="">All Subjects {availableSubjects.length > 0 ? `(${availableSubjects.length})` : ''}</option>
                    {availableSubjects.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Selection Info Badge */}
              {selectedTodayAttendanceClass && (
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 flex-wrap">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-semibold text-gray-900">Loaded Roster:</span>
                    <span className="rounded bg-orange-100 text-[#D96B00] px-2 py-0.5 font-bold">
                      {selectedTodayAttendanceClass.className}
                    </span>
                    {selectedTodayAttendanceClass.batchName && selectedTodayAttendanceClass.batchName !== 'All Batches' && (
                      <span className="rounded bg-gray-100 text-gray-800 px-2 py-0.5 font-semibold">
                        {selectedTodayAttendanceClass.batchName}
                      </span>
                    )}
                    {selectedTodayAttendanceClass.subjectName && (
                      <span className="rounded bg-blue-100 text-blue-800 px-2 py-0.5 font-semibold">
                        {selectedTodayAttendanceClass.subjectName}
                      </span>
                    )}
                    <span className="text-gray-400">• {selectedDate}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadAttendanceForFilter(classFilterId, batchFilterId, subjectFilterId, selectedDate)}
                      disabled={loadingTodayAttendance}
                      className="text-xs h-7 px-2.5 flex items-center gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${loadingTodayAttendance ? 'animate-spin' : ''}`} />
                      <span>Reload Roster</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTodayAttendanceClass(null);
                        setTodayAttendanceStudents([]);
                        setSelectedStudentIds(new Set());
                      }}
                      className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-2 py-1"
                    >
                      Clear Roster
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* If Roster is Loaded, render Student Attendance Sheet */}
            {selectedTodayAttendanceClass && renderStudentAttendanceSheet()}

            {/* If No Class is selected yet, show Quick Selector Guide */}
            {!selectedTodayAttendanceClass && !loadingTodayAttendance && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[#FF8500]">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Select a Class or Batch to Start Roll Call</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    Use the filters above to choose a Class, Batch, and Subject, or click any class below to load students:
                  </p>
                </div>

                {classesList.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                      Available Classes ({classesList.length})
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap max-w-2xl mx-auto">
                      {classesList.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setClassFilterId(c.id);
                            setBatchFilterId('');
                            setSubjectFilterId('');
                            handleLoadAttendanceForFilter(c.id, '', '', selectedDate);
                          }}
                          className="px-3.5 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-[#FF8500] hover:text-white hover:border-[#FF8500] text-xs font-bold text-gray-800 transition active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <BookOpen className="h-3.5 w-3.5 shrink-0" />
                          <span>{c.name}</span>
                          {c.batches && c.batches.length > 0 && (
                            <span className="text-[10px] opacity-75 font-normal">
                              ({c.batches.length} {c.batches.length === 1 ? 'batch' : 'batches'})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading Indicator */}
            {loadingTodayAttendance && !selectedTodayAttendanceClass && (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center space-y-2">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-[#FF8500]" />
                <p className="text-sm font-semibold text-gray-700">Loading student roster...</p>
                <p className="text-xs text-gray-400">Fetching enrollments for the selected class and filters.</p>
              </div>
            )}
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
                                {formatTime12h(r.startTime)} – {formatTime12h(r.endTime)}
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
                            {formatTimeOnly12h(r.recordedAt)}
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
                                {s.checkInAt ? formatTimeOnly12h(s.checkInAt) : '—'}
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

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSubmittedAbsenteeModalData(null)}
                  className="w-full sm:w-auto text-xs py-2 sm:py-1.5"
                >
                  Done / Close
                </Button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(submittedAbsenteeModalData.message);
                      showToast('Copied absentee message to clipboard!');
                    }}
                    className="w-full sm:w-auto text-xs py-2 sm:py-1.5 flex items-center justify-center gap-1.5 font-bold text-gray-700 hover:text-black border-gray-300"
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
                    className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20ba59] text-white text-xs sm:text-sm font-bold py-2.5 sm:py-2 px-4 flex items-center justify-center gap-2 shadow-sm active:scale-98"
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
