'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  UserCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Briefcase,
  Shield,
  Layers,
  KeyRound,
  RefreshCw,
  QrCode,
  X,
  ExternalLink,
  Trash2,
  DollarSign,
  Receipt,
  BookOpen,
} from 'lucide-react';
import { ApiClient } from '@/lib/api/api-client';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';

interface StaffAssignment {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  batchId: string | null;
  batchName: string | null;
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  role: string | null;
  staffSharePercentage: number;
  compensationRule: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string | null;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  designation: string | null;
  staffCategory?: 'GENERAL' | 'FACULTY';
  compensationModel?: 'FIXED_SALARY' | 'REVENUE_SHARING';
  fixedSalaryAmount?: number;
  payFrequency?: 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY';
  compensationEffectiveDate?: string;
  attendanceCode: string | null;
  status: string;
  roles: string[];
  primaryRole: string;
  assignments: StaffAssignment[];
  totalAttendanceRecorded: number;
  createdAt: string;
}

interface CourseOption {
  id: string;
  name: string;
  code: string;
  subjects?: { id: string; name: string; code: string }[];
  batches: { id: string; name: string; code: string | null }[];
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showSuccessCodeModal, setShowSuccessCodeModal] = useState<{
    name: string;
    code: string;
    role: string;
  } | null>(null);
  const [showAssignModal, setShowAssignModal] = useState<StaffMember | null>(null);
  const [showSalaryModal, setShowSalaryModal] = useState<StaffMember | null>(null);
  const [showAccrueModal, setShowAccrueModal] = useState<StaffMember | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState<StaffMember | null>(null);
  const [salaryData, setSalaryData] = useState<any | null>(null);
  const [loadingSalary, setLoadingSalary] = useState(false);

  // Staff delete modal state
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  // Accrue & Adjustment form states
  const [accruePeriod, setAccruePeriod] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [accrueNotes, setAccrueNotes] = useState('');
  const [adjustmentForm, setAdjustmentForm] = useState({
    amount: 1000,
    type: 'BONUS' as 'BONUS' | 'DEDUCTION' | 'ADJUSTMENT',
    reason: '',
    notes: '',
  });

  // Forms
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'TEACHER',
    designation: '',
    password: '',
    staffCategory: 'FACULTY' as 'GENERAL' | 'FACULTY',
    compensationModel: 'REVENUE_SHARING' as 'FIXED_SALARY' | 'REVENUE_SHARING',
    fixedSalaryAmount: 25000,
    payFrequency: 'MONTHLY' as 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY',
    courseId: '',
    subjectId: '',
    batchId: '',
    staffSharePercentage: 70,
  });

  const [assignForm, setAssignForm] = useState({
    courseId: '',
    subjectId: '',
    batchId: '',
    role: 'INSTRUCTOR',
    staffSharePercentage: 70,
    compensationRule: 'REVENUE_SHARE_70_30',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pathname = usePathname();

  // Reset all modals when route changes
  useEffect(() => {
    setShowOnboardModal(false);
    setShowSuccessCodeModal(null);
    setShowAssignModal(null);
    setShowSalaryModal(null);
    setShowAccrueModal(null);
    setShowAdjustmentModal(null);
    setStaffToDelete(null);
    setDeleteModalError(null);
  }, [pathname]);

  // Handle Escape key & body scroll lock
  useEffect(() => {
    const isAnyModalOpen =
      showOnboardModal ||
      !!showSuccessCodeModal ||
      !!showAssignModal ||
      !!showSalaryModal ||
      !!showAccrueModal ||
      !!showAdjustmentModal ||
      !!staffToDelete;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOnboardModal(false);
        setShowSuccessCodeModal(null);
        setShowAssignModal(null);
        setShowSalaryModal(null);
        setShowAccrueModal(null);
        setShowAdjustmentModal(null);
        setStaffToDelete(null);
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
  }, [showOnboardModal, showSuccessCodeModal, showAssignModal, showSalaryModal, showAccrueModal, showAdjustmentModal, staffToDelete]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [staffData, coursesData] = await Promise.all([
        ApiClient.fetch<StaffMember[]>('/staff'),
        ApiClient.fetch<CourseOption[]>('/courses'),
      ]);
      setStaffList(staffData);
      setCourses(coursesData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load staff records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openSalaryStatement = async (staff: StaffMember) => {
    setShowSalaryModal(staff);
    setLoadingSalary(true);
    setSalaryData(null);
    try {
      const data = await ApiClient.fetch(`/salary/staff/${staff.id}`);
      setSalaryData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load faculty salary statement');
    } finally {
      setLoadingSalary(false);
    }
  };

  const handleOnboardStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const isFaculty = form.staffCategory === 'FACULTY';
    if (!form.name.trim() || !form.phone.trim() || !form.role) {
      setErrorMsg('Please fill mandatory fields: Name, Mobile Number, and Role.');
      return;
    }
    if (isFaculty && !form.courseId) {
      setErrorMsg('Please select Initial Teaching Assignment for Faculty.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const parts = form.name.trim().split(/\s+/);
      const firstName = parts[0] || 'Staff';
      const lastName = parts.slice(1).join(' ') || '.';
      const cleanPhone = form.phone.trim();
      const generatedEmail = `staff_${cleanPhone.replace(/\D/g, '') || Date.now()}@rcacademy.local`;

      const payload: any = {
        name: form.name.trim(),
        firstName,
        lastName,
        email: form.email.trim() || generatedEmail,
        phone: cleanPhone,
        role: form.role,
        designation: form.designation.trim() || undefined,
        password: form.password || undefined,
        staffCategory: form.staffCategory,
        compensationModel: form.compensationModel,
        fixedSalaryAmount: Number(form.fixedSalaryAmount) || 0,
        payFrequency: form.payFrequency,
        ...(isFaculty && form.courseId
          ? {
              courseAssignments: [
                {
                  courseId: form.courseId,
                  subjectId: form.subjectId || undefined,
                  batchId: form.batchId || undefined,
                  role: 'LEAD_INSTRUCTOR',
                  staffSharePercentage: Number(form.staffSharePercentage) || 70,
                  compensationRule: 'REVENUE_SHARE_70_30',
                },
              ],
            }
          : {}),
      };

      const res: any = await ApiClient.fetch('/staff', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowOnboardModal(false);
      setForm({
        name: '',
        email: '',
        phone: '',
        role: 'TEACHER',
        designation: '',
        password: '',
        staffCategory: 'FACULTY',
        compensationModel: 'REVENUE_SHARING',
        fixedSalaryAmount: 25000,
        payFrequency: 'MONTHLY',
        courseId: '',
        subjectId: '',
        batchId: '',
        staffSharePercentage: 70,
      });

      setShowSuccessCodeModal({
        name: res.fullName || `${res.firstName || firstName} ${res.lastName || lastName}`,
        code: res.attendanceCode,
        role: res.role,
      });

      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to onboard staff member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccrueSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accruePeriod.trim()) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res: any = await ApiClient.fetch('/salary/accrue-fixed', {
        method: 'POST',
        body: JSON.stringify({
          payPeriod: accruePeriod.trim(),
          staffId: showAccrueModal?.id,
          notes: accrueNotes.trim() || undefined,
        }),
      });
      setSuccessMsg(res.message || 'Fixed salary accrued successfully');
      setShowAccrueModal(null);
      setAccrueNotes('');
      if (showSalaryModal) {
        openSalaryStatement(showSalaryModal);
      }
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accrue fixed salary');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustmentModal || !adjustmentForm.reason.trim() || adjustmentForm.amount <= 0) return;
    try {
      setSubmitting(true);
      setErrorMsg(null);
      await ApiClient.fetch('/salary/adjustments', {
        method: 'POST',
        body: JSON.stringify({
          staffId: showAdjustmentModal.id,
          amount: Number(adjustmentForm.amount),
          type: adjustmentForm.type,
          reason: adjustmentForm.reason.trim(),
          notes: adjustmentForm.notes.trim() || undefined,
        }),
      });
      setSuccessMsg(`Salary adjustment (${adjustmentForm.type}) recorded successfully`);
      setShowAdjustmentModal(null);
      setAdjustmentForm({ amount: 1000, type: 'BONUS', reason: '', notes: '' });
      if (showSalaryModal) {
        openSalaryStatement(showSalaryModal);
      }
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal || !assignForm.courseId) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await ApiClient.fetch(`/staff/${showAssignModal.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          assignments: [
            {
              courseId: assignForm.courseId,
              subjectId: assignForm.subjectId || undefined,
              batchId: assignForm.batchId || undefined,
              role: assignForm.role,
              staffSharePercentage: Number(assignForm.staffSharePercentage) || 70,
              compensationRule: assignForm.compensationRule || 'REVENUE_SHARE_70_30',
            },
          ],
        }),
      });

      setSuccessMsg(`Assignment updated for ${showAssignModal.fullName}`);
      setShowAssignModal(null);
      setAssignForm({
        courseId: '',
        subjectId: '',
        batchId: '',
        role: 'INSTRUCTOR',
        staffSharePercentage: 70,
        compensationRule: 'REVENUE_SHARE_70_30',
      });
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign course/subject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (staffId: string, assignmentId: string) => {
    if (!confirm('Deactivate this teaching assignment? Historical earnings will be strictly preserved.')) return;
    try {
      await ApiClient.fetch(`/staff/${staffId}/assignments/${assignmentId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Teaching assignment deactivated');
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to remove assignment');
    }
  };

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.attendanceCode && s.attendanceCode.includes(search)) ||
      (s.designation && s.designation.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'ALL' || s.roles.includes(roleFilter);

    const isFaculty = s.staffCategory === 'FACULTY' || s.compensationModel === 'REVENUE_SHARING' || s.roles.includes('TEACHER');
    const matchesCategory =
      categoryFilter === 'ALL' ||
      (categoryFilter === 'FACULTY' ? isFaculty : !isFaculty);

    return matchesSearch && matchesRole && matchesCategory;
  });

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    try {
      setDeletingStaff(true);
      setDeleteModalError(null);
      setErrorMsg(null);
      await ApiClient.fetch(`/staff/${staffToDelete.id}`, {
        method: 'DELETE',
      });
      setSuccessMsg(
        `Staff member '${staffToDelete.fullName}' deleted successfully${
          staffToDelete.attendanceCode ? ` (Attendance code #${staffToDelete.attendanceCode} released for re-allocation)` : ''
        }`
      );
      setStaffToDelete(null);
      await fetchData();
    } catch (err: any) {
      setDeleteModalError(err.message || 'Failed to delete staff member');
    } finally {
      setDeletingStaff(false);
    }
  };

  const selectedCourseObj = courses.find((c) => c.id === form.courseId);
  const selectedAssignCourseObj = courses.find((c) => c.id === assignForm.courseId);

  return (
    <>
      <Header
        title="Staff Directory, Assignments & Dual Compensation"
        subtitle="Manage faculty 70/30 revenue sharing, general staff fixed salary, attendance codes and auditable ledgers"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData()}
            className="p-1.5 border border-neutral-300 rounded-lg hover:bg-neutral-50 text-neutral-700 transition"
            title="Refresh staff"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setErrorMsg(null);
              setShowOnboardModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF8500] hover:bg-[#E67700] text-white font-medium text-xs rounded-lg shadow-subtle transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Onboard Staff</span>
          </button>
        </div>
      </Header>

      <ResponsivePageContainer>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900">
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
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Total Faculty & Staff</div>
          <div className="text-2xl font-bold text-black mt-1">{staffList.length}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Single record per person</div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Teaching Faculty</div>
          <div className="text-2xl font-bold text-[#FF8500] mt-1">
            {staffList.filter((s) => s.staffCategory === 'FACULTY' || s.compensationModel === 'REVENUE_SHARING' || s.roles.includes('TEACHER')).length}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">70% revenue share from fees</div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">General Staff</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {staffList.filter((s) => s.staffCategory === 'GENERAL' || s.compensationModel === 'FIXED_SALARY').length}
          </div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Fixed periodic salary</div>
        </div>
        <div className="p-4 bg-white border border-neutral-200 rounded-xl shadow-xs">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Dual Model Engine</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">Active</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Fixed Salary + Faculty Revenue Share</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-neutral-200 rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, designation, or 3-digit code..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] focus:border-[#FF8500]"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
            >
              <option value="ALL">All Categories</option>
              <option value="FACULTY">Faculty (Revenue Share)</option>
              <option value="GENERAL">General Staff (Fixed)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
            >
              <option value="ALL">All Roles</option>
              <option value="TEACHER">Teachers</option>
              <option value="ACADEMY_ADMIN">Admins</option>
              <option value="ACCOUNTANT">Accountants</option>
              <option value="STAFF">General Staff</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Cards Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl">
          <RefreshCw className="w-6 h-6 animate-spin text-[#FF8500] mx-auto mb-2" />
          <p className="text-sm text-neutral-500">Loading staff records...</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl">
          <UserCheck className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-neutral-700">No staff members found</h3>
          <p className="text-xs text-neutral-500 mt-1">
            Click "Onboard Staff" to add instructors and administrators.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => (
            <div
              key={staff.id}
              className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col justify-between hover:border-neutral-300 transition shadow-xs"
            >
              <div>
                {/* Header with Category & Compensation Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-black text-base leading-tight truncate">
                        {staff.fullName}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        staff.staffCategory === 'FACULTY' || staff.compensationModel === 'REVENUE_SHARING' || staff.roles.includes('TEACHER')
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {staff.staffCategory === 'FACULTY' || staff.compensationModel === 'REVENUE_SHARING' || staff.roles.includes('TEACHER')
                          ? 'Faculty'
                          : 'General Staff'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-xs text-neutral-500">
                        {staff.designation || staff.primaryRole}
                      </p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        staff.compensationModel === 'FIXED_SALARY'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {staff.compensationModel === 'FIXED_SALARY'
                          ? `Fixed ₹${(staff.fixedSalaryAmount || 0).toLocaleString('en-IN')}/${staff.payFrequency === 'MONTHLY' ? 'mo' : (staff.payFrequency || 'mo').toLowerCase()}`
                          : '70% Revenue Share'}
                      </span>
                    </div>
                  </div>

                  {/* 3-Digit Attendance Code Badge */}
                  {staff.attendanceCode ? (
                    <div
                      className="px-2.5 py-1 bg-[#FFF4E5] border border-[#FF8500] text-[#CC6B00] rounded-lg text-center shadow-2xs shrink-0"
                      title="Unique 3-Digit Staff Attendance Code"
                    >
                      <div className="text-[9px] uppercase font-bold tracking-wider text-neutral-500">Code</div>
                      <div className="font-mono font-bold text-base tracking-widest text-[#CC6B00]">
                        {staff.attendanceCode}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded shrink-0">
                      No Code
                    </span>
                  )}
                </div>

                {/* Contact info */}
                <div className="space-y-1 mt-3 pt-3 border-t border-neutral-100 text-xs text-neutral-600">
                  <div className="flex items-center gap-2 truncate">
                    <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">{staff.email}</span>
                  </div>
                  {staff.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span>{staff.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="capitalize">{staff.roles.join(', ')}</span>
                  </div>
                </div>

                {/* Teaching Assignments (Faculty) OR Fixed Compensation Terms (General Staff) */}
                {staff.staffCategory === 'FACULTY' || staff.compensationModel === 'REVENUE_SHARING' || staff.roles.includes('TEACHER') ? (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-[#FF8500]" />
                        Teaching Assignments ({staff.assignments.length})
                      </span>
                      <button
                        onClick={() => setShowAssignModal(staff)}
                        className="text-[#FF8500] hover:text-[#CC6B00] text-[11px] font-semibold"
                      >
                        + Assign
                      </button>
                    </div>

                    {staff.assignments.length === 0 ? (
                      <p className="text-[11px] text-neutral-400 italic">No active courses assigned.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {staff.assignments.map((as) => (
                          <div
                            key={as.id}
                            className="flex items-center justify-between text-[11px] bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-200"
                          >
                            <div className="truncate flex-1">
                              <div className="font-semibold text-black truncate">
                                {as.courseName} ({as.courseCode})
                              </div>
                              <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                                {as.subjectName ? (
                                  <span className="text-[#CC6B00] font-medium bg-[#FFF4E5] px-1 rounded">
                                    {as.subjectName}
                                  </span>
                                ) : (
                                  <span>All Subjects</span>
                                )}
                                <span>•</span>
                                <span>{as.batchName ? as.batchName : 'All Batches'}</span>
                                <span>•</span>
                                <span className="font-semibold text-emerald-700">
                                  {as.staffSharePercentage || 70}% Pool
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveAssignment(staff.id, as.id)}
                              className="text-neutral-400 hover:text-rose-600 p-1 ml-1"
                              title="Deactivate assignment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 pt-3 border-t border-neutral-100">
                    <div className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                      Fixed Compensation Terms
                    </div>
                    <div className="p-2.5 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center text-blue-950">
                        <span className="text-neutral-600">Fixed Salary:</span>
                        <strong className="font-mono text-sm text-black">
                          ₹{(staff.fixedSalaryAmount || 0).toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center text-blue-950">
                        <span className="text-neutral-600">Pay Frequency:</span>
                        <span className="capitalize font-semibold text-neutral-800">
                          {staff.payFrequency || 'Monthly'}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500 italic pt-1 border-t border-blue-200/60 leading-tight">
                        Fixed salary staff receive monthly accruals and adjustments independent of student course fees.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer: Clock-ins & Salary View Button + Delete Button */}
              <div className="mt-4 pt-2.5 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                <span className="text-neutral-500">Clock-ins: {staff.totalAttendanceRecorded}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openSalaryStatement(staff)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-black font-semibold rounded text-xs transition"
                  >
                    <DollarSign className="w-3.5 h-3.5 text-[#FF8500]" />
                    Salary Statement
                  </button>
                  <button
                    onClick={() => {
                      setStaffToDelete(staff);
                      setDeleteModalError(null);
                    }}
                    className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title={`Delete ${staff.fullName}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </ResponsivePageContainer>

      {/* SALARY STATEMENT MODAL */}
      {showSalaryModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSalaryModal(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full border-t sm:border border-neutral-200 shadow-2xl overflow-hidden my-0 sm:my-8 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 pb-[env(safe-area-inset-bottom)]"
          >
            {/* Native Mobile Drag Handle */}
            <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2 sm:hidden shrink-0" />
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-[#FF8500]">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-black text-base">
                      {salaryData?.staff?.compensationModel === 'FIXED_SALARY'
                        ? 'General Staff Compensation & Salary'
                        : 'Faculty 70/30 Revenue Sharing Statement'}
                    </h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      salaryData?.staff?.compensationModel === 'FIXED_SALARY'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {salaryData?.staff?.compensationModel === 'FIXED_SALARY' ? 'Fixed Salary' : 'Revenue Sharing'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {showSalaryModal.fullName} ({showSalaryModal.email}) • Attendance Code: {showSalaryModal.attendanceCode || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {salaryData?.staff?.compensationModel === 'FIXED_SALARY' && (
                  <button
                    type="button"
                    onClick={() => setShowAccrueModal(showSalaryModal)}
                    className="px-2.5 py-1 text-xs font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition flex items-center gap-1 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Accrue Salary
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentForm({ amount: 1000, type: 'BONUS', reason: '', notes: '' });
                    setShowAdjustmentModal(showSalaryModal);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-neutral-100 text-neutral-800 rounded-lg transition flex items-center gap-1 border border-neutral-300 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adjustment
                </button>
                <button
                  type="button"
                  onClick={() => setShowSalaryModal(null)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {loadingSalary ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#FF8500] mx-auto mb-2" />
                  <p className="text-xs text-neutral-500">Loading audited salary ledger...</p>
                </div>
              ) : salaryData ? (
                <>
                  {/* Fixed Terms Banner for General Staff */}
                  {salaryData.staff?.compensationModel === 'FIXED_SALARY' && (
                    <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-blue-600" />
                          Agreed Compensation Contract
                        </div>
                        <p className="text-xs text-blue-800/80 mt-1">
                          General staff fixed terms: independent of student course fee collections.
                        </p>
                      </div>
                      <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-blue-200/80 shadow-2xs">
                        <div>
                          <div className="text-[10px] uppercase font-bold text-neutral-400">Fixed Rate</div>
                          <div className="font-mono text-base font-extrabold text-black">
                            ₹{(salaryData.staff.fixedSalaryAmount || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div className="h-6 w-px bg-neutral-200" />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-neutral-400">Frequency</div>
                          <div className="text-xs font-semibold capitalize text-neutral-700">
                            {salaryData.staff.payFrequency || 'Monthly'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* KPI Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Total Accrued</div>
                      <div className="text-xl font-extrabold text-black mt-1">
                        ₹{Number(salaryData.summary.totalEarned).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {salaryData.staff?.compensationModel === 'FIXED_SALARY' ? 'Fixed accruals' : '70% revenue pool'}
                      </div>
                    </div>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Adjustments</div>
                      <div className="text-xl font-extrabold text-rose-600 mt-1">
                        ₹{Number(salaryData.summary.totalAdjustments).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-neutral-400">Audited corrections & bonuses</div>
                    </div>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Paid to Staff</div>
                      <div className="text-xl font-extrabold text-emerald-600 mt-1">
                        ₹{Number(salaryData.summary.totalPaid).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-neutral-400">Disbursed payouts</div>
                    </div>
                    <div className="p-3 bg-[#FFF4E5] border border-[#FF8500] rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-[#CC6B00] tracking-wider">Outstanding Payable</div>
                      <div className="text-xl font-extrabold text-[#CC6B00] mt-1">
                        ₹{Number(salaryData.summary.outstandingPayable).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-neutral-600 font-medium">Available balance</div>
                    </div>
                  </div>

                  {/* Earnings by Teaching Assignment (Only for Faculty) */}
                  {salaryData.staff?.compensationModel !== 'FIXED_SALARY' && (
                    <div>
                      <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#FF8500]" />
                        Earnings Breakdown by Teaching Assignment
                      </h3>
                      {salaryData.earningsByAssignment.length === 0 ? (
                        <p className="text-xs text-neutral-400 italic bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                          No earnings attributed to assignments yet. Earnings accrue automatically when student fees are collected.
                        </p>
                      ) : (
                        <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold">
                              <tr>
                                <th className="px-3 py-2">Class / Course</th>
                                <th className="px-3 py-2">Subject</th>
                                <th className="px-3 py-2">Batch</th>
                                <th className="px-3 py-2">Rule / Rate</th>
                                <th className="px-3 py-2 text-right">Collections Count</th>
                                <th className="px-3 py-2 text-right">Cumulative Earned</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200">
                              {salaryData.earningsByAssignment.map((as: any, idx: number) => (
                                <tr key={idx} className="hover:bg-neutral-50/50">
                                  <td className="px-3 py-2 font-medium text-black">{as.className} ({as.classCode})</td>
                                  <td className="px-3 py-2 text-[#CC6B00] font-medium">{as.subjectName}</td>
                                  <td className="px-3 py-2 text-neutral-600">{as.batchName || 'All Batches'}</td>
                                  <td className="px-3 py-2 text-neutral-500 font-mono text-[11px]">{as.rate}% pool</td>
                                  <td className="px-3 py-2 text-right text-neutral-600">{as.entriesCount}</td>
                                  <td className="px-3 py-2 text-right font-bold text-black">₹{as.earned.toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Audit Ledger Rows */}
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-[#FF8500]" />
                      Audited Compensation Ledger
                    </h3>
                    {salaryData.recentLedger.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                        No transactions recorded.
                      </p>
                    ) : (
                      <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-xs max-h-56 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold sticky top-0">
                            <tr>
                              <th className="px-3 py-2">Reference #</th>
                              <th className="px-3 py-2">Offering / Description</th>
                              <th className="px-3 py-2">Rule / Period</th>
                              <th className="px-3 py-2 text-right">Earned Amount</th>
                              <th className="px-3 py-2 text-center">Status</th>
                              <th className="px-3 py-2 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200">
                            {salaryData.recentLedger.map((row: any) => (
                              <tr key={row.id} className={`hover:bg-neutral-50/50 ${row.isReversed ? 'bg-rose-50/30' : ''}`}>
                                <td className="px-3 py-2 font-mono text-black font-medium">{row.receiptNumber}</td>
                                <td className="px-3 py-2 text-neutral-700">
                                  {row.className} • <span className="font-semibold text-[#CC6B00]">{row.subjectName}</span>
                                  {row.notes && <div className="text-[10px] text-neutral-400">{row.notes}</div>}
                                </td>
                                <td className="px-3 py-2 text-neutral-500 font-mono text-[11px]">
                                  {row.payPeriod || row.ruleApplied}
                                </td>
                                <td className={`px-3 py-2 text-right font-bold ${row.earnedAmount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  ₹{row.earnedAmount.toLocaleString('en-IN')}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    row.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : row.status === 'APPROVED'
                                      ? 'bg-blue-100 text-blue-800'
                                      : row.isReversed
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-neutral-100 text-neutral-800'
                                  }`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right text-neutral-400 text-[11px]">
                                  {new Date(row.createdAt).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-neutral-200 flex justify-end bg-neutral-50">
              <button
                type="button"
                onClick={() => setShowSalaryModal(null)}
                className="px-4 py-2 text-sm font-semibold bg-neutral-900 hover:bg-black text-white rounded-lg transition"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS ATTENDANCE CODE MODAL */}
      {showSuccessCodeModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSuccessCodeModal(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-2xl max-w-sm w-full border-t sm:border border-neutral-200 shadow-2xl p-6 text-center animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
          >
            <div className="w-12 h-12 bg-[#FFF4E5] border border-[#FF8500] text-[#CC6B00] rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-[#FF8500]" />
            </div>

            <h2 className="text-lg font-bold text-black">Staff Onboarded Successfully</h2>
            <p className="text-xs text-neutral-500 mt-1">
              {showSuccessCodeModal.name} ({showSuccessCodeModal.role})
            </p>

            <div className="my-5 p-4 bg-[#FFF4E5]/60 border-2 border-dashed border-[#FF8500] rounded-xl">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-neutral-600 mb-1">
                Generated Attendance Code
              </div>
              <div className="font-mono text-4xl font-extrabold text-[#CC6B00] tracking-widest">
                {showSuccessCodeModal.code}
              </div>
              <div className="text-[10px] text-neutral-500 mt-2">
                Guaranteed unique across all students and staff (100–999).
              </div>
            </div>

            <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
              The staff member can now use this 3-digit code to instant clock in and clock out on the
              Smart Attendance Terminal.
            </p>

            <button
              onClick={() => setShowSuccessCodeModal(null)}
              className="w-full py-2.5 bg-[#FF8500] hover:bg-[#E67700] text-white font-semibold text-sm rounded-lg transition"
            >
              Done & Return to Directory
            </button>
          </div>
        </div>
      )}

      {/* ONBOARD STAFF MODAL */}
      {showOnboardModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowOnboardModal(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full border-t sm:border border-neutral-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 my-0 sm:my-8 max-h-[92vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
          >
            {/* Native Mobile Drag Handle */}
            <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2 sm:hidden shrink-0" />
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-neutral-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-[#FF8500]">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-black text-base">
                    Onboard Faculty or Staff Member
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Fields marked with <span className="text-rose-500 font-semibold">*</span> are mandatory. Unique 3-digit code is allocated upon onboarding.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOnboardModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnboardStaff} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* 1. Staff Classification & Compensation Model Selector */}
                <div>
                  <label className="block text-xs font-bold text-neutral-800 uppercase tracking-wider mb-2">
                    Staff Category & Compensation Model <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          staffCategory: 'FACULTY',
                          compensationModel: 'REVENUE_SHARING',
                          role: 'TEACHER',
                        });
                      }}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        form.staffCategory === 'FACULTY'
                          ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-500/20'
                          : 'bg-white border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-sm text-purple-950 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-purple-600" />
                          Teaching Faculty
                        </span>
                        {form.staffCategory === 'FACULTY' && (
                          <span className="w-2 h-2 rounded-full bg-purple-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-tight">
                        Calculated from eligible collected fees for assigned subjects (default 70% faculty / 30% academy share).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          staffCategory: 'GENERAL',
                          compensationModel: 'FIXED_SALARY',
                          role: form.role === 'TEACHER' ? 'STAFF' : form.role,
                        });
                      }}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        form.staffCategory === 'GENERAL'
                          ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20'
                          : 'bg-white border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-sm text-blue-950 flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-blue-600" />
                          General Staff
                        </span>
                        {form.staffCategory === 'GENERAL' && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-tight">
                        Fixed agreed salary (e.g. Admin, Accountant, Office staff). Not calculated from student course fees.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Basic Staff Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Single Name Field (Mandatory) */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Gupta"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] transition"
                    />
                  </div>

                  {/* Mobile Number Field (Mandatory) */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                      Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] transition"
                    />
                  </div>

                  {/* Role Field (Mandatory) */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                      Role <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setForm({
                          ...form,
                          role: newRole,
                          staffCategory: newRole === 'TEACHER' ? 'FACULTY' : form.staffCategory,
                          compensationModel: newRole === 'TEACHER' ? 'REVENUE_SHARING' : form.compensationModel,
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] transition"
                    >
                      <option value="TEACHER">Teacher / Faculty</option>
                      <option value="ACADEMY_ADMIN">Academy Admin</option>
                      <option value="ACCOUNTANT">Accountant</option>
                      <option value="STAFF">General Staff</option>
                    </select>
                  </div>

                  {/* Email Address (Optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Email Address <span className="text-neutral-400 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. ramesh@example.com (optional)"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] transition"
                    />
                  </div>

                  {/* Designation (Optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Designation <span className="text-neutral-400 font-normal normal-case">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Faculty / HOD"
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] transition"
                    />
                  </div>

                  {/* Initial Password (Optional) */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                      Initial Password <span className="text-neutral-400 font-normal normal-case">(optional - default: Staff@12345)</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Leave empty for default (Staff@12345)"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] transition"
                    />
                  </div>
                </div>

                {/* Fixed Salary Settings for General Staff */}
                {form.staffCategory === 'GENERAL' && (
                  <div className="p-4 sm:p-5 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white border border-blue-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                          Fixed Salary Contract Terms
                        </h3>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                        General Staff
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                          Agreed Salary Amount (₹) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          step={500}
                          value={form.fixedSalaryAmount}
                          onChange={(e) => setForm({ ...form, fixedSalaryAmount: Number(e.target.value) })}
                          className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          placeholder="e.g. 25000"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                          Payment Frequency
                        </label>
                        <select
                          value={form.payFrequency}
                          onChange={(e) => setForm({ ...form, payFrequency: e.target.value as any })}
                          className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="BI_WEEKLY">Bi-Weekly</option>
                          <option value="WEEKLY">Weekly</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Course & Subject Assignment Section (MANDATORY FOR FACULTY) */}
                {form.staffCategory === 'FACULTY' && (
                  <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-white border border-amber-200/90 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-[#FF8500]">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                            Initial Teaching Assignment <span className="text-rose-500">*</span>
                          </h3>
                          <p className="text-[11px] text-neutral-500">
                            Class selection is mandatory. Subject and batch are optional.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-orange-100 text-[#FF8500] border border-orange-200">
                        Faculty Mandatory
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Class / Course (Mandatory) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                          Class / Course <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={form.courseId}
                          onChange={(e) => setForm({ ...form, courseId: e.target.value, subjectId: '', batchId: '' })}
                          className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500]"
                        >
                          <option value="" disabled>-- Select Class / Course * --</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Subject (Optional) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Subject <span className="text-neutral-400 font-normal normal-case">(optional)</span>
                        </label>
                        <select
                          value={form.subjectId}
                          disabled={!form.courseId}
                          onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] disabled:bg-neutral-100 disabled:text-neutral-400"
                        >
                          <option value="">All Subjects (Default)</option>
                          {selectedCourseObj?.subjects?.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Batch (Optional) */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                          Batch <span className="text-neutral-400 font-normal normal-case">(optional)</span>
                        </label>
                        <select
                          value={form.batchId}
                          disabled={!form.courseId}
                          onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                          className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] disabled:bg-neutral-100 disabled:text-neutral-400"
                        >
                          <option value="">All Batches (Default)</option>
                          {selectedCourseObj?.batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} {b.code ? `(${b.code})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Revenue Share % (Optional) */}
                    <div className="pt-1">
                      <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                        Faculty Revenue Share % <span className="text-neutral-400 font-normal normal-case">(optional - default 70%)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={form.staffSharePercentage}
                        onChange={(e) => setForm({ ...form, staffSharePercentage: Number(e.target.value) })}
                        className="w-full max-w-[200px] px-3 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500]"
                        placeholder="70"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/70 shrink-0">
                <p className="text-xs text-neutral-500 hidden sm:block">
                  Staff member will be immediately enrolled into the attendance & payroll system.
                </p>
                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="px-4 py-2.5 text-sm font-medium text-neutral-600 hover:text-black hover:bg-neutral-200/60 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Onboarding...</span>
                      </>
                    ) : (
                      'Complete Onboarding'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN COURSE & SUBJECT MODAL */}
      {showAssignModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAssignModal(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-xl max-w-md w-full border-t sm:border border-neutral-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 pb-[env(safe-area-inset-bottom)]"
          >
            {/* Native Mobile Drag Handle */}
            <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2 sm:hidden shrink-0" />
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-black text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FF8500]" />
                  Assign Course & Subject
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">Faculty: {showAssignModal.fullName}</p>
              </div>
              <button
                onClick={() => setShowAssignModal(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAssignment} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Class / Academic Level <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={assignForm.courseId}
                  onChange={(e) => setAssignForm({ ...assignForm, courseId: e.target.value, subjectId: '', batchId: '' })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                >
                  <option value="">Select course/class...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Subject (e.g. Maths, Science)
                </label>
                <select
                  value={assignForm.subjectId}
                  disabled={!assignForm.courseId}
                  onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  <option value="">All Subjects / General</option>
                  {selectedAssignCourseObj?.subjects?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Select Batch (Optional)
                </label>
                <select
                  value={assignForm.batchId}
                  disabled={!assignForm.courseId}
                  onChange={(e) => setAssignForm({ ...assignForm, batchId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] disabled:bg-neutral-100 disabled:text-neutral-400"
                >
                  <option value="">All Batches (Class-Wide)</option>
                  {selectedAssignCourseObj?.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.code ? `(${b.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Staff Pool Share %
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={assignForm.staffSharePercentage}
                      onChange={(e) => setAssignForm({ ...assignForm, staffSharePercentage: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    />
                    <span className="absolute right-3 top-2 text-xs text-neutral-400">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                    Compensation Rule
                  </label>
                  <select
                    value={assignForm.compensationRule}
                    onChange={(e) => setAssignForm({ ...assignForm, compensationRule: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                  >
                    <option value="REVENUE_SHARE_70_30">70/30 Standard</option>
                    <option value="FULL_POOL_100">100% Direct</option>
                    <option value="CUSTOM_CONTRACT">Custom Contract</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                  Role in Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. LEAD_INSTRUCTOR, SUBJECT_EXPERT"
                  value={assignForm.role}
                  onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(null)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition disabled:opacity-50"
                >
                  {submitting ? 'Assigning...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCRUE FIXED SALARY MODAL */}
      {showAccrueModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAccrueModal(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full border-t sm:border border-neutral-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 pb-[env(safe-area-inset-bottom)]"
          >
            {/* Native Mobile Drag Handle */}
            <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2 sm:hidden shrink-0" />
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-[#FF8500]">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-black text-sm">
                    Accrue Fixed Monthly Salary
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Staff: {showAccrueModal.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccrueModal(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAccrueSalary} className="p-5 space-y-4">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Agreed Fixed Salary:</span>
                  <strong className="text-black font-mono">
                    ₹{(showAccrueModal.fixedSalaryAmount || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Pay Frequency:</span>
                  <span className="capitalize font-semibold text-neutral-700">
                    {showAccrueModal.payFrequency || 'Monthly'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                  Pay Period (YYYY-MM) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026-10"
                  value={accruePeriod}
                  onChange={(e) => setAccruePeriod(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] font-mono"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Idempotent: Re-accruing for the same period will be safely skipped.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Notes / Audit Reference <span className="text-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regular monthly payroll accrual"
                  value={accrueNotes}
                  onChange={(e) => setAccrueNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAccrueModal(null)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? 'Accruing...' : 'Confirm Accrual'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SALARY ADJUSTMENT MODAL */}
      {showAdjustmentModal && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdjustmentModal(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full border-t sm:border border-neutral-200 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 pb-[env(safe-area-inset-bottom)]"
          >
            {/* Native Mobile Drag Handle */}
            <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2 sm:hidden shrink-0" />
            <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-[#FF8500]">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-black text-sm">
                    Record Salary Adjustment
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Staff: {showAdjustmentModal.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustmentModal(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdjustment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                  Adjustment Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['BONUS', 'DEDUCTION', 'ADJUSTMENT'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjustmentForm({ ...adjustmentForm, type: t })}
                      className={`py-2 text-xs font-bold rounded-xl border transition ${
                        adjustmentForm.type === t
                          ? t === 'DEDUCTION'
                            ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-300'
                          : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {t === 'BONUS' ? '+ Bonus' : t === 'DEDUCTION' ? '- Deduction' : '± Adjustment'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                  Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={100}
                  value={adjustmentForm.amount}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] font-mono font-bold"
                  placeholder="e.g. 2000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Festival Performance Bonus, Advance Deduction, etc."
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Internal Notes <span className="text-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved by Academy Director"
                  value={adjustmentForm.notes}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(null)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE STAFF CONFIRM */}
      {staffToDelete && (
        <div
          className="fixed inset-0 z-backdrop bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={() => {
            setStaffToDelete(null);
            setDeleteModalError(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-2xl max-w-md w-full border border-neutral-200 shadow-2xl p-6 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-black">Delete Staff Member</h2>
                <p className="text-xs text-neutral-500">Permanent profile & role removal</p>
              </div>
            </div>

            {deleteModalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteModalError}</span>
              </div>
            )}

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">Name:</span>
                <span className="font-semibold text-black">{staffToDelete.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Email:</span>
                <span className="text-neutral-700 font-mono text-[11px]">{staffToDelete.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Role / Designation:</span>
                <span className="text-neutral-700">{staffToDelete.designation || staffToDelete.primaryRole}</span>
              </div>
              {staffToDelete.attendanceCode && (
                <div className="flex justify-between items-center pt-1 border-t border-neutral-200/80">
                  <span className="text-neutral-500">3-Digit Attendance Code:</span>
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    #{staffToDelete.attendanceCode} (will be released)
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed mb-6">
              Are you sure you want to delete <strong className="text-black">{staffToDelete.fullName}</strong>? This action will permanently remove their user account, teaching assignments, and release their 3-digit attendance code back to the academy pool.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setStaffToDelete(null);
                  setDeleteModalError(null);
                }}
                disabled={deletingStaff}
                className="px-4 py-2 border border-neutral-200 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={deletingStaff}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-subtle transition disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {deletingStaff ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
