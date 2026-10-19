'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import { ApiClient } from '@/lib/api/api-client';
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
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Manual Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCreatedCodeModal, setShowCreatedCodeModal] = useState<{
    name: string;
    studentCode: string;
    attendanceCode: string;
  } | null>(null);

  // Bulk CSV Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStep, setBulkStep] = useState<'UPLOAD' | 'PREVIEW' | 'REPORT'>('UPLOAD');
  const [csvContent, setCsvContent] = useState('');
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
  }>({
    name: '',
    schoolName: '',
    dob: '2008-01-01',
    gender: 'MALE',
    email: '',
    phone: '',
    enrollments: [{ courseId: '', batchId: '' }],
    guardians: [{ fullName: '', phone: '', relationship: 'Father', email: '' }],
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
      const [studentsRes, coursesRes] = await Promise.all([
        ApiClient.fetch<{ items: Student[] }>(`/students?search=${encodeURIComponent(search)}`),
        ApiClient.fetch<CourseOption[]>('/courses'),
      ]);
      setStudents(studentsRes.items || []);
      setCourses(coursesRes || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch student data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

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
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load student enrollments');
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(file);
  };

  const handleValidateCsv = async () => {
    try {
      setBulkLoading(true);
      setErrorMsg(null);
      const parsedRows = parseCsvText(csvContent);
      if (parsedRows.length === 0) {
        throw new Error('CSV file contains no data rows or has invalid headers.');
      }

      const res: any = await ApiClient.fetch('/students/bulk-validate', {
        method: 'POST',
        body: JSON.stringify({
          rows: parsedRows,
          defaultCourseId: bulkTargetCourseId || undefined,
          defaultBatchId: bulkTargetBatchId || undefined,
        }),
      });

      setValidationReport(res);
      setBulkFilterTab('ALL');
      setBulkStep('PREVIEW');
    } catch (err: any) {
      setErrorMsg(err.message || 'CSV validation failed');
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

  const filteredStudents = students.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (batchFilter) {
      const hasEnrollment = s.enrollments?.some((e) => e.batchId === batchFilter);
      const hasCurrent = s.currentBatch?.id === batchFilter;
      if (!hasEnrollment && !hasCurrent) return false;
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
        title="Student Directory & Admissions"
        subtitle="Manage enrolled students, multi-course cohort allocations, unique 3-digit attendance codes, and bulk onboarding"
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setBulkStep('UPLOAD');
              setCsvContent('');
              setValidationReport(null);
              setImportSummary(null);
              setShowBulkModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-neutral-100 hover:bg-[#FFF4E5] hover:text-[#CC6B00] text-neutral-800 text-sm font-semibold rounded-lg border border-neutral-200 transition"
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
        </div>
      </div>

      {/* Students Table & Native Mobile Cards */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
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
              <p className="text-xs">No students found matching filters.</p>
            </div>
          ) : (
            filteredStudents.map((s, idx) => (
              <div key={s.id} className="p-4 space-y-2.5 hover:bg-neutral-50/50 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-600 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      #{idx + 1}
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
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>

                {/* Attendance Code & Cohorts */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {s.attendanceCode ? (
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/30 flex items-center gap-1 shadow-2xs">
                      <QrCode className="w-3 h-3" />
                      Code: {s.attendanceCode}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                      No code
                    </span>
                  )}

                  {s.enrollments && s.enrollments.length > 0 ? (
                    <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[11px] font-medium">
                      {s.enrollments.map((e) => e.className).join(', ')}
                    </span>
                  ) : s.currentBatch ? (
                    <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[11px]">
                      {s.currentBatch.name}
                    </span>
                  ) : null}
                </div>

                {/* Guardian Phone & Relationship with Direct Tap-to-Call */}
                {s.guardians && s.guardians.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-neutral-600 pt-1.5 border-t border-neutral-100">
                    <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                      <span className="font-medium text-black truncate">{s.guardians[0].fullName}</span>
                      <span className="text-[10px] text-neutral-400">({s.guardians[0].relationship})</span>
                    </div>
                    <a
                      href={`tel:${s.guardians[0].phone}`}
                      className="inline-flex items-center gap-1 text-[#FF8500] font-semibold hover:underline active:opacity-75 py-1 px-2 rounded-lg bg-[#FFF4E5]/50 border border-[#FF8500]/20"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{s.guardians[0].phone}</span>
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                  <button
                    onClick={() => openManageEnrollments(s)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF4E5] hover:bg-[#FFE8CC] text-[#CC6B00] border border-[#FF8500]/30 rounded-lg text-xs font-semibold transition"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Enrollments ({s.enrollments?.length || 0})</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400 font-mono">{s.admissionNumber}</span>
                    <button
                      onClick={() => setStudentToDelete(s)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title={`Delete ${s.fullName}`}
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Full Table View (>= 768px) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50/80 border-b border-neutral-200 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12 font-mono">#</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Student ID / Adm #</th>
                <th className="py-3 px-4 text-center">3-Digit Code</th>
                <th className="py-3 px-4">Enrolled Course(s) & Batch(es)</th>
                <th className="py-3 px-4">Guardian Contact</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                    Loading student directory...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                    No students found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-neutral-50/50 transition">
                    <td className="py-3 px-3 text-center font-mono text-xs text-neutral-400 font-semibold">
                      {idx + 1}
                    </td>

                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openManageEnrollments(s)}
                        className="text-left group cursor-pointer block"
                        title="View single student details & enrollments"
                      >
                        <div className="font-semibold text-black group-hover:text-[#FF8500] transition">
                          {s.fullName}
                        </div>
                        <div className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="capitalize">{s.gender.toLowerCase()}</span>
                          {s.schoolName && (
                            <>
                              <span>•</span>
                              <span className="text-neutral-500 font-medium truncate max-w-[160px] flex items-center gap-1" title={s.schoolName}>
                                <GraduationCap className="w-3 h-3 text-[#FF8500] shrink-0" />
                                <span>{s.schoolName}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </td>

                    <td className="py-3 px-4 font-mono text-xs">
                      <div className="text-black font-semibold">{s.studentCode}</div>
                      <div className="text-neutral-400">{s.admissionNumber}</div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      {s.attendanceCode ? (
                        <span
                          className="inline-block px-2.5 py-1 bg-[#FFF4E5] border border-[#FF8500] text-[#CC6B00] font-mono font-bold text-sm tracking-wider rounded-lg shadow-2xs"
                          title="Assigned 3-Digit Attendance Code (100–999)"
                        >
                          {s.attendanceCode}
                        </span>
                      ) : (
                        <span className="text-[11px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded">
                          None
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {s.enrollments && s.enrollments.length > 0 ? (
                        <div className="space-y-1.5">
                          {s.enrollments.map((en) => (
                            <div key={en.id} className="flex items-center gap-1.5 text-xs flex-wrap">
                              <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-700 font-mono text-[10px] rounded font-semibold">
                                {en.classCode || 'CRS'}
                              </span>
                              <span className="font-medium text-neutral-800">{en.className}:</span>
                              {en.subjectName && (
                                <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 text-[11px]">
                                  {en.subjectName}
                                </span>
                              )}
                              <span className="text-[#FF8500] font-semibold">{en.batchName}</span>
                              {en.batchCode && (
                                <span className="text-[10px] text-neutral-400">({en.batchCode})</span>
                              )}
                            </div>
                          ))}
                          {s.enrollments.length > 1 && (
                            <div className="pt-0.5">
                              <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {s.enrollments.length} Active Courses Enrolled
                              </span>
                            </div>
                          )}
                        </div>
                      ) : s.currentBatch ? (
                        <div>
                          <div className="font-semibold text-black text-xs flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-200 text-neutral-700 font-mono text-[10px] rounded">
                              {s.currentBatch.class?.code || 'CRS'}
                            </span>
                            <span>{s.currentBatch.class?.name || 'Course'}</span>
                          </div>
                          <div className="text-xs text-[#FF8500] font-medium mt-0.5">
                            {s.currentBatch.name} {s.currentBatch.code ? `(${s.currentBatch.code})` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">No active cohort</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-xs">
                      {s.guardians && s.guardians.length > 0 ? (
                        <div>
                          <div className="text-black font-medium flex items-center gap-1.5 flex-wrap">
                            <span>{s.guardians[0].fullName}</span>
                            {s.guardians.length > 1 && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/30 cursor-help"
                                title={s.guardians.slice(1).map((g) => `${g.fullName} (${g.relationship}): ${g.phone}`).join(' | ')}
                              >
                                +{s.guardians.length - 1} contact{s.guardians.length > 2 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-neutral-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span>{s.guardians[0].phone}</span>
                            <span className="text-[10px] text-neutral-400">({s.guardians[0].relationship})</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 text-xs">No guardian</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          s.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openManageEnrollments(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF4E5] hover:bg-[#FFE8CC] text-[#CC6B00] border border-[#FF8500]/30 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                          title="View student profile & manage enrollments"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => setStudentToDelete(s)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer"
                          title={`Delete student ${s.fullName}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                      onClick={handleValidateCsv}
                      className="px-4 py-2 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {bulkLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>{bulkLoading ? 'Validating CSV...' : 'Validate CSV Rows'}</span>
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
                      onClick={() => setBulkStep('UPLOAD')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Upload</span>
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

                                  <button
                                    type="button"
                                    disabled={endingEnrollmentId === en.id}
                                    onClick={() => handleEndEnrollment(en.id)}
                                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg border border-rose-200 transition disabled:opacity-50 shrink-0 self-start sm:self-center cursor-pointer"
                                  >
                                    {endingEnrollmentId === en.id ? 'Ending...' : 'End Enrollment'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Add New Enrollment Form */}
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
    </>
  );
}

