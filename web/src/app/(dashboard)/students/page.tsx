'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import { ApiClient } from '@/lib/api/api-client';
import { useAuthUser } from '@/lib/auth/use-role';
import { Modal } from '@/components/ui/modal';
import {
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  QrCode,
  Layers,
  RefreshCw,
  FileSpreadsheet,
  Check,
  X,
  FileDown,
  Trash2,
  BookOpen,
  Edit2,
  Calendar,
  MapPin,
  Save,
  User,
  Eye,
  ArrowRight,
  ArrowLeft,
  GraduationCap,
  BarChart3,
  SlidersHorizontal,
  Link2,
  ChevronRight,
  ChevronLeft,
  Zap,
  Sparkles,
  Wallet,
  CreditCard,
  Receipt,
  Clock,
  History,
  ArrowUpRight,
} from 'lucide-react';

interface StudentEnrollment {
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
}

interface Student {
  id: string;
  studentCode: string;
  admissionNumber: string;
  attendanceCode?: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  schoolName?: string | null;
  dob: string;
  gender: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  currentBatch?: {
    id: string;
    name: string;
    code?: string | null;
    class?: { id: string; name: string; code: string };
  };
  enrollments?: StudentEnrollment[];
  guardians: Array<{
    fullName: string;
    phone: string;
    relationship: string;
  }>;
}

interface CourseOption {
  id: string;
  name: string;
  code: string;
  category?: 'ACADEMIC' | 'SKILL';
  batches: { id: string; name: string; code: string | null }[];
  subjects?: { id: string; name: string; code: string }[];
}

interface CourseEnrollmentRow {
  courseId: string;
  batchId: string;
  subjectId?: string;
}

interface GuardianContactRow {
  fullName: string;
  phone: string;
  relationship: string;
  email: string;
}

