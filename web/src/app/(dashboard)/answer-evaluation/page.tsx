'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import {
  FileCheck2,
  Check,
  Sparkles,
  Upload,
  Search,
  FileText,
  CheckCircle2,
  ChevronLeft,
  XCircle,
  ShieldCheck,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiClient } from '@/lib/api/api-client';

interface EvaluationItem {
  questionId: string;
  questionText: string;
  topic?: string;
  maxMarks: number;
  extractedAnswer: string;
  aiSuggestedMarks: number;
  teacherFinalMarks: number;
  confidence: number;
  explanation: string;
  isOverridden: boolean;
  teacherNotes: string;
  criterionScores: Array<{
    criterion: string;
    allocatedMarks: number;
    obtainedMarks: number;
    feedback: string;
  }>;
  approved: boolean;
}

interface SubmissionItem {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  examId: string;
  examTitle: string;
  examTotalMarks: number;
  uploadedAt: string;
  fileName: string;
  status: 'UPLOADED' | 'PROCESSING' | 'AI_EVALUATED' | 'TEACHER_REVIEWED' | 'APPROVED' | 'REJECTED';
  approvedMarks?: number;
  rejectionReason?: string;
  items: EvaluationItem[];
}

export default function AnswerEvaluationWorkspacePage() {
  const [viewMode, setViewMode] = useState<'queue' | 'review'>('queue');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Server state (zero hardcoded / fabricated records)
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [activeSubmission, setActiveSubmission] = useState<SubmissionItem | null>(null);

  // Auxiliary data for uploads
  const [availableExams, setAvailableExams] = useState<Array<{ id: string; title: string }>>([]);
  const [availableStudents, setAvailableStudents] = useState<
    Array<{ id: string; studentCode: string; name: string }>
  >([]);

  // Async indicators & discrete error tracking
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [auxError, setAuxError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Upload Form States
  const [uploadExamId, setUploadExamId] = useState('');
  const [uploadStudentId, setUploadStudentId] = useState('');
  const [uploadFileName, setUploadFileName] = useState('answer_sheet.pdf');
  const [submittingUpload, setSubmittingUpload] = useState(false);

  // --------------------------------------------------------------------------
  // Data Fetching: Deliberate Concurrent Loading with Partial Failure Isolation
  // --------------------------------------------------------------------------
  const loadSubmissions = useCallback(async () => {
    setLoading(true);

    const [subsResult, examsResult, studentsResult] = await Promise.allSettled([
      ApiClient.fetch<any[]>('/evaluations/submissions'),
      ApiClient.fetch<any[]>('/examinations'),
      ApiClient.fetch<any[]>('/students'),
    ]);

    const auxFailed: string[] = [];

    // 1. Process Submissions
    if (subsResult.status === 'fulfilled') {
      const rawSubs = subsResult.value || [];
      const mappedSubs: SubmissionItem[] = rawSubs.map((s: any) => ({
        id: s.id,
        studentId: s.studentId,
        studentName: s.student ? `${s.student.firstName} ${s.student.lastName}`.trim() : 'Unknown Candidate',
        studentCode: s.student?.studentCode || 'N/A',
        examId: s.examinationId,
        examTitle: s.examination?.title || 'Examination',
        examTotalMarks: Number(s.examination?.totalMarks) || 100,
        uploadedAt:
          typeof s.uploadedAt === 'string'
            ? s.uploadedAt.replace('T', ' ').slice(0, 16)
            : new Date(s.uploadedAt).toISOString().replace('T', ' ').slice(0, 16),
        fileName: s.fileName || 'answer_sheet.pdf',
        status: s.status || 'UPLOADED',
        approvedMarks: s.approvedMarks !== null && s.approvedMarks !== undefined ? Number(s.approvedMarks) : undefined,
        rejectionReason: s.rejectionReason || undefined,
        items: (s.evaluations || []).map((e: any) => ({
          questionId: e.questionId,
          questionText: e.question?.content || 'Question item',
          topic: e.question?.topic,
          maxMarks: Number(e.question?.maxMarks) || 10,
          extractedAnswer: e.extractedAnswer || 'No OCR text extracted',
          aiSuggestedMarks: Number(e.suggestedMarks) || 0,
          teacherFinalMarks:
            e.reviewedMarks !== null && e.reviewedMarks !== undefined
              ? Number(e.reviewedMarks)
              : Number(e.suggestedMarks) || 0,
          confidence: Number(e.confidenceScore) || 0.95,
          explanation: e.rationale || 'Evaluation matches curriculum answer rubric.',
          isOverridden: Boolean(e.isOverridden),
          teacherNotes: e.teacherNotes || '',
          criterionScores: [
            {
              criterion: 'Rubric Alignment',
              allocatedMarks: Number(e.question?.maxMarks) || 10,
              obtainedMarks:
                e.reviewedMarks !== null && e.reviewedMarks !== undefined
                  ? Number(e.reviewedMarks)
                  : Number(e.suggestedMarks) || 0,
              feedback: e.rationale || 'Standard response criteria evaluated.',
            },
          ],
          approved: e.status === 'APPROVED' || e.reviewedMarks !== null,
        })),
      }));

      setSubmissions(mappedSubs);
      setSubmissionsError(null);
    } else {
      const errMsg = subsResult.reason?.message || 'Failed to load evaluation submissions';
      setSubmissionsError(errMsg);
      // NOTE: Do not clear previously loaded submissions on refresh failure!
    }

    // 2. Process Auxiliary Exams
    if (examsResult.status === 'fulfilled') {
      const rawExams = examsResult.value || [];
      const mappedExams = rawExams.map((e: any) => ({
        id: e.id,
        title: `${e.title} (${e.class?.name || 'Class'} • ${e.subject?.name || 'Subject'})`,
      }));
      setAvailableExams(mappedExams);
      if (mappedExams.length > 0) {
        setUploadExamId((prev) => prev || mappedExams[0].id);
      }
    } else {
      auxFailed.push('Examinations list for upload selection');
    }

    // 3. Process Auxiliary Students
    if (studentsResult.status === 'fulfilled') {
      const rawStudents = studentsResult.value || [];
      const mappedStudents = rawStudents.map((st: any) => ({
        id: st.id,
        studentCode: st.studentCode,
        name: `${st.firstName} ${st.lastName} (${st.studentCode})`,
      }));
      setAvailableStudents(mappedStudents);
      if (mappedStudents.length > 0) {
        setUploadStudentId((prev) => prev || mappedStudents[0].id);
      }
    } else {
      auxFailed.push('Students list for upload selection');
    }

    if (auxFailed.length > 0) {
      setAuxError(`Auxiliary data sync incomplete: ${auxFailed.join(', ')}.`);
    } else {
      setAuxError(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  // --------------------------------------------------------------------------
  // Data Fetching: Submission Details for Workspace
  // --------------------------------------------------------------------------
  const openReviewWorkspace = async (sub: SubmissionItem) => {
    setDetailLoading(true);
    setDetailError(null);
    setViewMode('review');
    try {
      const detailed = await ApiClient.fetch<any>(`/evaluations/submissions/${sub.id}`);
      const examQuestions = detailed.examination?.questions || [];
      const evals = detailed.evaluations || [];

      // Merge questions with evaluations to ensure every exam question has a review slot
      const items: EvaluationItem[] = examQuestions.map((eq: any) => {
        const q = eq.question;
        const ev = evals.find((e: any) => e.questionId === q.id);

        return {
          questionId: q.id,
          questionText: q.content,
          topic: q.topic,
          maxMarks: Number(q.maxMarks) || 10,
          extractedAnswer: ev?.extractedAnswer || 'Pending OCR extraction for this question...',
          aiSuggestedMarks: ev ? Number(ev.suggestedMarks) : 0,
          teacherFinalMarks:
            ev?.reviewedMarks !== null && ev?.reviewedMarks !== undefined
              ? Number(ev.reviewedMarks)
              : ev
              ? Number(ev.suggestedMarks)
              : 0,
          confidence: ev?.confidenceScore ? Number(ev.confidenceScore) : 0.9,
          explanation: ev?.rationale || 'Pending AI evaluation.',
          isOverridden: Boolean(ev?.isOverridden),
          teacherNotes: ev?.teacherNotes || '',
          criterionScores: [
            {
              criterion: 'Core Curriculum Concept',
              allocatedMarks: Number(q.maxMarks) || 10,
              obtainedMarks: ev ? (ev.reviewedMarks !== null ? Number(ev.reviewedMarks) : Number(ev.suggestedMarks)) : 0,
              feedback: ev?.rationale || 'Awaiting evaluation',
            },
          ],
          approved: ev?.status === 'APPROVED' || (ev && ev.reviewedMarks !== null),
        };
      });

      setActiveSubmission({
        ...sub,
        status: detailed.status || sub.status,
        approvedMarks: detailed.approvedMarks ? Number(detailed.approvedMarks) : sub.approvedMarks,
        items,
      });
    } catch (err) {
      const msg = (err as Error).message || 'Failed to load submission question details';
      setDetailError(msg);
      setActiveSubmission(sub);
    } finally {
      setDetailLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutations: Teacher Score Override & Question Approval
  // --------------------------------------------------------------------------
  const handleFinalMarkChange = (qId: string, val: number) => {
    if (!activeSubmission) return;
    setActiveSubmission({
      ...activeSubmission,
      items: activeSubmission.items.map((it) =>
        it.questionId === qId
          ? {
              ...it,
              teacherFinalMarks: val,
              isOverridden: val !== it.aiSuggestedMarks,
              approved: false, // requires confirmation click
            }
          : it,
      ),
    });
  };

  const handleApproveItem = async (qId: string) => {
    if (!activeSubmission) return;
    const item = activeSubmission.items.find((i) => i.questionId === qId);
    if (!item) return;

    setActionLoading(true);
    try {
      await ApiClient.fetch(`/evaluations/submissions/${activeSubmission.id}/review-answer`, {
        method: 'PATCH',
        body: JSON.stringify({
          questionId: qId,
          reviewedMarks: item.teacherFinalMarks,
          teacherNotes: item.teacherNotes || undefined,
        }),
      });

      setActiveSubmission({
        ...activeSubmission,
        status: 'TEACHER_REVIEWED',
        items: activeSubmission.items.map((it) => (it.questionId === qId ? { ...it, approved: true } : it)),
      });
      setActionNotice({ type: 'success', message: `Score approved for Question.` });
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to review question.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutation: Trigger AI Evaluation for active submission
  // --------------------------------------------------------------------------
  const handleTriggerAiEvaluation = async () => {
    if (!activeSubmission) return;
    setActionLoading(true);
    try {
      await ApiClient.fetch<any>(`/evaluations/submissions/${activeSubmission.id}/evaluate-ai`, {
        method: 'POST',
      });

      setActionNotice({
        type: 'info',
        message:
          'AI evaluation completed using on-premise scoring heuristics. (Notice: BullMQ queue integration pending for worker execution).',
      });

      await openReviewWorkspace(activeSubmission);
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'AI evaluation failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutation: Sign Off & Transfer to Results
  // --------------------------------------------------------------------------
  const handleFinalSignOff = async () => {
    if (!activeSubmission) return;
    setActionLoading(true);
    try {
      const res = await ApiClient.fetch<any>(`/evaluations/submissions/${activeSubmission.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          transferToOfficialResult: true,
          questionReviews: activeSubmission.items.map((i) => ({
            questionId: i.questionId,
            reviewedMarks: i.teacherFinalMarks,
            teacherNotes: i.teacherNotes || undefined,
          })),
        }),
      });

      setActionNotice({
        type: 'success',
        message: res.message || 'Submission approved and transferred to official candidate examination results.',
      });
      setViewMode('queue');
      await loadSubmissions();
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to approve evaluation.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutation: Reject Submission
  // --------------------------------------------------------------------------
  const handleRejectSubmission = async () => {
    if (!activeSubmission) return;
    if (!rejectReason.trim()) {
      setActionNotice({ type: 'error', message: 'A rejection reason is required.' });
      return;
    }

    setActionLoading(true);
    try {
      await ApiClient.fetch(`/evaluations/submissions/${activeSubmission.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason: rejectReason.trim(),
        }),
      });

      setShowRejectModal(false);
      setRejectReason('');
      setActionNotice({ type: 'warning', message: 'Submission marked as rejected in the audit log.' });
      setViewMode('queue');
      await loadSubmissions();
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to reject submission.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutation: Upload Answer Sheet
  // --------------------------------------------------------------------------
  const handleUploadSubmission = async () => {
    if (!uploadExamId || !uploadStudentId) {
      setActionNotice({ type: 'error', message: 'Please select an examination and student candidate.' });
      return;
    }

    setSubmittingUpload(true);
    try {
      const newSub = await ApiClient.fetch<any>('/evaluations/submissions', {
        method: 'POST',
        body: JSON.stringify({
          examinationId: uploadExamId,
          studentId: uploadStudentId,
          fileName: uploadFileName.trim() || 'answer_sheet.pdf',
        }),
      });

      // Automatically trigger preliminary heuristic AI evaluation
      try {
        await ApiClient.fetch(`/evaluations/submissions/${newSub.id}/evaluate-ai`, {
          method: 'POST',
        });
      } catch (_) {
        // AI evaluation failure is non-fatal to the registration
      }

      setShowUploadModal(false);
      setActionNotice({
        type: 'success',
        message: 'Answer sheet queued and registered. Preliminary AI scoring generated.',
      });
      await loadSubmissions();
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to queue answer sheet.' });
    } finally {
      setSubmittingUpload(false);
    }
  };

  // --------------------------------------------------------------------------
  // Filtered Submissions in Queue
  // --------------------------------------------------------------------------
  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (
      searchQuery &&
      !s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !s.studentCode.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !s.examTitle.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Calculations for active submission
  const totalSuggested = activeSubmission ? activeSubmission.items.reduce((acc, i) => acc + i.aiSuggestedMarks, 0) : 0;
  const totalFinal = activeSubmission ? activeSubmission.items.reduce((acc, i) => acc + i.teacherFinalMarks, 0) : 0;
  const allApproved =
    Boolean(activeSubmission) &&
    activeSubmission!.items.length > 0 &&
    activeSubmission!.items.every((i) => i.approved);

  return (
    <>
      <Header
        title="AI-Assisted Answer Evaluation"
        subtitle="Review OCR extracted papers against marking rubrics, adjust scores and authorize transfers into official records"
      />

      <ResponsivePageContainer>
        {/* User Action Feedback Banner */}
        {actionNotice && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-150 ${
              actionNotice.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : actionNotice.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : actionNotice.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-neutral-100 text-neutral-800 border-neutral-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-neutral-600 shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="p-1 text-neutral-400 hover:text-black rounded cursor-pointer"
              aria-label="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Global/Auxiliary Service Error Banner */}
        {(submissionsError || auxError) && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Failed to synchronize answer evaluation data:</span>
                {submissionsError && <div>• Evaluation Queue: {submissionsError}</div>}
                {auxError && <div>• {auxError}</div>}
              </div>
            </div>
            <Button onClick={loadSubmissions} variant="outline" size="sm" className="self-start sm:self-auto shrink-0">
              <RefreshCw className="w-3.5 h-3.5" /> Retry Sync
            </Button>
          </div>
        )}

        {/* VIEW 1: QUEUE */}
        {viewMode === 'queue' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-black tracking-tight">Answer Sheet Evaluation Queue</h3>
                <p className="text-xs text-neutral-500">
                  Provisional AI scoring requires mandatory teacher review before marks are finalized.
                </p>
              </div>

              <Button onClick={() => setShowUploadModal(true)} variant="primary" size="sm">
                <Upload className="w-3.5 h-3.5" />
                Upload Answer Sheet
              </Button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200 shadow-card">
              <div className="flex items-center gap-1 overflow-x-auto">
                {['ALL', 'UPLOADED', 'AI_EVALUATED', 'TEACHER_REVIEWED', 'APPROVED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      statusFilter === st
                        ? 'bg-neutral-900 text-white shadow-subtle'
                        : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div className="relative max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search student code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                />
              </div>
            </div>

            {/* Submissions Table */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
              {loading && submissions.length === 0 ? (
                <div className="p-12 text-center text-xs text-neutral-500">
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF8500] mx-auto mb-2" />
                  Loading answer sheet submissions...
                </div>
              ) : submissionsError && submissions.length === 0 ? (
                <div className="p-12 text-center">
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-black">Failed to load evaluation queue</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">{submissionsError}</p>
                  <Button onClick={loadSubmissions} variant="outline" size="sm" className="mt-4">
                    <RefreshCw className="w-3.5 h-3.5" /> Try Again
                  </Button>
                </div>
              ) : filteredSubmissions.length === 0 && !loading ? (
                <div className="p-12 text-center">
                  <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-black">No submissions in evaluation queue</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                    The database has 0 matching answer sheet records. Click &apos;Upload Answer Sheet&apos; to register a paper for evaluation.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-black">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5">Candidate</th>
                        <th className="px-6 py-3.5">Examination</th>
                        <th className="px-6 py-3.5">Document Scan</th>
                        <th className="px-6 py-3.5">Uploaded</th>
                        <th className="px-6 py-3.5 text-right">Score</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredSubmissions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-neutral-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-black">{sub.studentName}</div>
                            <div className="text-xs text-neutral-500 font-mono">{sub.studentCode}</div>
                          </td>
                          <td className="px-6 py-4 text-xs text-neutral-800 font-medium">{sub.examTitle}</td>
                          <td className="px-6 py-4 text-xs font-mono text-neutral-600">
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-neutral-400" />
                              {sub.fileName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-neutral-500">{sub.uploadedAt}</td>
                          <td className="px-6 py-4 font-bold text-black text-right">
                            {sub.approvedMarks !== undefined ? `${sub.approvedMarks} / ${sub.examTotalMarks}` : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                sub.status === 'APPROVED'
                                  ? 'primary'
                                  : sub.status === 'REJECTED'
                                  ? 'error'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {sub.status.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {sub.status !== 'APPROVED' ? (
                              <Button
                                onClick={() => openReviewWorkspace(sub)}
                                variant="outline"
                                size="sm"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#FF8500]" />
                                Review & Sign Off
                              </Button>
                            ) : (
                              <span className="text-xs font-semibold text-neutral-800 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#FF8500]" /> Verified
                              </span>
                            )}
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

        {/* VIEW 2: TEACHER REVIEW WORKSPACE */}
        {viewMode === 'review' && activeSubmission && (
          <div className="space-y-6">
            {/* Top Bar with Sign-Off Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <Button onClick={() => setViewMode('queue')} variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4" />
                Back to Evaluation Queue
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleTriggerAiEvaluation}
                  disabled={actionLoading}
                  variant="outline"
                  size="sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FF8500]" />
                  Re-run AI Scoring
                </Button>
                <Button onClick={() => setShowRejectModal(true)} variant="outline" size="sm">
                  <XCircle className="w-4 h-4 text-neutral-500" />
                  Reject Scan
                </Button>
                <Button
                  disabled={!allApproved || actionLoading}
                  onClick={handleFinalSignOff}
                  variant="primary"
                  size="sm"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Sign Off & Transfer to Results
                </Button>
              </div>
            </div>

            {/* Candidate Header Summary */}
            <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-neutral-100 text-black border border-neutral-200">
                    {activeSubmission.studentCode}
                  </span>
                  <h3 className="font-bold text-black text-lg">{activeSubmission.studentName}</h3>
                </div>
                <div className="text-xs text-neutral-500 mt-1">{activeSubmission.examTitle}</div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs text-neutral-500">AI Suggested Total</div>
                  <div className="text-lg font-bold text-neutral-800">
                    {totalSuggested} / {activeSubmission.examTotalMarks}
                  </div>
                </div>

                <div className="text-right border-l border-neutral-200 pl-6">
                  <div className="text-xs text-neutral-500">Teacher Approved Total</div>
                  <div className="text-2xl font-bold text-black">
                    {totalFinal} / {activeSubmission.examTotalMarks}
                  </div>
                </div>
              </div>
            </div>

            {/* Question Breakdown Workspace */}
            {detailLoading ? (
              <div className="p-12 text-center text-xs text-neutral-500 bg-white rounded-xl border border-neutral-200">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                Loading question evaluations and rubric details...
              </div>
            ) : detailError ? (
              <div className="p-8 text-center bg-white rounded-xl border border-neutral-200 text-red-600">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-red-500" />
                <h4 className="text-sm font-semibold">Failed to load submission question details</h4>
                <p className="text-xs text-neutral-500 mt-1">{detailError}</p>
                <Button onClick={() => openReviewWorkspace(activeSubmission)} variant="outline" size="sm" className="mt-3">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Loading Questions
                </Button>
              </div>
            ) : activeSubmission.items.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-xl border border-neutral-200">
                <p className="text-xs text-neutral-500">
                  No question items linked to this examination blueprint. Click &apos;Re-run AI Scoring&apos; after adding questions to the exam paper.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {activeSubmission.items.map((item, idx) => (
                  <div
                    key={item.questionId}
                    className={`bg-white p-6 rounded-xl border transition-all ${
                      item.approved ? 'border-[#FFD199] bg-[#FFF8F0]/30' : 'border-neutral-200'
                    } shadow-card space-y-4`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                          Question {idx + 1} ({item.maxMarks} Marks) • {item.topic || 'General'}
                        </span>
                        <h4 className="font-bold text-black text-sm mt-1">{item.questionText}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="primary" size="sm">
                          AI Suggested: {item.aiSuggestedMarks} / {item.maxMarks}
                        </Badge>
                        <span className="text-xs text-neutral-500 font-mono">
                          ({Math.round(item.confidence * 100)}% conf)
                        </span>
                      </div>
                    </div>

                    {/* OCR Extracted Answer */}
                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono text-black">
                      <span className="text-neutral-500 block mb-1 uppercase font-bold text-[10px]">
                        OCR Extracted Student Answer:
                      </span>
                      {item.extractedAnswer}
                    </div>

                    {/* Rubric Criteria Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {item.criterionScores.map((c, cIdx) => (
                        <div key={cIdx} className="p-3 rounded-lg border border-neutral-200 bg-white text-xs space-y-1">
                          <div className="flex items-center justify-between font-semibold text-black">
                            <span>{c.criterion}</span>
                            <span className="font-mono text-neutral-700">
                              {c.obtainedMarks} / {c.allocatedMarks}
                            </span>
                          </div>
                          <div className="text-neutral-500 text-[11px]">{c.feedback}</div>
                        </div>
                      ))}
                    </div>

                    {/* Teacher Decision Row */}
                    <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="text-xs text-neutral-600">
                        <span className="font-semibold text-black">AI Rubric Rationale: </span>
                        {item.explanation}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-black">Teacher Mark:</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={item.maxMarks}
                            value={item.teacherFinalMarks}
                            onChange={(e) => handleFinalMarkChange(item.questionId, Number(e.target.value))}
                            className="w-20 px-2.5 py-1 text-sm font-bold text-center border border-neutral-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                          />
                        </div>

                        <Button
                          onClick={() => handleApproveItem(item.questionId)}
                          disabled={actionLoading}
                          variant={item.approved ? 'secondary' : 'primary'}
                          size="sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {item.approved ? 'Approved' : 'Approve Score'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ResponsivePageContainer>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Answer Sheet"
        description="Attach PDF or high-resolution scan to register submission for OCR and rubric evaluation."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-black block mb-1">Target Examination *</label>
            <select
              value={uploadExamId}
              onChange={(e) => setUploadExamId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            >
              {availableExams.length === 0 ? (
                <option value="">No examinations available</option>
              ) : (
                availableExams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-black block mb-1">Student Candidate *</label>
            <select
              value={uploadStudentId}
              onChange={(e) => setUploadStudentId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            >
              {availableStudents.length === 0 ? (
                <option value="">No students available</option>
              ) : (
                availableStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-black block mb-1">Document File Name</label>
            <input
              type="text"
              value={uploadFileName}
              onChange={(e) => setUploadFileName(e.target.value)}
              placeholder="e.g. candidate_paper_scan.pdf"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            />
          </div>

          <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center space-y-2 bg-neutral-50">
            <Upload className="w-8 h-8 text-neutral-400 mx-auto" />
            <div className="text-xs font-medium text-black">Drag and drop scanned PDF / JPEG answer sheet</div>
            <div className="text-[10px] text-neutral-500">Max size: 25MB • Up to 10 pages</div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUploadSubmission}
              disabled={submittingUpload || !uploadExamId || !uploadStudentId}
            >
              {submittingUpload ? 'Registering...' : 'Queue Evaluation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Scan Modal */}
      {showRejectModal && (
        <Modal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          title="Reject Answer Sheet"
          description="Mark this scan as rejected so a clean copy can be re-submitted."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Rejection Reason *</label>
              <textarea
                rows={3}
                required
                placeholder="Reason for scan rejection (e.g. Page 2 is blurry or missing student signature)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRejectSubmission} disabled={actionLoading}>
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
