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
  Percent,
  Sparkles,
  Edit2,
  Sliders,
} from 'lucide-react';
import { ApiClient } from '@/lib/api/api-client';
import { useAuthUser } from '@/lib/auth/use-role';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import {
  SettlementFormState,
  defaultSettlementState,
  buildSettlementPayload,
  parseSettlementToForm,
  getSettlementBadgeDisplay,
} from '@/lib/utils/staff-settlement';

interface StaffAssignment {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  batchId: string | null;
  batchName: string | null;
  batchCode: string | null;
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  role: string | null;
  staffSharePercentage: number;
  compensationRule: string;
  settlementConfig?: any;
  settlementRuleSummary?: string;
  settlementRuleBadge?: string;
  settlementRuleMode?: string;
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
  const { user } = useAuthUser();
  const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN') ?? true;

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
    email?: string;
    password?: string;
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

  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [settlementForm, setSettlementForm] = useState<SettlementFormState>(defaultSettlementState);
  const [onboardSettlementForm, setOnboardSettlementForm] = useState<SettlementFormState>(defaultSettlementState);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pathname = usePathname();

  // Reset all modals when route changes
  useEffect(() => {
    setShowOnboardModal(false);
    setShowSuccessCodeModal(null);
    setShowAssignModal(null);
    setEditingAssignmentId(null);
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
    const isAdmin = form.role === 'ACADEMY_ADMIN' || form.role === 'SUPER_ADMIN';

    if (!form.name.trim() || !form.phone.trim() || !form.role) {
      setErrorMsg('Please fill mandatory fields: Name, Mobile Number, and Role.');
      return;
    }
    if (isAdmin && !form.email.trim()) {
      setErrorMsg('An Email Address is required for Administrator accounts so they can sign into the portal.');
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
      const finalEmail = form.email.trim() || generatedEmail;
      const plainPassword = form.password?.trim() || (isAdmin ? 'Admin@12345' : 'Staff@12345');

      const payload: any = {
        name: form.name.trim(),
        firstName,
        lastName,
        email: finalEmail,
        phone: cleanPhone,
        role: form.role,
        designation: form.designation.trim() || (form.role === 'SUPER_ADMIN' ? 'Super Administrator' : form.role === 'ACADEMY_ADMIN' ? 'Academy Administrator' : undefined),
        password: plainPassword,
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
                  staffSharePercentage: buildSettlementPayload(onboardSettlementForm).staffSharePercentage,
                  compensationRule: buildSettlementPayload(onboardSettlementForm).compensationRule,
                  settlementConfig: buildSettlementPayload(onboardSettlementForm).settlementConfig,
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
        email: res.email || finalEmail,
        password: plainPassword,
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

  const handleOpenAssignModal = (staff: StaffMember, assignment?: StaffAssignment) => {
    setShowAssignModal(staff);
    if (assignment) {
      setEditingAssignmentId(assignment.id);
      setAssignForm({
        courseId: assignment.courseId,
        subjectId: assignment.subjectId || '',
        batchId: assignment.batchId || '',
        role: assignment.role || 'INSTRUCTOR',
        staffSharePercentage: assignment.staffSharePercentage || 70,
        compensationRule: assignment.compensationRule || 'REVENUE_SHARE_70_30',
      });
      setSettlementForm(parseSettlementToForm(assignment.compensationRule, assignment.staffSharePercentage));
    } else {
      setEditingAssignmentId(null);
      setAssignForm({
        courseId: '',
        subjectId: '',
        batchId: '',
        role: 'INSTRUCTOR',
        staffSharePercentage: 70,
        compensationRule: 'REVENUE_SHARE_70_30',
      });
      setSettlementForm(defaultSettlementState);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal || !assignForm.courseId) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const settlement = buildSettlementPayload(settlementForm);

      await ApiClient.fetch(`/staff/${showAssignModal.id}/assignments`, {
        method: 'POST',
        body: JSON.stringify({
          assignments: [
            {
              courseId: assignForm.courseId,
              subjectId: assignForm.subjectId || undefined,
              batchId: assignForm.batchId || undefined,
              role: assignForm.role,
              staffSharePercentage: settlement.staffSharePercentage,
              compensationRule: settlement.compensationRule,
              settlementConfig: settlement.settlementConfig,
            },
          ],
        }),
      });

      setSuccessMsg(`Assignment & settlement rule saved for ${showAssignModal.fullName}`);
      setShowAssignModal(null);
      setEditingAssignmentId(null);
      setAssignForm({
        courseId: '',
        subjectId: '',
        batchId: '',
        role: 'INSTRUCTOR',
        staffSharePercentage: 70,
        compensationRule: 'REVENUE_SHARE_70_30',
      });
      setSettlementForm(defaultSettlementState);
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
              <option value="SUPER_ADMIN">👑 Super Admins</option>
              <option value="ACADEMY_ADMIN">🛡️ Academy Admins</option>
              <option value="TEACHER">Teachers / Faculty</option>
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
                        staff.roles.includes('SUPER_ADMIN')
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : staff.roles.includes('ACADEMY_ADMIN')
                          ? 'bg-sky-100 text-sky-800 border border-sky-300'
                          : staff.staffCategory === 'FACULTY' || staff.compensationModel === 'REVENUE_SHARING' || staff.roles.includes('TEACHER')
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {staff.roles.includes('SUPER_ADMIN')
                          ? 'Super Admin'
                          : staff.roles.includes('ACADEMY_ADMIN')
                          ? 'Academy Admin'
                          : staff.staffCategory === 'FACULTY' || staff.compensationModel === 'REVENUE_SHARING' || staff.roles.includes('TEACHER')
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
                        onClick={() => handleOpenAssignModal(staff)}
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
                              <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
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
                                {(() => {
                                  const badge = getSettlementBadgeDisplay(as);
                                  return (
                                    <span
                                      className={`font-semibold px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1 border ${badge.badgeClass}`}
                                      title={badge.tooltip}
                                    >
                                      {badge.mode === 'STUDENT_TIER_BASED' && <Layers className="w-2.5 h-2.5 text-purple-600 shrink-0" />}
                                      {badge.mode === 'PER_STUDENT_FIXED' && <UserCheck className="w-2.5 h-2.5 text-teal-600 shrink-0" />}
                                      {badge.mode === 'REVENUE_SHARE_PERCENTAGE' && <Percent className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                                      <span className="truncate max-w-[170px]">{badge.text}</span>
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 ml-1 shrink-0">
                              <button
                                onClick={() => handleOpenAssignModal(staff, as)}
                                className="text-neutral-400 hover:text-black p-1 rounded hover:bg-neutral-200 transition"
                                title="Edit assignment & settlement rule"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleRemoveAssignment(staff.id, as.id)}
                                className="text-neutral-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition"
                                title="Deactivate assignment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

            <h2 className="text-lg font-bold text-black">
              {showSuccessCodeModal.role?.includes('ADMIN') ? 'Administrator Created Successfully' : 'Staff Onboarded Successfully'}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">
              {showSuccessCodeModal.name} ({showSuccessCodeModal.role === 'SUPER_ADMIN' ? 'Super Admin' : showSuccessCodeModal.role === 'ACADEMY_ADMIN' ? 'Academy Admin' : showSuccessCodeModal.role})
            </p>

            {/* Login Credentials Box if email is present */}
            {showSuccessCodeModal.email && (
              <div className="my-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-left text-xs space-y-1.5 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider flex items-center justify-between">
                  <span>Portal Login Credentials</span>
                  <span className="text-emerald-600 font-semibold">Active</span>
                </div>
                <div className="flex justify-between items-center text-neutral-700">
                  <span className="text-neutral-400">Login Email:</span>
                  <span className="font-mono font-semibold text-black select-all">{showSuccessCodeModal.email}</span>
                </div>
                {showSuccessCodeModal.password && (
                  <div className="flex justify-between items-center text-neutral-700">
                    <span className="text-neutral-400">Password:</span>
                    <span className="font-mono font-semibold text-black select-all">{showSuccessCodeModal.password}</span>
                  </div>
                )}
                <div className="text-[10px] text-neutral-400 pt-1 border-t border-neutral-200/60">
                  Can sign in at <span className="font-semibold text-neutral-600">/login</span> immediately.
                </div>
              </div>
            )}

            <div className="my-4 p-4 bg-[#FFF4E5]/60 border-2 border-dashed border-[#FF8500] rounded-xl">
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
              The staff member can use this 3-digit code on the Smart Attendance Terminal, and use their email/password for the management portal.
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        Calculated from eligible collected fees for assigned subjects (default 70% share).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          staffCategory: 'GENERAL',
                          compensationModel: 'FIXED_SALARY',
                          role: 'ACADEMY_ADMIN',
                          fixedSalaryAmount: 0,
                        });
                      }}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        form.role === 'ACADEMY_ADMIN' || form.role === 'SUPER_ADMIN'
                          ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-500/20'
                          : 'bg-white border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-amber-600" />
                          Administrator
                        </span>
                        {(form.role === 'ACADEMY_ADMIN' || form.role === 'SUPER_ADMIN') && (
                          <span className="w-2 h-2 rounded-full bg-amber-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-tight">
                        Leadership & branch operations. Full access to exams, students, and dashboard.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForm({
                          ...form,
                          staffCategory: 'GENERAL',
                          compensationModel: 'FIXED_SALARY',
                          role: 'STAFF',
                        });
                      }}
                      className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        form.staffCategory === 'GENERAL' && form.role !== 'ACADEMY_ADMIN' && form.role !== 'SUPER_ADMIN'
                          ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20'
                          : 'bg-white border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-sm text-blue-950 flex items-center gap-1.5">
                          <Briefcase className="w-4 h-4 text-blue-600" />
                          General Staff
                        </span>
                        {form.staffCategory === 'GENERAL' && form.role !== 'ACADEMY_ADMIN' && form.role !== 'SUPER_ADMIN' && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 leading-tight">
                        Fixed agreed salary (Accountants, support, reception). Not based on course fees.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Administrator Privilege Banner if Admin role selected */}
                {(form.role === 'SUPER_ADMIN' || form.role === 'ACADEMY_ADMIN') && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        {form.role === 'SUPER_ADMIN' ? '👑 Super Admin Role Selected' : '🛡️ Academy Admin Role Selected'}
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        This user can sign in at <code className="font-mono font-bold text-amber-950 bg-amber-100/70 px-1 py-0.5 rounded">/login</code> to access system controls. An Email Address is required as their login username.
                      </p>
                    </div>
                  </div>
                )}

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
                        const isTeaching = newRole === 'TEACHER';
                        setForm({
                          ...form,
                          role: newRole,
                          staffCategory: isTeaching ? 'FACULTY' : 'GENERAL',
                          compensationModel: isTeaching ? 'REVENUE_SHARING' : 'FIXED_SALARY',
                        });
                      }}
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] transition"
                    >
                      <option value="TEACHER">Teacher / Faculty</option>
                      {isSuperAdmin && <option value="SUPER_ADMIN">👑 Super Admin (Full Academy Ownership)</option>}
                      <option value="ACADEMY_ADMIN">🛡️ Academy Admin (Operational Management)</option>
                      <option value="ACCOUNTANT">Accountant</option>
                      <option value="STAFF">General Staff</option>
                    </select>
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                      Email Address{' '}
                      {form.role === 'SUPER_ADMIN' || form.role === 'ACADEMY_ADMIN' ? (
                        <span className="text-rose-500 font-bold">* (Login ID)</span>
                      ) : (
                        <span className="text-neutral-400 font-normal normal-case">(optional)</span>
                      )}
                    </label>
                    <input
                      type="email"
                      required={form.role === 'SUPER_ADMIN' || form.role === 'ACADEMY_ADMIN'}
                      placeholder={
                        form.role === 'SUPER_ADMIN' || form.role === 'ACADEMY_ADMIN'
                          ? 'e.g. admin.branch@rcacademy.com'
                          : 'e.g. ramesh@example.com (optional)'
                      }
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
                      placeholder={
                        form.role === 'SUPER_ADMIN'
                          ? 'e.g. Super Administrator'
                          : form.role === 'ACADEMY_ADMIN'
                          ? 'e.g. Academy Administrator / Branch Head'
                          : 'e.g. Senior Faculty / HOD'
                      }
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8500]/20 focus:border-[#FF8500] transition"
                    />
                  </div>

                  {/* Initial Password */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 uppercase tracking-wider mb-1.5">
                      Initial Password{' '}
                      <span className="text-neutral-400 font-normal normal-case">
                        (default: {form.role === 'SUPER_ADMIN' || form.role === 'ACADEMY_ADMIN' ? 'Admin@12345' : 'Staff@12345'})
                      </span>
                    </label>
                    <input
                      type="password"
                      placeholder={`Leave blank to use default (${form.role === 'SUPER_ADMIN' || form.role === 'ACADEMY_ADMIN' ? 'Admin@12345' : 'Staff@12345'})`}
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

                    {/* Settlement Rule Configuration */}
                    <div className="pt-2 border-t border-neutral-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-semibold text-neutral-700 uppercase tracking-wider">
                          Initial Settlement Rule
                        </label>
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {onboardSettlementForm.mode === 'STUDENT_TIER_BASED' ? 'Tier-Based Bundle' : onboardSettlementForm.mode === 'PER_STUDENT_FIXED' ? 'Per Student' : 'Revenue Share %'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setOnboardSettlementForm({ ...onboardSettlementForm, mode: 'STUDENT_TIER_BASED' })}
                          className={`p-2 rounded-lg border text-left text-xs font-semibold transition ${
                            onboardSettlementForm.mode === 'STUDENT_TIER_BASED'
                              ? 'bg-purple-50 border-purple-400 text-purple-950'
                              : 'bg-white border-neutral-200 text-neutral-600'
                          }`}
                        >
                          Tier-Based
                        </button>
                        <button
                          type="button"
                          onClick={() => setOnboardSettlementForm({ ...onboardSettlementForm, mode: 'PER_STUDENT_FIXED' })}
                          className={`p-2 rounded-lg border text-left text-xs font-semibold transition ${
                            onboardSettlementForm.mode === 'PER_STUDENT_FIXED'
                              ? 'bg-teal-50 border-teal-400 text-teal-950'
                              : 'bg-white border-neutral-200 text-neutral-600'
                          }`}
                        >
                          ₹ / Student
                        </button>
                        <button
                          type="button"
                          onClick={() => setOnboardSettlementForm({ ...onboardSettlementForm, mode: 'REVENUE_SHARE_PERCENTAGE' })}
                          className={`p-2 rounded-lg border text-left text-xs font-semibold transition ${
                            onboardSettlementForm.mode === 'REVENUE_SHARE_PERCENTAGE'
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                              : 'bg-white border-neutral-200 text-neutral-600'
                          }`}
                        >
                          Flat %
                        </button>
                      </div>

                      {onboardSettlementForm.mode === 'STUDENT_TIER_BASED' && (
                        <div className="grid grid-cols-2 gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200 text-xs">
                          <div>
                            <span className="text-[10px] text-neutral-500 font-semibold block">All-Subjects Bundle:</span>
                            <div className="relative mt-1">
                              <input
                                type="number"
                                min="0"
                                value={onboardSettlementForm.allSubjectsValue}
                                onChange={(e) => setOnboardSettlementForm({ ...onboardSettlementForm, allSubjectsValue: Number(e.target.value) })}
                                className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-semibold pr-6"
                              />
                              <span className="absolute right-2 top-1 text-[10px] text-neutral-400">
                                {onboardSettlementForm.allSubjectsType === 'PERCENTAGE' ? '%' : '₹'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-neutral-500 font-semibold block">Single Subject:</span>
                            <div className="relative mt-1">
                              <input
                                type="number"
                                min="0"
                                value={onboardSettlementForm.singleSubjectValue}
                                onChange={(e) => setOnboardSettlementForm({ ...onboardSettlementForm, singleSubjectValue: Number(e.target.value) })}
                                className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-semibold pr-6"
                              />
                              <span className="absolute right-2 top-1 text-[10px] text-neutral-400">
                                {onboardSettlementForm.singleSubjectType === 'PERCENTAGE' ? '%' : '₹'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {onboardSettlementForm.mode === 'PER_STUDENT_FIXED' && (
                        <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-200 text-xs">
                          <span className="text-[10px] text-neutral-500 font-semibold block">Fixed ₹ per Student:</span>
                          <div className="relative mt-1 max-w-[200px]">
                            <span className="absolute left-2.5 top-1 text-xs text-neutral-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={onboardSettlementForm.perStudentAmount}
                              onChange={(e) => setOnboardSettlementForm({ ...onboardSettlementForm, perStudentAmount: Number(e.target.value) })}
                              className="w-full pl-6 pr-2 py-1 bg-white border border-neutral-200 rounded text-xs font-semibold"
                            />
                          </div>
                        </div>
                      )}

                      {onboardSettlementForm.mode === 'REVENUE_SHARE_PERCENTAGE' && (
                        <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-200 text-xs">
                          <span className="text-[10px] text-neutral-500 font-semibold block">Staff Pool Share %:</span>
                          <div className="relative mt-1 max-w-[200px]">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={onboardSettlementForm.staffSharePercentage}
                              onChange={(e) => setOnboardSettlementForm({ ...onboardSettlementForm, staffSharePercentage: Number(e.target.value) })}
                              className="w-full px-2 py-1 bg-white border border-neutral-200 rounded text-xs font-semibold pr-6"
                            />
                            <span className="absolute right-2 top-1 text-[10px] text-neutral-400">%</span>
                          </div>
                        </div>
                      )}
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
            if (e.target === e.currentTarget) {
              setShowAssignModal(null);
              setEditingAssignmentId(null);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-modal bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full border-t sm:border border-neutral-200 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-150 pb-[env(safe-area-inset-bottom)]"
          >
            {/* Native Mobile Drag Handle */}
            <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2 sm:hidden shrink-0" />
            <div className="p-4 sm:px-6 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-neutral-50/50">
              <div>
                <h2 className="font-bold text-black text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FF8500]" />
                  {editingAssignmentId ? 'Edit Teaching Assignment & Settlement Rule' : 'Assign Course & Settlement Rule'}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Faculty: <strong className="text-neutral-800">{showAssignModal.fullName}</strong>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(null);
                  setEditingAssignmentId(null);
                }}
                className="p-1 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAssignment} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
              {/* 1. Academic Scope */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-neutral-100">
                  <BookOpen className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Academic Assignment Scope</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      Subject (Specialization)
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                      Role / Designation in Subject
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LEAD_INSTRUCTOR, SUBJECT_EXPERT"
                      value={assignForm.role}
                      onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500]"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Staff Settlement & Compensation Rule Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                  <div className="flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-[#FF8500]" />
                    <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                      Staff Settlement Configuration Rule
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Fee-Config Aligned
                  </span>
                </div>

                {/* Mode Selector Tabs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettlementForm({ ...settlementForm, mode: 'STUDENT_TIER_BASED' })}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      settlementForm.mode === 'STUDENT_TIER_BASED'
                        ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-400/20'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-purple-950 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-purple-600" />
                        Student Tier-Based
                      </span>
                      {settlementForm.mode === 'STUDENT_TIER_BASED' && (
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 leading-tight">
                      All-Subject bundle vs Single-Subject rates (fee config matched)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettlementForm({ ...settlementForm, mode: 'PER_STUDENT_FIXED' })}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      settlementForm.mode === 'PER_STUDENT_FIXED'
                        ? 'bg-teal-50/90 border-teal-500 ring-2 ring-teal-400/20'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-teal-950 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                        Per Student Fixed
                      </span>
                      {settlementForm.mode === 'PER_STUDENT_FIXED' && (
                        <span className="w-2 h-2 rounded-full bg-teal-600" />
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 leading-tight">
                      Fixed ₹ amount earned per paying student
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettlementForm({ ...settlementForm, mode: 'REVENUE_SHARE_PERCENTAGE' })}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      settlementForm.mode === 'REVENUE_SHARE_PERCENTAGE'
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-400/20'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-emerald-950 flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-emerald-600" />
                        Revenue Share %
                      </span>
                      {settlementForm.mode === 'REVENUE_SHARE_PERCENTAGE' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 leading-tight">
                      Standard percentage of collected fees (e.g. 70/30 pool)
                    </p>
                  </button>
                </div>

                {/* Mode 1: STUDENT_TIER_BASED */}
                {settlementForm.mode === 'STUDENT_TIER_BASED' && (
                  <div className="space-y-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                    {/* Presets */}
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Recommended Presets:
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setSettlementForm({
                              ...settlementForm,
                              allSubjectsType: 'PERCENTAGE',
                              allSubjectsValue: 25,
                              singleSubjectType: 'PERCENTAGE',
                              singleSubjectValue: 70,
                            })
                          }
                          className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-neutral-200 rounded-md hover:border-purple-300 hover:bg-purple-50 transition text-neutral-700 cursor-pointer"
                        >
                          25% All-Sub / 70% Single
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettlementForm({
                              ...settlementForm,
                              allSubjectsType: 'FIXED_AMOUNT',
                              allSubjectsValue: 1000,
                              singleSubjectType: 'FIXED_AMOUNT',
                              singleSubjectValue: 1500,
                            })
                          }
                          className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-neutral-200 rounded-md hover:border-purple-300 hover:bg-purple-50 transition text-neutral-700 cursor-pointer"
                        >
                          ₹1,000 All-Sub / ₹1,500 Single
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSettlementForm({
                              ...settlementForm,
                              allSubjectsType: 'PERCENTAGE',
                              allSubjectsValue: 25,
                              singleSubjectType: 'FIXED_AMOUNT',
                              singleSubjectValue: 1200,
                            })
                          }
                          className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-neutral-200 rounded-md hover:border-purple-300 hover:bg-purple-50 transition text-neutral-700 cursor-pointer"
                        >
                          25% All-Sub / ₹1,200 Single
                        </button>
                      </div>
                    </div>

                    {/* Tier A: All-Subject Students */}
                    <div className="p-3 bg-white rounded-lg border border-purple-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-600" />
                          <label className="text-xs font-bold text-purple-950">
                            All-Subject Enrolled Students (Bundle Package)
                          </label>
                        </div>
                        <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                          Full Cohort Tier
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        When a student is enrolled in all course subjects, payout is calculated as:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setSettlementForm({ ...settlementForm, allSubjectsType: 'PERCENTAGE' })}
                            className={`flex-1 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                              settlementForm.allSubjectsType === 'PERCENTAGE'
                                ? 'bg-white text-purple-950 shadow-xs'
                                : 'text-neutral-500 hover:text-black'
                            }`}
                          >
                            Percentage (%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSettlementForm({ ...settlementForm, allSubjectsType: 'FIXED_AMOUNT' })}
                            className={`flex-1 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                              settlementForm.allSubjectsType === 'FIXED_AMOUNT'
                                ? 'bg-white text-purple-950 shadow-xs'
                                : 'text-neutral-500 hover:text-black'
                            }`}
                          >
                            Per Student (₹)
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step={settlementForm.allSubjectsType === 'PERCENTAGE' ? '0.5' : '50'}
                            value={settlementForm.allSubjectsValue}
                            onChange={(e) =>
                              setSettlementForm({
                                ...settlementForm,
                                allSubjectsValue: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 pr-8"
                            placeholder={settlementForm.allSubjectsType === 'PERCENTAGE' ? '25' : '1000'}
                          />
                          <span className="absolute right-3 top-2 text-xs font-semibold text-neutral-400">
                            {settlementForm.allSubjectsType === 'PERCENTAGE' ? '%' : '₹'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tier B: Single-Subject Students */}
                    <div className="p-3 bg-white rounded-lg border border-purple-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#FF8500]" />
                          <label className="text-xs font-bold text-neutral-900">
                            Single-Subject Enrolled Students (Standalone)
                          </label>
                        </div>
                        <span className="text-[10px] font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                          Individual Tier
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        When a student is enrolled only in this subject, payout is calculated as:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setSettlementForm({ ...settlementForm, singleSubjectType: 'PERCENTAGE' })}
                            className={`flex-1 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                              settlementForm.singleSubjectType === 'PERCENTAGE'
                                ? 'bg-white text-orange-950 shadow-xs'
                                : 'text-neutral-500 hover:text-black'
                            }`}
                          >
                            Percentage (%)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSettlementForm({ ...settlementForm, singleSubjectType: 'FIXED_AMOUNT' })}
                            className={`flex-1 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                              settlementForm.singleSubjectType === 'FIXED_AMOUNT'
                                ? 'bg-white text-orange-950 shadow-xs'
                                : 'text-neutral-500 hover:text-black'
                            }`}
                          >
                            Per Student (₹)
                          </button>
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step={settlementForm.singleSubjectType === 'PERCENTAGE' ? '0.5' : '50'}
                            value={settlementForm.singleSubjectValue}
                            onChange={(e) =>
                              setSettlementForm({
                                ...settlementForm,
                                singleSubjectValue: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#FF8500] pr-8"
                            placeholder={settlementForm.singleSubjectType === 'PERCENTAGE' ? '70' : '1500'}
                          />
                          <span className="absolute right-3 top-2 text-xs font-semibold text-neutral-400">
                            {settlementForm.singleSubjectType === 'PERCENTAGE' ? '%' : '₹'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Optional Tier C: 2-Subjects Bundle */}
                    <div className="pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-700">
                        <input
                          type="checkbox"
                          checked={settlementForm.includeTwoSubjects}
                          onChange={(e) => setSettlementForm({ ...settlementForm, includeTwoSubjects: e.target.checked })}
                          className="rounded text-[#FF8500] focus:ring-[#FF8500]"
                        />
                        <span>Configure specific rate for 2-Subject bundle students</span>
                      </label>
                      {settlementForm.includeTwoSubjects && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-amber-200 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setSettlementForm({ ...settlementForm, twoSubjectsType: 'PERCENTAGE' })}
                                className={`flex-1 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                                  settlementForm.twoSubjectsType === 'PERCENTAGE'
                                    ? 'bg-white text-amber-950 shadow-xs'
                                    : 'text-neutral-500 hover:text-black'
                                }`}
                              >
                                Percentage (%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setSettlementForm({ ...settlementForm, twoSubjectsType: 'FIXED_AMOUNT' })}
                                className={`flex-1 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                                  settlementForm.twoSubjectsType === 'FIXED_AMOUNT'
                                    ? 'bg-white text-amber-950 shadow-xs'
                                    : 'text-neutral-500 hover:text-black'
                                }`}
                              >
                                Per Student (₹)
                              </button>
                            </div>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step={settlementForm.twoSubjectsType === 'PERCENTAGE' ? '0.5' : '50'}
                                value={settlementForm.twoSubjectsValue}
                                onChange={(e) =>
                                  setSettlementForm({
                                    ...settlementForm,
                                    twoSubjectsValue: Number(e.target.value),
                                  })
                                }
                                className="w-full px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 pr-8"
                                placeholder="35"
                              />
                              <span className="absolute right-3 top-2 text-xs font-semibold text-neutral-400">
                                {settlementForm.twoSubjectsType === 'PERCENTAGE' ? '%' : '₹'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mode 2: PER_STUDENT_FIXED */}
                {settlementForm.mode === 'PER_STUDENT_FIXED' && (
                  <div className="space-y-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Fixed Fee Earned Per Student (₹)
                      </label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-2.5 text-sm font-semibold text-neutral-500">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          value={settlementForm.perStudentAmount}
                          onChange={(e) =>
                            setSettlementForm({ ...settlementForm, perStudentAmount: Number(e.target.value) })
                          }
                          className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold"
                          placeholder="1000"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Quick Presets:
                      </span>
                      {[500, 800, 1000, 1200, 1500, 2000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setSettlementForm({ ...settlementForm, perStudentAmount: amt })}
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition cursor-pointer ${
                            settlementForm.perStudentAmount === amt
                              ? 'bg-teal-100 text-teal-800 border-teal-300'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          ₹{amt.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-neutral-500 leading-snug">
                      Faculty will receive this flat ₹ amount for every student who makes a payment towards this course.
                    </p>
                  </div>
                )}

                {/* Mode 3: REVENUE_SHARE_PERCENTAGE */}
                {settlementForm.mode === 'REVENUE_SHARE_PERCENTAGE' && (
                  <div className="space-y-3 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
                        Staff Pool Share %
                      </label>
                      <div className="relative max-w-xs">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={settlementForm.staffSharePercentage}
                          onChange={(e) =>
                            setSettlementForm({ ...settlementForm, staffSharePercentage: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold pr-8"
                          placeholder="70"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-semibold text-neutral-400">%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Standard Splits:
                      </span>
                      {[
                        { label: '70/30 Standard', val: 70 },
                        { label: '60/40 Custom', val: 60 },
                        { label: '50/50 Equal', val: 50 },
                        { label: '100% Direct', val: 100 },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setSettlementForm({ ...settlementForm, staffSharePercentage: p.val })}
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition cursor-pointer ${
                            settlementForm.staffSharePercentage === p.val
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-neutral-500 leading-snug">
                      Faculty receives {settlementForm.staffSharePercentage}% of total collected fees; the academy retains {100 - settlementForm.staffSharePercentage}%.
                    </p>
                  </div>
                )}

                {/* Live Simulation / Summary Box */}
                <div className="p-3 bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-xl shadow-xs text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Live Settlement Projection</span>
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono">Real-Time</span>
                  </div>

                  {settlementForm.mode === 'STUDENT_TIER_BASED' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className="bg-white/10 p-2 rounded-lg">
                        <span className="text-neutral-400 block text-[10px]">All-Subject Bundle Student:</span>
                        <strong className="text-emerald-400 font-mono">
                          {settlementForm.allSubjectsType === 'PERCENTAGE'
                            ? `${settlementForm.allSubjectsValue}% of bundle fee (e.g. ₹${((5000 * settlementForm.allSubjectsValue) / 100).toLocaleString('en-IN')} on ₹5,000)`
                            : `₹${settlementForm.allSubjectsValue.toLocaleString('en-IN')} fixed per student`}
                        </strong>
                      </div>
                      <div className="bg-white/10 p-2 rounded-lg">
                        <span className="text-neutral-400 block text-[10px]">Single-Subject Student:</span>
                        <strong className="text-amber-400 font-mono">
                          {settlementForm.singleSubjectType === 'PERCENTAGE'
                            ? `${settlementForm.singleSubjectValue}% of subject fee (e.g. ₹${((1500 * settlementForm.singleSubjectValue) / 100).toLocaleString('en-IN')} on ₹1,500)`
                            : `₹${settlementForm.singleSubjectValue.toLocaleString('en-IN')} fixed per student`}
                        </strong>
                      </div>
                    </div>
                  )}

                  {settlementForm.mode === 'PER_STUDENT_FIXED' && (
                    <p className="text-[11px] text-neutral-300 pt-0.5">
                      Fixed payout: Faculty earns exactly <strong className="text-emerald-400 font-mono">₹{settlementForm.perStudentAmount.toLocaleString('en-IN')}</strong> per student fee payment recorded.
                    </p>
                  )}

                  {settlementForm.mode === 'REVENUE_SHARE_PERCENTAGE' && (
                    <p className="text-[11px] text-neutral-300 pt-0.5">
                      Pool split: Faculty receives <strong className="text-emerald-400 font-mono">{settlementForm.staffSharePercentage}%</strong> (₹{((5000 * settlementForm.staffSharePercentage) / 100).toLocaleString('en-IN')} on ₹5,000), Academy retains <strong className="text-amber-400 font-mono">{100 - settlementForm.staffSharePercentage}%</strong>.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(null);
                    setEditingAssignmentId(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-semibold bg-[#FF8500] hover:bg-[#E67700] text-white rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? 'Saving...' : editingAssignmentId ? 'Update Assignment & Rule' : 'Save Assignment & Rule'}
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