export default function StudentsPage() {
  const { user: authUser, role } = useAuthUser();
  const isPrivileged = role === 'SUPER_ADMIN' || role === 'ACADEMY_ADMIN';

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Available batches based on selected courseFilter
  const availableBatches = useMemo(() => {
    if (courseFilter) {
      const selectedCourse = courses.find((c) => c.id === courseFilter);
      return selectedCourse ? selectedCourse.batches : [];
    }
    return courses.flatMap((c) =>
      c.batches.map((b) => ({
        ...b,
        name: `${c.code || c.name} - ${b.name}`,
      }))
    );
  }, [courses, courseFilter]);

  // Pagination states (Defaults to 100 per user request)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Analysis panel and subject filtering
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');

  // Manual Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCreatedCodeModal, setShowCreatedCodeModal] = useState<{
    name: string;
    studentCode: string;
    attendanceCode: string;
  } | null>(null);

  // Bulk CSV Modal with Interactive Column Mapping
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStep, setBulkStep] = useState<'UPLOAD' | 'MAP_COLUMNS' | 'PREVIEW' | 'REPORT'>('UPLOAD');
  const [csvContent, setCsvContent] = useState('');
  const [csvRawHeaders, setCsvRawHeaders] = useState<string[]>([]);
  const [csvRawDataRows, setCsvRawDataRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<{
    rawName: string;
    courseCode: string;
    batchCode: string;
    subjects: string;
    dob: string;
    gender: string;
    phone: string;
    email: string;
    fatherName: string;
    fatherPhone: string;
    motherName: string;
    motherPhone: string;
    schoolName: string;
    academicBoard: string;
    address: string;
    dateOfJoining: string;
  }>({
    rawName: '',
    courseCode: '',
    batchCode: '',
    subjects: '',
    dob: '',
    gender: '',
    phone: '',
    email: '',
    fatherName: '',
    fatherPhone: '',
    motherName: '',
    motherPhone: '',
    schoolName: '',
    academicBoard: '',
    address: '',
    dateOfJoining: '',
  });
  const [useClassColumn, setUseClassColumn] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<any>(null);
  const [importSummary, setImportSummary] = useState<any>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkTargetCourseId, setBulkTargetCourseId] = useState('');
  const [bulkTargetBatchId, setBulkTargetBatchId] = useState('');
  const [bulkFilterTab, setBulkFilterTab] = useState<'ALL' | 'INVALID' | 'VALID'>('ALL');
  const [bulkBatchGender, setBulkBatchGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');

  // Manage Enrollments Modal (Multi-Subject & Multi-Course Lifecycle)
  const [selectedStudentForEnrollments, setSelectedStudentForEnrollments] = useState<Student | null>(null);
  const [enrollmentsData, setEnrollmentsData] = useState<{
    student?: any;
    active?: any[];
    historical?: any[];
    activeEnrollments?: any[];
    historicalEnrollments?: any[];
    totalCount?: number;
  } | null>(null);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [newEnrollment, setNewEnrollment] = useState({
    courseId: '',
    batchId: '',
    subjectId: '',
  });
  const [addingEnrollment, setAddingEnrollment] = useState(false);
  const [endingEnrollmentId, setEndingEnrollmentId] = useState<string | null>(null);

  // Single View Tab & Edit State
  const [singleViewTab, setSingleViewTab] = useState<'details' | 'edit' | 'enrollments'>('details');
  const [editForm, setEditForm] = useState<{
    name: string;
    schoolName: string;
    dob: string;
    gender: string;
    status: string;
    email: string;
    phone: string;
    address: string;
    guardians: GuardianContactRow[];
  }>({
    name: '',
    schoolName: '',
    dob: '',
    gender: 'MALE',
    status: 'ACTIVE',
    email: '',
    phone: '',
    address: '',
    guardians: [],
  });
  const [savingStudent, setSavingStudent] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [editModalSuccess, setEditModalSuccess] = useState<string | null>(null);

  // Delete Student Modal
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [manualModalError, setManualModalError] = useState<string | null>(null);

  // Student Advance & Fee Allocation State
  const [advanceSummary, setAdvanceSummary] = useState<{
    totalCollected: number;
    totalUtilized: number;
    availableBalance: number;
    advances: any[];
    history: any[];
  } | null>(null);
  const [loadingAdvance, setLoadingAdvance] = useState(false);

  // Record additional advance for existing student
  const [recordAdvanceForm, setRecordAdvanceForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'CASH',
    reference: '',
    notes: '',
  });
  const [recordingAdvance, setRecordingAdvance] = useState(false);
  const [recordAdvanceError, setRecordAdvanceError] = useState<string | null>(null);
  const [recordAdvanceSuccess, setRecordAdvanceSuccess] = useState<string | null>(null);

  // Allocate advance against fee invoice
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [studentInvoices, setStudentInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [allocationForm, setAllocationForm] = useState({
    invoiceId: '',
    amount: '',
    notes: '',
  });
  const [allocatingAdvance, setAllocatingAdvance] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationSuccess, setAllocationSuccess] = useState<string | null>(null);

  const fetchAdvanceSummary = async (studentId: string) => {
    try {
      setLoadingAdvance(true);
      const summary = await ApiClient.fetch<any>(`/students/${studentId}/advances`);
      setAdvanceSummary(summary);
    } catch (_) {
      // Ignore
    } finally {
      setLoadingAdvance(false);
    }
  };

  const handleRecordAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForEnrollments) return;

    const amt = parseFloat(recordAdvanceForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setRecordAdvanceError('Please enter a valid advance amount greater than ₹0');
      return;
    }
    if (!recordAdvanceForm.paymentDate) {
      setRecordAdvanceError('Please select a payment date');
      return;
    }

    try {
      setRecordingAdvance(true);
      setRecordAdvanceError(null);
      setRecordAdvanceSuccess(null);

      const res: any = await ApiClient.fetch(`/students/${selectedStudentForEnrollments.id}/advances`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          paymentDate: recordAdvanceForm.paymentDate,
          paymentMethod: recordAdvanceForm.paymentMethod,
          reference: recordAdvanceForm.reference?.trim() || undefined,
          notes: recordAdvanceForm.notes?.trim() || undefined,
        }),
      });

      setRecordAdvanceSuccess(
        `Advance of ₹${amt.toLocaleString('en-IN')} recorded successfully! Receipt: ${res.receiptNumber || 'ADV'}`,
      );
      setRecordAdvanceForm({
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'CASH',
        reference: '',
        notes: '',
      });

      if (res.summary) {
        setAdvanceSummary(res.summary);
      } else {
        await fetchAdvanceSummary(selectedStudentForEnrollments.id);
      }
      await loadData();
    } catch (err: any) {
      setRecordAdvanceError(err.message || 'Failed to record advance');
    } finally {
      setRecordingAdvance(false);
    }
  };

  const openAllocationModal = async () => {
    if (!selectedStudentForEnrollments) return;
    setShowAllocateModal(true);
    setAllocationError(null);
    setAllocationSuccess(null);
    setAllocationForm({ invoiceId: '', amount: '', notes: '' });

    try {
      setLoadingInvoices(true);
      const invoices = await ApiClient.fetch<any[]>(
        `/fees/invoices?studentId=${selectedStudentForEnrollments.id}`,
      );
      const outstanding = (invoices || []).filter(
        (inv) =>
          (inv.status === 'UNPAID' || inv.status === 'PARTIAL') &&
          Number(inv.balanceAmount) > 0,
      );
      setStudentInvoices(outstanding);
      if (outstanding.length > 0) {
        const first = outstanding[0];
        const avail = advanceSummary?.availableBalance || 0;
        const maxAlloc = Math.min(avail, Number(first.balanceAmount));
        setAllocationForm({
          invoiceId: first.id,
          amount: maxAlloc > 0 ? String(maxAlloc) : '',
          notes: `Settled from available advance balance`,
        });
      }
    } catch (err: any) {
      setAllocationError(err.message || 'Failed to load outstanding invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleAllocateAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForEnrollments || !allocationForm.invoiceId) return;

    const amt = parseFloat(allocationForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setAllocationError('Please enter a valid allocation amount greater than ₹0');
      return;
    }

    const available = advanceSummary?.availableBalance || 0;
    if (amt > available) {
      setAllocationError(
        `Allocation amount (₹${amt}) cannot exceed available advance balance (₹${available})`,
      );
      return;
    }

    const targetInv = studentInvoices.find((i) => i.id === allocationForm.invoiceId);
    if (targetInv && amt > Number(targetInv.balanceAmount)) {
      setAllocationError(
        `Allocation amount (₹${amt}) cannot exceed invoice balance (₹${targetInv.balanceAmount})`,
      );
      return;
    }

    try {
      setAllocatingAdvance(true);
      setAllocationError(null);
      setAllocationSuccess(null);

      const res: any = await ApiClient.fetch(
        `/students/${selectedStudentForEnrollments.id}/advances/allocate`,
        {
          method: 'POST',
          body: JSON.stringify({
            invoiceId: allocationForm.invoiceId,
            amount: amt,
            notes: allocationForm.notes?.trim() || undefined,
          }),
        },
      );

      setAllocationSuccess(
        `₹${amt.toLocaleString('en-IN')} allocated successfully against invoice ${res.invoice?.invoiceNumber || ''}!`,
      );
      if (res.summary) {
        setAdvanceSummary(res.summary);
      } else {
        await fetchAdvanceSummary(selectedStudentForEnrollments.id);
      }

      const updatedInvoices = await ApiClient.fetch<any[]>(
        `/fees/invoices?studentId=${selectedStudentForEnrollments.id}`,
      );
      const outstanding = (updatedInvoices || []).filter(
        (inv) =>
          (inv.status === 'UNPAID' || inv.status === 'PARTIAL') &&
          Number(inv.balanceAmount) > 0,
      );
      setStudentInvoices(outstanding);

      const updatedEnrollments = await ApiClient.fetch<any>(
        `/students/${selectedStudentForEnrollments.id}/enrollments`,
      );
      setEnrollmentsData(updatedEnrollments);

      await loadData();
      setTimeout(() => {
        setShowAllocateModal(false);
      }, 1500);
    } catch (err: any) {
      setAllocationError(err.message || 'Failed to allocate advance');
    } finally {
      setAllocatingAdvance(false);
    }
  };

  const pathname = usePathname();

  // Reset all modals when route changes
  useEffect(() => {
    setShowManualModal(false);
    setShowCreatedCodeModal(null);
    setShowBulkModal(false);
    setSelectedStudentForEnrollments(null);
    setStudentToDelete(null);
    setManualModalError(null);
    setEditModalError(null);
    setEditModalSuccess(null);
  }, [pathname]);

  // Handle Escape key & body scroll lock
  useEffect(() => {
    const isAnyModalOpen =
      showManualModal ||
      !!showCreatedCodeModal ||
      showBulkModal ||
      !!selectedStudentForEnrollments ||
      !!studentToDelete;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowManualModal(false);
        setShowCreatedCodeModal(null);
        setShowBulkModal(false);
        setSelectedStudentForEnrollments(null);
        setStudentToDelete(null);
        setManualModalError(null);
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
  }, [showManualModal, showCreatedCodeModal, showBulkModal, selectedStudentForEnrollments, studentToDelete]);

  // Manual Form State with Multi-Course Enrollments & Multiple Guardian Contacts
  const [manualForm, setManualForm] = useState<{
    name: string;
    schoolName: string;
    dob: string;
    gender: string;
    email: string;
    phone: string;
    enrollments: CourseEnrollmentRow[];
    guardians: GuardianContactRow[];
    advanceAmount: string;
    advancePaymentDate: string;
    advancePaymentMethod: string;
    advanceReference: string;
    advanceNotes: string;
  }>({
    name: '',
    schoolName: '',
    dob: '2008-01-01',
    gender: 'MALE',
    email: '',
    phone: '',
    enrollments: [{ courseId: '', batchId: '' }],
    guardians: [{ fullName: '', phone: '', relationship: 'Father', email: '' }],
    advanceAmount: '0',
    advancePaymentDate: new Date().toISOString().split('T')[0],
    advancePaymentMethod: 'CASH',
    advanceReference: '',
    advanceNotes: '',
  });
  const [submittingManual, setSubmittingManual] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const addEnrollmentRow = () => {
    setManualForm((prev) => ({
      ...prev,
      enrollments: [...prev.enrollments, { courseId: '', batchId: '', subjectId: '' }],
    }));
  };

  const removeEnrollmentRow = (index: number) => {
    setManualForm((prev) => {
      if (prev.enrollments.length <= 1) return prev;
      return {
        ...prev,
        enrollments: prev.enrollments.filter((_, i) => i !== index),
      };
    });
  };

  const updateEnrollmentRow = (
    index: number,
    field: 'courseId' | 'batchId' | 'subjectId',
    value: string,
  ) => {
    setManualForm((prev) => {
      const updated = [...prev.enrollments];
      if (field === 'courseId') {
        updated[index] = { courseId: value, batchId: '', subjectId: '' };
      } else if (field === 'subjectId') {
        updated[index] = { ...updated[index], subjectId: value };
      } else {
        updated[index] = { ...updated[index], batchId: value };
      }
      return { ...prev, enrollments: updated };
    });
  };

  const addGuardianRow = () => {
    setManualForm((prev) => ({
      ...prev,
      guardians: [
        ...prev.guardians,
        {
          fullName: '',
          phone: '',
          relationship: prev.guardians.length === 1 ? 'Mother' : 'Guardian',
          email: '',
        },
      ],
    }));
  };

  const removeGuardianRow = (index: number) => {
    setManualForm((prev) => {
      if (prev.guardians.length <= 1) return prev;
      return {
        ...prev,
        guardians: prev.guardians.filter((_, i) => i !== index),
      };
    });
  };

  const updateGuardianRow = (index: number, field: keyof GuardianContactRow, value: string) => {
    setManualForm((prev) => {
      const updated = [...prev.guardians];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, guardians: updated };
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (courseFilter) queryParams.append('classId', courseFilter);
      if (batchFilter) queryParams.append('batchId', batchFilter);
      queryParams.append('page', String(currentPage));
      queryParams.append('limit', String(pageSize));

      const [studentsRes, coursesRes] = await Promise.all([
        ApiClient.fetch<{ items: Student[]; meta?: { page: number; limit: number; total: number; totalPages: number } }>(
          `/students?${queryParams.toString()}`
        ),
        ApiClient.fetch<CourseOption[]>('/courses'),
      ]);
      setStudents(studentsRes.items || []);
      if (studentsRes.meta) {
        setTotalCount(studentsRes.meta.total);
        setTotalPages(studentsRes.meta.totalPages || Math.ceil(studentsRes.meta.total / pageSize) || 1);
      } else {
        setTotalCount(studentsRes.items?.length || 0);
        setTotalPages(1);
      }
      setCourses(coursesRes || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch student data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, courseFilter, batchFilter, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, courseFilter, batchFilter, statusFilter, selectedSubjectFilter]);

  // Handle Manual Student Registration
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.name.trim()) {
      setManualModalError('Please enter the student name.');
      return;
    }

    const trimmedName = manualForm.name.trim();
    const nameParts = trimmedName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-';

    const validEnrollments = manualForm.enrollments.filter((en) => en.courseId && en.batchId);
    if (validEnrollments.length === 0) {
      setManualModalError('Please select at least one course and cohort batch for admission.');
      return;
    }

    // Check for duplicate offerings (same batch + subject)
    const offeringSet = new Set<string>();
    for (const en of validEnrollments) {
      const key = `${en.batchId}_${en.subjectId || 'ALL'}`;
      if (offeringSet.has(key)) {
        setManualModalError('Duplicate enrollment selection for the same batch and subject offering.');
        return;
      }
      offeringSet.add(key);
    }

    // Validate guardian contacts if partially entered
    for (let i = 0; i < manualForm.guardians.length; i++) {
      const g = manualForm.guardians[i];
      const hasName = g.fullName.trim().length > 0;
      const hasPhone = g.phone.trim().length > 0;
      if (hasName && !hasPhone) {
        setManualModalError(`Please enter a contact phone number for #${i + 1} (${g.fullName})`);
        return;
      }
      if (!hasName && hasPhone) {
        setManualModalError(`Please enter the guardian/contact name for entry #${i + 1}`);
        return;
      }
    }

    try {
      setSubmittingManual(true);
      setManualModalError(null);
      setErrorMsg(null);

      const validGuardians = manualForm.guardians
        .filter((g) => g.fullName.trim() && g.phone.trim())
        .map((g) => ({
          fullName: g.fullName.trim(),
          phone: g.phone.trim(),
          relationship: g.relationship.trim() || 'Guardian',
          ...(g.email && g.email.trim() ? { email: g.email.trim() } : {}),
        }));

      const payload: any = {
        firstName,
        lastName,
        ...(manualForm.schoolName && manualForm.schoolName.trim() ? { schoolName: manualForm.schoolName.trim() } : {}),
        dob: manualForm.dob || '2008-01-01',
        gender: manualForm.gender || 'MALE',
        ...(manualForm.email && manualForm.email.trim() ? { email: manualForm.email.trim() } : {}),
        ...(manualForm.phone && manualForm.phone.trim() ? { phone: manualForm.phone.trim() } : {}),
        batchId: validEnrollments[0].batchId,
        courseId: validEnrollments[0].courseId,
        ...(validEnrollments[0].subjectId ? { subjectId: validEnrollments[0].subjectId } : {}),
        batchIds: validEnrollments.map((en) => en.batchId),
        enrollments: validEnrollments.map((en) => ({
          courseId: en.courseId,
          batchId: en.batchId,
          ...(en.subjectId ? { subjectId: en.subjectId } : {}),
        })),
        ...(validGuardians.length > 0 ? { guardians: validGuardians } : {}),
      };

      // Validate advance amount if entered
      const advNum = parseFloat(manualForm.advanceAmount || '0');
      if (isNaN(advNum) || advNum < 0) {
        setManualModalError('Advance amount must be a valid non-negative number');
        return;
      }
      if (advNum > 0) {
        if (!manualForm.advancePaymentDate) {
          setManualModalError('Payment date is required when an advance amount is entered');
          return;
        }
        if (!manualForm.advancePaymentMethod) {
          setManualModalError('Payment method is required when an advance amount is entered');
          return;
        }
        payload.advanceAmount = advNum;
        payload.advancePaymentDate = manualForm.advancePaymentDate;
        payload.advancePaymentMethod = manualForm.advancePaymentMethod;
        if (manualForm.advanceReference?.trim()) {
          payload.advanceReference = manualForm.advanceReference.trim();
        }
        if (manualForm.advanceNotes?.trim()) {
          payload.advanceNotes = manualForm.advanceNotes.trim();
        }
      }

      const res: any = await ApiClient.fetch('/students', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowManualModal(false);
      setManualForm({
        name: '',
        schoolName: '',
        dob: '2008-01-01',
        gender: 'MALE',
        email: '',
        phone: '',
        enrollments: [{ courseId: '', batchId: '', subjectId: '' }],
        guardians: [{ fullName: '', phone: '', relationship: 'Father', email: '' }],
        advanceAmount: '0',
        advancePaymentDate: new Date().toISOString().split('T')[0],
        advancePaymentMethod: 'CASH',
        advanceReference: '',
        advanceNotes: '',
      });

      setShowCreatedCodeModal({
        name: res.fullName || `${res.firstName} ${res.lastName && res.lastName !== '-' ? res.lastName : ''}`.trim(),
        studentCode: res.studentCode,
        attendanceCode: res.attendanceCode,
      });

      await loadData();
    } catch (err: any) {
      setManualModalError(err.message || 'Error onboarding student');
    } finally {
      setSubmittingManual(false);
    }
  };

  // Guardian helper for Single View
  const extractGuardians = (rawGuardians: any[] = []): GuardianContactRow[] => {
    if (!Array.isArray(rawGuardians)) return [];
    return rawGuardians.map((g) => {
      const data = g.guardian || g;
      return {
        fullName: data.fullName || '',
        phone: data.phone || '',
        relationship: data.relationship || 'Guardian',
        email: data.email || '',
      };
    });
  };

  const addEditGuardianRow = () => {
    setEditForm((prev) => ({
      ...prev,
      guardians: [
        ...prev.guardians,
        {
          fullName: '',
          phone: '',
          relationship: prev.guardians.length === 1 ? 'Mother' : 'Guardian',
          email: '',
        },
      ],
    }));
  };

  const removeEditGuardianRow = (index: number) => {
    setEditForm((prev) => {
      if (prev.guardians.length <= 1) return prev;
      return {
        ...prev,
        guardians: prev.guardians.filter((_, i) => i !== index),
      };
    });
  };

  const updateEditGuardianRow = (index: number, field: keyof GuardianContactRow, value: string) => {
    setEditForm((prev) => {
      const updated = [...prev.guardians];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, guardians: updated };
    });
  };

  // Open Single View (Details, Edit, Enrollments)
  const openManageEnrollments = async (student: Student) => {
    setSelectedStudentForEnrollments(student);
    setSingleViewTab('details');
    setLoadingEnrollments(true);
    setEditModalError(null);
    setEditModalSuccess(null);
    setNewEnrollment({ courseId: '', batchId: '', subjectId: '' });

    const initialGuardians = extractGuardians(student.guardians);
    setEditForm({
      name: student.fullName || `${student.firstName} ${student.lastName && student.lastName !== '-' ? student.lastName : ''}`.trim(),
      schoolName: student.schoolName || '',
      dob: student.dob ? student.dob.split('T')[0] : '2008-01-01',
      gender: student.gender || 'MALE',
      status: student.status || 'ACTIVE',
      email: student.email || '',
      phone: student.phone || '',
      address: (student as any).address || '',
      guardians: initialGuardians.length > 0 ? initialGuardians : [{ fullName: '', phone: '', relationship: 'Father', email: '' }],
    });

    try {
      const [data, fullStudent] = await Promise.all([
        ApiClient.fetch<any>(`/students/${student.id}/enrollments`),
        ApiClient.fetch<any>(`/students/${student.id}`).catch(() => null),
      ]);
      setEnrollmentsData(data);
      if (fullStudent) {
        setSelectedStudentForEnrollments((prev) => ({ ...(prev || student), ...fullStudent }));
        if (fullStudent.advanceSummary) {
          setAdvanceSummary(fullStudent.advanceSummary);
        } else {
          fetchAdvanceSummary(student.id);
        }
        const freshGuardians = extractGuardians(fullStudent.guardians || student.guardians);
        setEditForm({
          name: fullStudent.fullName || student.fullName || `${fullStudent.firstName} ${fullStudent.lastName && fullStudent.lastName !== '-' ? fullStudent.lastName : ''}`.trim(),
          schoolName: fullStudent.schoolName || student.schoolName || '',
          dob: fullStudent.dob ? fullStudent.dob.split('T')[0] : (student.dob ? student.dob.split('T')[0] : '2008-01-01'),
          gender: fullStudent.gender || student.gender || 'MALE',
          status: fullStudent.status || student.status || 'ACTIVE',
          email: fullStudent.email || student.email || '',
          phone: fullStudent.phone || student.phone || '',
          address: fullStudent.address || '',
          guardians: freshGuardians.length > 0 ? freshGuardians : [{ fullName: '', phone: '', relationship: 'Father', email: '' }],
        });
      } else {
        fetchAdvanceSummary(student.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'You do not have permission to access this student record');
      setSelectedStudentForEnrollments(null);
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForEnrollments) return;

    if (!editForm.name.trim()) {
      setEditModalError('Please enter a student name.');
      return;
    }

    try {
      setSavingStudent(true);
      setEditModalError(null);
      setEditModalSuccess(null);

      const validGuardians = editForm.guardians
        .filter((g) => g.fullName.trim() && g.phone.trim())
        .map((g) => ({
          fullName: g.fullName.trim(),
          phone: g.phone.trim(),
          relationship: g.relationship.trim() || 'Guardian',
          ...(g.email && g.email.trim() ? { email: g.email.trim() } : {}),
        }));

      const payload: any = {
        name: editForm.name.trim(),
        schoolName: editForm.schoolName.trim() ? editForm.schoolName.trim() : '',
        dob: editForm.dob || undefined,
        gender: editForm.gender,
        status: editForm.status,
        email: editForm.email.trim() ? editForm.email.trim() : '',
        phone: editForm.phone.trim() ? editForm.phone.trim() : '',
        address: editForm.address.trim() ? editForm.address.trim() : '',
        guardians: validGuardians,
      };

      const updated = await ApiClient.fetch<any>(`/students/${selectedStudentForEnrollments.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSelectedStudentForEnrollments((prev: any) => ({
        ...prev,
        ...updated,
        fullName: updated.fullName || editForm.name.trim(),
        schoolName: updated.schoolName || editForm.schoolName.trim(),
      }));

      const freshGuardians = extractGuardians(updated.guardians);
      setEditForm((prev) => ({
        ...prev,
        name: updated.fullName || prev.name,
        schoolName: updated.schoolName || prev.schoolName,
        guardians: freshGuardians.length > 0 ? freshGuardians : prev.guardians,
      }));

      setEditModalSuccess('Student profile updated successfully!');
      await loadData();
    } catch (err: any) {
      setEditModalError(err.message || 'Failed to update student profile');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleAddEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForEnrollments || !newEnrollment.batchId) return;

    try {
      setAddingEnrollment(true);
      setErrorMsg(null);
      await ApiClient.fetch(`/students/${selectedStudentForEnrollments.id}/enrollments`, {
        method: 'POST',
        body: JSON.stringify({
          courseId: newEnrollment.courseId || undefined,
          batchId: newEnrollment.batchId,
          subjectId: newEnrollment.subjectId || undefined,
        }),
      });
      setSuccessMsg('New enrollment added successfully');
      setNewEnrollment({ courseId: '', batchId: '', subjectId: '' });
      const data = await ApiClient.fetch<any>(
        `/students/${selectedStudentForEnrollments.id}/enrollments`,
      );
      setEnrollmentsData(data);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add enrollment');
    } finally {
      setAddingEnrollment(false);
    }
  };

  const handleEndEnrollment = async (enrollmentId: string) => {
    if (!selectedStudentForEnrollments) return;

    try {
      setEndingEnrollmentId(enrollmentId);
      setErrorMsg(null);
      await ApiClient.fetch(
        `/students/${selectedStudentForEnrollments.id}/enrollments/${enrollmentId}`,
        {
          method: 'DELETE',
        },
      );
      setSuccessMsg('Enrollment ended successfully');
      const data = await ApiClient.fetch<any>(
        `/students/${selectedStudentForEnrollments.id}/enrollments`,
      );
      setEnrollmentsData(data);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to end enrollment');
    } finally {
      setEndingEnrollmentId(null);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      setDeletingStudent(true);
      setErrorMsg(null);
      await ApiClient.fetch(`/students/${studentToDelete.id}`, {
        method: 'DELETE',
      });
      setSuccessMsg(`Student ${studentToDelete.fullName} (${studentToDelete.studentCode}) deleted successfully.`);
      setStudentToDelete(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete student');
    } finally {
      setDeletingStudent(false);
    }
  };


  // CSV Helpers
  const handleDownloadTemplate = () => {
    const csvContent =
      'Date of joining,Name,Name of the School,Date of Birth,Father\'s Name,Father\'s Mobile Number,Mother\'s Name,Mother\'s Mobile Number,Alternative Number,Email Id,Address,Are you a part of,Subjects,How do you know about our academy\n' +
      '01-06-2026,Aarav Sharma,St. Joseph Higher Secondary School,14-05-2010,Rajesh Sharma,9876543210,Sunita Sharma,9876543211,9876543212,aarav.sharma@example.com,"123 Heritage Way, Central City",CBSE,Science;Maths,Friend Referral\n' +
      '01-06-2026,Priya Verma,Delhi Public School,22-08-2010,Suresh Verma,9876543220,Anita Verma,9876543221,,priya.verma@example.com,"45 Sunrise Avenue, Block B",CBSE,All Subjects,Online Search\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'rc_academy_student_onboarding_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvText = (text: string) => {
    if (!text || !text.trim()) return [];
    // RFC 4180 Compliant state machine parser
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    // Normalize newlines to \n
    const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      const nextChar = cleaned[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote "" -> "
          currentCell += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length < 2) return [];

    const rawHeaders = rows[0];
    const normalizedHeaders = rawHeaders.map((h) => {
      const compact = h
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      if (compact === 'dateofjoining' || compact === 'doj') return 'dateOfJoining';
      if (compact === 'name' || compact === 'studentname' || compact === 'fullname') return 'rawName';
      if (compact === 'firstname') return 'firstName';
      if (compact === 'lastname' || compact === 'surname') return 'lastName';
      if (compact === 'nameoftheschool' || compact === 'schoolname' || compact === 'school') return 'schoolName';
      if (compact === 'dateofbirth' || compact === 'dob') return 'dob';
      if (compact === 'fathersname' || compact === 'fathername') return 'fatherName';
      if (compact === 'fathersmobilenumber' || compact === 'fathermobilenumber' || compact === 'fatherphone') return 'fatherPhone';
      if (compact === 'mothersname' || compact === 'mothername') return 'motherName';
      if (compact === 'mothersmobilenumber' || compact === 'mothermobilenumber' || compact === 'motherphone') return 'motherPhone';
      if (compact === 'alternativenumber' || compact === 'alternativeno' || compact === 'altphone') return 'alternativePhone';
      if (compact === 'emailid' || compact === 'email') return 'email';
      if (compact === 'address') return 'address';
      if (compact === 'areyouapartof' || compact === 'board' || compact === 'academicboard') return 'academicBoard';
      if (compact === 'subjects' || compact === 'subject') return 'subjects';
      if (compact === 'howdoyouknowaboutouracademy' || compact === 'referral' || compact === 'referralsource') return 'referralSource';
      if (compact === 'gender') return 'gender';
      if (compact === 'coursecode' || compact === 'course') return 'courseCode';
      if (compact === 'batchcode' || compact === 'batch') return 'batchCode';
      if (compact === 'guardianname') return 'guardianName';
      if (compact === 'guardianphone') return 'guardianPhone';
      if (compact === 'guardianrelationship') return 'guardianRelationship';
      return h.trim();
    });

    const parsedDataRows: any[] = [];
    for (let r = 1; r < rows.length; r++) {
      const rowValues = rows[r];
      const rowObj: any = {};
      normalizedHeaders.forEach((key, idx) => {
        let val = rowValues[idx] !== undefined ? rowValues[idx].trim() : '';
        const lower = val.toLowerCase();
        if (['-', '--', 'nil', 'null', 'na', 'n/a', 'none', '.'].includes(lower)) {
          val = '';
        }
        rowObj[key] = val;
      });
      parsedDataRows.push(rowObj);
    }

    return parsedDataRows;
  };

  const handleDownloadRejectedCsv = () => {
    if (!validationReport || !validationReport.rows) return;
    const invalidRows = validationReport.rows.filter((r: any) => !r.isValid);
    if (invalidRows.length === 0) return;

    const headers = [
      'Date of joining',
      'Name',
      'Name of the School',
      'Date of Birth',
      'Gender',
      'Father\'s Name',
      'Father\'s Mobile Number',
      'Mother\'s Name',
      'Mother\'s Mobile Number',
      'Alternative Number',
      'Email Id',
      'Address',
      'Are you a part of',
      'Subjects',
      'How do you know about our academy',
      'Rejection_Errors',
    ];

    const escapeCsv = (val: any) => {
      const str = val !== undefined && val !== null ? String(val) : '';
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [headers.join(',')];
    for (const vr of invalidRows) {
      const d = vr.data || {};
      const line = [
        escapeCsv(d.dateOfJoining || ''),
        escapeCsv(d.rawName || (d.firstName ? `${d.firstName} ${d.lastName || ''}`.trim() : '')),
        escapeCsv(d.schoolName || ''),
        escapeCsv(d.dob || ''),
        escapeCsv(d.gender || ''),
        escapeCsv(d.fatherName || ''),
        escapeCsv(d.fatherPhone || ''),
        escapeCsv(d.motherName || ''),
        escapeCsv(d.motherPhone || ''),
        escapeCsv(d.alternativePhone || ''),
        escapeCsv(d.email || ''),
        escapeCsv(d.address || ''),
        escapeCsv(d.academicBoard || ''),
        escapeCsv(d.subjects || ''),
        escapeCsv(d.referralSource || ''),
        escapeCsv((vr.errors || []).join('; ')),
      ];
      csvLines.push(line.join(','));
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'rc_academy_rejected_rows.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadImportErrorsCsv = () => {
    if (!importSummary || !importSummary.failedRows || importSummary.failedRows.length === 0) return;
    const headers = ['Row_Number', 'Candidate_Name', 'Status', 'Errors'];
    const escapeCsv = (val: any) => {
      const str = val !== undefined && val !== null ? String(val) : '';
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [headers.join(',')];
    for (const fr of importSummary.failedRows) {
      csvLines.push([
        escapeCsv(fr.row),
        escapeCsv(fr.name),
        escapeCsv(fr.status),
        escapeCsv((fr.errors || []).join('; ')),
      ].join(','));
    }

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'rc_academy_failed_import_rows.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchSetGender = async (genderToSet: 'MALE' | 'FEMALE' | 'OTHER') => {
    if (!validationReport || !validationReport.rows) return;
    try {
      setBulkLoading(true);
      setErrorMsg(null);
      const updatedRows = validationReport.rows.map((r: any) => {
        const curData = { ...r.data };
        if (!curData.gender || !['MALE', 'FEMALE', 'OTHER'].includes(String(curData.gender).toUpperCase())) {
          curData.gender = genderToSet;
        }
        return curData;
      });

      const res: any = await ApiClient.fetch('/students/bulk-validate', {
        method: 'POST',
        body: JSON.stringify({
          rows: updatedRows,
          defaultCourseId: bulkTargetCourseId || undefined,
          defaultBatchId: bulkTargetBatchId || undefined,
        }),
      });

      setValidationReport(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update missing genders');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUpdateRowField = async (rowIndex: number, field: string, value: string) => {
    if (!validationReport || !validationReport.rows) return;
    const updatedRows = validationReport.rows.map((r: any) => {
      if (r.rowIndex === rowIndex) {
        return {
          ...r.data,
          [field]: value,
        };
      }
      return r.data;
    });

    try {
      setBulkLoading(true);
      setErrorMsg(null);
      const res: any = await ApiClient.fetch('/students/bulk-validate', {
        method: 'POST',
        body: JSON.stringify({
          rows: updatedRows,
          defaultCourseId: bulkTargetCourseId || undefined,
          defaultBatchId: bulkTargetBatchId || undefined,
        }),
      });
      setValidationReport(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to re-validate row');
    } finally {
      setBulkLoading(false);
    }
  };

  const parseRawCsvGrid = (text: string): { headers: string[]; dataRows: string[][] } => {
    if (!text || !text.trim()) return { headers: [], dataRows: [] };
    const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      const nextChar = cleaned[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentCell.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) return { headers: [], dataRows: [] };
    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1).filter((r) => r.some((c) => c.length > 0));
    return { headers, dataRows };
  };

  const autoDetectColumnMapping = (headers: string[]) => {
    const mapping = {
      rawName: '',
      courseCode: '',
      batchCode: '',
      subjects: '',
      dob: '',
      gender: '',
      phone: '',
      email: '',
      fatherName: '',
      fatherPhone: '',
      motherName: '',
      motherPhone: '',
      schoolName: '',
      academicBoard: '',
      address: '',
      dateOfJoining: '',
    };

    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    headers.forEach((h) => {
      const c = clean(h);
      if (!mapping.rawName && (c === 'name' || c === 'studentname' || c === 'fullname' || c === 'candidate' || c === 'candidatename' || c === 'student')) {
        mapping.rawName = h;
      } else if (!mapping.courseCode && (c === 'class' || c === 'course' || c === 'standard' || c === 'grade' || c === 'cohort' || c === 'coursecode')) {
        mapping.courseCode = h;
      } else if (!mapping.batchCode && (c === 'batch' || c === 'section' || c === 'batchcode' || c === 'division')) {
        mapping.batchCode = h;
      } else if (!mapping.subjects && (c === 'subjects' || c === 'subject' || c === 'subjectcode' || c === 'coursesubject' || c === 'elective')) {
        mapping.subjects = h;
      } else if (!mapping.dob && (c === 'dob' || c === 'dateofbirth' || c === 'birthdate' || c === 'birth')) {
        mapping.dob = h;
      } else if (!mapping.gender && (c === 'gender' || c === 'sex')) {
        mapping.gender = h;
      } else if (!mapping.phone && (c === 'phone' || c === 'mobile' || c === 'contact' || c === 'phonenumber' || c === 'mobilenumber' || c === 'studentphone')) {
        mapping.phone = h;
      } else if (!mapping.email && (c === 'email' || c === 'emailid' || c === 'emailaddress')) {
        mapping.email = h;
      } else if (!mapping.fatherName && (c === 'fathername' || c === 'fathersname' || c === 'parentname' || c === 'primaryguardian')) {
        mapping.fatherName = h;
      } else if (!mapping.fatherPhone && (c === 'fatherphone' || c === 'fathersphone' || c === 'fathermobile' || c === 'fathersmobile' || c === 'fathermobilenumber')) {
        mapping.fatherPhone = h;
      } else if (!mapping.motherName && (c === 'mothername' || c === 'mothersname')) {
        mapping.motherName = h;
      } else if (!mapping.motherPhone && (c === 'motherphone' || c === 'mothersphone' || c === 'mothermobile' || c === 'mothersmobile' || c === 'mothermobilenumber')) {
        mapping.motherPhone = h;
      } else if (!mapping.schoolName && (c === 'schoolname' || c === 'school' || c === 'nameoftheschool' || c === 'institution')) {
        mapping.schoolName = h;
      } else if (!mapping.academicBoard && (c === 'board' || c === 'academicboard' || c === 'areyouapartof' || c === 'curriculum')) {
        mapping.academicBoard = h;
      } else if (!mapping.address && (c === 'address' || c === 'residentialaddress')) {
        mapping.address = h;
      } else if (!mapping.dateOfJoining && (c === 'dateofjoining' || c === 'doj' || c === 'joiningdate')) {
        mapping.dateOfJoining = h;
      }
    });

    return mapping;
  };

  const handleProcessRawCsv = (text: string) => {
    setCsvContent(text);
    const { headers, dataRows } = parseRawCsvGrid(text);
    if (headers.length === 0 || dataRows.length === 0) {
      setErrorMsg('The CSV file does not contain header or data rows.');
      return;
    }
    setCsvRawHeaders(headers);
    setCsvRawDataRows(dataRows);
    const detected = autoDetectColumnMapping(headers);
    setColumnMapping(detected);
    if (detected.courseCode) {
      setUseClassColumn(true);
    }
    setErrorMsg(null);
    setBulkStep('MAP_COLUMNS');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleProcessRawCsv(content);
    };
    reader.readAsText(file);
  };

  const handleValidateMappedCsv = async () => {
    if (!columnMapping.rawName) {
      setErrorMsg('Please connect a CSV column for Student Name (Mandatory).');
      return;
    }
    if (useClassColumn && !columnMapping.courseCode) {
      setErrorMsg('Please connect a CSV column for Class / Course, or choose a default course.');
      return;
    }
    if (!useClassColumn && !bulkTargetCourseId) {
      setErrorMsg('Please select a Target Academic Course for the cohort, or connect a Class column.');
      return;
    }

    try {
      setBulkLoading(true);
      setErrorMsg(null);

      const headerIdxMap: Record<string, number> = {};
      csvRawHeaders.forEach((h, idx) => {
        headerIdxMap[h] = idx;
      });

      const getColVal = (rowArr: string[], colName: string) => {
        if (!colName || headerIdxMap[colName] === undefined) return '';
        const raw = rowArr[headerIdxMap[colName]];
        if (raw === undefined || raw === null) return '';
        const trimmed = String(raw).trim();
        const lower = trimmed.toLowerCase();
        if (['-', '--', 'nil', 'null', 'na', 'n/a', 'none', '.'].includes(lower)) return '';
        return trimmed;
      };

      const mappedRows = csvRawDataRows.map((r) => {
        const studentName = getColVal(r, columnMapping.rawName);
        return {
          rawName: studentName,
          name: studentName,
          courseCode: useClassColumn ? getColVal(r, columnMapping.courseCode) : undefined,
          batchCode: getColVal(r, columnMapping.batchCode) || undefined,
          subjects: getColVal(r, columnMapping.subjects),
          dob: getColVal(r, columnMapping.dob),
          gender: (getColVal(r, columnMapping.gender) || undefined) as any,
          phone: getColVal(r, columnMapping.phone),
          email: getColVal(r, columnMapping.email),
          fatherName: getColVal(r, columnMapping.fatherName),
          fatherPhone: getColVal(r, columnMapping.fatherPhone),
          motherName: getColVal(r, columnMapping.motherName),
          motherPhone: getColVal(r, columnMapping.motherPhone),
          schoolName: getColVal(r, columnMapping.schoolName),
          academicBoard: getColVal(r, columnMapping.academicBoard),
          address: getColVal(r, columnMapping.address),
          dateOfJoining: getColVal(r, columnMapping.dateOfJoining),
          targetCourseId: !useClassColumn ? bulkTargetCourseId : undefined,
          targetBatchId: !useClassColumn ? bulkTargetBatchId : undefined,
        };
      }).filter((r) => r.rawName);

      if (mappedRows.length === 0) {
        throw new Error('No rows found with student names in the selected column.');
      }

      const res: any = await ApiClient.fetch('/students/bulk-validate', {
        method: 'POST',
        body: JSON.stringify({
          rows: mappedRows,
          defaultCourseId: bulkTargetCourseId || undefined,
          defaultBatchId: bulkTargetBatchId || undefined,
        }),
      });

      setValidationReport(res);
      setBulkFilterTab('ALL');
      setBulkStep('PREVIEW');
    } catch (err: any) {
      setErrorMsg(err.message || 'Validation failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExecuteBulkImport = async () => {
    if (!validationReport) return;

    try {
      setBulkLoading(true);
      setErrorMsg(null);

      // Only submit the parsed rows that passed validation
      const validRows = validationReport.rows
        .filter((r: any) => r.isValid)
        .map((r: any) => r.data);

      const res: any = await ApiClient.fetch('/students/bulk-import', {
        method: 'POST',
        body: JSON.stringify({
          rows: validRows,
          defaultCourseId: bulkTargetCourseId || undefined,
          defaultBatchId: bulkTargetBatchId || undefined,
        }),
      });

      setImportSummary(res);
      setBulkStep('REPORT');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Bulk import failed');
    } finally {
      setBulkLoading(false);
    }
  };

  // Student Analysis & Cohort Overview
  const analysisStats = useMemo(() => {
    const totalStudents = students.length;
    const activeStudents = students.filter((s) => s.status === 'ACTIVE').length;

    const classCountMap: Record<string, { id?: string; name: string; count: number; code?: string }> = {};
    const subjectCountMap: Record<string, { name: string; count: number }> = {};

    students.forEach((s) => {
      if (s.enrollments && s.enrollments.length > 0) {
        const seenInStudentClasses = new Set<string>();
        s.enrollments.forEach((e) => {
          if (e.className && !seenInStudentClasses.has(e.className)) {
            seenInStudentClasses.add(e.className);
            if (!classCountMap[e.className]) {
              classCountMap[e.className] = { id: e.classId, name: e.className, count: 0, code: e.classCode };
            }
            classCountMap[e.className].count++;
          }
          if (e.subjectName) {
            const subName = e.subjectName.trim();
            if (!subjectCountMap[subName]) {
              subjectCountMap[subName] = { name: subName, count: 0 };
            }
            subjectCountMap[subName].count++;
          }
        });
      } else if (s.currentBatch) {
        const cName = s.currentBatch.class?.name || 'Assigned Cohort';
        if (!classCountMap[cName]) {
          classCountMap[cName] = { id: s.currentBatch.class?.id, name: cName, count: 0, code: s.currentBatch.class?.code };
        }
        classCountMap[cName].count++;
      }
    });

    return {
      totalStudents,
      activeStudents,
      classes: Object.values(classCountMap).sort((a, b) => b.count - a.count),
      subjects: Object.values(subjectCountMap).sort((a, b) => b.count - a.count),
    };
  }, [students]);

  const filteredStudents = students.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (courseFilter) {
      const hasCourse =
        s.enrollments?.some((e) => e.classId === courseFilter) ||
        s.currentBatch?.class?.id === courseFilter;
      if (!hasCourse) return false;
    }
    if (batchFilter) {
      const hasEnrollment = s.enrollments?.some((e) => e.batchId === batchFilter);
      const hasCurrent = s.currentBatch?.id === batchFilter;
      if (!hasEnrollment && !hasCurrent) return false;
    }
    if (selectedSubjectFilter) {
      const hasSubject = s.enrollments?.some(
        (e) => e.subjectName && e.subjectName.toLowerCase().includes(selectedSubjectFilter.toLowerCase()),
      );
      if (!hasSubject) return false;
    }
    return true;
  });

  const validEnrollmentsCount = manualForm.enrollments.filter(
    (en) => en.courseId && en.batchId
  ).length;

  return (
    <>
      {/* Header */}
      <Header
        title={isPrivileged ? "Student Directory & Admissions" : "My Assigned Students"}
        subtitle={
          isPrivileged
            ? "Manage enrolled students, multi-course cohort allocations, unique 3-digit attendance codes, and bulk onboarding"
            : "View students enrolled in the courses and batches assigned to you"
        }
      />

      <ResponsivePageContainer>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-900 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name, code, or 3-digit code..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm text-black placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAnalysisPanel(!showAnalysisPanel)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg border transition ${
              showAnalysisPanel || selectedSubjectFilter
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200'
            }`}
          >
            <BarChart3 className={`w-4 h-4 ${showAnalysisPanel || selectedSubjectFilter ? 'text-[#FF8500]' : 'text-neutral-500'}`} />
            <span>Analysis & Distribution</span>
            {(selectedSubjectFilter || batchFilter) && (
              <span className="w-2 h-2 rounded-full bg-[#FF8500]"></span>
            )}
          </button>

          {isPrivileged && (
            <>
              <button
                onClick={() => {
                  setBulkStep('UPLOAD');
                  setCsvContent('');
                  setCsvRawHeaders([]);
                  setCsvRawDataRows([]);
                  setValidationReport(null);
                  setImportSummary(null);
                  setShowBulkModal(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#FFF4E5] hover:bg-[#FFE8CC] text-[#CC6B00] text-sm font-semibold rounded-lg border border-[#FF8500]/30 transition shadow-2xs"
              >
                <Upload className="w-4 h-4 text-[#FF8500]" />
                <span>Bulk Import CSV</span>
              </button>

              <button
                onClick={() => {
                  setErrorMsg(null);
                  setManualModalError(null);
                  setShowManualModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-sm font-semibold rounded-lg shadow-subtle transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Student</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* FILTER CONTROLS TOOLBAR: Class / Course, Batch, Status */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 uppercase tracking-wider mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF8500]" />
            <span>Filters:</span>
          </div>

          {/* 1. Class / Course Filter */}
          <div className="flex items-center gap-1.5 min-w-[210px] flex-1 sm:flex-initial">
            <div className="relative w-full">
              <BookOpen className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <select
                value={courseFilter}
                onChange={(e) => {
                  const newCourse = e.target.value;
                  setCourseFilter(newCourse);
                  if (newCourse) {
                    const courseObj = courses.find((c) => c.id === newCourse);
                    const batchExists = courseObj?.batches.some((b) => b.id === batchFilter);
                    if (!batchExists) setBatchFilter('');
                  }
                }}
                className={`w-full pl-8 pr-7 py-2 text-xs font-semibold rounded-lg border transition appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] ${
                  courseFilter
                    ? 'bg-orange-50/70 border-[#FF8500] text-[#CC6B00] ring-1 ring-[#FF8500]/20'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <option value="">All Classes / Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-[10px]">▼</span>
            </div>
          </div>

          {/* 2. Batch Filter */}
          <div className="flex items-center gap-1.5 min-w-[190px] flex-1 sm:flex-initial">
            <div className="relative w-full">
              <Layers className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className={`w-full pl-8 pr-7 py-2 text-xs font-semibold rounded-lg border transition appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] ${
                  batchFilter
                    ? 'bg-orange-50/70 border-[#FF8500] text-[#CC6B00] ring-1 ring-[#FF8500]/20'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <option value="">{courseFilter ? 'All Batches in Course' : 'All Batches'}</option>
                {availableBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </option>
                ))}
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-[10px]">▼</span>
            </div>
          </div>

          {/* 3. Status Filter */}
          <div className="flex items-center gap-1.5 min-w-[130px] flex-1 sm:flex-initial">
            <div className="relative w-full">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-lg border transition appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] ${
                  statusFilter !== 'ALL'
                    ? 'bg-orange-50/70 border-[#FF8500] text-[#CC6B00] ring-1 ring-[#FF8500]/20'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="ALUMNI">Alumni</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400 text-[10px]">▼</span>
            </div>
          </div>
        </div>

        {/* Active Filters Summary & Reset Button */}
        {(courseFilter || batchFilter || statusFilter !== 'ALL' || selectedSubjectFilter || search) && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-medium text-neutral-500">
              Showing <strong className="text-neutral-900">{filteredStudents.length}</strong> matching students
            </span>
            <button
              type="button"
              onClick={() => {
                setCourseFilter('');
                setBatchFilter('');
                setStatusFilter('ALL');
                setSelectedSubjectFilter('');
                setSearch('');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* STUDENT ANALYSIS & COHORT OVERVIEW PANEL */}
      {(showAnalysisPanel || selectedSubjectFilter) && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-4 animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FFF4E5] text-[#FF8500] flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 text-sm">Students Cohort & Subject Analysis</h3>
                <p className="text-xs text-neutral-500">
                  Live distribution across enrolled classes and specific subjects (Chemistry, Maths, etc.)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {courseFilter && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-900 text-xs font-semibold">
                  <span>Class: {courses.find((c) => c.id === courseFilter)?.name || courseFilter}</span>
                  <button
                    type="button"
                    onClick={() => setCourseFilter('')}
                    className="p-0.5 hover:bg-blue-200 rounded-full cursor-pointer"
                    title="Clear class filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {batchFilter && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 border border-purple-200 text-purple-900 text-xs font-semibold">
                  <span>Batch: {availableBatches.find((b) => b.id === batchFilter)?.name || batchFilter}</span>
                  <button
                    type="button"
                    onClick={() => setBatchFilter('')}
                    className="p-0.5 hover:bg-purple-200 rounded-full cursor-pointer"
                    title="Clear batch filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedSubjectFilter && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-900 text-xs font-semibold">
                  <span>Subject: {selectedSubjectFilter}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectFilter('')}
                    className="p-0.5 hover:bg-orange-200 rounded-full cursor-pointer"
                    title="Clear subject filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Total Enrolled</span>
              <div className="text-2xl font-bold text-black mt-0.5">{analysisStats.totalStudents}</div>
              <span className="text-[10px] text-neutral-400">Total in directory</span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Active Students</span>
              <div className="text-2xl font-bold text-emerald-800 mt-0.5">{analysisStats.activeStudents}</div>
              <span className="text-[10px] text-emerald-600 font-medium">Currently active</span>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Total Classes</span>
              <div className="text-2xl font-bold text-blue-800 mt-0.5">{analysisStats.classes.length}</div>
              <span className="text-[10px] text-blue-600 font-medium">Active courses</span>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Total Subjects</span>
              <div className="text-2xl font-bold text-purple-800 mt-0.5">{analysisStats.subjects.length}</div>
              <span className="text-[10px] text-purple-600 font-medium">Unique subjects</span>
            </div>
          </div>

          {/* Subjects Breakdown (e.g. Chemistry, Maths) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-700 uppercase tracking-wider text-[11px]">
                Subject Distribution (Click to filter table)
              </span>
              {selectedSubjectFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedSubjectFilter('')}
                  className="text-xs text-[#FF8500] hover:underline font-semibold cursor-pointer"
                >
                  Show All Subjects
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {analysisStats.subjects.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">No subject-specific enrollments recorded yet.</p>
              ) : (
                analysisStats.subjects.map((sub) => {
                  const isSelected = selectedSubjectFilter.toLowerCase() === sub.name.toLowerCase();
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() =>
                        setSelectedSubjectFilter(isSelected ? '' : sub.name)
                      }
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                        isSelected
                          ? 'bg-[#FF8500] text-white border-[#FF8500] shadow-sm'
                          : 'bg-neutral-50 hover:bg-[#FFF4E5] hover:text-[#CC6B00] hover:border-[#FF8500]/40 text-neutral-800 border-neutral-200'
                      }`}
                    >
                      <span>{sub.name}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-neutral-200/80 text-neutral-700'
                        }`}
                      >
                        {sub.count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Classes Breakdown */}
          {analysisStats.classes.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <span className="font-semibold text-neutral-700 uppercase tracking-wider text-[11px] block">
                Class / Course Distribution
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {analysisStats.classes.map((cls) => {
                  const isSelected = cls.id ? courseFilter === cls.id : false;
                  return (
                    <button
                      key={cls.name}
                      type="button"
                      onClick={() => {
                        if (cls.id) {
                          setCourseFilter(isSelected ? '' : cls.id);
                        }
                      }}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition text-left cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF8500] text-white border-[#FF8500] shadow-sm'
                          : 'bg-neutral-50 hover:bg-[#FFF4E5] hover:text-[#CC6B00] hover:border-[#FF8500]/40 text-neutral-800 border-neutral-200'
                      }`}
                    >
                      <span className="font-semibold truncate mr-1" title={cls.name}>
                        {cls.name}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md text-[11px] border shrink-0 ${
                          isSelected
                            ? 'bg-white/20 text-white border-transparent'
                            : 'bg-white text-neutral-900 border-neutral-200'
                        }`}
                      >
                        {cls.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Students Table & Native Mobile Cards */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
        {/* Top Table Control Bar with Instant 100 Listing */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-neutral-50/90 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-neutral-900 bg-white px-3 py-1 rounded-lg border border-neutral-200 shadow-2xs">
              {totalCount || filteredStudents.length} Students Total
            </span>
            {pageSize === 100 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                <Zap className="w-3 h-3 text-emerald-600" />
                100 Students Listed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Instant List 100 Button */}
            <button
              type="button"
              onClick={() => {
                setPageSize(100);
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
                pageSize === 100
                  ? 'bg-[#FF8500] text-white ring-2 ring-[#FF8500]/30 shadow-subtle'
                  : 'bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/40 hover:bg-[#FFE8CC]'
              }`}
              title="Instantly display 100 students on one page"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Instantly List 100</span>
            </button>

            {/* Page Size Selection Pills */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-neutral-200">
              <span className="text-[10px] font-semibold text-neutral-400 px-1.5">Page Size:</span>
              {[25, 50, 100, 200].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                    pageSize === size
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Native Card View (< 768px) */}
        <div className="md:hidden divide-y divide-neutral-100">
          {loading ? (
            <div className="py-12 text-center text-neutral-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
              <p className="text-xs">Loading students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
              <p className="text-xs font-medium text-neutral-600">
                {isPrivileged
                  ? 'No students found matching filters.'
                  : 'No students assigned to your classes. You will see students once you are assigned to a course or batch.'}
              </p>
            </div>
          ) : (
            filteredStudents.map((s, idx) => (
              <div key={s.id} className="p-4 space-y-2.5 hover:bg-neutral-50/50 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-600 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      #{(currentPage - 1) * pageSize + idx + 1}
                    </span>
                    <div>
                      <button
                        type="button"
                        onClick={() => openManageEnrollments(s)}
                        className="font-bold text-black text-sm text-left hover:text-[#FF8500] transition cursor-pointer block"
                        title="View single student details & enrollments"
                      >
                        {s.fullName}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500 font-mono">
                        <span>{s.studentCode}</span>
                        <span>•</span>
                        <span>Adm: {s.admissionNumber}</span>
                      </div>
                      {s.schoolName && (
                        <div className="text-[11px] text-neutral-500 font-medium truncate mt-0.5 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3 text-[#FF8500] shrink-0" />
                          <span>{s.schoolName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3-Digit Attendance Code Badge */}
                  {s.attendanceCode ? (
                    <span className="font-mono font-extrabold text-xs px-2.5 py-1 rounded-lg bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/40 flex items-center gap-1 shadow-2xs">
                      <QrCode className="w-3 h-3 text-[#FF8500]" />
                      #{s.attendanceCode}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
                      No code
                    </span>
                  )}
                </div>

                {/* Class & Cohorts */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  {s.enrollments && s.enrollments.length > 0 ? (
                    s.enrollments.map((e) => (
                      <span key={e.id} className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 text-[11px] font-medium border border-neutral-200">
                        {e.className} {e.subjectName ? `(${e.subjectName})` : ''} • {e.batchName}
                      </span>
                    ))
                  ) : s.currentBatch ? (
                    <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[11px]">
                      {s.currentBatch.class?.name || 'Class'} • {s.currentBatch.name}
                    </span>
                  ) : (
                    <span className="text-[11px] text-neutral-400 italic">No class assigned</span>
                  )}
                </div>

                {/* Guardian Phone if available */}
                {s.guardians && s.guardians.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-neutral-600 pt-1 border-t border-neutral-100">
                    <span className="font-medium text-neutral-700 truncate max-w-[180px]">
                      {s.guardians[0].fullName} ({s.guardians[0].relationship})
                    </span>
                    <a
                      href={`tel:${s.guardians[0].phone}`}
                      className="inline-flex items-center gap-1 text-[#FF8500] font-semibold text-[11px] py-0.5 px-2 rounded bg-[#FFF4E5]/60 border border-[#FF8500]/20"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{s.guardians[0].phone}</span>
                    </a>
                  </div>
                )}

                {/* Status & Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                    {s.status}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openManageEnrollments(s)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF4E5] hover:bg-[#FFE8CC] text-[#CC6B00] border border-[#FF8500]/30 rounded-lg text-xs font-bold transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>
                    {isPrivileged && (
                      <button
                        onClick={() => setStudentToDelete(s)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title={`Delete ${s.fullName}`}
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View (>= 768px): Name, 3-Digit Code, Class, Status, Action */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3.5 px-3 text-center w-12 font-mono">#</th>
                <th className="py-3.5 px-4 font-bold text-neutral-800">Name</th>
                <th className="py-3.5 px-4 text-center font-bold text-neutral-800">3-Digit Code</th>
                <th className="py-3.5 px-4 font-bold text-neutral-800">Class</th>
                <th className="py-3.5 px-4 text-center font-bold text-neutral-800">Status</th>
                <th className="py-3.5 px-4 text-right font-bold text-neutral-800">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                    Loading student directory...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    <p className="text-xs font-medium text-neutral-600">
                      {isPrivileged
                        ? 'No students found matching current filters.'
                        : 'No students assigned to your classes. You will see students once you are assigned to a course or batch.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-neutral-50/70 transition">
                    {/* Index */}
                    <td className="py-3 px-3 text-center font-mono text-xs text-neutral-400 font-semibold">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>

                    {/* Column 1: Name */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openManageEnrollments(s)}
                        className="text-left group cursor-pointer block"
                        title="View student profile & enrollments"
                      >
                        <div className="font-bold text-neutral-900 group-hover:text-[#FF8500] transition text-sm">
                          {s.fullName}
                        </div>
                        <div className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5 flex-wrap font-mono">
                          <span className="font-semibold text-neutral-700">{s.studentCode}</span>
                          <span>•</span>
                          <span>Adm: {s.admissionNumber}</span>
                          <span>•</span>
                          <span className="capitalize font-sans text-neutral-400">{s.gender.toLowerCase()}</span>
                        </div>
                        {s.schoolName && (
                          <div className="text-[11px] text-neutral-500 font-medium truncate max-w-[280px] flex items-center gap-1 mt-0.5" title={s.schoolName}>
                            <GraduationCap className="w-3 h-3 text-[#FF8500] shrink-0" />
                            <span>{s.schoolName}</span>
                          </div>
                        )}
                        {s.guardians && s.guardians.length > 0 && (
                          <div className="text-[11px] text-neutral-400 flex items-center gap-1 mt-0.5 truncate max-w-[280px]">
                            <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>{s.guardians[0].fullName} ({s.guardians[0].relationship}): {s.guardians[0].phone}</span>
                          </div>
                        )}
                      </button>
                    </td>

                    {/* Column 2: 3-Digit Code */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center">
                        {s.attendanceCode ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF4E5] border border-[#FF8500]/60 text-[#CC6B00] font-mono font-extrabold text-sm tracking-wider rounded-lg shadow-2xs"
                            title="Assigned 3-Digit Attendance Code (100–999)"
                          >
                            <QrCode className="w-3.5 h-3.5 text-[#FF8500]" />
                            <span>#{s.attendanceCode}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded font-mono">
                            ---
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Column 3: Class */}
                    <td className="py-3 px-4">
                      {s.enrollments && s.enrollments.length > 0 ? (
                        <div className="space-y-1">
                          {s.enrollments.map((en) => (
                            <div key={en.id} className="flex items-center gap-1.5 text-xs flex-wrap">
                              <span className="font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                                {en.className}
                              </span>
                              {en.subjectName && (
                                <span className="font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[11px]">
                                  {en.subjectName}
                                </span>
                              )}
                              <span className="text-[#FF8500] font-semibold text-xs">
                                {en.batchName}
                              </span>
                            </div>
                          ))}
                          {s.enrollments.length > 1 && (
                            <div className="pt-0.5">
                              <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                                {s.enrollments.length} Course Enrollments
                              </span>
                            </div>
                          )}
                        </div>
                      ) : s.currentBatch ? (
                        <div>
                          <div className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
                            <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-800 font-bold rounded">
                              {s.currentBatch.class?.name || 'Course'}
                            </span>
                            <span className="text-xs text-[#FF8500] font-medium">
                              {s.currentBatch.name}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">No class assigned</span>
                      )}
                    </td>

                    {/* Column 4: Status */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                          {s.status}
                        </span>
                      </div>
                    </td>

                    {/* Column 5: Action */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openManageEnrollments(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF4E5] hover:bg-[#FFE8CC] text-[#CC6B00] border border-[#FF8500]/30 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
                          title="View student profile & manage enrollments"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        {isPrivileged && (
                          <button
                            type="button"
                            onClick={() => setStudentToDelete(s)}
                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer"
                            title={`Delete student ${s.fullName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Button Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-neutral-50/90 border-t border-neutral-200 text-xs">
          <div className="flex items-center gap-2 text-neutral-600 font-medium">
            <span>
              Showing <strong className="text-black font-mono">{filteredStudents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
              <strong className="text-black font-mono">{(currentPage - 1) * pageSize + filteredStudents.length}</strong> of{' '}
              <strong className="text-black font-mono">{totalCount || filteredStudents.length}</strong> students
            </span>
            {pageSize === 100 && (
              <span className="px-2 py-0.5 rounded-full bg-orange-100 text-[#CC6B00] font-bold text-[10px]">
                100 / page
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {/* Dynamic Page Buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = Math.min(totalPages - 4 + i, Math.max(1, currentPage - 2 + i));
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg font-bold text-xs transition cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#FF8500] text-white shadow-xs'
                      : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span className="px-1 text-neutral-400 font-bold">...</span>
            )}

            <button
              type="button"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      </ResponsivePageContainer>

      {/* CODE GENERATION SUCCESS MODAL */}
      {showCreatedCodeModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreatedCodeModal(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-2xl max-w-sm w-full border-t sm:border border-neutral-200 shadow-2xl p-6 text-center animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="w-12 h-12 bg-[#FFF4E5] border border-[#FF8500] text-[#CC6B00] rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-[#FF8500]" />
            </div>

            <h2 className="text-lg font-bold text-black">Student Onboarded!</h2>
            <p className="text-xs text-neutral-500 mt-1">
              {showCreatedCodeModal.name} ({showCreatedCodeModal.studentCode})
            </p>

            <div className="my-5 p-4 bg-[#FFF4E5]/60 border-2 border-dashed border-[#FF8500] rounded-xl">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-neutral-600 mb-1">
                Generated Attendance Code
              </div>
              <div className="font-mono text-4xl font-extrabold text-[#CC6B00] tracking-widest">
                {showCreatedCodeModal.attendanceCode}
              </div>
              <div className="text-[10px] text-neutral-500 mt-2">
                Globally unique 3-digit student identifier (100–999).
              </div>
            </div>

            <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
              This 3-digit code is permanently assigned and used for quick scanning at the Smart Attendance Terminal.
            </p>

            <button
              onClick={() => setShowCreatedCodeModal(null)}
              className="w-full py-2.5 bg-[#FF8500] hover:bg-[#E67700] text-white font-semibold text-sm rounded-lg transition"
            >
              Done & View Directory
            </button>
          </div>
        </div>
      )}

      {/* EXPANDED MANUAL ONBOARDING MODAL WITH MULTI-COURSE ENROLLMENT */}
      {showManualModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowManualModal(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-2xl max-w-4xl lg:max-w-5xl w-full border-t sm:border border-neutral-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 my-0 sm:my-6 h-full sm:h-auto max-h-[95vh] sm:max-h-[92vh] flex flex-col"
          >
            {/* Native Mobile Drag Handle */}
            <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2 sm:hidden shrink-0" />
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4E5] border border-[#FF8500]/30 flex items-center justify-center text-[#FF8500]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-black text-base sm:text-lg flex items-center gap-2">
                    Student Admission & Multi-Course Allocation
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Register a new student and enroll them across multiple academic courses and cohorts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleManualSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0 overscroll-contain">
              {manualModalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{manualModalError}</span>
                </div>
              )}

              {/* Section 1: Personal Details */}
              <div>
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF8500]"></span>
                  1. Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Single Name Field (Mandatory) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aravind Kumar"
                      value={manualForm.name}
                      onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={manualForm.gender}
                      onChange={(e) => setManualForm({ ...manualForm, gender: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                {/* School Name & DOB */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-[#FF8500]" />
                        School / Institution Name
                      </span>
                      <span className="text-[10px] text-neutral-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. St. Joseph's Higher Secondary School"
                      value={manualForm.schoolName}
                      onChange={(e) => setManualForm({ ...manualForm, schoolName: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={manualForm.dob}
                      onChange={(e) => setManualForm({ ...manualForm, dob: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Course & Cohort Allocations (MULTI-COURSE) */}
              <div className="p-4 sm:p-5 bg-neutral-50/70 border border-neutral-200 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/80 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#FF8500]" />
                      2. Course & Cohort Allocations (Multi-Course Enrollment) <span className="text-rose-500">*</span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Students can be enrolled simultaneously in multiple courses (e.g., standard curricula & elective subjects).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addEnrollmentRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#FF8500]/40 text-[#CC6B00] hover:bg-[#FFF4E5] font-semibold text-xs rounded-lg shadow-2xs transition self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Course</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {manualForm.enrollments.map((enRow, idx) => {
                    const rowCourse = courses.find((c) => c.id === enRow.courseId);
                    return (
                      <div
                        key={idx}
                        className="bg-white p-3.5 border border-neutral-200 rounded-xl shadow-2xs flex flex-col md:flex-row md:items-center gap-3 transition hover:border-neutral-300"
                      >
                        <div className="flex items-center gap-2 min-w-[70px]">
                          <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-600 font-mono text-xs font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-medium text-neutral-500 md:hidden">Course Allocation</span>
                        </div>

                        {/* Course Dropdown */}
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Course / Standard <span className="text-rose-500">*</span>
                          </label>
                          <select
                            required
                            value={enRow.courseId}
                            onChange={(e) => updateEnrollmentRow(idx, 'courseId', e.target.value)}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white"
                          >
                            <option value="">Select course offering...</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.code}) - {c.category || 'ACADEMIC'}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Subject Dropdown (if course has subjects) */}
                        {rowCourse?.subjects && rowCourse.subjects.length > 0 && (
                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                              Subject (Optional / Specific)
                            </label>
                            <select
                              value={enRow.subjectId || ''}
                              onChange={(e) => updateEnrollmentRow(idx, 'subjectId', e.target.value)}
                              className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white"
                            >
                              <option value="">All Standard Subjects</option>
                              {rowCourse.subjects.map((sub) => (
                                <option key={sub.id} value={sub.id}>
                                  {sub.name} ({sub.code})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Batch Dropdown */}
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Cohort Batch <span className="text-rose-500">*</span>
                          </label>
                          <select
                            required
                            value={enRow.batchId}
                            disabled={!enRow.courseId}
                            onChange={(e) => updateEnrollmentRow(idx, 'batchId', e.target.value)}
                            className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white disabled:bg-neutral-100 disabled:text-neutral-400"
                          >
                            <option value="">
                              {enRow.courseId ? 'Select cohort batch...' : 'Select course first'}
                            </option>
                            {rowCourse?.batches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} {b.code ? `(${b.code})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Delete Row Button */}
                        <div className="flex items-center justify-end md:self-end md:mb-1">
                          {manualForm.enrollments.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeEnrollmentRow(idx)}
                              title="Remove this course enrollment"
                              className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="w-8" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Courses Summary Badges */}
                {validEnrollmentsCount > 0 && (
                  <div className="p-3 bg-white border border-neutral-200 rounded-lg flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mr-1">
                      Enrolling In:
                    </span>
                    {manualForm.enrollments
                      .filter((e) => e.courseId && e.batchId)
                      .map((en, i) => {
                        const crs = courses.find((c) => c.id === en.courseId);
                        const bch = crs?.batches.find((b) => b.id === en.batchId);
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#FFF4E5] border border-[#FF8500]/30 text-[#CC6B00] rounded-full text-xs font-medium"
                          >
                            <span className="font-bold">{crs?.name}</span>
                            <ArrowRight className="w-3 h-3 text-[#FF8500]" />
                            <span>{bch?.name}</span>
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Section 3: Contact Details */}
              <div>
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF8500]"></span>
                  3. Student Contact Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Student Email
                    </label>
                    <input
                      type="email"
                      placeholder="student@example.com"
                      value={manualForm.email}
                      onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={manualForm.phone}
                      onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Primary Guardian Details & Multiple Contacts */}
              <div className="p-4 sm:p-5 bg-neutral-50/70 border border-neutral-200 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/80 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#FF8500]" />
                      4. Primary Guardian Details & Contacts
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Enter the primary guardian (Father/Mother) and add secondary or emergency contacts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addGuardianRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#FF8500]/40 text-[#CC6B00] hover:bg-[#FFF4E5] font-semibold text-xs rounded-lg shadow-2xs transition self-start sm:self-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Contact</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {manualForm.guardians.map((gRow, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-3.5 border border-neutral-200 rounded-xl shadow-2xs flex flex-col md:flex-row md:items-center gap-3 transition hover:border-neutral-300"
                    >
                      <div className="flex items-center gap-2 min-w-[105px]">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            idx === 0
                              ? 'bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/30'
                              : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                          }`}
                        >
                          {idx === 0 ? 'Primary' : `#${idx + 1} Contact`}
                        </span>
                      </div>

                      {/* Guardian Full Name */}
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                          Full Name {idx === 0 && <span className="text-neutral-400 font-normal">(Primary)</span>}
                        </label>
                        <input
                          type="text"
                          placeholder={idx === 0 ? 'e.g. Rajesh Kumar' : 'e.g. Sunita Devi'}
                          value={gRow.fullName}
                          onChange={(e) => updateGuardianRow(idx, 'fullName', e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white"
                        />
                      </div>

                      {/* Relationship */}
                      <div className="w-full md:w-36">
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                          Relationship
                        </label>
                        <select
                          value={gRow.relationship}
                          onChange={(e) => updateGuardianRow(idx, 'relationship', e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white"
                        >
                          <option value="Father">Father</option>
                          <option value="Mother">Mother</option>
                          <option value="Guardian">Guardian</option>
                          <option value="Emergency Contact">Emergency</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Guardian Phone */}
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={gRow.phone}
                          onChange={(e) => updateGuardianRow(idx, 'phone', e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white"
                        />
                      </div>

                      {/* Guardian Email */}
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                          Email <span className="text-[10px] text-neutral-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          placeholder="guardian@example.com"
                          value={gRow.email}
                          onChange={(e) => updateGuardianRow(idx, 'email', e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white"
                        />
                      </div>

                      {/* Delete Row Button */}
                      <div className="flex items-center justify-end md:self-end md:mb-1">
                        {manualForm.guardians.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeGuardianRow(idx)}
                            title="Remove this contact"
                            className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Admission Payment & Advance */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#FF8500]" />
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Admission Payment & Advance
                    </h3>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-medium">
                    Optional advance collected at admission
                  </span>
                </div>

                <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    {/* Advance Amount */}
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Advance Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={manualForm.advanceAmount}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, advanceAmount: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white font-semibold text-neutral-900"
                        placeholder="₹0 (Default)"
                      />
                      <span className="text-[10px] text-neutral-400 mt-0.5 block">
                        Keep ₹0 if no advance is collected at admission.
                      </span>
                    </div>

                    {/* Payment Date */}
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Payment Date {parseFloat(manualForm.advanceAmount || '0') > 0 && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="date"
                        disabled={parseFloat(manualForm.advanceAmount || '0') <= 0}
                        value={manualForm.advancePaymentDate}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, advancePaymentDate: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white disabled:opacity-50 disabled:bg-neutral-100"
                      />
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Payment Method {parseFloat(manualForm.advanceAmount || '0') > 0 && <span className="text-rose-500">*</span>}
                      </label>
                      <select
                        disabled={parseFloat(manualForm.advanceAmount || '0') <= 0}
                        value={manualForm.advancePaymentMethod}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, advancePaymentMethod: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white disabled:opacity-50 disabled:bg-neutral-100"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHEQUE">Cheque</option>
                      </select>
                    </div>

                    {/* Transaction Reference */}
                    <div className="sm:col-span-1 md:col-span-2">
                      <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Transaction Reference <span className="text-[10px] text-neutral-400 font-normal">(Optional for UPI / Bank Transfer)</span>
                      </label>
                      <input
                        type="text"
                        disabled={parseFloat(manualForm.advanceAmount || '0') <= 0}
                        value={manualForm.advanceReference}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, advanceReference: e.target.value })
                        }
                        placeholder="e.g. UPI Ref / Bank UTR / Cheque #"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white disabled:opacity-50 disabled:bg-neutral-100"
                      />
                    </div>

                    {/* Payment Notes */}
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Payment Notes <span className="text-[10px] text-neutral-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        disabled={parseFloat(manualForm.advanceAmount || '0') <= 0}
                        value={manualForm.advanceNotes}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, advanceNotes: e.target.value })
                        }
                        placeholder="e.g. Admission advance"
                        className="w-full px-3 py-2 text-xs sm:text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white disabled:opacity-50 disabled:bg-neutral-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Sticky above mobile safe area) */}
              <div className="sticky bottom-0 bg-white border-t border-neutral-100 p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] z-10">
                <div className="text-xs">
                  {manualModalError ? (
                    <span className="text-rose-600 font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                      {manualModalError}
                    </span>
                  ) : validEnrollmentsCount > 0 ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {validEnrollmentsCount} course{validEnrollmentsCount > 1 ? 's' : ''} ready to enroll
                    </span>
                  ) : (
                    <span className="text-neutral-400">At least 1 course and batch required</span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManualModal(false)}
                    className="px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingManual}
                    className="px-5 py-2.5 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition shadow-subtle disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {submittingManual ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Enrolling Student...</span>
                      </>
                    ) : (
                      <span>
                        Register & Enroll {validEnrollmentsCount > 1 ? `(${validEnrollmentsCount} Courses)` : 'Student'}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK ONBOARDING MODAL */}
      {showBulkModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBulkModal(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-xl max-w-4xl w-full border-t sm:border border-neutral-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 my-0 sm:my-6 max-h-[95vh] sm:max-h-[92vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-black text-base flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#FF8500]" />
                  Bulk Student Onboarding via Excel / CSV
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Import academy spreadsheets, resolve subjects (Science;Maths / All Subjects), and auto-allocate random 3-digit attendance codes.
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-neutral-400 hover:text-black p-1 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 min-h-0 overscroll-contain">
              {/* Step 1: Upload */}
              {bulkStep === 'UPLOAD' && (
                <div className="space-y-4">
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-black text-sm">Download Actual Academy CSV Template</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Matches official academy headers: Name, School Name, Date of Birth, Father/Mother details, Board, and Subjects.
                      </p>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="px-3 py-1.5 bg-white border border-neutral-300 hover:border-[#FF8500] text-neutral-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#FF8500]" />
                      <span>Template</span>
                    </button>
                  </div>

                  {/* Target Cohort Pre-Selection */}
                  <div className="p-4 bg-orange-50/40 border border-orange-200/80 rounded-xl space-y-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-[#FF8500]" />
                      <h4 className="font-semibold text-neutral-900 text-xs uppercase tracking-wider">
                        Cohort Destination (Target Course & Batch)
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Target Academic Course *
                        </label>
                        <select
                          value={bulkTargetCourseId}
                          onChange={(e) => {
                            const cId = e.target.value;
                            setBulkTargetCourseId(cId);
                            const sel = courses.find((c) => c.id === cId);
                            if (sel && sel.batches && sel.batches.length > 0) {
                              setBulkTargetBatchId(sel.batches[0].id);
                            } else {
                              setBulkTargetBatchId('');
                            }
                          }}
                          className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        >
                          <option value="">-- Select Course (e.g. 10th Standard) --</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-1">
                          Target Batch *
                        </label>
                        <select
                          value={bulkTargetBatchId}
                          onChange={(e) => setBulkTargetBatchId(e.target.value)}
                          disabled={!bulkTargetCourseId}
                          className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] disabled:bg-neutral-100 disabled:text-neutral-400"
                        >
                          <option value="">-- Select Batch / Section --</option>
                          {courses
                            .find((c) => c.id === bulkTargetCourseId)
                            ?.batches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name} {b.code ? `(${b.code})` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-2">
                      Upload Completed CSV File
                    </label>
                    <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center hover:border-[#FF8500] transition bg-neutral-50/50">
                      <Upload className="w-8 h-8 text-[#FF8500] mx-auto mb-2" />
                      <p className="text-xs text-neutral-600 font-medium">
                        Drag and drop your file here, or{' '}
                        <label className="text-[#FF8500] cursor-pointer hover:underline">
                          browse
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Accepts standard academy spreadsheets with quoted commas and multiline addresses
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Or Paste CSV Content
                    </label>
                    <textarea
                      rows={5}
                      value={csvContent}
                      onChange={(e) => setCsvContent(e.target.value)}
                      placeholder="Date of joining,Name,Name of the School,Date of Birth,Father's Name,Father's Mobile Number..."
                      className="w-full px-3 py-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setShowBulkModal(false)}
                      className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={bulkLoading || !csvContent.trim()}
                      onClick={() => handleProcessRawCsv(csvContent)}
                      className="px-4 py-2 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      <span>Connect Columns & Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Connect CSV Columns (Interactive Column Mapping) */}
              {bulkStep === 'MAP_COLUMNS' && (
                <div className="space-y-5 animate-in fade-in-50 duration-200">
                  {/* Step Progress Header */}
                  <div className="flex items-center justify-between p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FFF4E5] text-[#FF8500] flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-[#FF8500]" />
                          Connect CSV Columns to Fields
                        </h4>
                        <p className="text-xs text-neutral-500">
                          Match your spreadsheet headers. <strong>Name</strong> and <strong>Class</strong> are the only mandatory requirements.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono bg-white border border-neutral-200 px-2.5 py-1 rounded-md text-neutral-600 font-semibold">
                      {csvRawDataRows.length} Rows Detected
                    </span>
                  </div>

                  {/* Mandatory Requirement Note */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Required &amp; Multi-Subject Rules:</span>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-amber-800">
                        <li><strong>Student Name</strong> and <strong>Class</strong> are the only mandatory fields.</li>
                        <li><strong>Subjects</strong>: Enter multiple subjects separated by semicolons (e.g. <code>Chemistry;Maths</code>) or commas. Missing subjects will be auto-provisioned!</li>
                        <li><strong>DOB &amp; Gender</strong>: Optional. If omitted, safe standard defaults are automatically assigned.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Cohort Course & Batch Assignment Mode */}
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-[#FF8500]" />
                        Class / Course Destination *
                      </label>
                      <div className="flex items-center gap-4 text-xs">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="classSource"
                            checked={!useClassColumn}
                            onChange={() => setUseClassColumn(false)}
                            className="text-[#FF8500] focus:ring-[#FF8500]"
                          />
                          <span className="font-medium text-neutral-700">Select One Class for All</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="classSource"
                            checked={useClassColumn}
                            onChange={() => setUseClassColumn(true)}
                            className="text-[#FF8500] focus:ring-[#FF8500]"
                          />
                          <span className="font-medium text-neutral-700">Map from CSV Column</span>
                        </label>
                      </div>
                    </div>

                    {!useClassColumn ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Target Academic Course (Mandatory)
                          </label>
                          <select
                            value={bulkTargetCourseId}
                            onChange={(e) => {
                              const cId = e.target.value;
                              setBulkTargetCourseId(cId);
                              const sel = courses.find((c) => c.id === cId);
                              if (sel && sel.batches && sel.batches.length > 0) {
                                setBulkTargetBatchId(sel.batches[0].id);
                              } else {
                                setBulkTargetBatchId('');
                              }
                            }}
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          >
                            <option value="">-- Choose Course (e.g. 10th Standard) --</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.code})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Target Batch (Optional - defaults to Section A)
                          </label>
                          <select
                            value={bulkTargetBatchId}
                            onChange={(e) => setBulkTargetBatchId(e.target.value)}
                            disabled={!bulkTargetCourseId}
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] disabled:bg-neutral-100"
                          >
                            <option value="">-- Auto-Assign Default Batch --</option>
                            {courses
                              .find((c) => c.id === bulkTargetCourseId)
                              ?.batches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} {b.code ? `(${b.code})` : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Connect Class / Course Column *
                          </label>
                          <select
                            value={columnMapping.courseCode}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, courseCode: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          >
                            <option value="">-- Select CSV Header for Class --</option>
                            {csvRawHeaders.map((h) => (
                              <option key={h} value={h}>
                                Column: {h}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                            Fallback Course (if row column is empty)
                          </label>
                          <select
                            value={bulkTargetCourseId}
                            onChange={(e) => setBulkTargetCourseId(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          >
                            <option value="">-- Optional Fallback Course --</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Core Column Connections */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Field Connectors
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Student Name */}
                      <div className="p-3.5 bg-white border-2 border-orange-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#FF8500]"></span>
                            Student Name * (Mandatory)
                          </label>
                          <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-semibold uppercase">
                            Required
                          </span>
                        </div>
                        <select
                          value={columnMapping.rawName}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, rawName: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] font-medium"
                        >
                          <option value="">-- Select CSV Column for Name --</option>
                          {csvRawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        {columnMapping.rawName && (
                          <div className="text-[11px] text-neutral-500 font-mono truncate">
                            Row 1 Sample: &quot;{csvRawDataRows[0]?.[csvRawHeaders.indexOf(columnMapping.rawName)] || '-'}&quot;
                          </div>
                        )}
                      </div>

                      {/* Subjects */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-[#FF8500]" />
                            Subjects (e.g. Chemistry;Maths)
                          </label>
                          <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-medium">
                            Auto-split
                          </span>
                        </div>
                        <select
                          value={columnMapping.subjects}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, subjects: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        >
                          <option value="">-- (Optional) Select Subjects Column --</option>
                          {csvRawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                        {columnMapping.subjects && (
                          <div className="text-[11px] text-neutral-500 font-mono truncate">
                            Row 1 Sample: &quot;{csvRawDataRows[0]?.[csvRawHeaders.indexOf(columnMapping.subjects)] || '-'}&quot;
                          </div>
                        )}
                      </div>

                      {/* Batch */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-neutral-800">
                            Batch / Section (Optional)
                          </label>
                          <span className="text-[10px] text-neutral-400">Default: Section A</span>
                        </div>
                        <select
                          value={columnMapping.batchCode}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, batchCode: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        >
                          <option value="">-- (Optional) Select Batch Column --</option>
                          {csvRawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Date of Birth */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-neutral-800">
                            Date of Birth (Optional)
                          </label>
                          <span className="text-[10px] text-neutral-400">Auto-defaults</span>
                        </div>
                        <select
                          value={columnMapping.dob}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, dob: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        >
                          <option value="">-- (Optional) Select DOB Column --</option>
                          {csvRawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Gender */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-neutral-800">
                            Gender (Optional)
                          </label>
                          <span className="text-[10px] text-neutral-400">Defaults to OTHER</span>
                        </div>
                        <select
                          value={columnMapping.gender}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, gender: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        >
                          <option value="">-- (Optional) Select Gender Column --</option>
                          {csvRawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Student Mobile */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <label className="block text-xs font-semibold text-neutral-800">
                          Student Phone Number (Optional)
                        </label>
                        <select
                          value={columnMapping.phone}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, phone: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        >
                          <option value="">-- (Optional) Select Phone Column --</option>
                          {csvRawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Student Email */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <label className="block text-xs font-semibold text-neutral-800">
                          Student Email (Optional)
                        </label>
                        <select
                          value={columnMapping.email}
                          onChange={(e) =>
                            setColumnMapping({ ...columnMapping, email: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                        >
                          <option value="">-- (Optional) Select Email Column --</option>
                          {csvRawHeaders.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Father Contact */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <label className="block text-xs font-semibold text-neutral-800">
                          Father&apos;s Name &amp; Mobile (Optional)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={columnMapping.fatherName}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, fatherName: e.target.value })
                            }
                            className="w-full px-2 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none"
                          >
                            <option value="">Father Name Col</option>
                            {csvRawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          <select
                            value={columnMapping.fatherPhone}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, fatherPhone: e.target.value })
                            }
                            className="w-full px-2 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none"
                          >
                            <option value="">Father Mobile Col</option>
                            {csvRawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Mother Contact */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <label className="block text-xs font-semibold text-neutral-800">
                          Mother&apos;s Name &amp; Mobile (Optional)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={columnMapping.motherName}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, motherName: e.target.value })
                            }
                            className="w-full px-2 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none"
                          >
                            <option value="">Mother Name Col</option>
                            {csvRawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          <select
                            value={columnMapping.motherPhone}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, motherPhone: e.target.value })
                            }
                            className="w-full px-2 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none"
                          >
                            <option value="">Mother Mobile Col</option>
                            {csvRawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* School & Board */}
                      <div className="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1.5">
                        <label className="block text-xs font-semibold text-neutral-800">
                          School Name &amp; Board (Optional)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={columnMapping.schoolName}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, schoolName: e.target.value })
                            }
                            className="w-full px-2 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none"
                          >
                            <option value="">School Name Col</option>
                            {csvRawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          <select
                            value={columnMapping.academicBoard}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, academicBoard: e.target.value })
                            }
                            className="w-full px-2 py-1.5 text-xs bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none"
                          >
                            <option value="">Board Col</option>
                            {csvRawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Sample Preview Table */}
                  <div className="border border-neutral-200 rounded-xl p-3.5 bg-neutral-50/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-[#FF8500]" />
                        Live Connection Preview (First 3 Rows)
                      </span>
                      <span className="text-neutral-500">Previewing mapped columns</span>
                    </div>

                    <div className="bg-white border border-neutral-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase text-[10px]">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Candidate Name</th>
                            <th className="py-2 px-3">Class / Batch</th>
                            <th className="py-2 px-3">Subjects Breakdown</th>
                            <th className="py-2 px-3">Sample Contact</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {csvRawDataRows.slice(0, 3).map((r, idx) => {
                            const nameIdx = csvRawHeaders.indexOf(columnMapping.rawName);
                            const nameVal = nameIdx !== -1 ? r[nameIdx] : '—';
                            const subIdx = csvRawHeaders.indexOf(columnMapping.subjects);
                            const subVal = subIdx !== -1 ? r[subIdx] : '';
                            const classIdx = csvRawHeaders.indexOf(columnMapping.courseCode);
                            const classVal = useClassColumn && classIdx !== -1 ? r[classIdx] : (courses.find((c) => c.id === bulkTargetCourseId)?.name || 'Default Course');
                            const phoneIdx = csvRawHeaders.indexOf(columnMapping.phone);
                            const phoneVal = phoneIdx !== -1 ? r[phoneIdx] : '—';

                            // Split subjects by semicolon or comma
                            const subPills = subVal ? subVal.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [];

                            return (
                              <tr key={idx} className="hover:bg-neutral-50">
                                <td className="py-2 px-3 font-mono text-neutral-400">{idx + 1}</td>
                                <td className="py-2 px-3 font-semibold text-neutral-900">
                                  {nameVal || <span className="text-rose-500 italic">Missing Name</span>}
                                </td>
                                <td className="py-2 px-3 text-neutral-700">
                                  <span className="font-medium">{classVal || 'Default Cohort'}</span>
                                </td>
                                <td className="py-2 px-3">
                                  {subPills.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {subPills.map((p, pIdx) => (
                                        <span
                                          key={pIdx}
                                          className="px-1.5 py-0.5 rounded text-[10px] bg-orange-50 border border-orange-200 text-orange-900 font-semibold"
                                        >
                                          {p}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-neutral-400 italic">None specified</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-neutral-600 font-mono text-[11px]">
                                  {phoneVal || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setBulkStep('UPLOAD')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Upload</span>
                    </button>

                    <button
                      type="button"
                      disabled={bulkLoading || !columnMapping.rawName}
                      onClick={handleValidateMappedCsv}
                      className="px-4 py-2 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      {bulkLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>
                        {bulkLoading
                          ? 'Validating Rows...'
                          : `Confirm Mapping & Validate ${csvRawDataRows.length} Rows`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Preview & Validation Table */}
              {bulkStep === 'PREVIEW' && validationReport && (
                <div className="space-y-4">
                  {/* Summary counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                      <div className="text-[11px] font-semibold text-neutral-500 uppercase">Total Rows</div>
                      <div className="text-xl font-bold text-black mt-0.5">{validationReport.totalRows}</div>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="text-[11px] font-semibold text-emerald-700 uppercase">Ready to Import</div>
                      <div className="text-xl font-bold text-emerald-800 mt-0.5">{validationReport.validCount}</div>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                      <div className="text-[11px] font-semibold text-rose-700 uppercase">Needs Action</div>
                      <div className="text-xl font-bold text-rose-800 mt-0.5">{validationReport.invalidCount}</div>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="text-[11px] font-semibold text-amber-700 uppercase">Warnings</div>
                      <div className="text-xl font-bold text-amber-800 mt-0.5">{validationReport.warningCount || 0}</div>
                    </div>
                  </div>

                  {/* Batch Gender Setter Helper (Excel sheet has no gender column) */}
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-neutral-700">
                      <AlertCircle className="w-4 h-4 text-[#FF8500]" />
                      <span>The academy spreadsheet has no Gender column. Quickly assign missing gender:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={bulkBatchGender}
                        onChange={(e: any) => setBulkBatchGender(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-white border border-neutral-300 rounded focus:outline-none"
                      >
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleBatchSetGender(bulkBatchGender)}
                        disabled={bulkLoading}
                        className="px-3 py-1 bg-[#FF8500] hover:bg-[#E67700] text-white font-semibold rounded transition cursor-pointer"
                      >
                        Apply to Missing
                      </button>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-2 border-b border-neutral-200 pb-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setBulkFilterTab('ALL')}
                      className={`px-3 py-1.5 font-medium rounded-lg transition cursor-pointer ${
                        bulkFilterTab === 'ALL'
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      All Rows ({validationReport.totalRows})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkFilterTab('INVALID')}
                      className={`px-3 py-1.5 font-medium rounded-lg transition cursor-pointer ${
                        bulkFilterTab === 'INVALID'
                          ? 'bg-rose-700 text-white'
                          : 'text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      Action Required ({validationReport.invalidCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkFilterTab('VALID')}
                      className={`px-3 py-1.5 font-medium rounded-lg transition cursor-pointer ${
                        bulkFilterTab === 'VALID'
                          ? 'bg-emerald-700 text-white'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      Ready ({validationReport.validCount})
                    </button>
                  </div>

                  {/* Row by row table */}
                  <div className="border border-neutral-200 rounded-lg max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 text-[10px] text-neutral-500 uppercase">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Candidate & School</th>
                          <th className="py-2.5 px-3">DOB & Gender</th>
                          <th className="py-2.5 px-3">Cohort & Subjects</th>
                          <th className="py-2.5 px-3">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {validationReport.rows
                          .filter((vr: any) => {
                            if (bulkFilterTab === 'INVALID') return !vr.isValid;
                            if (bulkFilterTab === 'VALID') return vr.isValid;
                            return true;
                          })
                          .map((vr: any) => (
                            <tr key={vr.rowIndex} className={vr.isValid ? 'bg-white hover:bg-neutral-50/50' : 'bg-rose-50/30'}>
                              <td className="py-2.5 px-3 font-mono font-medium text-neutral-500">{vr.rowIndex}</td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-black">
                                    {vr.data.firstName} {vr.data.lastName}
                                  </span>
                                  {vr.isNameAmbiguous && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium">
                                      Split Review
                                    </span>
                                  )}
                                </div>
                                {vr.data.schoolName && (
                                  <div className="text-[10px] text-neutral-500 font-medium flex items-center gap-1 mt-0.5">
                                    <GraduationCap className="w-3 h-3 text-[#FF8500]" />
                                    <span>{vr.data.schoolName}</span>
                                  </div>
                                )}
                                {vr.data.fatherName && (
                                  <div className="text-[10px] text-neutral-400 mt-0.5">
                                    Father: {vr.data.fatherName} ({vr.data.fatherPhone || 'No Phone'})
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-mono text-neutral-700">{vr.data.dob || 'Missing DOB'}</div>
                                <div className="mt-1">
                                  <select
                                    value={vr.data.gender || ''}
                                    onChange={(e) => handleUpdateRowField(vr.rowIndex, 'gender', e.target.value)}
                                    className={`px-1.5 py-0.5 text-[11px] rounded border ${
                                      vr.data.gender
                                        ? 'bg-neutral-50 border-neutral-300 text-neutral-800'
                                        : 'bg-rose-100 border-rose-300 text-rose-800 font-semibold'
                                    }`}
                                  >
                                    <option value="">Select Gender</option>
                                    <option value="MALE">MALE</option>
                                    <option value="FEMALE">FEMALE</option>
                                    <option value="OTHER">OTHER</option>
                                  </select>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div>
                                  <span className="font-semibold">{vr.resolvedCourseName || vr.data.courseCode || 'No Course'}</span>
                                  <div className="text-[10px] text-[#FF8500] font-medium">
                                    {vr.resolvedBatchName || vr.data.batchCode || 'No Batch'}
                                  </div>
                                </div>
                                {vr.resolvedSubjectNames && vr.resolvedSubjectNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {vr.resolvedSubjectNames.map((sName: string, sIdx: number) => (
                                      <span
                                        key={sIdx}
                                        className="text-[10px] bg-neutral-100 border border-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded"
                                      >
                                        {sName}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-neutral-400 mt-0.5 italic">
                                    {vr.data.subjects ? `Subjects: ${vr.data.subjects}` : 'Course Cohort'}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                {vr.isValid ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      Ready
                                    </span>
                                    {vr.warnings && vr.warnings.length > 0 && (
                                      <div className="mt-1 space-y-0.5">
                                        {vr.warnings.map((w: string, i: number) => (
                                          <div key={i} className="text-[10px] text-amber-700 flex items-center gap-1">
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                            <span>{w}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-0.5">
                                    {vr.errors.map((err: string, i: number) => (
                                      <div key={i} className="text-[11px] text-rose-700 flex items-center gap-1">
                                        <X className="w-3 h-3 text-rose-600 shrink-0" />
                                        <span>{err}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setBulkStep(csvRawHeaders.length > 0 ? 'MAP_COLUMNS' : 'UPLOAD')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{csvRawHeaders.length > 0 ? 'Back to Column Mapping' : 'Back to Upload'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {validationReport.invalidCount > 0 && (
                        <button
                          type="button"
                          onClick={handleDownloadRejectedCsv}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold rounded-lg border border-rose-200 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-rose-700" />
                          <span>Download Rejected Rows (CSV)</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={bulkLoading || validationReport.validCount === 0}
                        onClick={handleExecuteBulkImport}
                        className="px-4 py-2 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                      >
                        {bulkLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                        <span>
                          {bulkLoading
                            ? 'Importing...'
                            : `Confirm & Import ${validationReport.validCount} Students`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Final Report */}
              {bulkStep === 'REPORT' && importSummary && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                    <h3 className="font-bold text-emerald-900 text-base">Bulk Student Import Complete</h3>
                    <p className="text-xs text-emerald-700 mt-1">
                      Successfully onboarded <strong>{importSummary.summary.created}</strong> students with unique 3-digit attendance codes.
                      {importSummary.summary.skipped > 0 && (
                        <span className="block mt-0.5 text-neutral-600">
                          ({importSummary.summary.skipped} skipped or idempotent duplicates; {importSummary.summary.failed} errors)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                      <div className="text-[11px] font-semibold text-neutral-500 uppercase">Created</div>
                      <div className="text-xl font-bold text-emerald-700 mt-0.5">{importSummary.summary.created}</div>
                    </div>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                      <div className="text-[11px] font-semibold text-neutral-500 uppercase">Skipped</div>
                      <div className="text-xl font-bold text-neutral-700 mt-0.5">{importSummary.summary.skipped}</div>
                    </div>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                      <div className="text-[11px] font-semibold text-neutral-500 uppercase">Failed</div>
                      <div className="text-xl font-bold text-rose-700 mt-0.5">{importSummary.summary.failed}</div>
                    </div>
                  </div>

                  {/* If there are failed or skipped rows */}
                  {importSummary.failedRows && importSummary.failedRows.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-rose-50/70 border border-rose-200 rounded-lg">
                      <div className="text-xs text-rose-900 font-medium">
                        {importSummary.failedRows.length} rows were skipped or failed database admission.
                      </div>
                      <button
                        type="button"
                        onClick={handleDownloadImportErrorsCsv}
                        className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-800 text-xs font-semibold rounded border border-rose-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-rose-700" />
                        <span>Export Skipped / Errors</span>
                      </button>
                    </div>
                  )}

                  <div className="border border-neutral-200 rounded-lg max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 text-[10px] text-neutral-500 uppercase">
                        <tr>
                          <th className="py-2 px-3">Student Name</th>
                          <th className="py-2 px-3">Student ID</th>
                          <th className="py-2 px-3 text-center">Attendance Code</th>
                          <th className="py-2 px-3">Cohort & Subjects</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {importSummary.createdStudents.map((cs: any) => (
                          <tr key={cs.id}>
                            <td className="py-2 px-3 font-semibold text-black">{cs.name}</td>
                            <td className="py-2 px-3 font-mono text-neutral-600">{cs.studentCode}</td>
                            <td className="py-2 px-3 text-center">
                              <span className="font-mono font-bold text-xs px-2.5 py-0.5 bg-[#FFF4E5] border border-[#FF8500] text-[#CC6B00] rounded">
                                {cs.attendanceCode}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-neutral-600">
                              <span className="font-medium">{cs.course}</span> ({cs.batch})
                              <div className="text-[10px] text-neutral-500">{cs.subjects}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => setShowBulkModal(false)}
                    className="w-full py-2.5 bg-[#FF8500] hover:bg-[#E67700] text-white font-semibold text-sm rounded-lg transition cursor-pointer"
                  >
                    Close & Refresh Directory
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MANAGE ENROLLMENTS MODAL */}
      {selectedStudentForEnrollments && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedStudentForEnrollments(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-50 bg-white rounded-t-2xl sm:rounded-2xl max-w-4xl lg:max-w-5xl w-full max-h-[92vh] sm:h-auto flex flex-col border-t sm:border border-neutral-200 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 overflow-hidden my-auto"
          >
            {/* Header: Student Profile Summary Banner */}
            <div className="p-5 border-b border-neutral-100 flex flex-col gap-4 bg-gradient-to-b from-neutral-50/70 to-white shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#FFF4E5] border border-[#FF8500]/30 flex items-center justify-center text-[#CC6B00] font-bold text-lg shadow-xs">
                    {selectedStudentForEnrollments.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg font-bold text-black tracking-tight">
                        {selectedStudentForEnrollments.fullName}
                      </h2>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedStudentForEnrollments.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : selectedStudentForEnrollments.status === 'SUSPENDED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : selectedStudentForEnrollments.status === 'GRADUATED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                        }`}
                      >
                        {selectedStudentForEnrollments.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-neutral-500 font-mono flex-wrap">
                      <span className="font-semibold text-neutral-800">{selectedStudentForEnrollments.studentCode}</span>
                      <span>•</span>
                      <span>Adm #{selectedStudentForEnrollments.admissionNumber}</span>
                      <span>•</span>
                      <span className="capitalize font-sans font-medium text-neutral-600">
                        {selectedStudentForEnrollments.gender?.toLowerCase() || 'student'}
                      </span>
                      {selectedStudentForEnrollments.dob && (
                        <>
                          <span>•</span>
                          <span className="font-sans text-neutral-500">
                            DOB: {new Date(selectedStudentForEnrollments.dob).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {selectedStudentForEnrollments.attendanceCode && (
                    <div className="hidden sm:flex flex-col items-end px-3 py-1.5 rounded-xl bg-[#FFF4E5] border border-[#FF8500]/30 shadow-2xs">
                      <div className="text-[10px] uppercase font-bold text-[#CC6B00] flex items-center gap-1">
                        <QrCode className="w-3 h-3 text-[#FF8500]" />
                        Attendance Code
                      </div>
                      <div className="font-mono text-xl font-extrabold text-[#CC6B00]">
                        #{selectedStudentForEnrollments.attendanceCode}
                      </div>
                    </div>
                  )}

                  {isPrivileged && (
                    <button
                      type="button"
                      onClick={() => {
                        setSingleViewTab(singleViewTab === 'edit' ? 'details' : 'edit');
                        setEditModalError(null);
                        setEditModalSuccess(null);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                        singleViewTab === 'edit'
                          ? 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                          : 'bg-[#FFF4E5] text-[#CC6B00] border-[#FF8500]/30 hover:bg-[#FFE8CC]'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{singleViewTab === 'edit' ? 'View Details' : 'Edit Profile'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedStudentForEnrollments(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-1 px-5 border-b border-neutral-200 bg-neutral-50/70 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setSingleViewTab('details')}
                className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  singleViewTab === 'details'
                    ? 'border-[#FF8500] text-[#CC6B00] bg-white rounded-t-lg shadow-2xs font-bold'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All Details</span>
              </button>

              {isPrivileged && (
                <button
                  type="button"
                  onClick={() => {
                    setSingleViewTab('edit');
                    setEditModalError(null);
                    setEditModalSuccess(null);
                  }}
                  className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 ${
                    singleViewTab === 'edit'
                      ? 'border-[#FF8500] text-[#CC6B00] bg-white rounded-t-lg shadow-2xs font-bold'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Profile & Guardians</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSingleViewTab('enrollments')}
                className={`py-3 px-3.5 text-xs font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 ${
                  singleViewTab === 'enrollments'
                    ? 'border-[#FF8500] text-[#CC6B00] bg-white rounded-t-lg shadow-2xs font-bold'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>
                  Courses & Enrollments (
                  {(enrollmentsData?.active || enrollmentsData?.activeEnrollments || []).length}
                  )
                </span>
              </button>
            </div>

            {/* TAB CONTENT CONTAINER */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 min-h-0 overscroll-contain">
              {/* TAB 1: ALL DETAILS VIEW */}
              {singleViewTab === 'details' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Top Action Info Banner */}
                  <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-200/60 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs text-amber-900">
                      <CheckCircle2 className="w-4 h-4 text-[#FF8500] shrink-0" />
                      <span>
                        Viewing complete student profile. You can edit any details or add guardians by clicking <strong>Edit Profile</strong>.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSingleViewTab('edit');
                        setEditModalError(null);
                        setEditModalSuccess(null);
                      }}
                      className="px-3 py-1.5 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-semibold rounded-lg shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Profile</span>
                    </button>
                  </div>

                  {/* 2-Column Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card 1: Personal Details */}
                    <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-3">
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                        <User className="w-3.5 h-3.5 text-[#FF8500]" />
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-neutral-400 block text-[11px]">Full Name</span>
                          <span className="font-semibold text-neutral-800">{selectedStudentForEnrollments.fullName}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[11px]">Account Status</span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                              selectedStudentForEnrollments.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : selectedStudentForEnrollments.status === 'SUSPENDED'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : selectedStudentForEnrollments.status === 'GRADUATED'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {selectedStudentForEnrollments.status}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[11px]">Gender</span>
                          <span className="font-medium text-neutral-800 capitalize">
                            {selectedStudentForEnrollments.gender?.toLowerCase() || 'Not specified'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[11px]">Date of Birth</span>
                          <span className="font-medium text-neutral-800">
                            {selectedStudentForEnrollments.dob
                              ? new Date(selectedStudentForEnrollments.dob).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'Not recorded'}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-neutral-100">
                          <span className="text-neutral-400 block text-[11px] flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5 text-[#FF8500]" />
                            School / Institution Name
                          </span>
                          <span className="font-medium text-neutral-800">
                            {selectedStudentForEnrollments.schoolName || 'Not specified'}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-neutral-100">
                          <span className="text-neutral-400 block text-[11px] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-neutral-400" />
                            Residential Address
                          </span>
                          <span className="font-medium text-neutral-700">
                            {(selectedStudentForEnrollments as any).address || 'No physical address recorded'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Identifiers & Codes */}
                    <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-3">
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                        <QrCode className="w-3.5 h-3.5 text-[#FF8500]" />
                        Official Academy Identifiers
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-neutral-400 block text-[11px]">Student Code</span>
                          <span className="font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded inline-block mt-0.5">
                            {selectedStudentForEnrollments.studentCode}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[11px]">Admission Number</span>
                          <span className="font-mono font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded inline-block mt-0.5">
                            {selectedStudentForEnrollments.admissionNumber}
                          </span>
                        </div>
                        <div className="col-span-2 p-2.5 bg-[#FFF4E5]/60 border border-[#FF8500]/25 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#CC6B00] block">
                              3-Digit Terminal Check-In Code
                            </span>
                            <span className="text-[11px] text-neutral-600">
                              Permanent code used for student kiosk attendance verification.
                            </span>
                          </div>
                          <span className="font-mono text-2xl font-black text-[#CC6B00]">
                            #{selectedStudentForEnrollments.attendanceCode || '---'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Contact Details */}
                    <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-3">
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                        <Phone className="w-3.5 h-3.5 text-[#FF8500]" />
                        Direct Contact Details
                      </h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-neutral-700">
                          <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          {selectedStudentForEnrollments.phone ? (
                            <a
                              href={`tel:${selectedStudentForEnrollments.phone}`}
                              className="font-medium text-[#CC6B00] hover:underline"
                            >
                              {selectedStudentForEnrollments.phone}
                            </a>
                          ) : (
                            <span className="text-neutral-400 italic">No student phone recorded</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-neutral-700">
                          <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          {selectedStudentForEnrollments.email ? (
                            <a
                              href={`mailto:${selectedStudentForEnrollments.email}`}
                              className="font-medium text-[#CC6B00] hover:underline"
                            >
                              {selectedStudentForEnrollments.email}
                            </a>
                          ) : (
                            <span className="text-neutral-400 italic">No student email registered</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Guardians & Contacts */}
                    <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-[#FF8500]" />
                          Guardians & Emergency Contacts
                        </h3>
                        <span className="text-[11px] font-semibold text-neutral-400">
                          {extractGuardians(selectedStudentForEnrollments.guardians).length} Contact(s)
                        </span>
                      </div>

                      {extractGuardians(selectedStudentForEnrollments.guardians).length === 0 ? (
                        <p className="text-xs text-neutral-400 italic p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                          No guardian contacts registered. Click Edit Profile to add one.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {extractGuardians(selectedStudentForEnrollments.guardians).map((g, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 bg-neutral-50 border border-neutral-200/80 rounded-lg text-xs flex items-center justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-neutral-900">{g.fullName}</span>
                                  <span className="px-1.5 py-0.5 bg-neutral-200/80 text-neutral-700 text-[10px] font-medium rounded">
                                    {g.relationship}
                                  </span>
                                  {idx === 0 && (
                                    <span className="px-1.5 py-0.5 bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/30 text-[9px] font-bold rounded">
                                      PRIMARY
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-2 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-neutral-400" />
                                    <a href={`tel:${g.phone}`} className="hover:text-[#CC6B00]">
                                      {g.phone}
                                    </a>
                                  </span>
                                  {g.email && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-neutral-400" />
                                        <a href={`mailto:${g.email}`} className="hover:text-[#CC6B00]">
                                          {g.email}
                                        </a>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 4B: Student Advance Balance & Allocation */}
                  <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-[#FF8500]" />
                        Student Advance Balance & Settlement
                      </h3>
                      {isPrivileged && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSingleViewTab('edit');
                              setTimeout(() => {
                                const el = document.getElementById('record-advance-section');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }, 100);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#CC6B00] bg-[#FFF4E5] hover:bg-[#FFE8CC] border border-[#FF8500]/30 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Record Advance</span>
                          </button>
                          <button
                            type="button"
                            onClick={openAllocationModal}
                            disabled={!advanceSummary || advanceSummary.availableBalance <= 0}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Allocate to Fee Invoice</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 3 Metrics Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                        <span className="text-[11px] font-medium text-neutral-500 block">Total Advance Collected</span>
                        <div className="text-base font-bold text-neutral-900 mt-1">
                          ₹{(advanceSummary?.totalCollected || 0).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-neutral-400 mt-0.5 block">Lifetime received from student</span>
                      </div>

                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                        <span className="text-[11px] font-medium text-neutral-500 block">Advance Utilized</span>
                        <div className="text-base font-bold text-neutral-700 mt-1">
                          ₹{(advanceSummary?.totalUtilized || 0).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-neutral-400 mt-0.5 block">Allocated to fee invoices</span>
                      </div>

                      <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-xl border border-emerald-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-emerald-800">Available Advance Balance</span>
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">
                            READY TO SETTLE
                          </span>
                        </div>
                        <div className="text-lg font-extrabold text-emerald-700 mt-1">
                          ₹{(advanceSummary?.availableBalance || 0).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-emerald-600 mt-0.5 block">Unallocated balance available</span>
                      </div>
                    </div>

                    {/* Advance Transaction History Timeline / Table */}
                    <div className="space-y-2 pt-1">
                      <h4 className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                        <History className="w-3 h-3 text-neutral-400" />
                        Advance Transaction History & Allocations
                      </h4>

                      {(!advanceSummary?.history || advanceSummary.history.length === 0) ? (
                        <p className="text-xs text-neutral-400 italic p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                          No advance transactions or fee allocations recorded yet for this student.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-neutral-200">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-50 text-[10px] uppercase font-bold text-neutral-500 border-b border-neutral-200">
                              <tr>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Type</th>
                                <th className="px-3 py-2">Amount</th>
                                <th className="px-3 py-2">Reference / Invoice</th>
                                <th className="px-3 py-2">Recorded By</th>
                                <th className="px-3 py-2">Notes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white">
                              {advanceSummary.history.map((tx: any) => (
                                <tr key={tx.id} className="hover:bg-neutral-50/60 transition">
                                  <td className="px-3 py-2 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                                    {new Date(tx.date).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {tx.type === 'COLLECTION' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <Plus className="w-2.5 h-2.5" />
                                        Collection ({tx.paymentMethod})
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        <ArrowUpRight className="w-2.5 h-2.5" />
                                        Fee Allocation
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 font-bold whitespace-nowrap text-neutral-900">
                                    {tx.type === 'COLLECTION' ? (
                                      <span className="text-emerald-700">+₹{tx.amount.toLocaleString('en-IN')}</span>
                                    ) : (
                                      <span className="text-blue-700">-₹{tx.amount.toLocaleString('en-IN')}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                                    {tx.invoiceNumber ? (
                                      <span className="font-semibold text-neutral-800">{tx.invoiceNumber}</span>
                                    ) : (
                                      <span>{tx.receiptNumber || tx.reference || '—'}</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-neutral-600 text-[11px] whitespace-nowrap">
                                    {tx.actorName || 'System Admin'}
                                  </td>
                                  <td className="px-3 py-2 text-neutral-500 text-[11px] max-w-xs truncate">
                                    {tx.notes || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 5: Active Course Enrollments Snapshot */}
                  <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-[#FF8500]" />
                        Active Academic & Skill Enrollments
                      </h3>
                      <button
                        type="button"
                        onClick={() => setSingleViewTab('enrollments')}
                        className="inline-flex items-center gap-1.5 text-xs text-[#CC6B00] font-semibold hover:underline cursor-pointer"
                      >
                        <span>Manage or Add Courses</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {(enrollmentsData?.active || enrollmentsData?.activeEnrollments || []).length === 0 ? (
                      <p className="text-xs text-neutral-400 italic p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                        No active course enrollments. Click 'Manage or Add Courses' to allocate a batch.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(enrollmentsData?.active || enrollmentsData?.activeEnrollments || []).map((en: any) => {
                          const courseName = en.courseName || en.batch?.class?.name || 'Academic Course';
                          const courseCode = en.courseCode || en.batch?.class?.code || '';
                          const batchName = en.batchName || en.batch?.name || 'Cohort Batch';
                          const subjectName = en.subjectName || en.subject?.name || null;
                          return (
                            <div
                              key={en.id}
                              className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {courseCode && (
                                    <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 bg-neutral-200/80 text-neutral-700 rounded">
                                      {courseCode}
                                    </span>
                                  )}
                                  <span className="font-bold text-neutral-900">{courseName}</span>
                                  {subjectName && (
                                    <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] border border-blue-200">
                                      {subjectName}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-neutral-500 mt-1">
                                  Batch: <strong className="text-[#CC6B00]">{batchName}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: EDIT PROFILE & GUARDIANS */}
              {singleViewTab === 'edit' && (
                <form onSubmit={handleSaveStudentEdit} className="space-y-5 animate-in fade-in duration-150">
                  {editModalError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs animate-in fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{editModalError}</span>
                    </div>
                  )}

                  {editModalSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span>{editModalSuccess}</span>
                    </div>
                  )}

                  {/* Section 1: Basic Information */}
                  <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-4">
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                      <User className="w-3.5 h-3.5 text-[#FF8500]" />
                      1. Student Identity & Status
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Name */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                          placeholder="e.g. Aravind Kumar"
                        />
                      </div>

                      {/* Gender */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Gender <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={editForm.gender}
                          onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Student Status <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                          <option value="SUSPENDED">Suspended</option>
                          <option value="GRADUATED">Graduated</option>
                        </select>
                      </div>

                      {/* DOB */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Date of Birth <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={editForm.dob}
                          onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                        />
                      </div>

                      {/* School Name */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-[#FF8500]" />
                            School / Institution Name
                          </span>
                          <span className="text-[10px] text-neutral-400 font-normal lowercase">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.schoolName}
                          onChange={(e) => setEditForm({ ...editForm, schoolName: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                          placeholder="e.g. St. Joseph's Higher Secondary School"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Contact Details */}
                  <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-4">
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2 border-b border-neutral-100 pb-2">
                      <Phone className="w-3.5 h-3.5 text-[#FF8500]" />
                      2. Contact & Address
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Phone */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                          placeholder="e.g. +91 98765 43210"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                          placeholder="e.g. student@example.com"
                        />
                      </div>

                      {/* Address */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Residential Address
                        </label>
                        <textarea
                          rows={2}
                          value={editForm.address}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500] focus:bg-white transition"
                          placeholder="e.g. 123 Heritage Way, Anna Nagar, Chennai"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Guardians & Contacts */}
                  <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-[#FF8500]" />
                        3. Guardians & Emergency Contacts
                      </h3>
                      <button
                        type="button"
                        onClick={addEditGuardianRow}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#CC6B00] hover:text-[#B35E00] px-2.5 py-1 bg-[#FFF4E5] hover:bg-[#FFE8CC] rounded-lg transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Guardian</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {editForm.guardians.map((g, index) => (
                        <div
                          key={index}
                          className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3 relative group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-[#FF8500]/15 text-[#CC6B00] text-[10px] flex items-center justify-center font-mono">
                                {index + 1}
                              </span>
                              {index === 0 ? 'Primary Guardian / Contact' : `Secondary Guardian #${index + 1}`}
                            </span>

                            {editForm.guardians.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEditGuardianRow(index)}
                                className="text-neutral-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer"
                                title="Remove guardian contact"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                                Full Name *
                              </label>
                              <input
                                type="text"
                                value={g.fullName}
                                onChange={(e) => updateEditGuardianRow(index, 'fullName', e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                                placeholder="e.g. Rajesh Kumar"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                                Relationship
                              </label>
                              <select
                                value={g.relationship}
                                onChange={(e) => updateEditGuardianRow(index, 'relationship', e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                              >
                                <option value="Father">Father</option>
                                <option value="Mother">Mother</option>
                                <option value="Guardian">Guardian</option>
                                <option value="Sibling">Sibling</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                                Phone Number *
                              </label>
                              <input
                                type="tel"
                                value={g.phone}
                                onChange={(e) => updateEditGuardianRow(index, 'phone', e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                                placeholder="e.g. 9876543210"
                              />
                            </div>

                            <div className="sm:col-span-4">
                              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                                Email (Optional)
                              </label>
                              <input
                                type="email"
                                value={g.email}
                                onChange={(e) => updateEditGuardianRow(index, 'email', e.target.value)}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                                placeholder="e.g. guardian@example.com"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 4: Student Advance Accounting & Record Collection */}
                  <div id="record-advance-section" className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5 text-[#FF8500]" />
                        4. Advance Accounting & Financial Ledger
                      </h3>
                      <button
                        type="button"
                        onClick={openAllocationModal}
                        disabled={!advanceSummary || advanceSummary.availableBalance <= 0}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Allocate to Fee Invoice</span>
                      </button>
                    </div>

                    {/* Summary Balance Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                        <span className="text-[11px] font-medium text-neutral-500 block">Total Advance Collected</span>
                        <div className="text-base font-bold text-neutral-900 mt-1">
                          ₹{(advanceSummary?.totalCollected || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                        <span className="text-[11px] font-medium text-neutral-500 block">Advance Utilized</span>
                        <div className="text-base font-bold text-neutral-700 mt-1">
                          ₹{(advanceSummary?.totalUtilized || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                        <span className="text-[11px] font-semibold text-emerald-800 block">Available Advance Balance</span>
                        <div className="text-base font-extrabold text-emerald-700 mt-1">
                          ₹{(advanceSummary?.availableBalance || 0).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Record Additional Advance Collection Form */}
                    <div className="p-3.5 bg-neutral-50/80 border border-neutral-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Plus className="w-3.5 h-3.5 text-[#FF8500]" />
                          Record Additional Advance Collection
                        </h4>
                        <span className="text-[10px] text-neutral-500">
                          Creates an immutable financial transaction
                        </span>
                      </div>

                      {recordAdvanceError && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{recordAdvanceError}</span>
                        </div>
                      )}

                      {recordAdvanceSuccess && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                          <span>{recordAdvanceSuccess}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {/* Amount */}
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Advance Amount (₹) <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={recordAdvanceForm.amount}
                            onChange={(e) =>
                              setRecordAdvanceForm({ ...recordAdvanceForm, amount: e.target.value })
                            }
                            placeholder="e.g. 500"
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] font-semibold text-neutral-900"
                          />
                        </div>

                        {/* Payment Date */}
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Payment Date <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={recordAdvanceForm.paymentDate}
                            onChange={(e) =>
                              setRecordAdvanceForm({ ...recordAdvanceForm, paymentDate: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          />
                        </div>

                        {/* Payment Method */}
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Payment Method <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={recordAdvanceForm.paymentMethod}
                            onChange={(e) =>
                              setRecordAdvanceForm({ ...recordAdvanceForm, paymentMethod: e.target.value })
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          >
                            <option value="CASH">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="BANK_TRANSFER">Bank Transfer</option>
                            <option value="CHEQUE">Cheque</option>
                          </select>
                        </div>

                        {/* Transaction Reference */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Transaction Reference <span className="text-neutral-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={recordAdvanceForm.reference}
                            onChange={(e) =>
                              setRecordAdvanceForm({ ...recordAdvanceForm, reference: e.target.value })
                            }
                            placeholder="e.g. UTR / UPI Ref / Cheque No"
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          />
                        </div>

                        {/* Notes */}
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                            Payment Notes <span className="text-neutral-400 font-normal">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            value={recordAdvanceForm.notes}
                            onChange={(e) =>
                              setRecordAdvanceForm({ ...recordAdvanceForm, notes: e.target.value })
                            }
                            placeholder="e.g. Collected during admission"
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={recordingAdvance || !recordAdvanceForm.amount}
                          onClick={handleRecordAdvanceSubmit}
                          className="px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                          {recordingAdvance ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Recording Advance...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3" />
                              <span>Record Advance Payment</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Form Submit / Cancel Bar */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSingleViewTab('details')}
                      className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingStudent}
                      className="px-5 py-2 text-xs font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition shadow-subtle flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingStudent ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: COURSES & ENROLLMENTS */}
              {singleViewTab === 'enrollments' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {loadingEnrollments ? (
                    <div className="py-12 text-center text-neutral-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                      Loading enrollment portfolio...
                    </div>
                  ) : (
                    <>
                      {/* Active Enrollments */}
                      <div>
                        <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                          <span>
                            Active Enrollments (
                            {(enrollmentsData?.active || enrollmentsData?.activeEnrollments || []).length}
                            )
                          </span>
                          <span className="text-[11px] font-normal text-neutral-400">
                            Attendance and fees are linked to these active offerings
                          </span>
                        </h3>

                        {(enrollmentsData?.active || enrollmentsData?.activeEnrollments || []).length === 0 ? (
                          <p className="text-xs text-neutral-400 italic p-3 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                            No active course or subject enrollments found. Use the form below to enroll this student.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {(enrollmentsData?.active || enrollmentsData?.activeEnrollments || []).map((en: any) => {
                              const courseName = en.courseName || en.batch?.class?.name || 'Course';
                              const courseCode = en.courseCode || en.batch?.class?.code || '';
                              const batchName = en.batchName || en.batch?.name || 'Cohort Batch';
                              const batchCode = en.batchCode || en.batch?.code || '';
                              const subjectName = en.subjectName || en.subject?.name || null;
                              const subjectCode = en.subjectCode || en.subject?.code || null;
                              const courseCategory = en.courseCategory || en.batch?.class?.category || 'ACADEMIC';

                              return (
                                <div
                                  key={en.id}
                                  className="p-3 bg-white border border-neutral-200 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-neutral-300 transition"
                                >
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {courseCode && (
                                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded">
                                          {courseCode}
                                        </span>
                                      )}
                                      <span className="font-semibold text-black text-sm">{courseName}</span>
                                      {subjectName ? (
                                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-xs">
                                          Subject: {subjectName} {subjectCode ? `(${subjectCode})` : ''}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-neutral-500 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-200">
                                          All Standard Subjects
                                        </span>
                                      )}
                                      <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          courseCategory === 'ACADEMIC'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                                        }`}
                                      >
                                        {courseCategory}
                                      </span>
                                    </div>
                                    <div className="text-xs text-neutral-500 mt-1 flex items-center gap-3 flex-wrap">
                                      <span>
                                        Batch: <strong className="text-[#CC6B00]">{batchName}</strong>{' '}
                                        {batchCode ? `(${batchCode})` : ''}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        Enrolled:{' '}
                                        {en.enrolledAt
                                          ? new Date(en.enrolledAt).toLocaleDateString()
                                          : en.startDate
                                          ? new Date(en.startDate).toLocaleDateString()
                                          : 'Active'}
                                      </span>
                                      {en.invoices && en.invoices.length > 0 && (
                                        <>
                                          <span>•</span>
                                          <span>
                                            Invoices:{' '}
                                            {en.invoices
                                              .map((inv: any) => `${inv.invoiceNumber} (${inv.status})`)
                                              .join(', ')}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                    {isPrivileged && (
                                      <button
                                        type="button"
                                        disabled={endingEnrollmentId === en.id}
                                        onClick={() => handleEndEnrollment(en.id)}
                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition disabled:opacity-50 shrink-0 self-start sm:self-center cursor-pointer"
                                      >
                                        {endingEnrollmentId === en.id ? 'Ending...' : 'End Enrollment'}
                                      </button>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Add New Enrollment Form */}
                      {isPrivileged && (
                        <div className="p-4 bg-neutral-50/80 border border-neutral-200 rounded-xl space-y-3">
                        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5 text-[#FF8500]" />
                          Add New Enrollment (Academic Subject or Skill Course)
                        </h3>

                        <form onSubmit={handleAddEnrollment} className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Course Dropdown */}
                            <div>
                              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                                Course / Standard *
                              </label>
                              <select
                                required
                                value={newEnrollment.courseId}
                                onChange={(e) =>
                                  setNewEnrollment({
                                    courseId: e.target.value,
                                    batchId: '',
                                    subjectId: '',
                                  })
                                }
                                className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                              >
                                <option value="">Select course / standard...</option>
                                {courses.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.code}) - {c.category || 'ACADEMIC'}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Subject Dropdown */}
                            <div>
                              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                                Subject (Optional)
                              </label>
                              <select
                                value={newEnrollment.subjectId}
                                disabled={!newEnrollment.courseId}
                                onChange={(e) =>
                                  setNewEnrollment({ ...newEnrollment, subjectId: e.target.value })
                                }
                                className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] disabled:bg-neutral-100"
                              >
                                <option value="">All Standard Subjects</option>
                                {courses
                                  .find((c) => c.id === newEnrollment.courseId)
                                  ?.subjects?.map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                      {sub.name} ({sub.code})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            {/* Batch Dropdown */}
                            <div>
                              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                                Cohort Batch *
                              </label>
                              <select
                                required
                                value={newEnrollment.batchId}
                                disabled={!newEnrollment.courseId}
                                onChange={(e) =>
                                  setNewEnrollment({ ...newEnrollment, batchId: e.target.value })
                                }
                                className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] disabled:bg-neutral-100"
                              >
                                <option value="">
                                  {newEnrollment.courseId
                                    ? 'Select cohort batch...'
                                    : 'Select course first'}
                                </option>
                                {courses
                                  .find((c) => c.id === newEnrollment.courseId)
                                  ?.batches?.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name} {b.code ? `(${b.code})` : ''}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={addingEnrollment || !newEnrollment.batchId}
                              className="px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50 cursor-pointer"
                            >
                              {addingEnrollment ? 'Enrolling...' : '+ Add Enrollment'}
                            </button>
                          </div>
                        </form>
                      </div>
                      )}

                      {/* Historical / Inactive Enrollments */}
                      {(enrollmentsData?.historical || enrollmentsData?.historicalEnrollments || []).length > 0 && (
                        <div>
                          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                            Historical Enrollments (
                            {(enrollmentsData?.historical || enrollmentsData?.historicalEnrollments || []).length}
                            )
                          </h3>
                          <div className="space-y-1.5 opacity-80">
                            {(enrollmentsData?.historical || enrollmentsData?.historicalEnrollments || []).map(
                              (en: any) => {
                                const courseName = en.courseName || en.batch?.class?.name || 'Course';
                                const batchName = en.batchName || en.batch?.name || 'Cohort Batch';
                                const subjectName = en.subjectName || en.subject?.name || null;
                                return (
                                  <div
                                    key={en.id}
                                    className="p-2.5 bg-neutral-100/70 border border-neutral-200 rounded-lg text-xs flex items-center justify-between text-neutral-600"
                                  >
                                    <div>
                                      <span className="font-semibold text-neutral-800">{courseName}</span>
                                      {subjectName && <span className="ml-1 text-neutral-600">({subjectName})</span>}
                                      <span className="mx-2">•</span>
                                      <span>Batch: {batchName}</span>
                                    </div>
                                    <span className="text-[10px] text-neutral-400">
                                      Ended:{' '}
                                      {en.endedAt
                                        ? new Date(en.endedAt).toLocaleDateString()
                                        : en.endDate
                                        ? new Date(en.endDate).toLocaleDateString()
                                        : 'Inactive'}
                                    </span>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-100 bg-neutral-50/70 flex items-center justify-between shrink-0">
              <span className="text-xs text-neutral-500 font-mono">
                {selectedStudentForEnrollments.studentCode} • Adm #{selectedStudentForEnrollments.admissionNumber}
              </span>
              <div className="flex items-center gap-2.5">
                {singleViewTab === 'details' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSingleViewTab('edit');
                      setEditModalError(null);
                      setEditModalSuccess(null);
                    }}
                    className="px-3.5 py-2 bg-[#FFF4E5] hover:bg-[#FFE8CC] text-[#CC6B00] border border-[#FF8500]/30 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedStudentForEnrollments(null)}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Close View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE STUDENT CONFIRMATION MODAL */}
      <Modal
        isOpen={!!studentToDelete}
        onClose={() => {
          if (!deletingStudent) setStudentToDelete(null);
        }}
        title="Delete Student Record"
        description="Permanently remove student and release 3-digit attendance code"
        maxWidth="md"
      >
        {studentToDelete && (
          <div className="space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600 mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="text-xs text-rose-950 space-y-1.5 flex-1">
                <div className="font-bold text-sm text-rose-900">
                  Are you sure you want to delete this student?
                </div>
                <p>
                  You are about to permanently delete <strong>{studentToDelete.fullName}</strong>{' '}
                  <span className="font-mono text-[11px] text-rose-700">({studentToDelete.studentCode})</span>.
                </p>
                <div className="p-2.5 bg-white/80 rounded-lg border border-rose-200/80 text-[11px] text-neutral-700 space-y-1">
                  <div>• Student Code: <strong className="font-mono">{studentToDelete.studentCode}</strong></div>
                  <div>• Admission Number: <strong className="font-mono">{studentToDelete.admissionNumber}</strong></div>
                  {studentToDelete.attendanceCode && (
                    <div className="text-[#CC6B00] font-semibold">
                      • 3-Digit Code: <strong className="font-mono">#{studentToDelete.attendanceCode}</strong> (will be released for re-allocation)
                    </div>
                  )}
                  {studentToDelete.enrollments && studentToDelete.enrollments.length > 0 && (
                    <div>• Active Enrollments: <strong>{studentToDelete.enrollments.length}</strong> course(s)</div>
                  )}
                </div>
                <p className="text-[11px] text-rose-700 font-medium">
                  This action cannot be undone. All enrollments, attendance marks, and related records will be removed.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={deletingStudent}
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingStudent}
                onClick={handleDeleteStudent}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-subtle transition disabled:opacity-50 cursor-pointer"
              >
                {deletingStudent ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Student...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Student</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Allocate Advance to Fee Invoice Modal */}
      <Modal
        isOpen={showAllocateModal}
        onClose={() => setShowAllocateModal(false)}
        title="Allocate Advance to Outstanding Fee Invoice"
      >
        <div className="space-y-4">
          {allocationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{allocationError}</span>
            </div>
          )}

          {allocationSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{allocationSuccess}</span>
            </div>
          )}

          {/* Student & Available Advance Banner */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50/40 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-neutral-900">
                {selectedStudentForEnrollments?.fullName}
              </div>
              <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                Code: {selectedStudentForEnrollments?.studentCode} | Adm: {selectedStudentForEnrollments?.admissionNumber}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">
                Available Advance Balance
              </span>
              <div className="text-lg font-extrabold text-emerald-700">
                ₹{(advanceSummary?.availableBalance || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {loadingInvoices ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#FF8500] mb-2" />
              Loading student fee invoices...
            </div>
          ) : studentInvoices.length === 0 ? (
            <div className="p-4 bg-neutral-50 border border-dashed border-neutral-200 rounded-xl text-center space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <div className="text-xs font-bold text-neutral-800">No Outstanding Invoices</div>
              <p className="text-[11px] text-neutral-500">
                This student has no unpaid or partial fee invoices with an outstanding balance.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAllocateAdvanceSubmit} className="space-y-4 text-xs">
              {/* Select Invoice Dropdown */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Select Outstanding Invoice *
                </label>
                <select
                  required
                  value={allocationForm.invoiceId}
                  onChange={(e) => {
                    const invId = e.target.value;
                    const inv = studentInvoices.find((i) => i.id === invId);
                    const avail = advanceSummary?.availableBalance || 0;
                    const maxAlloc = inv ? Math.min(avail, Number(inv.balanceAmount)) : 0;
                    setAllocationForm({
                      ...allocationForm,
                      invoiceId: invId,
                      amount: maxAlloc > 0 ? String(maxAlloc) : '',
                    });
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                >
                  <option value="">Select an invoice to settle...</option>
                  {studentInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - {inv.class?.name || 'Course'} ({inv.batch?.name || 'Batch'}) - Balance Due: ₹{Number(inv.balanceAmount).toLocaleString('en-IN')} (Total: ₹{Number(inv.totalAmount).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Invoice Details Card */}
              {allocationForm.invoiceId && (() => {
                const inv = studentInvoices.find((i) => i.id === allocationForm.invoiceId);
                if (!inv) return null;
                return (
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 block">Total Invoice</span>
                      <span className="font-semibold text-neutral-800">₹{Number(inv.totalAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">Already Paid</span>
                      <span className="font-semibold text-emerald-700">₹{Number(inv.paidAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">Remaining Balance</span>
                      <span className="font-bold text-rose-700">₹{Number(inv.balanceAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">Due Date</span>
                      <span className="text-neutral-700">{new Date(inv.dueDate).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Amount to Allocate with Max button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-neutral-700 uppercase tracking-wider">
                    Amount to Allocate (₹) *
                  </label>
                  {allocationForm.invoiceId && (
                    <button
                      type="button"
                      onClick={() => {
                        const inv = studentInvoices.find((i) => i.id === allocationForm.invoiceId);
                        const avail = advanceSummary?.availableBalance || 0;
                        const max = inv ? Math.min(avail, Number(inv.balanceAmount)) : 0;
                        setAllocationForm({ ...allocationForm, amount: String(max) });
                      }}
                      className="text-[11px] font-bold text-[#FF8500] hover:underline cursor-pointer"
                    >
                      Use Max Available
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  max={Math.min(
                    advanceSummary?.availableBalance || 0,
                    Number(studentInvoices.find((i) => i.id === allocationForm.invoiceId)?.balanceAmount || 9999999),
                  )}
                  value={allocationForm.amount}
                  onChange={(e) => setAllocationForm({ ...allocationForm, amount: e.target.value })}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] font-bold text-neutral-900"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Cannot exceed available advance balance or invoice remaining balance.
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Allocation Notes (Optional)
                </label>
                <input
                  type="text"
                  value={allocationForm.notes}
                  onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
                  placeholder="e.g. Advance allocated against Annual Term 1 fee"
                  className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocatingAdvance || !allocationForm.amount || parseFloat(allocationForm.amount) <= 0}
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-subtle transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {allocatingAdvance ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Allocating Advance...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Allocate Advance</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}

