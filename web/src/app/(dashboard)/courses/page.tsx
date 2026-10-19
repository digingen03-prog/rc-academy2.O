'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  Layers,
  BarChart3,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  UserCheck,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FolderPlus,
  Trash2,
  Edit2,
  Calendar,
  Award,
  ArrowRight,
  Filter,
  Check,
  X,
  Zap,
  Info
} from 'lucide-react';
import { ApiClient } from '@/lib/api/api-client';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';

// --- TYPES ---
export type TabType = 'standards' | 'subjects' | 'skills' | 'batches' | 'overview';

interface Batch {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  activeEnrollments: number;
  activeStaff: number;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  classId: string;
  class?: {
    id: string;
    name: string;
    code: string;
    category: 'ACADEMIC' | 'SKILL';
  };
  staffAssignments?: Array<{
    user: { id: string; firstName: string; lastName: string; designation?: string };
    batch?: { id: string; name: string };
  }>;
  _count?: {
    enrollments: number;
    examinations: number;
  };
}

interface Course {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: 'ACADEMIC' | 'SKILL';
  isActive: boolean;
  academicYear?: { name: string };
  batchesCount: number;
  totalEnrolled: number;
  assignedStaffCount: number;
  subjects?: SubjectItem[];
  batches: Batch[];
  createdAt: string;
}

interface CoursesOverview {
  academicStandardsCount: number;
  skillCoursesCount: number;
  subjectsCount: number;
  batchesCount: number;
  totalActiveEnrollments: number;
  academicEnrollments: number;
  skillEnrollments: number;
  multiEnrolledStudents: number;
  activeFacultyAssignments: number;
}

