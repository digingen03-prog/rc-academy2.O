'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
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
  Trash2,
  Edit3,
  ExternalLink,
  Users,
  BookOpen,
  MapPin,
  Settings,
  Filter,
  Layers,
  ChevronRight,
  UserCheck,
  Sparkles,
  Info,
  X,
  MessageSquare
} from 'lucide-react';
import { ApiClient } from '@/lib/api/api-client';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';

interface DailyClass {
  id: string;
  classId: string;
  className: string;
  classCode: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  batchId?: string | null;
  batchName?: string | null;
  staffId: string;
  teacherId?: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  isException?: boolean;
  isSpecialClass?: boolean;
  exceptionStatus?: string;
  notes?: string | null;
}

interface CancelledClass {
  id: string;
  className: string;
  subjectName: string;
  batchName?: string | null;
  startTime: string;
  endTime: string;
  teacherName: string;
  reason: string;
}

interface DailyScheduleResponse {
  date: string;
  dayOfWeek: string;
  formattedDate: string;
  academyName: string;
  classesCount: number;
  cancelledCount: number;
  conflictsCount: number;
  conflicts: any[];
  schedule: DailyClass[];
  classes: DailyClass[];
  cancelledClasses: CancelledClass[];
  whatsappMessage: string;
  whatsappUrl: string;
  config: {
    academyName: string;
    timezone: string;
    groupByBatch: boolean;
  };
}

interface MasterScheduleEntry {
  id: string;
  classId: string;
  subjectId: string;
  batchId?: string | null;
  staffId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  isActive: boolean;
  class: { id: string; name: string; code: string };
  subject: { id: string; name: string; code: string };
  batch?: { id: string; name: string; code: string } | null;
  staff: { id: string; firstName: string; lastName: string; email: string };
}

interface DailyExceptionEntry {
  id: string;
  date: string;
  scheduleId?: string | null;
  classId: string;
  subjectId: string;
  batchId?: string | null;
  staffId: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  status: 'ACTIVE' | 'CANCELLED' | 'SUBSTITUTED' | 'RESCHEDULED' | 'SPECIAL_CLASS';
  cancellationReason?: string | null;
  notes?: string | null;
  class: { id: string; name: string; code: string };
  subject: { id: string; name: string; code: string };
  batch?: { id: string; name: string; code: string } | null;
  staff: { id: string; firstName: string; lastName: string; email: string };
}

interface CourseItem {
  id: string;
  name: string;
  code: string;
  subjects: { id: string; name: string; code: string }[];
  batches: { id: string; name: string; code: string | null }[];
}

interface StaffItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation?: string | null;
}

const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

// Default Fallback Class Timings
const DEFAULT_CLASS_START_TIME = '09:00'; // 09:00 AM
const DEFAULT_CLASS_END_TIME = '10:30';   // 10:30 AM