export default function CoursesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('standards');
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [overview, setOverview] = useState<CoursesOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // Filter selections
  const [subjectFilterClassId, setSubjectFilterClassId] = useState<string>('ALL');
  const [batchFilterCategory, setBatchFilterCategory] = useState<'ALL' | 'ACADEMIC' | 'SKILL'>('ALL');

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseModalCategory, setCourseModalCategory] = useState<'ACADEMIC' | 'SKILL'>('ACADEMIC');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedCourseForBatch, setSelectedCourseForBatch] = useState<Course | null>(null);

  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [selectedCourseForSubject, setSelectedCourseForSubject] = useState<string>('');

  // Delete modal states
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<{ batch: Batch; courseName: string } | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  // Bootstrap modal
  const [showBootstrapModal, setShowBootstrapModal] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  // Forms
  const [courseForm, setCourseForm] = useState({ name: '', code: '', description: '' });
  const [batchForm, setBatchForm] = useState({ name: '', code: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pathname = usePathname();

  // Reset modals on route change
  useEffect(() => {
    setShowCourseModal(false);
    setShowBatchModal(false);
    setShowSubjectModal(false);
    setCourseToDelete(null);
    setBatchToDelete(null);
    setSubjectToDelete(null);
    setDeleteModalError(null);
    setShowBootstrapModal(false);
  }, [pathname]);

  // Handle Escape key
  useEffect(() => {
    const isAnyModalOpen =
      showCourseModal ||
      showBatchModal ||
      showSubjectModal ||
      showBootstrapModal ||
      !!courseToDelete ||
      !!batchToDelete ||
      !!subjectToDelete;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCourseModal(false);
        setShowBatchModal(false);
        setShowSubjectModal(false);
        setShowBootstrapModal(false);
        setCourseToDelete(null);
        setBatchToDelete(null);
        setSubjectToDelete(null);
        setDeleteModalError(null);
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
  }, [
    showCourseModal,
    showBatchModal,
    showSubjectModal,
    showBootstrapModal,
    courseToDelete,
    batchToDelete,
    subjectToDelete,
  ]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [coursesData, subjectsData, overviewData] = await Promise.all([
        ApiClient.fetch<Course[]>('/courses'),
        ApiClient.fetch<SubjectItem[]>('/courses/subjects').catch(() => []),
        ApiClient.fetch<CoursesOverview>('/courses/overview').catch(() => null),
      ]);
      setCourses(coursesData);
      setSubjects(subjectsData);
      setOverview(overviewData);

      if (coursesData.length > 0 && !expandedCourseId) {
        setExpandedCourseId(coursesData[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load course details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handlers for Course (Academic Standard or Skill Course)
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.name || !courseForm.code) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await ApiClient.fetch('/courses', {
        method: 'POST',
        body: JSON.stringify({
          name: courseForm.name,
          code: courseForm.code,
          description: courseForm.description,
          category: courseModalCategory,
        }),
      });
      setSuccessMsg(
        `${courseModalCategory === 'ACADEMIC' ? 'Academic Standard' : 'Skill Course'} '${courseForm.name}' created successfully`,
      );
      setShowCourseModal(false);
      setCourseForm({ name: '', code: '', description: '' });
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;
    try {
      setDeleting(true);
      setDeleteModalError(null);
      setErrorMsg(null);
      await ApiClient.fetch(`/courses/${courseToDelete.id}`, {
        method: 'DELETE',
      });
      setSuccessMsg(`'${courseToDelete.name}' deleted successfully`);
      setCourseToDelete(null);
      await loadAllData();
    } catch (err: any) {
      setDeleteModalError(err.message || 'Failed to delete course');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleCourseStatus = async (course: Course) => {
    try {
      const newStatus = !course.isActive;
      await ApiClient.fetch(`/courses/${course.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, isActive: newStatus } : c)),
      );
      setSuccessMsg(`'${course.name}' ${newStatus ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update course status');
    }
  };

  // Handlers for Batches
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseForBatch || !batchForm.name) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await ApiClient.fetch(`/courses/${selectedCourseForBatch.id}/batches`, {
        method: 'POST',
        body: JSON.stringify(batchForm),
      });
      setSuccessMsg(`Batch '${batchForm.name}' added to '${selectedCourseForBatch.name}'`);
      setShowBatchModal(false);
      setBatchForm({ name: '', code: '' });
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create batch');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    try {
      setDeleting(true);
      setDeleteModalError(null);
      setErrorMsg(null);
      await ApiClient.fetch(`/courses/batches/${batchToDelete.batch.id}`, {
        method: 'DELETE',
      });
      setSuccessMsg(`Batch '${batchToDelete.batch.name}' deleted successfully`);
      setBatchToDelete(null);
      await loadAllData();
    } catch (err: any) {
      setDeleteModalError(err.message || 'Failed to delete batch');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleBatchStatus = async (batch: Batch) => {
    try {
      const newStatus = !batch.isActive;
      await ApiClient.fetch(`/courses/batches/${batch.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      await loadAllData();
      setSuccessMsg(`Batch '${batch.name}' ${newStatus ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update batch status');
    }
  };

  // Handlers for Subjects
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name || !subjectForm.code) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);
      if (editingSubject) {
        await ApiClient.fetch(`/courses/subjects/${editingSubject.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: subjectForm.name,
            code: subjectForm.code,
          }),
        });
        setSuccessMsg(`Subject '${subjectForm.name}' updated successfully`);
      } else {
        if (!selectedCourseForSubject) {
          setErrorMsg('Please select an Academic Standard or Course for this subject');
          return;
        }
        await ApiClient.fetch(`/courses/${selectedCourseForSubject}/subjects`, {
          method: 'POST',
          body: JSON.stringify({
            name: subjectForm.name,
            code: subjectForm.code,
          }),
        });
        setSuccessMsg(`Subject '${subjectForm.name}' created successfully`);
      }
      setShowSubjectModal(false);
      setEditingSubject(null);
      setSubjectForm({ name: '', code: '' });
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save subject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return;
    try {
      setDeleting(true);
      setDeleteModalError(null);
      setErrorMsg(null);
      await ApiClient.fetch(`/courses/subjects/${subjectToDelete.id}`, {
        method: 'DELETE',
      });
      setSuccessMsg(`Subject '${subjectToDelete.name}' deleted successfully`);
      setSubjectToDelete(null);
      await loadAllData();
    } catch (err: any) {
      setDeleteModalError(err.message || 'Failed to delete subject');
    } finally {
      setDeleting(false);
    }
  };

  // Handler for Bootstrap Standards & Skill Courses
  const handleBootstrap = async () => {
    try {
      setBootstrapping(true);
      setErrorMsg(null);
      const res = await ApiClient.fetch<any>('/courses/bootstrap-standards', {
        method: 'POST',
      });
      setSuccessMsg(res.message || 'Standards & Skill courses bootstrapped successfully');
      setShowBootstrapModal(false);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to bootstrap standards');
    } finally {
      setBootstrapping(false);
    }
  };

  // Filtering
  const academicStandards = courses.filter((c) => c.category === 'ACADEMIC');
  const skillCourses = courses.filter((c) => c.category === 'SKILL');

  const filteredAcademicStandards = academicStandards.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredSkillCourses = skillCourses.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()),
  );

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      (s.class?.name.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesClass = subjectFilterClassId === 'ALL' || s.classId === subjectFilterClassId;
    return matchesSearch && matchesClass;
  });

  // Flat list of batches for the Batches tab
  const allBatches = courses.flatMap((course) =>
    course.batches.map((b) => ({
      ...b,
      courseId: course.id,
      courseName: course.name,
      courseCode: course.code,
      courseCategory: course.category,
    })),
  );

  const filteredBatches = allBatches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      (b.code?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      b.courseName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      batchFilterCategory === 'ALL' || b.courseCategory === batchFilterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <Header
        title="Courses & Programs Management"
        subtitle="Manage School Academic Standards (1st–12th), Independent Skill Courses, Subjects, and Batch Schedules"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadAllData()}
            className="p-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 text-neutral-700 transition"
            title="Refresh courses and overview"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowBootstrapModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-[#FFF4E5] hover:text-[#CC6B00] text-neutral-800 font-semibold text-xs rounded-lg border border-neutral-200 transition"
            title="Pre-populate 9th-12th standards & Skill courses"
          >
            <Zap className="w-3.5 h-3.5 text-[#FF8500]" />
            <span>Setup RCA Defaults</span>
          </button>

          <button
            onClick={() => {
              setErrorMsg(null);
              setCourseModalCategory('ACADEMIC');
              setCourseForm({ name: '', code: '', description: '' });
              setShowCourseModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white font-semibold text-xs rounded-lg shadow-subtle transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Standard</span>
          </button>

          <button
            onClick={() => {
              setErrorMsg(null);
              setCourseModalCategory('SKILL');
              setCourseForm({ name: '', code: '', description: '' });
              setShowCourseModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-black hover:bg-neutral-800 text-white font-semibold text-xs rounded-lg shadow-subtle transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF8500]" />
            <span>New Skill Course</span>
          </button>
        </div>
      </Header>

      <ResponsivePageContainer>
        {/* Alerts & Notifications */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-900 ml-2 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-rose-800 text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 hover:text-rose-900 ml-2 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dual-Model Navigation Tabs */}
        <div className="bg-white border border-neutral-200 rounded-xl p-1.5 shadow-2xs flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('standards')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'standards'
                ? 'bg-[#FF8500] text-white shadow-2xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Academic Standards</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'standards'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {academicStandards.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'subjects'
                ? 'bg-[#FF8500] text-white shadow-2xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Subjects & Offerings</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'subjects'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {subjects.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('skills')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'skills'
                ? 'bg-[#FF8500] text-white shadow-2xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Skill Courses</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'skills'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {skillCourses.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('batches')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'batches'
                ? 'bg-[#FF8500] text-white shadow-2xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Batches & Sections</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'batches'
                  ? 'bg-white/20 text-white font-bold'
                  : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {allBatches.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeTab === 'overview'
                ? 'bg-[#FF8500] text-white shadow-2xs'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Enrollment & Assignment Overview</span>
          </button>
        </div>

        {/* Search & Quick Filter Bar */}
        {activeTab !== 'overview' && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 border border-neutral-200 rounded-xl shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  activeTab === 'standards'
                    ? 'Search academic standards (e.g., 10th Standard, STD10)...'
                    : activeTab === 'subjects'
                    ? 'Search subjects by title or code (e.g. Maths, 10MTH, Physics)...'
                    : activeTab === 'skills'
                    ? 'Search independent skill courses (e.g., Drawing, Spoken English)...'
                    : 'Search batch name, code, or associated course...'
                }
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500]"
              />
            </div>

            {/* Tab specific secondary dropdown filter */}
            {activeTab === 'subjects' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 whitespace-nowrap">Standard / Course:</span>
                <select
                  value={subjectFilterClassId}
                  onChange={(e) => setSubjectFilterClassId(e.target.value)}
                  className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                >
                  <option value="ALL">All Standards & Courses</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) - {c.category}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setEditingSubject(null);
                    setSubjectForm({ name: '', code: '' });
                    setSelectedCourseForSubject(academicStandards[0]?.id || '');
                    setShowSubjectModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF8500] hover:bg-[#E67700] text-white font-semibold text-xs rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Subject</span>
                </button>
              </div>
            )}

            {activeTab === 'batches' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 whitespace-nowrap">Category:</span>
                <select
                  value={batchFilterCategory}
                  onChange={(e) => setBatchFilterCategory(e.target.value as any)}
                  className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 font-medium focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                >
                  <option value="ALL">All Categories</option>
                  <option value="ACADEMIC">Academic Standards Only</option>
                  <option value="SKILL">Skill Courses Only</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: ACADEMIC STANDARDS */}
        {activeTab === 'standards' && (
          <div className="space-y-4">
            <div className="bg-[#FFF4E5]/60 border border-[#FF8500]/30 rounded-xl p-3.5 text-xs text-neutral-800 flex items-start gap-3">
              <Info className="w-4 h-4 text-[#FF8500] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-black">School Academic Programs Architecture: </span>
                Students enrolled in an academic standard (e.g. 10th Standard) can choose to enroll in
                individual subjects (e.g., Maths only, or Maths + English), or full subject combinations.
                Fee obligations, timetable attendance sessions, and examination candidates resolve at
                the specific subject offering level.
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl">
                <RefreshCw className="w-6 h-6 animate-spin text-[#FF8500] mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Loading academic standards...</p>
              </div>
            ) : filteredAcademicStandards.length === 0 ? (
              <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-3">
                <GraduationCap className="w-10 h-10 text-neutral-300 mx-auto" />
                <h3 className="text-base font-bold text-neutral-800">No Academic Standards Found</h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Click below to quickly seed standard grades (9th through 12th) with core subjects
                  and section batches, or create one manually.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setShowBootstrapModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF8500] text-white text-xs font-semibold rounded-lg shadow-subtle hover:bg-[#E67700] transition"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Setup RCA Standard Grades</span>
                  </button>
                  <button
                    onClick={() => {
                      setCourseModalCategory('ACADEMIC');
                      setCourseForm({ name: '', code: '', description: '' });
                      setShowCourseModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-lg hover:bg-neutral-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Standard Manually</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAcademicStandards.map((std) => {
                  const isExpanded = expandedCourseId === std.id;
                  const subjectsList = std.subjects || [];

                  return (
                    <div
                      key={std.id}
                      className="bg-white border border-neutral-200 rounded-xl overflow-hidden transition shadow-2xs hover:border-neutral-300"
                    >
                      {/* Standard Header Row */}
                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div
                          className="flex items-start gap-3 flex-1 cursor-pointer"
                          onClick={() => setExpandedCourseId(isExpanded ? null : std.id)}
                        >
                          <div className="p-1 text-neutral-400 hover:text-black mt-0.5">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-[#FF8500]" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/30 rounded">
                                {std.code}
                              </span>
                              <h3 className="font-bold text-black text-base">{std.name}</h3>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                                Academic Standard
                              </span>
                              {std.isActive ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {std.description && (
                              <p className="text-xs text-neutral-500 mt-1 max-w-2xl">{std.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Metrics Pills & Quick Actions */}
                        <div className="flex items-center gap-4 text-xs font-medium text-neutral-600 flex-wrap">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg">
                            <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{subjectsList.length} Subjects</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg">
                            <Layers className="w-3.5 h-3.5 text-[#FF8500]" />
                            <span>{std.batchesCount} Batches</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-50 border border-neutral-200 rounded-lg">
                            <Users className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{std.totalEnrolled} Enrolled</span>
                          </div>

                          <div className="flex items-center gap-1 pl-2 border-l border-neutral-200">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCourseForBatch(std);
                                setBatchForm({ name: '', code: '' });
                                setShowBatchModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-[#CC6B00] bg-[#FFF4E5] hover:bg-[#FFE8CC] border border-[#FF8500]/30 rounded-lg transition"
                            >
                              + Batch
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSubject(null);
                                setSubjectForm({ name: '', code: '' });
                                setSelectedCourseForSubject(std.id);
                                setShowSubjectModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition"
                            >
                              + Subject
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCourseStatus(std);
                              }}
                              className="p-1.5 text-neutral-400 hover:text-black rounded"
                              title={std.isActive ? 'Deactivate Standard' : 'Activate Standard'}
                            >
                              <Check className={`w-4 h-4 ${std.isActive ? 'text-emerald-600' : ''}`} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCourseToDelete(std);
                              }}
                              className="p-1.5 text-neutral-400 hover:text-rose-600 rounded"
                              title="Delete Standard"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Section: Subjects Offerings and Batches */}
                      {isExpanded && (
                        <div className="bg-neutral-50/70 border-t border-neutral-200 p-4 space-y-4">
                          {/* Subjects Pill Row */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                                Offered Subjects ({subjectsList.length})
                              </span>
                              <span className="text-[11px] text-neutral-500">
                                Students may enroll in individual subjects or multiple combinations
                              </span>
                            </div>

                            {subjectsList.length === 0 ? (
                              <p className="text-xs text-neutral-400 italic bg-white p-3 rounded-lg border border-dashed border-neutral-300">
                                No subjects mapped to this standard yet. Click '+ Subject' to add
                                Maths, Science, etc.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {subjectsList.map((sub) => (
                                  <div
                                    key={sub.id}
                                    className="p-2.5 bg-white border border-neutral-200 rounded-lg flex items-center justify-between text-xs shadow-2xs hover:border-[#FF8500]/40 transition"
                                  >
                                    <div>
                                      <div className="font-semibold text-black flex items-center gap-1.5">
                                        <span>{sub.name}</span>
                                        <span className="font-mono text-[10px] text-neutral-400">
                                          ({sub.code})
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-neutral-500 mt-0.5">
                                        {sub._count?.enrollments || 0} active student enrollments
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          setEditingSubject(sub);
                                          setSubjectForm({ name: sub.name, code: sub.code });
                                          setSelectedCourseForSubject(std.id);
                                          setShowSubjectModal(true);
                                        }}
                                        className="p-1 text-neutral-400 hover:text-black rounded"
                                        title="Edit Subject"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setSubjectToDelete(sub)}
                                        className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                                        title="Delete Subject"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Batches Table for this Standard */}
                          <div>
                            <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider block mb-2">
                              Cohort Batches & Sections ({std.batches.length})
                            </span>

                            {std.batches.length === 0 ? (
                              <p className="text-xs text-neutral-400 italic bg-white p-3 rounded-lg border border-dashed border-neutral-300">
                                No batches created for this standard. Click '+ Batch' to create
                                Section A, Morning Cohort, etc.
                              </p>
                            ) : (
                              <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase text-[10px]">
                                    <tr>
                                      <th className="py-2 px-3">Batch Name</th>
                                      <th className="py-2 px-3">Code</th>
                                      <th className="py-2 px-3">Active Students</th>
                                      <th className="py-2 px-3">Faculty Staff</th>
                                      <th className="py-2 px-3">Status</th>
                                      <th className="py-2 px-3 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-100">
                                    {std.batches.map((b) => (
                                      <tr key={b.id} className="hover:bg-neutral-50 transition">
                                        <td className="py-2 px-3 font-semibold text-black">{b.name}</td>
                                        <td className="py-2 px-3 font-mono text-neutral-500">
                                          {b.code || '—'}
                                        </td>
                                        <td className="py-2 px-3">
                                          <span className="inline-flex items-center gap-1 font-semibold text-[#FF8500]">
                                            <Users className="w-3 h-3" />
                                            {b.activeEnrollments}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-neutral-600">
                                          {b.activeStaff} instructors
                                        </td>
                                        <td className="py-2 px-3">
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                              b.isActive
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-neutral-100 text-neutral-600'
                                            }`}
                                          >
                                            {b.isActive ? 'Active' : 'Inactive'}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-right space-x-1">
                                          <button
                                            onClick={() => handleToggleBatchStatus(b)}
                                            className="px-2 py-0.5 rounded text-[11px] font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                                          >
                                            {b.isActive ? 'Deactivate' : 'Activate'}
                                          </button>
                                          <button
                                            onClick={() =>
                                              setBatchToDelete({ batch: b, courseName: std.name })
                                            }
                                            className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                                            title="Delete Batch"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 inline" />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SUBJECTS & COURSE OFFERINGS */}
        {activeTab === 'subjects' && (
          <div className="space-y-4">
            <div className="bg-[#FFF4E5]/60 border border-[#FF8500]/30 rounded-xl p-3.5 text-xs text-neutral-800 flex items-start gap-3">
              <BookOpen className="w-4 h-4 text-[#FF8500] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-black">Subject-Level Curriculum Matrix: </span>
                Every subject is uniquely mapped to an academic standard or program course. Student
                enrollments, faculty revenue shares, attendance eligibility sessions, and examination
                candidate lists are strictly partitioned per subject offering.
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4">Subject Name & Code</th>
                    <th className="py-3 px-4">Associated Standard / Course</th>
                    <th className="py-3 px-4">Program Category</th>
                    <th className="py-3 px-4 text-center">Active Enrollments</th>
                    <th className="py-3 px-4">Assigned Instructors</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                        Loading subjects matrix...
                      </td>
                    </tr>
                  ) : filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-400">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                        No subjects found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((sub) => (
                      <tr key={sub.id} className="hover:bg-neutral-50/50 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-black">{sub.name}</div>
                          <span className="font-mono text-xs font-semibold px-1.5 py-0.2 bg-[#FFF4E5] text-[#CC6B00] border border-[#FF8500]/30 rounded">
                            {sub.code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-neutral-800">
                            {sub.class?.name || 'Unassigned'}
                          </span>
                          <span className="font-mono text-xs text-neutral-400 ml-1.5">
                            ({sub.class?.code})
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.class?.category === 'ACADEMIC'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {sub.class?.category || 'ACADEMIC'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-semibold text-black">
                            {sub._count?.enrollments || 0}
                          </span>
                          <span className="text-[11px] text-neutral-400 block">students</span>
                        </td>
                        <td className="py-3 px-4">
                          {sub.staffAssignments && sub.staffAssignments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {sub.staffAssignments.map((sa, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded text-xs text-neutral-700"
                                >
                                  <UserCheck className="w-3 h-3 text-[#FF8500]" />
                                  {sa.user.firstName} {sa.user.lastName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-xs italic">No faculty assigned</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => {
                              setEditingSubject(sub);
                              setSubjectForm({ name: sub.name, code: sub.code });
                              setSelectedCourseForSubject(sub.classId);
                              setShowSubjectModal(true);
                            }}
                            className="p-1.5 text-neutral-500 hover:text-black rounded"
                            title="Edit Subject"
                          >
                            <Edit2 className="w-4 h-4 inline" />
                          </button>
                          <button
                            onClick={() => setSubjectToDelete(sub)}
                            className="p-1.5 text-neutral-500 hover:text-rose-600 rounded"
                            title="Delete Subject"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SKILL COURSES */}
        {activeTab === 'skills' && (
          <div className="space-y-4">
            <div className="bg-[#FFF4E5]/60 border border-[#FF8500]/30 rounded-xl p-3.5 text-xs text-neutral-800 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[#FF8500] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-black">Independent Skill Courses Architecture: </span>
                Programs such as Drawing, Spoken English, Abacus, Coding, and Music run independently
                of school standard grades. Students can enroll in a skill course alone without any
                school-standard enrollment, or alongside their regular academic subjects.
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl">
                <RefreshCw className="w-6 h-6 animate-spin text-[#FF8500] mx-auto mb-2" />
                <p className="text-sm text-neutral-500">Loading skill courses...</p>
              </div>
            ) : filteredSkillCourses.length === 0 ? (
              <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-3">
                <Sparkles className="w-10 h-10 text-neutral-300 mx-auto" />
                <h3 className="text-base font-bold text-neutral-800">No Skill Courses Found</h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Provide standalone creative and technical programs such as Drawing, Spoken
                  English, Abacus, or Computer Foundations.
                </p>
                <button
                  onClick={() => {
                    setCourseModalCategory('SKILL');
                    setCourseForm({ name: '', code: '', description: '' });
                    setShowCourseModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF8500] text-white text-xs font-semibold rounded-lg shadow-subtle hover:bg-[#E67700] transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Skill Course</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSkillCourses.map((sk) => (
                  <div
                    key={sk.id}
                    className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs hover:border-[#FF8500]/40 transition space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded">
                          {sk.code}
                        </span>
                        <h3 className="font-bold text-black text-base mt-1.5">{sk.name}</h3>
                        {sk.description && (
                          <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{sk.description}</p>
                        )}
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sk.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {sk.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-neutral-100">
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Enrolled Students</span>
                        <span className="font-bold text-black text-base">{sk.totalEnrolled}</span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Active Batches</span>
                        <span className="font-bold text-[#FF8500] text-base">{sk.batchesCount}</span>
                      </div>
                    </div>

                    {/* Batches list in this skill course */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-600 uppercase">
                        <span>Cohort Batches</span>
                        <button
                          onClick={() => {
                            setSelectedCourseForBatch(sk);
                            setBatchForm({ name: '', code: '' });
                            setShowBatchModal(true);
                          }}
                          className="text-[#FF8500] hover:underline"
                        >
                          + Add Batch
                        </button>
                      </div>

                      {sk.batches.length === 0 ? (
                        <p className="text-xs text-neutral-400 italic">No batches created</p>
                      ) : (
                        sk.batches.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg text-xs"
                          >
                            <span className="font-medium text-black">{b.name}</span>
                            <span className="text-neutral-500 font-semibold">
                              {b.activeEnrollments} students
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                      <button
                        onClick={() => handleToggleCourseStatus(sk)}
                        className="text-xs font-medium text-neutral-600 hover:text-black"
                      >
                        {sk.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => setCourseToDelete(sk)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        Delete Course
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: BATCHES */}
        {activeTab === 'batches' && (
          <div className="space-y-4">
            <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4">Batch / Section Name</th>
                    <th className="py-3 px-4">Batch Code</th>
                    <th className="py-3 px-4">Associated Course / Standard</th>
                    <th className="py-3 px-4">Program Category</th>
                    <th className="py-3 px-4 text-center">Active Enrollments</th>
                    <th className="py-3 px-4 text-center">Assigned Faculty</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                        Loading cohorts and batches...
                      </td>
                    </tr>
                  ) : filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        <Layers className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                        No batches found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((b) => (
                      <tr key={b.id} className="hover:bg-neutral-50/50 transition">
                        <td className="py-3 px-4 font-semibold text-black">{b.name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-neutral-500">
                          {b.code || '—'}
                        </td>
                        <td className="py-3 px-4 font-medium text-neutral-800">
                          {b.courseName}{' '}
                          <span className="font-mono text-xs text-neutral-400">({b.courseCode})</span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              b.courseCategory === 'ACADEMIC'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {b.courseCategory}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-[#FF8500]">{b.activeEnrollments}</span>
                          <span className="text-[11px] text-neutral-400 block">enrolled</span>
                        </td>
                        <td className="py-3 px-4 text-center text-neutral-600 font-medium">
                          {b.activeStaff}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              b.isActive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {b.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => handleToggleBatchStatus(b)}
                            className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-xs font-semibold text-neutral-700 rounded transition"
                          >
                            {b.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() =>
                              setBatchToDelete({ batch: b, courseName: b.courseName })
                            }
                            className="p-1 text-neutral-400 hover:text-rose-600 rounded"
                            title="Delete Batch"
                          >
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: ENROLLMENT & ASSIGNMENT OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Academic Standards
                </div>
                <div className="text-2xl font-bold text-black mt-1">
                  {overview?.academicStandardsCount || academicStandards.length}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">School grades 1st–12th</div>
              </div>

              <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Skill Courses
                </div>
                <div className="text-2xl font-bold text-purple-600 mt-1">
                  {overview?.skillCoursesCount || skillCourses.length}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Drawing, Spoken English, etc.</div>
              </div>

              <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Active Enrollments
                </div>
                <div className="text-2xl font-bold text-[#FF8500] mt-1">
                  {overview?.totalActiveEnrollments || 0}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Across standard subjects & skills
                </div>
              </div>

              <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-2xs">
                <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Cross-Enrolled Students
                </div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">
                  {overview?.multiEnrolledStudents || 0}
                </div>
                <div className="text-[11px] text-neutral-400 mt-0.5">
                  Taking &gt;1 subject or dual models
                </div>
              </div>
            </div>

            {/* Architecture Card Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
                <h3 className="font-bold text-black text-sm flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#FF8500]" />
                  Education Model Breakdown
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-neutral-700">
                        Academic Standard Enrollments
                      </span>
                      <span className="font-bold text-black">
                        {overview?.academicEnrollments || 0}
                      </span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${
                            overview?.totalActiveEnrollments
                              ? Math.min(
                                  100,
                                  Math.round(
                                    ((overview.academicEnrollments || 0) /
                                      overview.totalActiveEnrollments) *
                                      100,
                                  ),
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-neutral-700">Skill Course Enrollments</span>
                      <span className="font-bold text-black">{overview?.skillEnrollments || 0}</span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{
                          width: `${
                            overview?.totalActiveEnrollments
                              ? Math.min(
                                  100,
                                  Math.round(
                                    ((overview.skillEnrollments || 0) /
                                      overview.totalActiveEnrollments) *
                                      100,
                                  ),
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-neutral-50 rounded-lg text-neutral-600 text-[11px] space-y-1">
                  <p className="font-bold text-black">Unified Student Profile Guarantee:</p>
                  <p>
                    Every student retains a single student code, admission record, and unique 3-digit
                    attendance code while participating in arbitrary combinations of academic standard
                    subjects and independent skill courses.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
                <h3 className="font-bold text-black text-sm flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#FF8500]" />
                  Faculty Multi-Assignment Distribution
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
                    <span className="text-neutral-600">Total Teaching Assignments:</span>
                    <span className="font-bold text-black">
                      {overview?.activeFacultyAssignments || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
                    <span className="text-neutral-600">Total Active Batches:</span>
                    <span className="font-bold text-black">
                      {overview?.batchesCount || allBatches.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg">
                    <span className="text-neutral-600">Total Catalog Subjects:</span>
                    <span className="font-bold text-black">
                      {overview?.subjectsCount || subjects.length}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[#FFF4E5] rounded-lg text-[#CC6B00] text-[11px] space-y-1">
                  <p className="font-bold">Multi-Standard Faculty Principle:</p>
                  <p>
                    A single faculty member can teach Maths in 10th Standard, Maths in 12th Standard,
                    and also lead Drawing without RBAC privilege escalation. Revenue share and
                    compensation models track each teaching assignment independently.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </ResponsivePageContainer>

      {/* MODAL: CREATE COURSE (ACADEMIC STANDARD OR SKILL COURSE) */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-black">
                {courseModalCategory === 'ACADEMIC'
                  ? 'New Academic Standard'
                  : 'New Independent Skill Course'}
              </h2>
              <button
                onClick={() => setShowCourseModal(false)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Program Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCourseModalCategory('ACADEMIC')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                      courseModalCategory === 'ACADEMIC'
                        ? 'bg-[#FF8500] text-white border-[#FF8500]'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    Academic Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseModalCategory('SKILL')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                      courseModalCategory === 'SKILL'
                        ? 'bg-black text-white border-black'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    Skill Course
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={courseForm.name}
                  onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
                  placeholder={
                    courseModalCategory === 'ACADEMIC'
                      ? 'e.g. 10th Standard or 12th Standard'
                      : 'e.g. Drawing, Spoken English'
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  value={courseForm.code}
                  onChange={(e) =>
                    setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder={
                    courseModalCategory === 'ACADEMIC' ? 'e.g. STD10 or STD12' : 'e.g. SKL-DRAW'
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  placeholder="Outline syllabus, focus areas, and batch scheduling guidelines..."
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE OR EDIT SUBJECT */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-black">
                {editingSubject ? `Edit Subject: ${editingSubject.name}` : 'New Subject Offering'}
              </h2>
              <button
                onClick={() => {
                  setShowSubjectModal(false);
                  setEditingSubject(null);
                }}
                className="text-neutral-400 hover:text-black p-1 rounded-lg hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4">
              {!editingSubject && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                    Belongs to Standard / Course *
                  </label>
                  <select
                    value={selectedCourseForSubject}
                    onChange={(e) => setSelectedCourseForSubject(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  >
                    <option value="">Select an Academic Standard</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code}) - {c.category}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="e.g. Mathematics, Physics, Chemistry, English"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Subject Code *
                </label>
                <input
                  type="text"
                  required
                  value={subjectForm.code}
                  onChange={(e) =>
                    setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. 10MTH, 12PHY, ENG-01"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Must be unique within this academic standard.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubjectModal(false);
                    setEditingSubject(null);
                  }}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingSubject ? 'Update Subject' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE BATCH */}
      {showBatchModal && selectedCourseForBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-black">New Batch / Section</h2>
                <p className="text-xs text-neutral-500">
                  Target Course: {selectedCourseForBatch.name} ({selectedCourseForBatch.code})
                </p>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-neutral-400 hover:text-black p-1 rounded-lg hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Batch Name *
                </label>
                <input
                  type="text"
                  required
                  value={batchForm.name}
                  onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
                  placeholder="e.g. Section A, Morning Batch, Weekend Group"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase mb-1">
                  Batch Code (Optional)
                </label>
                <input
                  type="text"
                  value={batchForm.code}
                  onChange={(e) =>
                    setBatchForm({ ...batchForm, code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. SEC-A, WKND-1"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BOOTSTRAP STANDARDS & SKILL COURSES CONFIRM */}
      {showBootstrapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-[#FF8500] mb-4">
              <Zap className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold text-black">Setup RCA Standard Programs</h2>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              This action will seed standard school grades (9th, 10th, 11th, and 12th Standards)
              along with their respective core subjects (Maths, Science, Physics, Chemistry,
              Biology, English) and Section A/B batches. It will also create independent Skill Courses
              (Drawing, Spoken English, Abacus).
            </p>

            <div className="p-3 bg-neutral-50 rounded-lg text-neutral-700 text-xs mb-4">
              <div className="font-semibold text-black mb-1">Safety Guarantee:</div>
              Existing courses, student enrollments, attendance records, and examination scores will{' '}
              <span className="font-bold text-emerald-700">NOT be overwritten or deleted</span>.
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBootstrapModal(false)}
                className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBootstrap}
                disabled={bootstrapping}
                className="px-4 py-2 bg-[#FF8500] hover:bg-[#E67700] text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {bootstrapping ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Bootstrapping...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Proceed with Setup</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE COURSE CONFIRM */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold text-black">Delete Course</h2>
            </div>

            {deleteModalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteModalError}</span>
              </div>
            )}

            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Are you sure you want to delete{' '}
              <span className="font-bold text-black">'{courseToDelete.name}'</span>? This will permanently
              remove this academic standard along with its associated batches, subjects, and schedules.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCourseToDelete(null);
                  setDeleteModalError(null);
                }}
                className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE BATCH CONFIRM */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold text-black">Delete Batch</h2>
            </div>

            {deleteModalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteModalError}</span>
              </div>
            )}

            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Are you sure you want to delete batch{' '}
              <span className="font-bold text-black">'{batchToDelete.batch.name}'</span> from course{' '}
              <span className="font-bold text-black">'{batchToDelete.courseName}'</span>? This will
              remove this cohort section.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setBatchToDelete(null);
                  setDeleteModalError(null);
                }}
                className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBatch}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE SUBJECT CONFIRM */}
      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold text-black">Delete Subject</h2>
            </div>

            {deleteModalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteModalError}</span>
              </div>
            )}

            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Are you sure you want to delete subject{' '}
              <span className="font-bold text-black">'{subjectToDelete.name}'</span> (
              {subjectToDelete.code})? This will remove this subject offering.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubjectToDelete(null);
                  setDeleteModalError(null);
                }}
                className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSubject}
                disabled={deleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