// ----------------------------------------------------------------
// Time Formatter: Convert 24h ("14:00") to 12h AM/PM ("02:00 PM")
// Supports default fallback time when time is missing or null
// ----------------------------------------------------------------
function formatTime12h(timeStr?: string | null, fallbackTime = ''): string {
  const effective = (timeStr && timeStr.trim()) ? timeStr.trim() : fallbackTime;
  if (!effective) return '';
  const parts = effective.split(':');
  if (parts.length < 2) return effective;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, '0');
  if (isNaN(hours)) return effective;

  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const hh = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hh}:${minutes} ${ampm}`;
}

// ----------------------------------------------------------------
// WhatsApp Message Builder Helper
// ----------------------------------------------------------------
function buildWhatsAppMessage({
  data,
  targetClassId,
  customFooter,
  noticesList,
  batchGrouping,
  headerTemplate,
}: {
  data: DailyScheduleResponse | null;
  targetClassId: string | 'ALL';
  customFooter: string;
  noticesList: string[];
  batchGrouping: boolean;
  headerTemplate?: string;
}): string {
  if (!data) return '';

  const academyName = data.academyName || 'RC Academy';
  const dateFormatted = data.formattedDate || data.date;

  const targetClasses =
    targetClassId === 'ALL'
      ? data.classes
      : data.classes.filter((c) => c.id === targetClassId);

  if (targetClasses.length === 0) {
    return `*${academyName} – Class Schedule*\n📅 ${dateFormatted}\n\n🏖️ *No classes scheduled.* Enjoy your day!`;
  }

  // Header
  const isSingleClass = targetClassId !== 'ALL' && targetClasses.length === 1;
  const tpl = headerTemplate || "*{academy_name} – Tomorrow's Class Schedule*\n📅 {date}";
  const header = isSingleClass
    ? `*${academyName} – Class Schedule Update*\n📅 ${dateFormatted}`
    : tpl.replace('{academy_name}', academyName).replace('{date}', dateFormatted);

  // Body
  let body = '';
  if (isSingleClass || !batchGrouping) {
    const classLines = targetClasses.map((c) => {
      const startTime = formatTime12h(c.startTime, DEFAULT_CLASS_START_TIME);
      const endTime = formatTime12h(c.endTime, DEFAULT_CLASS_END_TIME);
      let text = `🕘 *${startTime} – ${endTime}*\n📚 Class: *${c.className}*`;
      if (c.subjectName) text += `\n📘 Subject: *${c.subjectName}*`;
      if (c.teacherName) text += `\n👨‍🏫 Teacher: ${c.teacherName}`;
      if (c.batchName) text += `\n👥 Batch: ${c.batchName}`;
      if (c.room) text += `\n📍 Room: ${c.room}`;
      if (c.isException && c.exceptionStatus === 'SUBSTITUTED') {
        text += `\n⚠️ _(Teacher Substitution)_`;
      } else if (c.isSpecialClass || (c.isException && c.exceptionStatus === 'SPECIAL_CLASS')) {
        text += `\n⭐ _(Special Additional Class)_`;
      }
      if (c.notes) {
        text += `\n📝 Note: ${c.notes}`;
      }
      return text;
    });
    body = classLines.join('\n\n');
  } else {
    // Group by Batch
    const groups = new Map<string, DailyClass[]>();
    for (const c of targetClasses) {
      const key = c.batchName ? `${c.className} (${c.batchName})` : c.className;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    const groupSections: string[] = [];
    for (const [groupName, groupClasses] of groups.entries()) {
      const items = groupClasses.map((c) => {
        const startTime = formatTime12h(c.startTime, DEFAULT_CLASS_START_TIME);
        const endTime = formatTime12h(c.endTime, DEFAULT_CLASS_END_TIME);
        let text = `  • *${startTime} – ${endTime}*: ${c.subjectName} (${c.teacherName})`;
        if (c.room) text += ` [${c.room}]`;
        return text;
      });
      groupSections.push(`🎓 *${groupName}*\n${items.join('\n')}`);
    }
    body = groupSections.join('\n\n');
  }

  // Additional Notices
  let noticesBlock = '';
  if (noticesList.length > 0) {
    noticesBlock = '\n\n📢 *Important Notice(s):*\n' + noticesList.map((n) => `• ${n}`).join('\n');
  }

  // Ending Message / Sign-off
  let footerBlock = '';
  if (customFooter && customFooter.trim()) {
    footerBlock = `\n\n${customFooter.trim()}`;
  }

  return `${header}\n\n${body}${noticesBlock}${footerBlock}`;
}

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState<'daily' | 'master' | 'exceptions' | 'settings'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Daily Schedule & WhatsApp Data
  const [dailyData, setDailyData] = useState<DailyScheduleResponse | null>(null);
  const [editedMessage, setEditedMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [groupByBatch, setGroupByBatch] = useState<boolean>(false);

  // Class Selection, Ending Message & Custom Notices for WhatsApp
  const [selectedClassId, setSelectedClassId] = useState<string | 'ALL'>('ALL');
  const [endingMessage, setEndingMessage] = useState<string>(
    '🔔 *Reminder:* Please arrive 10 minutes before class with textbooks and completed homework. Have a great learning session!'
  );
  const [customNotices, setCustomNotices] = useState<string[]>([]);
  const [customNoticeInput, setCustomNoticeInput] = useState<string>('');

  // Master Timetable Data
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string>('MONDAY');
  const [masterSchedules, setMasterSchedules] = useState<MasterScheduleEntry[]>([]);
  const [masterLoading, setMasterLoading] = useState<boolean>(false);

  // Daily Exceptions Data
  const [exceptions, setExceptions] = useState<DailyExceptionEntry[]>([]);
  const [exceptionsLoading, setExceptionsLoading] = useState<boolean>(false);

  // Resources for dropdowns
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<StaffItem[]>([]);

  // Modals
  const [showAddRecurringModal, setShowAddRecurringModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [showSubstituteModal, setShowSubstituteModal] = useState<boolean>(false);
  const [showSpecialModal, setShowSpecialModal] = useState<boolean>(false);
  const [selectedClassForAction, setSelectedClassForAction] = useState<DailyClass | null>(null);

  const pathname = usePathname();

  // Reset all modals on route change
  useEffect(() => {
    setShowAddRecurringModal(false);
    setShowCancelModal(false);
    setShowSubstituteModal(false);
    setShowSpecialModal(false);
    setSelectedClassForAction(null);
  }, [pathname]);

  // Handle Escape key & body scroll lock
  useEffect(() => {
    const isAnyModalOpen = showAddRecurringModal || showCancelModal || showSubstituteModal || showSpecialModal;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddRecurringModal(false);
        setShowCancelModal(false);
        setShowSubstituteModal(false);
        setShowSpecialModal(false);
        setSelectedClassForAction(null);
      }
    };

    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAddRecurringModal, showCancelModal, showSubstituteModal, showSpecialModal]);

  // Forms
  const [recurringForm, setRecurringForm] = useState({
    classId: '',
    subjectId: '',
    batchId: '',
    staffId: '',
    dayOfWeek: 'MONDAY',
    startTime: '09:00',
    endTime: '10:30',
    room: '',
  });

  const [cancelReason, setCancelReason] = useState<string>('');
  const [substituteTeacherId, setSubstituteTeacherId] = useState<string>('');
  const [substituteNotes, setSubstituteNotes] = useState<string>('');

  const [specialForm, setSpecialForm] = useState({
    classId: '',
    subjectId: '',
    batchId: '',
    staffId: '',
    startTime: '14:00',
    endTime: '15:30',
    room: '',
    notes: 'Extra Class / Doubt Session',
  });

  // Settings Form
  const [configForm, setConfigForm] = useState({
    academyName: 'RC Academy',
    timezone: 'Asia/Kolkata',
    headerTemplate: "*{academy_name} – Tomorrow's Class Schedule*\n📅 {date}",
    footerTemplate: '🔔 *Reminder:* Please arrive 10 minutes before class with textbooks and completed homework. Have a great learning session!',
    groupByBatch: false,
  });

  // ----------------------------------------------------------------
  // Fetch Reference Data (Courses, Teachers)
  // ----------------------------------------------------------------
  const fetchReferenceData = async () => {
    try {
      const [coursesRes, staffRes] = await Promise.all([
        ApiClient.fetch<any[]>('/courses'),
        ApiClient.fetch<any[]>('/staff'),
      ]);
      setCourses(coursesRes || []);
      setTeachers(staffRes || []);
    } catch (err: any) {
      console.error('Failed to load courses or staff reference data', err);
    }
  };

  // ----------------------------------------------------------------
  // Fetch Daily Schedule
  // ----------------------------------------------------------------
  const fetchDailySchedule = useCallback(async (dateParam?: string, batchGrouping?: boolean) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const queryParams = new URLSearchParams();
      if (dateParam) queryParams.append('date', dateParam);
      if (batchGrouping !== undefined) queryParams.append('groupByBatch', String(batchGrouping));

      const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const data = await ApiClient.fetch<DailyScheduleResponse>(`/schedule/daily${queryStr}`);
      setDailyData(data);
      setSelectedDate(data.date);
      setGroupByBatch(data.config.groupByBatch);

      setSelectedClassId((prevClassId) => {
        const validId = prevClassId !== 'ALL' && data.classes.some((c) => c.id === prevClassId)
          ? prevClassId
          : 'ALL';

        setEndingMessage((prevFooter) => {
          const footerToUse = prevFooter || '🔔 *Reminder:* Please arrive 10 minutes before class with textbooks and completed homework. Have a great learning session!';
          setCustomNotices((prevNotices) => {
            const initialMsg = buildWhatsAppMessage({
              data,
              targetClassId: validId,
              customFooter: footerToUse,
              noticesList: prevNotices,
              batchGrouping: data.config.groupByBatch,
            });
            setEditedMessage(initialMsg);
            return prevNotices;
          });
          return footerToUse;
        });

        return validId;
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resolve daily schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------------------------------------------
  // Fetch Master Recurring Timetable
  // ----------------------------------------------------------------
  const fetchMasterSchedule = useCallback(async (day: string) => {
    try {
      setMasterLoading(true);
      const data = await ApiClient.fetch<MasterScheduleEntry[]>(`/schedule?dayOfWeek=${day}`);
      setMasterSchedules(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch weekly timetable');
    } finally {
      setMasterLoading(false);
    }
  }, []);

  // ----------------------------------------------------------------
  // Fetch Exceptions
  // ----------------------------------------------------------------
  const fetchExceptions = useCallback(async (dateParam?: string) => {
    try {
      setExceptionsLoading(true);
      const url = dateParam ? `/schedule/exceptions?date=${dateParam}` : '/schedule/exceptions';
      const data = await ApiClient.fetch<DailyExceptionEntry[]>(url);
      setExceptions(data || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch schedule exceptions');
    } finally {
      setExceptionsLoading(false);
    }
  }, []);

  // ----------------------------------------------------------------
  // Fetch Config
  // ----------------------------------------------------------------
  const fetchConfig = async () => {
    try {
      const data = await ApiClient.fetch<any>('/schedule/config');
      if (data) {
        setConfigForm({
          academyName: data.academyName || 'RC Academy',
          timezone: data.timezone || 'Asia/Kolkata',
          headerTemplate: data.headerTemplate || "*{academy_name} – Tomorrow's Class Schedule*\n📅 {date}",
          footerTemplate: data.footerTemplate || '🔔 *Reminder:* Please arrive 10 minutes before class with textbooks and completed homework. Have a great learning session!',
          groupByBatch: data.groupByBatch || false,
        });
      }
    } catch (err: any) {
      console.error('Failed to load schedule config', err);
    }
  };

  useEffect(() => {
    fetchReferenceData();
    fetchDailySchedule();
    fetchConfig();
  }, [fetchDailySchedule]);

  useEffect(() => {
    if (activeTab === 'master') {
      fetchMasterSchedule(selectedDayOfWeek);
    } else if (activeTab === 'exceptions') {
      fetchExceptions(selectedDate);
    }
  }, [activeTab, selectedDayOfWeek, selectedDate, fetchMasterSchedule, fetchExceptions]);

  // ----------------------------------------------------------------
  // Copy to Clipboard
  // ----------------------------------------------------------------
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(editedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      alert('Unable to copy automatically. Please select text and copy manually.');
    }
  };

  // ----------------------------------------------------------------
  // Date Helpers
  // ----------------------------------------------------------------
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    fetchDailySchedule(newDate, groupByBatch);
  };

  const handleResetTomorrow = () => {
    fetchDailySchedule(undefined, groupByBatch);
  };

  const handleToggleGroupByBatch = (checked: boolean) => {
    setGroupByBatch(checked);
    if (dailyData) {
      const newMsg = buildWhatsAppMessage({
        data: dailyData,
        targetClassId: selectedClassId,
        customFooter: endingMessage,
        noticesList: customNotices,
        batchGrouping: checked,
        headerTemplate: configForm.headerTemplate,
      });
      setEditedMessage(newMsg);
    }
  };

  const handleSelectClassForWhatsApp = (classId: string | 'ALL') => {
    setSelectedClassId(classId);
    if (dailyData) {
      const newMsg = buildWhatsAppMessage({
        data: dailyData,
        targetClassId: classId,
        customFooter: endingMessage,
        noticesList: customNotices,
        batchGrouping: groupByBatch,
        headerTemplate: configForm.headerTemplate,
      });
      setEditedMessage(newMsg);
    }
  };

  const handleUpdateEndingMessage = (newEnding: string) => {
    setEndingMessage(newEnding);
    if (dailyData) {
      const newMsg = buildWhatsAppMessage({
        data: dailyData,
        targetClassId: selectedClassId,
        customFooter: newEnding,
        noticesList: customNotices,
        batchGrouping: groupByBatch,
        headerTemplate: configForm.headerTemplate,
      });
      setEditedMessage(newMsg);
    }
  };

  const handleAddCustomNotice = () => {
    const text = customNoticeInput.trim();
    if (!text) return;
    const updated = [...customNotices, text];
    setCustomNotices(updated);
    setCustomNoticeInput('');
    if (dailyData) {
      const newMsg = buildWhatsAppMessage({
        data: dailyData,
        targetClassId: selectedClassId,
        customFooter: endingMessage,
        noticesList: updated,
        batchGrouping: groupByBatch,
        headerTemplate: configForm.headerTemplate,
      });
      setEditedMessage(newMsg);
    }
  };

  const handleAddNoticePreset = (presetText: string) => {
    const updated = [...customNotices, presetText];
    setCustomNotices(updated);
    if (dailyData) {
      const newMsg = buildWhatsAppMessage({
        data: dailyData,
        targetClassId: selectedClassId,
        customFooter: endingMessage,
        noticesList: updated,
        batchGrouping: groupByBatch,
        headerTemplate: configForm.headerTemplate,
      });
      setEditedMessage(newMsg);
    }
  };

  const handleRemoveNotice = (indexToRemove: number) => {
    const updated = customNotices.filter((_, idx) => idx !== indexToRemove);
    setCustomNotices(updated);
    if (dailyData) {
      const newMsg = buildWhatsAppMessage({
        data: dailyData,
        targetClassId: selectedClassId,
        customFooter: endingMessage,
        noticesList: updated,
        batchGrouping: groupByBatch,
        headerTemplate: configForm.headerTemplate,
      });
      setEditedMessage(newMsg);
    }
  };

  const handleClearAllNotices = () => {
    setCustomNotices([]);
    if (dailyData) {
      const newMsg = buildWhatsAppMessage({
        data: dailyData,
        targetClassId: selectedClassId,
        customFooter: endingMessage,
        noticesList: [],
        batchGrouping: groupByBatch,
        headerTemplate: configForm.headerTemplate,
      });
      setEditedMessage(newMsg);
    }
  };

  const handleResetToGenerated = () => {
    if (dailyData) {
      const newMsg = buildWhatsAppMessage({
        data: dailyData,
        targetClassId: selectedClassId,
        customFooter: endingMessage,
        noticesList: customNotices,
        batchGrouping: groupByBatch,
        headerTemplate: configForm.headerTemplate,
      });
      setEditedMessage(newMsg);
    }
  };

  // ----------------------------------------------------------------
  // Quick Daily Exceptions Handlers
  // ----------------------------------------------------------------
  const handleConfirmCancelClass = async () => {
    if (!selectedClassForAction) return;
    try {
      setErrorMsg(null);
      await ApiClient.fetch('/schedule/exceptions', {
        method: 'POST',
        body: JSON.stringify({
          scheduleId: selectedClassForAction.id.startsWith('exc-') ? undefined : selectedClassForAction.id,
          classId: selectedClassForAction.classId,
          subjectId: selectedClassForAction.subjectId,
          batchId: selectedClassForAction.batchId || undefined,
          staffId: selectedClassForAction.staffId,
          date: selectedDate,
          startTime: selectedClassForAction.startTime,
          endTime: selectedClassForAction.endTime,
          room: selectedClassForAction.room || undefined,
          status: 'CANCELLED',
          cancellationReason: cancelReason || 'Class cancelled by administrator',
          notes: 'Cancelled for this date only',
        }),
      });
      setSuccessMsg(`Class cancelled for ${selectedDate}. Master weekly timetable is preserved.`);
      setShowCancelModal(false);
      setSelectedClassForAction(null);
      setCancelReason('');
      await fetchDailySchedule(selectedDate, groupByBatch);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel class');
    }
  };

  const handleConfirmSubstituteTeacher = async () => {
    if (!selectedClassForAction || !substituteTeacherId) return;
    try {
      setErrorMsg(null);
      await ApiClient.fetch('/schedule/exceptions', {
        method: 'POST',
        body: JSON.stringify({
          scheduleId: selectedClassForAction.id.startsWith('exc-') ? undefined : selectedClassForAction.id,
          classId: selectedClassForAction.classId,
          subjectId: selectedClassForAction.subjectId,
          batchId: selectedClassForAction.batchId || undefined,
          staffId: substituteTeacherId,
          date: selectedDate,
          startTime: selectedClassForAction.startTime,
          endTime: selectedClassForAction.endTime,
          room: selectedClassForAction.room || undefined,
          status: 'SUBSTITUTED',
          notes: substituteNotes || 'Teacher substitution for this date',
        }),
      });
      setSuccessMsg(`Teacher substitution saved for ${selectedDate}.`);
      setShowSubstituteModal(false);
      setSelectedClassForAction(null);
      setSubstituteTeacherId('');
      setSubstituteNotes('');
      await fetchDailySchedule(selectedDate, groupByBatch);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign teacher substitution');
    }
  };

  const handleCreateSpecialClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialForm.classId || !specialForm.subjectId || !specialForm.staffId) {
      setErrorMsg('Please select course, subject, and teacher for special class');
      return;
    }

    try {
      setErrorMsg(null);
      await ApiClient.fetch('/schedule/exceptions', {
        method: 'POST',
        body: JSON.stringify({
          classId: specialForm.classId,
          subjectId: specialForm.subjectId,
          batchId: specialForm.batchId || undefined,
          staffId: specialForm.staffId,
          date: selectedDate,
          startTime: specialForm.startTime,
          endTime: specialForm.endTime,
          room: specialForm.room || undefined,
          status: 'SPECIAL_CLASS',
          notes: specialForm.notes,
        }),
      });
      setSuccessMsg(`Special extra class added for ${selectedDate}!`);
      setShowSpecialModal(false);
      setSpecialForm({
        classId: '',
        subjectId: '',
        batchId: '',
        staffId: '',
        startTime: '14:00',
        endTime: '15:30',
        room: '',
        notes: 'Extra Class / Doubt Session',
      });
      await fetchDailySchedule(selectedDate, groupByBatch);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create special class');
    }
  };

  const handleDeleteException = async (exceptionId: string) => {
    if (!confirm('Are you sure you want to revert this exception and restore regular schedule?')) return;
    try {
      setErrorMsg(null);
      await ApiClient.fetch(`/schedule/exceptions/${exceptionId}`, { method: 'DELETE' });
      setSuccessMsg('Exception removed and schedule restored.');
      await fetchDailySchedule(selectedDate, groupByBatch);
      if (activeTab === 'exceptions') {
        await fetchExceptions(selectedDate);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete exception');
    }
  };

  // ----------------------------------------------------------------
  // Master Recurring Schedule Handlers
  // ----------------------------------------------------------------
  const handleCreateRecurringSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurringForm.classId || !recurringForm.subjectId || !recurringForm.staffId) {
      setErrorMsg('Course, Subject, and Teacher are required');
      return;
    }

    try {
      setErrorMsg(null);
      await ApiClient.fetch('/schedule', {
        method: 'POST',
        body: JSON.stringify({
          classId: recurringForm.classId,
          subjectId: recurringForm.subjectId,
          batchId: recurringForm.batchId || undefined,
          staffId: recurringForm.staffId,
          dayOfWeek: recurringForm.dayOfWeek,
          startTime: recurringForm.startTime,
          endTime: recurringForm.endTime,
          room: recurringForm.room || undefined,
          isActive: true,
        }),
      });
      setSuccessMsg(`Timetable slot created for ${recurringForm.dayOfWeek}!`);
      setShowAddRecurringModal(false);
      setRecurringForm({
        classId: '',
        subjectId: '',
        batchId: '',
        staffId: '',
        dayOfWeek: selectedDayOfWeek,
        startTime: '09:00',
        endTime: '10:30',
        room: '',
      });
      await fetchMasterSchedule(selectedDayOfWeek);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create schedule slot (Check for resource conflict)');
    }
  };

  const handleDeleteRecurringSlot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this weekly recurring timetable entry?')) return;
    try {
      setErrorMsg(null);
      await ApiClient.fetch(`/schedule/${id}`, { method: 'DELETE' });
      setSuccessMsg('Timetable slot deleted.');
      await fetchMasterSchedule(selectedDayOfWeek);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete slot');
    }
  };

  // ----------------------------------------------------------------
  // Save Settings
  // ----------------------------------------------------------------
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setErrorMsg(null);
      await ApiClient.fetch('/schedule/config', {
        method: 'PUT',
        body: JSON.stringify(configForm),
      });
      setSuccessMsg('WhatsApp template & schedule configuration updated successfully!');
      await fetchDailySchedule(selectedDate, configForm.groupByBatch);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update schedule settings');
    }
  };

  const selectedCourseSubjects = courses.find((c) => c.id === recurringForm.classId)?.subjects || [];
  const selectedCourseBatches = courses.find((c) => c.id === recurringForm.classId)?.batches || [];

  const specialCourseSubjects = courses.find((c) => c.id === specialForm.classId)?.subjects || [];
  const specialCourseBatches = courses.find((c) => c.id === specialForm.classId)?.batches || [];

  return (
    <>
      <Header
        title="Class Schedule & WhatsApp Generator"
        subtitle="Manage daily timetable adjustments, conflict detection, and generate one-click WhatsApp messages"
      >
        <button
          onClick={() => fetchDailySchedule(selectedDate, groupByBatch)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
          title="Refresh latest data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </Header>

      <ResponsivePageContainer>

      {/* ---------------------------------------------------- */}
      {/* Alerts */}
      {/* ---------------------------------------------------- */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-red-800 font-medium">
            <p>{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-emerald-800 font-medium">
            <p>{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* Main Tabs Navigation */}
      {/* ---------------------------------------------------- */}
      <div className="border-b border-neutral-200 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-6 min-w-max sm:min-w-0 pb-px">
          <button
            onClick={() => setActiveTab('daily')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'daily'
                ? 'border-[#FF8500] text-[#FF8500]'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <Send className="w-4 h-4" />
            Tomorrow&apos;s WhatsApp Schedule
            {dailyData && (
              <span className="text-[11px] font-bold px-1.5 py-0.2 bg-neutral-100 text-neutral-700 rounded-full">
                {dailyData.classesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('master')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'master'
                ? 'border-[#FF8500] text-[#FF8500]'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <Clock className="w-4 h-4" />
            Weekly Master Timetable
          </button>

          <button
            onClick={() => setActiveTab('exceptions')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'exceptions'
                ? 'border-[#FF8500] text-[#FF8500]'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Daily Exceptions Log
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-[#FF8500] text-[#FF8500]'
                : 'border-transparent text-neutral-500 hover:text-black'
            }`}
          >
            <Settings className="w-4 h-4" />
            Message Customization
          </button>
        </nav>
      </div>

      {/* ==================================================== */}
      {/* TAB 1: DAILY SCHEDULE & WHATSAPP PREVIEW */}
      {/* ==================================================== */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Top Date Bar */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Target Date:
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="px-3 py-1.5 text-sm font-semibold text-black bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                />
              </div>

              <button
                onClick={handleResetTomorrow}
                className="px-2.5 py-1 text-xs font-semibold bg-[#FF8500]/10 text-[#FF8500] hover:bg-[#FF8500]/20 rounded-lg transition-colors"
              >
                Reset to Tomorrow
              </button>

              {dailyData && (
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  <span>Day: <strong>{dailyData.dayOfWeek}</strong></span>
                  <span>•</span>
                  <span>Timezone: <strong>{dailyData.config.timezone}</strong></span>
                </div>
              )}
            </div>

            {/* Quick Special Class Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSpecialModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-black text-white hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Special Class
              </button>
            </div>
          </div>

          {/* Conflict Alert Warning Banner */}
          {dailyData && dailyData.conflictsCount > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Warning: {dailyData.conflictsCount} Schedule Conflict(s) Detected!
                  </h4>
                  <p className="text-xs text-amber-800 mt-1">
                    Overlapping classes exist for the same teacher, batch, or classroom on this day. Please review
                    the conflicts below before sharing the message.
                  </p>
                  <ul className="mt-2 text-xs text-amber-900 space-y-1 list-disc list-inside">
                    {dailyData.conflicts.map((c, idx) => {
                      const conflictType =
                        c.type === 'TEACHER_OVERLAP'
                          ? 'Teacher Overlap'
                          : c.type === 'BATCH_OVERLAP'
                          ? 'Batch Overlap'
                          : c.type === 'ROOM_OVERLAP'
                          ? 'Room Overlap'
                          : c.type || 'Schedule Conflict';

                      return (
                        <li key={idx} className="leading-relaxed">
                          <strong>{conflictType}:</strong>{' '}
                          {c.message ? (
                            <span>{c.message}</span>
                          ) : (
                            <span>
                              {c.classA?.className || 'Class A'} ({formatTime12h(c.classA?.startTime)} – {formatTime12h(c.classA?.endTime)}) overlaps with{' '}
                              {c.classB?.className || 'Class B'} ({formatTime12h(c.classB?.startTime)} – {formatTime12h(c.classB?.endTime)})
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Two-Column Work Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
            {/* Left Column (7 cols): Structured Schedule Cards */}
            <div className="lg:col-span-7 space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-black">
                    Scheduled Classes ({dailyData?.classesCount || 0})
                  </h3>
                  {dailyData?.cancelledCount ? (
                    <span className="text-xs font-semibold px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                      {dailyData.cancelledCount} Cancelled
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-neutral-400">Sorted chronologically by start time</span>
              </div>

              {/* Class Selection Filter Pills */}
              {dailyData && dailyData.classes.length > 0 && (
                <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-2.5 flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-semibold text-neutral-500 flex items-center gap-1 shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-[#FF8500]" />
                    WhatsApp Scope:
                  </span>

                  <button
                    type="button"
                    onClick={() => handleSelectClassForWhatsApp('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                      selectedClassId === 'ALL'
                        ? 'bg-black text-white font-semibold shadow-xs'
                        : 'bg-white border border-neutral-200 text-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <span>All Classes ({dailyData.classes.length})</span>
                  </button>

                  {dailyData.classes.map((c) => {
                    const isSelected = selectedClassId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectClassForWhatsApp(c.id)}
                        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 max-w-[220px] truncate ${
                          isSelected
                            ? 'bg-[#FF8500] text-white font-semibold shadow-xs'
                            : 'bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:text-black'
                        }`}
                        title={`${c.className} – ${c.subjectName} (${formatTime12h(c.startTime)} – ${formatTime12h(c.endTime)})`}
                      >
                        <span className="truncate">{c.className} ({c.subjectName})</span>
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    );
                  })}

                  {selectedClassId !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => handleSelectClassForWhatsApp('ALL')}
                      className="ml-auto text-[11px] text-neutral-500 hover:text-black font-semibold flex items-center gap-0.5 underline"
                    >
                      Reset to All
                    </button>
                  )}
                </div>
              )}

              {loading ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center text-neutral-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF8500]" />
                  <p className="text-sm font-medium">Resolving tomorrow&apos;s schedule...</p>
                </div>
              ) : dailyData?.classes.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center">
                  <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                  <h4 className="font-semibold text-black text-sm">No classes scheduled for this date</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    No recurring master schedule entries match this day of the week, or all classes have been cancelled.
                  </p>
                  <button
                    onClick={() => setShowSpecialModal(true)}
                    className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#FF8500] text-white rounded-lg hover:bg-[#E67700]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add a Special Class for Today
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {dailyData?.classes.map((item) => {
                    const isSelected = selectedClassId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`bg-white border rounded-xl p-4 transition-all shadow-xs hover:border-[#FF8500]/50 ${
                          isSelected
                            ? 'border-[#FF8500] ring-2 ring-[#FF8500]/25 bg-orange-50/15'
                            : item.isSpecialClass
                            ? 'border-indigo-200 bg-indigo-50/20'
                            : item.exceptionStatus === 'SUBSTITUTED'
                            ? 'border-amber-200 bg-amber-50/20'
                            : 'border-neutral-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Time & Class info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 bg-black text-white rounded-md">
                                <Clock className="w-3 h-3 text-[#FF8500]" />
                                {formatTime12h(item.startTime, DEFAULT_CLASS_START_TIME)} – {formatTime12h(item.endTime, DEFAULT_CLASS_END_TIME)}
                              </span>

                              {item.isSpecialClass && (
                                <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> Special Class
                                </span>
                              )}

                              {item.exceptionStatus === 'SUBSTITUTED' && (
                                <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md flex items-center gap-1">
                                  <UserCheck className="w-3 h-3" /> Teacher Substitution
                                </span>
                              )}

                              {item.batchName && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded-md">
                                  Batch: {item.batchName}
                                </span>
                              )}

                              {isSelected && (
                                <span className="text-[11px] font-bold px-2 py-0.5 bg-[#FF8500] text-white rounded-md flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Selected in WhatsApp
                                </span>
                              )}
                            </div>

                            <div className="mt-2.5">
                              <h4 className="font-bold text-sm text-black">
                                {item.className} — <span className="text-[#FF8500]">{item.subjectName}</span>
                              </h4>
                            </div>

                            <div className="mt-2 flex items-center gap-4 text-xs text-neutral-600 flex-wrap">
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-neutral-400" />
                                Teacher: <strong>{item.teacherName}</strong>
                              </span>

                              {item.room && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                                  Room: <strong>{item.room}</strong>
                                </span>
                              )}
                            </div>

                            {item.notes && (
                              <p className="mt-1.5 text-xs text-neutral-500 italic">
                                Note: {item.notes}
                              </p>
                            )}
                          </div>

                          {/* Actions for this class */}
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSelectClassForWhatsApp(isSelected ? 'ALL' : item.id)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${
                                isSelected
                                  ? 'bg-[#FF8500] text-white shadow-xs'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80'
                              }`}
                              title={
                                isSelected
                                  ? 'Click to switch back to All Classes in WhatsApp'
                                  : 'Generate WhatsApp message for this class only'
                              }
                            >
                              <MessageSquare className="w-3 h-3" />
                              {isSelected ? 'Active in WhatsApp' : 'Only This Class'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedClassForAction(item);
                                setShowSubstituteModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
                              title="Substitute teacher for this date only"
                            >
                              Substitute
                            </button>
                            <button
                              onClick={() => {
                                setSelectedClassForAction(item);
                                setShowCancelModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                              title="Cancel class for this date only"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cancelled Classes on this date */}
              {dailyData?.cancelledClasses && dailyData.cancelledClasses.length > 0 && (
                <div className="mt-6 border border-red-200 bg-red-50/50 rounded-xl p-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-red-800 flex items-center gap-1.5 mb-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    Classes Cancelled for {selectedDate}
                  </h4>
                  <div className="space-y-2">
                    {dailyData.cancelledClasses.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white border border-red-200 rounded-lg p-2.5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-black line-through">
                            {formatTime12h(c.startTime)} – {formatTime12h(c.endTime)}: {c.className} ({c.subjectName})
                          </span>
                          <span className="text-neutral-500 ml-2">Teacher: {c.teacherName}</span>
                          <p className="text-red-700 text-[11px] mt-0.5">Reason: {c.reason}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                          Excluded from WhatsApp
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column (5 cols): WhatsApp Message Preview & One-Click Copy */}
            <div className="lg:col-span-5 space-y-4 min-w-0">
              <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-subtle space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shrink-0">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-black">WhatsApp Message Preview</h3>
                        {selectedClassId !== 'ALL' ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 bg-orange-100 text-[#B35300] rounded-full border border-orange-200">
                            Single Class Only
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full">
                            All Classes ({dailyData?.classes.length || 0})
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        {selectedClassId !== 'ALL'
                          ? `Target: ${dailyData?.classes.find((c) => c.id === selectedClassId)?.className} (${dailyData?.classes.find((c) => c.id === selectedClassId)?.subjectName})`
                          : 'Ready-to-copy formatted plain text'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {selectedClassId !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => handleSelectClassForWhatsApp('ALL')}
                        className="text-xs text-[#FF8500] hover:underline font-semibold"
                      >
                        Switch to All Classes
                      </button>
                    )}

                    {selectedClassId === 'ALL' && (
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-neutral-600">
                        <input
                          type="checkbox"
                          checked={groupByBatch}
                          onChange={(e) => handleToggleGroupByBatch(e.target.checked)}
                          className="rounded text-[#FF8500] focus:ring-[#FF8500]"
                        />
                        Group by Batch
                      </label>
                    )}
                  </div>
                </div>

                {/* Editable WhatsApp Text Box */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-600">
                      Message Body (Live Preview & Editable)
                    </label>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {editedMessage.length} characters
                    </span>
                  </div>
                  <textarea
                    rows={9}
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    className="w-full p-3 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] text-neutral-900 leading-relaxed resize-y min-w-0"
                    placeholder="Generating message..."
                  />
                </div>

                {/* Add Extra Notice to Message */}
                <div className="bg-neutral-50/70 border border-neutral-200/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-[#FF8500]" />
                      Add Extra Notice to Message
                    </span>
                    {customNotices.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllNotices}
                        className="text-[11px] text-red-600 hover:underline font-medium"
                      >
                        Clear Notices ({customNotices.length})
                      </button>
                    )}
                  </div>

                  {/* Input row */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customNoticeInput}
                      onChange={(e) => setCustomNoticeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomNotice();
                        }
                      }}
                      placeholder="Type custom note e.g. Bring lab coat / Homework due..."
                      className="flex-1 text-xs px-3 py-1.5 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomNotice}
                      disabled={!customNoticeInput.trim()}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#FF8500] hover:bg-[#E67700] disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap shadow-xs"
                    >
                      + Add
                    </button>
                  </div>

                  {/* Quick Notice Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-semibold text-neutral-400">Quick Add:</span>
                    <button
                      type="button"
                      onClick={() => handleAddNoticePreset('📝 *Homework:* Assignment submission is due tomorrow.')}
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition-colors"
                    >
                      + Homework
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNoticePreset('⚠️ *Dress Code:* Formal academy uniform and ID card are mandatory.')}
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition-colors"
                    >
                      + Uniform
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNoticePreset('📊 *Unit Test:* A revision test will be conducted during the session.')}
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition-colors"
                    >
                      + Unit Test
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNoticePreset('👥 *Parent Meeting:* Brief 10-minute interaction after class.')}
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition-colors"
                    >
                      + Parent Meeting
                    </button>
                  </div>

                  {/* Active Notice Chips */}
                  {customNotices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {customNotices.map((n, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 text-[11px] bg-white border border-neutral-200 text-neutral-800 px-2 py-0.5 rounded-md shadow-xs"
                        >
                          <span className="max-w-[200px] truncate">{n}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveNotice(idx)}
                            className="text-neutral-400 hover:text-red-600 font-bold ml-0.5"
                            title="Remove notice"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ending Message / Sign-off */}
                <div className="bg-neutral-50/70 border border-neutral-200/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#FF8500]" />
                      Ending Message / Sign-off
                    </span>
                    {endingMessage && (
                      <button
                        type="button"
                        onClick={() => handleUpdateEndingMessage('')}
                        className="text-[11px] text-neutral-500 hover:text-red-600 font-medium"
                      >
                        Clear Footer
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    value={endingMessage}
                    onChange={(e) => handleUpdateEndingMessage(e.target.value)}
                    placeholder="Enter ending note or reminder..."
                    className="w-full p-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] text-neutral-800 resize-none"
                  />

                  {/* Quick Footer Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-semibold text-neutral-400">Presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateEndingMessage(
                          '🔔 *Reminder:* Please arrive 10 minutes before class with textbooks and completed homework. Have a great learning session!'
                        )
                      }
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition-colors"
                    >
                      🔔 Standard
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateEndingMessage(
                          '📝 *Exam Reminder:* Bring stationery and admit card. Electronic devices prohibited.'
                        )
                      }
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition-colors"
                    >
                      📝 Exam Prep
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateEndingMessage(
                          '💳 *Fee Notice:* Tuition dues for this month are kindly requested by Friday. Thank you!'
                        )
                      }
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition-colors"
                    >
                      💳 Fee Due
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateEndingMessage('🙏 *Regards,*\n*Management - RC Academy*')
                      }
                      className="px-2 py-0.5 text-[11px] bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition-colors"
                    >
                      🙏 Management
                    </button>
                  </div>
                </div>

                {/* Reset & Summary row */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[11px] text-neutral-400">
                    Direct edits to message box are preserved until reset.
                  </span>
                  <button
                    type="button"
                    onClick={handleResetToGenerated}
                    className="text-[11px] text-[#FF8500] hover:underline font-semibold"
                  >
                    Reset to Generated Text
                  </button>
                </div>

                {/* Primary Action Buttons: Copy Message & Open WhatsApp */}
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      copied
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-[#FF8500] hover:bg-[#E67700] text-white shadow-subtle'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5" />
                        Message Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copy WhatsApp Message
                      </>
                    )}
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(editedMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs border border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open WhatsApp Web (Manual Send)
                  </a>
                </div>

                {/* Workflow Instructions Note */}
                <div className="bg-neutral-50 rounded-lg p-3 text-[11px] text-neutral-500 space-y-1">
                  <p className="font-semibold text-black flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-[#FF8500]" />
                    Manual Sending Workflow:
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 pl-1">
                    <li>Preview and make any daily adjustments above.</li>
                    <li>Click <strong>Copy WhatsApp Message</strong>.</li>
                    <li>Open your academy WhatsApp group and paste the message.</li>
                    <li>Review and hit send manually.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 2: WEEKLY MASTER RECURRING TIMETABLE */}
      {/* ==================================================== */}
      {activeTab === 'master' && (
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-black">Weekly Master Timetable</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Configure regular schedules once. Tomorrow&apos;s schedule is automatically generated from these entries.
              </p>
            </div>

            <button
              onClick={() => {
                setRecurringForm((prev) => ({ ...prev, dayOfWeek: selectedDayOfWeek }));
                setShowAddRecurringModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-bold rounded-lg transition-colors shadow-subtle"
            >
              <Plus className="w-4 h-4" />
              Add Timetable Slot
            </button>
          </div>

          {/* Days of Week Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDayOfWeek(day)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  selectedDayOfWeek === day
                    ? 'bg-black text-white'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:border-black'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Master Schedules for Selected Day */}
          <div className="bg-white border border-neutral-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-neutral-100 pb-3">
              <h4 className="font-bold text-sm text-black flex items-center gap-2">
                <span>{selectedDayOfWeek} Regular Schedule</span>
                <span className="text-xs font-normal text-neutral-400">
                  ({masterSchedules.length} slots configured)
                </span>
              </h4>
            </div>

            {masterLoading ? (
              <div className="p-8 text-center text-neutral-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                <p className="text-xs">Loading timetable slots...</p>
              </div>
            ) : masterSchedules.length === 0 ? (
              <div className="p-12 text-center text-neutral-400">
                <Clock className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                <p className="text-sm font-semibold text-black">No regular classes on {selectedDayOfWeek}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Click &apos;Add Timetable Slot&apos; to configure recurring classes for this day.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {masterSchedules.map((slot) => (
                  <div key={slot.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="font-bold text-xs bg-neutral-100 px-3 py-1.5 rounded-md text-black flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#FF8500]" />
                        {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-black">{slot.class.name}</span>
                          <span className="text-xs text-[#FF8500] font-semibold">• {slot.subject.name}</span>
                          {slot.batch && (
                            <span className="text-[11px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                              Batch: {slot.batch.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-xs text-neutral-500">
                          <span>
                            Teacher: <strong>{slot.staff.firstName} {slot.staff.lastName}</strong>
                          </span>
                          {slot.room && (
                            <span>
                              Room: <strong>{slot.room}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteRecurringSlot(slot.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: DAILY EXCEPTIONS LOG */}
      {/* ==================================================== */}
      {activeTab === 'exceptions' && (
        <div className="space-y-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-black">Daily Schedule Exceptions</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Cancellations, substitutions, and special classes applied for specific dates. The weekly recurring
                master timetable remains untouched.
              </p>
            </div>

            <button
              onClick={() => setShowSpecialModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Special Class
            </button>
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-subtle">
            <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-600">
                Exceptions for date: <strong>{selectedDate || 'All dates'}</strong>
              </span>
              <button
                onClick={() => fetchExceptions(selectedDate)}
                className="text-xs text-[#FF8500] font-semibold hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Log
              </button>
            </div>

            {exceptionsLoading ? (
              <div className="p-8 text-center text-neutral-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                <p className="text-xs">Loading exceptions...</p>
              </div>
            ) : exceptions.length === 0 ? (
              <div className="p-12 text-center text-neutral-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm font-semibold text-black">No exceptions recorded for this date</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Regular master schedule applies 100% without cancellations or teacher substitutions.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {exceptions.map((ex) => (
                  <div key={ex.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase ${
                            ex.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-700'
                              : ex.status === 'SUBSTITUTED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {ex.status}
                        </span>

                        <span className="text-xs font-bold text-black">
                          {formatTime12h(ex.startTime)} – {formatTime12h(ex.endTime)}
                        </span>

                        <span className="text-xs text-neutral-600 font-semibold">
                          {ex.class.name} ({ex.subject.name})
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-neutral-500 flex items-center gap-4">
                        <span>Teacher: <strong>{ex.staff.firstName} {ex.staff.lastName}</strong></span>
                        {ex.room && <span>Room: <strong>{ex.room}</strong></span>}
                        {ex.cancellationReason && (
                          <span className="text-red-600">Reason: {ex.cancellationReason}</span>
                        )}
                        {ex.notes && <span className="italic">Note: {ex.notes}</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteException(ex.id)}
                      className="px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:text-black bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
                      title="Revert exception and restore regular schedule"
                    >
                      Revert Exception
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: WHATSAPP TEMPLATE & MESSAGE SETTINGS */}
      {/* ==================================================== */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-subtle max-w-3xl space-y-6">
          <div>
            <h3 className="font-bold text-base text-black">WhatsApp Template & Academy Settings</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Customize academy branding, timezone, opening title, and reminder footers in the generated WhatsApp message.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Academy Display Name
                </label>
                <input
                  type="text"
                  value={configForm.academyName}
                  onChange={(e) => setConfigForm({ ...configForm, academyName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Timezone
                </label>
                <input
                  type="text"
                  value={configForm.timezone}
                  onChange={(e) => setConfigForm({ ...configForm, timezone: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  required
                />
                <p className="text-[10px] text-neutral-400 mt-1">Default: Asia/Kolkata (IST)</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Header Template
              </label>
              <textarea
                rows={2}
                value={configForm.headerTemplate}
                onChange={(e) => setConfigForm({ ...configForm, headerTemplate: e.target.value })}
                className="w-full p-2.5 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
              />
              <p className="text-[10px] text-neutral-400 mt-1">
                Tokens: <code className="text-[#FF8500]">&#123;academy_name&#125;</code>,{' '}
                <code className="text-[#FF8500]">&#123;date&#125;</code>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Footer / Reminder Template
              </label>
              <textarea
                rows={3}
                value={configForm.footerTemplate}
                onChange={(e) => setConfigForm({ ...configForm, footerTemplate: e.target.value })}
                className="w-full p-2.5 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-bold rounded-lg transition-colors shadow-subtle"
              >
                Save Template Configuration
              </button>
            </div>
          </form>
        </div>
      )}
      </ResponsivePageContainer>

      {/* ==================================================== */}
      {/* MODAL: ADD RECURRING TIMETABLE ENTRY */}
      {/* ==================================================== */}
      {showAddRecurringModal && (
        <div className="fixed inset-0 z-backdrop flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="relative z-modal bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-neutral-200 max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
            <div className="mx-auto w-10 h-1 bg-neutral-300 rounded-full sm:hidden mb-1" />
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-black">Add Master Timetable Slot</h3>
              <button
                onClick={() => setShowAddRecurringModal(false)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurringSlot} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Course / Standard *</label>
                  <select
                    value={recurringForm.classId}
                    onChange={(e) => setRecurringForm({ ...recurringForm, classId: e.target.value, subjectId: '', batchId: '' })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  >
                    <option value="">Select Course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Subject *</label>
                  <select
                    value={recurringForm.subjectId}
                    onChange={(e) => setRecurringForm({ ...recurringForm, subjectId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                    disabled={!recurringForm.classId}
                  >
                    <option value="">Select Subject</option>
                    {selectedCourseSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Batch (Optional)</label>
                  <select
                    value={recurringForm.batchId}
                    onChange={(e) => setRecurringForm({ ...recurringForm, batchId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    disabled={!recurringForm.classId}
                  >
                    <option value="">All Batches</option>
                    {selectedCourseBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Teacher *</label>
                  <select
                    value={recurringForm.staffId}
                    onChange={(e) => setRecurringForm({ ...recurringForm, staffId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Day of Week *</label>
                  <select
                    value={recurringForm.dayOfWeek}
                    onChange={(e) => setRecurringForm({ ...recurringForm, dayOfWeek: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={recurringForm.startTime}
                    onChange={(e) => setRecurringForm({ ...recurringForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={recurringForm.endTime}
                    onChange={(e) => setRecurringForm({ ...recurringForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Room / Hall (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Hall A, Lab 102"
                  value={recurringForm.room}
                  onChange={(e) => setRecurringForm({ ...recurringForm, room: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAddRecurringModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg shadow-subtle"
                >
                  Save Timetable Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CANCEL CLASS FOR TODAY */}
      {/* ==================================================== */}
      {showCancelModal && selectedClassForAction && (
        <div className="fixed inset-0 z-backdrop flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="relative z-modal bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-neutral-200 max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
            <div className="mx-auto w-10 h-1 bg-neutral-300 rounded-full sm:hidden mb-1" />
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-red-600 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Cancel Class for {selectedDate}
              </h3>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedClassForAction(null);
                }}
                className="text-neutral-400 hover:text-black p-1 rounded-lg hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-neutral-50 rounded-lg p-3 text-xs space-y-1">
              <p>
                <strong>Class:</strong> {selectedClassForAction.className} ({selectedClassForAction.subjectName})
              </p>
              <p>
                <strong>Time:</strong> {formatTime12h(selectedClassForAction.startTime)} – {formatTime12h(selectedClassForAction.endTime)}
              </p>
              <p>
                <strong>Teacher:</strong> {selectedClassForAction.teacherName}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Reason for cancellation *
              </label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Teacher on medical leave, holiday"
                className="w-full p-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                required
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                This class will be excluded from the generated WhatsApp message for {selectedDate}. The weekly
                recurring timetable is NOT modified.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-black"
              >
                Keep Class
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelClass}
                className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: SUBSTITUTE TEACHER FOR TODAY */}
      {/* ==================================================== */}
      {showSubstituteModal && selectedClassForAction && (
        <div className="fixed inset-0 z-backdrop flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="relative z-modal bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-neutral-200 max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
            <div className="mx-auto w-10 h-1 bg-neutral-300 rounded-full sm:hidden mb-1" />
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-black flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#FF8500]" />
                Teacher Substitution for {selectedDate}
              </h3>
              <button
                onClick={() => {
                  setShowSubstituteModal(false);
                  setSelectedClassForAction(null);
                }}
                className="text-neutral-400 hover:text-black p-1 rounded-lg hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-neutral-50 rounded-lg p-3 text-xs space-y-1">
              <p>
                <strong>Class:</strong> {selectedClassForAction.className} ({selectedClassForAction.subjectName})
              </p>
              <p>
                <strong>Time:</strong> {formatTime12h(selectedClassForAction.startTime)} – {formatTime12h(selectedClassForAction.endTime)}
              </p>
              <p>
                <strong>Regular Teacher:</strong> {selectedClassForAction.teacherName}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Select Replacement Teacher *
              </label>
              <select
                value={substituteTeacherId}
                onChange={(e) => setSubstituteTeacherId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                required
              >
                <option value="">Select Teacher</option>
                {teachers
                  .filter((t) => t.id !== selectedClassForAction.staffId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Optional Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Covering for Mr. Patel"
                value={substituteNotes}
                onChange={(e) => setSubstituteNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setShowSubstituteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-black"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubstituteTeacher}
                disabled={!substituteTeacherId}
                className="px-5 py-2 text-xs font-bold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg disabled:opacity-50"
              >
                Confirm Substitution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ADD SPECIAL CLASS FOR TODAY */}
      {/* ==================================================== */}
      {showSpecialModal && (
        <div className="fixed inset-0 z-backdrop flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="relative z-modal bg-white rounded-t-2xl sm:rounded-xl shadow-2xl border border-neutral-200 max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6">
            <div className="mx-auto w-10 h-1 bg-neutral-300 rounded-full sm:hidden mb-1" />
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-base text-black flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Add Special Class for {selectedDate}
              </h3>
              <button
                onClick={() => setShowSpecialModal(false)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSpecialClass} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Course / Standard *</label>
                  <select
                    value={specialForm.classId}
                    onChange={(e) => setSpecialForm({ ...specialForm, classId: e.target.value, subjectId: '', batchId: '' })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  >
                    <option value="">Select Course</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Subject *</label>
                  <select
                    value={specialForm.subjectId}
                    onChange={(e) => setSpecialForm({ ...specialForm, subjectId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                    disabled={!specialForm.classId}
                  >
                    <option value="">Select Subject</option>
                    {specialCourseSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Batch (Optional)</label>
                  <select
                    value={specialForm.batchId}
                    onChange={(e) => setSpecialForm({ ...specialForm, batchId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    disabled={!specialForm.classId}
                  >
                    <option value="">All Batches</option>
                    {specialCourseBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Teacher *</label>
                  <select
                    value={specialForm.staffId}
                    onChange={(e) => setSpecialForm({ ...specialForm, staffId: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={specialForm.startTime}
                    onChange={(e) => setSpecialForm({ ...specialForm, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={specialForm.endTime}
                    onChange={(e) => setSpecialForm({ ...specialForm, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Room / Hall (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Special Hall, Room 3"
                    value={specialForm.room}
                    onChange={(e) => setSpecialForm({ ...specialForm, room: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Special Session Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Doubt Clearing, Extra Class"
                    value={specialForm.notes}
                    onChange={(e) => setSpecialForm({ ...specialForm, notes: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowSpecialModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-black hover:bg-neutral-800 text-white rounded-lg shadow-subtle"
                >
                  Add Special Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
