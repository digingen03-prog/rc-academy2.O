'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { ResponsivePageContainer } from '@/components/layout/responsive-container';
import {
  BookOpen,
  Plus,
  Sparkles,
  FileText,
  Search,
  Printer,
  Edit3,
  Award,
  Calendar,
  Building2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiClient } from '@/lib/api/api-client';
import { useAuthUser } from '@/lib/auth/use-role';

interface ExamItem {
  id: string;
  title: string;
  className: string;
  classId?: string;
  batchName: string;
  batchId?: string;
  subjectName: string;
  subjectId?: string;
  date: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'EVALUATION' | 'PUBLISHED';
  isPublished: boolean;
  paperVersion: number;
  questionsCount: number;
}

interface QuestionItem {
  id: string;
  topic: string;
  subjectName: string;
  questionType: 'MCQ' | 'SHORT_ANSWER' | 'LONG_ANSWER' | 'NUMERICAL';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  content: string;
  maxMarks: number;
  status: 'DRAFT' | 'APPROVED';
  answerKeyText?: string;
  explanation?: string;
  sourceReference?: string;
}

interface CandidateResult {
  studentId: string;
  studentName: string;
  studentCode: string;
  admissionNumber?: string;
  batchName?: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'EXEMPT';
  marks: number;
  percentage: number;
  grade: string;
  rank?: number;
  correctedMarks?: number;
  correctionReason?: string;
  isPublished?: boolean;
}

interface CourseOption {
  id: string;
  name: string;
  code?: string;
  batches?: Array<{ id: string; name: string }>;
  subjects?: Array<{ id: string; name: string; code?: string }>;
}

export default function ExaminationsPage() {
  const { user } = useAuthUser();
  const canCorrectResults = Boolean(
    user?.roles?.includes('SUPER_ADMIN') || user?.roles?.includes('ACADEMY_ADMIN'),
  );

  const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'marks' | 'results'>('exams');

  // Server-connected states (zero fabricated records)
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateResult[]>([]);
  const [coursesList, setCoursesList] = useState<CourseOption[]>([]);

  // Async state & discrete error tracking per resource
  const [loading, setLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Selected entities
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null);

  // Modal States
  const [showNewExamModal, setShowNewExamModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showPaperPreviewModal, setShowPaperPreviewModal] = useState(false);

  // Form States - Create Exam
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamClassId, setNewExamClassId] = useState('');
  const [newExamBatchId, setNewExamBatchId] = useState('');
  const [newExamSubjectId, setNewExamSubjectId] = useState('');
  const [newExamDate, setNewExamDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newExamDuration, setNewExamDuration] = useState(90);
  const [newExamTotalMarks, setNewExamTotalMarks] = useState(50);
  const [newExamPassMarks, setNewExamPassMarks] = useState(17.5);
  const [submittingExam, setSubmittingExam] = useState(false);

  // Form States - AI Generation
  const [aiSubjectId, setAiSubjectId] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [generating, setGenerating] = useState(false);

  // Form States - Correction
  const [correctionMarks, setCorrectionMarks] = useState(0);
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  // Form States - Inline Marks Entry
  const [editableMarks, setEditableMarks] = useState<Record<string, number>>({});
  const [savingMarks, setSavingMarks] = useState(false);
  const [finalizingResults, setFinalizingResults] = useState(false);

  // --------------------------------------------------------------------------
  // Data Fetching: Deliberate Concurrent Loading with Partial Failure Isolation
  // --------------------------------------------------------------------------
  const loadPageData = useCallback(async () => {
    setLoading(true);

    const [examsResult, questionsResult, coursesResult] = await Promise.allSettled([
      ApiClient.fetch<any[]>('/examinations'),
      ApiClient.fetch<any[]>('/examinations/questions'),
      ApiClient.fetch<any[]>('/courses'),
    ]);

    const failedParts: string[] = [];

    // 1. Process Examinations
    if (examsResult.status === 'fulfilled') {
      const rawExams = examsResult.value || [];
      const mappedExams: ExamItem[] = rawExams.map((e: any) => ({
        id: e.id,
        title: e.title,
        className: e.class?.name || 'Class',
        classId: e.classId,
        batchName: e.batch?.name || 'General Batch',
        batchId: e.batchId,
        subjectName: e.subject?.name || 'Subject',
        subjectId: e.subjectId,
        date: typeof e.date === 'string' ? e.date.split('T')[0] : new Date(e.date).toISOString().split('T')[0],
        durationMinutes: Number(e.durationMinutes) || 60,
        totalMarks: Number(e.totalMarks) || 100,
        passMarks: Number(e.passMarks) || 35,
        status: e.status || 'DRAFT',
        isPublished: Boolean(e.isPublished),
        paperVersion: Number(e.paperVersion) || 1,
        questionsCount: e._count?.questions || 0,
      }));
      setExams(mappedExams);
      setExamsError(null);

      if (mappedExams.length > 0) {
        setSelectedExamId((prev) => (prev && mappedExams.some((x) => x.id === prev) ? prev : mappedExams[0].id));
      } else {
        setSelectedExamId('');
        setSelectedExam(null);
        setCandidates([]);
      }
    } else {
      const errMsg = examsResult.reason?.message || 'Failed to load examinations';
      setExamsError(errMsg);
      failedParts.push(`Examinations: ${errMsg}`);
      // NOTE: Do not erase previously loaded exams if present!
    }

    // 2. Process Questions
    if (questionsResult.status === 'fulfilled') {
      const rawQuestions = questionsResult.value || [];
      const mappedQuestions: QuestionItem[] = rawQuestions.map((q: any) => ({
        id: q.id,
        topic: q.topic || 'General',
        subjectName: q.subject?.name || 'Subject',
        questionType: q.questionType || 'SHORT_ANSWER',
        difficulty: q.difficulty || 'MEDIUM',
        content: q.content || '',
        maxMarks: Number(q.maxMarks) || 5,
        status: q.status || 'DRAFT',
        answerKeyText: q.answerKeyText,
        explanation: q.explanation,
        sourceReference: q.sourceReference,
      }));
      setQuestions(mappedQuestions);
      setQuestionsError(null);
    } else {
      const errMsg = questionsResult.reason?.message || 'Failed to load questions';
      setQuestionsError(errMsg);
      failedParts.push(`Questions: ${errMsg}`);
      // NOTE: Do not erase previously loaded questions!
    }

    // 3. Process Courses & Dropdown Options
    if (coursesResult.status === 'fulfilled') {
      const rawCourses = coursesResult.value || [];
      setCoursesList(rawCourses);
      setCoursesError(null);

      if (rawCourses.length > 0) {
        setNewExamClassId((prev) => prev || rawCourses[0].id);
        if (rawCourses[0].subjects && rawCourses[0].subjects.length > 0) {
          setNewExamSubjectId((prev) => prev || rawCourses[0].subjects[0].id);
          setAiSubjectId((prev) => prev || rawCourses[0].subjects[0].id);
        }
        if (rawCourses[0].batches && rawCourses[0].batches.length > 0) {
          setNewExamBatchId((prev) => prev || rawCourses[0].batches[0].id);
        }
      }
    } else {
      const errMsg = coursesResult.reason?.message || 'Failed to load curriculum courses';
      setCoursesError(errMsg);
      failedParts.push(`Courses: ${errMsg}`);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  // --------------------------------------------------------------------------
  // Data Fetching: Candidates for Selected Exam
  // --------------------------------------------------------------------------
  const loadCandidates = useCallback(async (examId: string) => {
    if (!examId) {
      setCandidates([]);
      setCandidatesError(null);
      return;
    }
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const rawCandidates = await ApiClient.fetch<any[]>(`/examinations/${examId}/candidates`);
      const mapped: CandidateResult[] = (rawCandidates || []).map((c: any) => {
        const res = c.result;
        return {
          studentId: c.studentId,
          studentName: c.studentName,
          studentCode: c.studentCode,
          admissionNumber: c.admissionNumber,
          batchName: c.batchName,
          attendanceStatus: c.attendanceStatus || 'PRESENT',
          marks: res ? Number(res.obtainedMarks) : 0,
          percentage: res ? Number(res.percentage) : 0,
          grade: res ? res.grade : '—',
          rank: res?.rank || undefined,
          correctedMarks: res?.correctedMarks ? Number(res.correctedMarks) : undefined,
          correctionReason: res?.correctionReason || undefined,
          isPublished: Boolean(res?.isPublished),
        };
      });
      setCandidates(mapped);

      // Initialize inline editable marks map
      const marksMap: Record<string, number> = {};
      mapped.forEach((c) => {
        marksMap[c.studentId] = c.marks;
      });
      setEditableMarks(marksMap);
    } catch (err) {
      const msg = (err as Error).message || 'Failed to load candidates';
      setCandidatesError(msg);
      // Retain previously loaded candidates on failure rather than wiping to []
    } finally {
      setCandidatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      const match = exams.find((e) => e.id === selectedExamId) || null;
      setSelectedExam(match);
      loadCandidates(selectedExamId);
    } else {
      setSelectedExam(null);
      setCandidates([]);
    }
  }, [selectedExamId, exams, loadCandidates]);

  // --------------------------------------------------------------------------
  // Mutation: Create Examination
  // --------------------------------------------------------------------------
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamTitle.trim() || !newExamClassId || !newExamSubjectId) {
      setActionNotice({ type: 'error', message: 'Please provide Title, Class, and Subject.' });
      return;
    }

    setSubmittingExam(true);
    try {
      await ApiClient.fetch('/examinations', {
        method: 'POST',
        body: JSON.stringify({
          title: newExamTitle.trim(),
          classId: newExamClassId,
          batchId: newExamBatchId || undefined,
          subjectId: newExamSubjectId,
          date: newExamDate,
          durationMinutes: Number(newExamDuration),
          totalMarks: Number(newExamTotalMarks),
          passMarks: Number(newExamPassMarks),
        }),
      });

      setShowNewExamModal(false);
      setNewExamTitle('');
      setActionNotice({ type: 'success', message: 'Examination blueprint created successfully.' });
      await loadPageData();
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to create examination.' });
    } finally {
      setSubmittingExam(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutation: AI Question Generation (With limitation notice)
  // --------------------------------------------------------------------------
  const handleGenerateAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) {
      setActionNotice({ type: 'error', message: 'Please provide a curriculum topic for AI generation.' });
      return;
    }
    if (!aiSubjectId) {
      setActionNotice({ type: 'error', message: 'Please select a subject to associate questions with.' });
      return;
    }

    setGenerating(true);
    try {
      const res = await ApiClient.fetch<any>('/examinations/ai/generate-questions', {
        method: 'POST',
        body: JSON.stringify({
          subjectId: aiSubjectId,
          topic: aiTopic.trim(),
          count: Number(aiCount),
          difficulty: aiDifficulty,
        }),
      });

      setShowAiModal(false);
      setAiTopic('');
      setActionNotice({
        type: 'info',
        message: `${res.message || 'Draft questions generated via backend template synthesizer.'} Note: Direct Ollama local inference is awaiting background queue wiring.`,
      });
      await loadPageData();
      setActiveTab('questions');
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to synthesize questions.' });
    } finally {
      setGenerating(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutation: Save Marks
  // --------------------------------------------------------------------------
  const handleSaveMarks = async () => {
    if (!selectedExamId || candidates.length === 0) return;
    setSavingMarks(true);
    try {
      const entries = candidates.map((c) => ({
        studentId: c.studentId,
        marks: Number(editableMarks[c.studentId] !== undefined ? editableMarks[c.studentId] : c.marks),
        attendanceStatus: c.attendanceStatus,
      }));

      await ApiClient.fetch(`/examinations/${selectedExamId}/marks`, {
        method: 'POST',
        body: JSON.stringify({ entries }),
      });

      setActionNotice({ type: 'success', message: `Saved marks for ${entries.length} candidate(s).` });
      await loadCandidates(selectedExamId);
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to submit candidate marks.' });
    } finally {
      setSavingMarks(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutation: Finalize & Publish Results
  // --------------------------------------------------------------------------
  const handleFinalizeResults = async () => {
    if (!selectedExamId) return;
    setFinalizingResults(true);
    try {
      const res = await ApiClient.fetch<any>(`/examinations/${selectedExamId}/results/finalize`, {
        method: 'POST',
      });
      setActionNotice({ type: 'success', message: res.message || 'Results finalized and published.' });
      await loadPageData();
      await loadCandidates(selectedExamId);
      setActiveTab('results');
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to finalize examination results.' });
    } finally {
      setFinalizingResults(false);
    }
  };

  // --------------------------------------------------------------------------
  // Mutation: Audited Result Correction (Admin authorization enforced)
  // --------------------------------------------------------------------------
  const handleApplyCorrection = async () => {
    if (!canCorrectResults) {
      setActionNotice({
        type: 'error',
        message: 'Unauthorized: Only Administrators (SUPER_ADMIN or ACADEMY_ADMIN) can apply audited corrections.',
      });
      setShowCorrectionModal(false);
      return;
    }

    if (!selectedExamId || !selectedCandidate) return;
    if (!correctionReason.trim()) {
      setActionNotice({ type: 'error', message: 'A mandatory audit reason is required for mark corrections.' });
      return;
    }

    setSubmittingCorrection(true);
    try {
      await ApiClient.fetch(`/examinations/${selectedExamId}/results/correct`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedCandidate.studentId,
          correctedMarks: Number(correctionMarks),
          reason: correctionReason.trim(),
        }),
      });

      setShowCorrectionModal(false);
      setCorrectionReason('');
      setActionNotice({
        type: 'success',
        message: `Audited correction recorded for ${selectedCandidate.studentName}.`,
      });
      await loadCandidates(selectedExamId);
    } catch (err) {
      setActionNotice({ type: 'error', message: (err as Error).message || 'Failed to apply audited correction.' });
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // --------------------------------------------------------------------------
  // Dynamic Metric Calculations (Derived strictly from live records)
  // --------------------------------------------------------------------------
  const scoredCandidates = candidates.filter(
    (c) => c.marks !== undefined && c.marks !== null && c.attendanceStatus === 'PRESENT',
  );
  const classAverage =
    scoredCandidates.length > 0
      ? (
          scoredCandidates.reduce((acc, c) => acc + (c.percentage || 0), 0) / scoredCandidates.length
        ).toFixed(1) + '%'
      : 'N/A';

  const passRate =
    scoredCandidates.length > 0
      ? `${Math.round(
          (scoredCandidates.filter((c) => (c.marks || 0) >= (selectedExam?.passMarks || 35)).length /
            scoredCandidates.length) *
            100,
        )}% pass rate`
      : 'No finalized results';

  return (
    <>
      <Header
        title="Examination & Paper Builder"
        subtitle="Curriculum blueprints, question bank, local AI synthesis, marks entry and finalized results"
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
              className="p-1 text-neutral-400 hover:text-black rounded"
              aria-label="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Global / Partial Service Error Banner */}
        {(examsError || questionsError || coursesError) && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Some data could not be synchronized from the server:</span>
                {examsError && <div>• Examinations: {examsError}</div>}
                {questionsError && <div>• Questions: {questionsError}</div>}
                {coursesError && <div>• Curriculum Courses: {coursesError}</div>}
              </div>
            </div>
            <Button onClick={loadPageData} variant="outline" size="sm" className="self-start sm:self-auto shrink-0">
              <RefreshCw className="w-3.5 h-3.5" /> Retry Sync
            </Button>
          </div>
        )}

        {/* Metric Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Scheduled Exams
            </span>
            <div className="text-2xl font-bold text-black mt-2">
              {loading && exams.length === 0 ? '—' : exams.length}
            </div>
            <span className="text-xs text-neutral-500 mt-1 block">Active blueprints</span>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Question Bank
            </span>
            <div className="text-2xl font-bold text-black mt-2">
              {loading && questions.length === 0 ? '—' : questions.length}
            </div>
            <span className="text-xs text-neutral-500 mt-1 block">
              {questions.filter((q) => q.status === 'APPROVED').length} approved items
            </span>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Class Average
            </span>
            <div className="text-2xl font-bold text-black mt-2">
              {loading && candidates.length === 0 ? '—' : classAverage}
            </div>
            <span className="text-xs text-[#CC6B00] mt-1 block font-medium">{passRate}</span>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
              Local AI Engine
            </span>
            <div className="text-base font-bold text-black mt-2">Ollama (Draft Synthesizer)</div>
            <span className="text-xs text-neutral-500 mt-1 block">Template Synthesizer Ready</span>
          </div>
        </div>

        {/* Tab Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-neutral-200 pb-3">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'exams', label: 'Examinations' },
                { id: 'questions', label: 'Question Bank' },
                { id: 'marks', label: 'Marks Entry' },
                { id: 'results', label: 'Results & Ranks' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-neutral-900 text-white shadow-subtle'
                    : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAiModal(true)} variant="outline" size="sm">
              <Sparkles className="w-3.5 h-3.5 text-[#FF8500]" />
              AI Question Generator
            </Button>
            <Button onClick={() => setShowNewExamModal(true)} variant="primary" size="sm">
              <Plus className="w-3.5 h-3.5" />
              New Examination
            </Button>
          </div>
        </div>

        {/* Loading Spinner Indicator */}
        {loading && exams.length === 0 && questions.length === 0 && (
          <div className="p-12 text-center bg-white rounded-xl border border-neutral-200">
            <Loader2 className="w-6 h-6 animate-spin text-[#FF8500] mx-auto mb-2" />
            <p className="text-xs text-neutral-500 font-medium">Connecting to examination services...</p>
          </div>
        )}

        {/* TAB 1: EXAMINATIONS */}
        {activeTab === 'exams' && (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
            {examsError && exams.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-black">Failed to load examinations</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">{examsError}</p>
                <Button onClick={loadPageData} variant="outline" size="sm" className="mt-4">
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </Button>
              </div>
            ) : exams.length === 0 && !loading ? (
              <div className="p-12 text-center">
                <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-black">No examinations scheduled yet</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  The database currently has 0 examination blueprints. Click &apos;New Examination&apos; to schedule an assessment.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-black">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Examination Title</th>
                      <th className="px-6 py-3.5">Class / Batch</th>
                      <th className="px-6 py-3.5">Subject</th>
                      <th className="px-6 py-3.5">Date</th>
                      <th className="px-6 py-3.5">Duration</th>
                      <th className="px-6 py-3.5">Marks (Total / Pass)</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Paper Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {exams.map((ex) => (
                      <tr key={ex.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="px-6 py-4 font-semibold text-black">
                          {ex.title}
                          {ex.isPublished && (
                            <span className="ml-2 text-[10px] font-mono bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200">
                              v{ex.paperVersion}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-neutral-700">
                          {ex.className} • <strong>{ex.batchName}</strong>
                        </td>
                        <td className="px-6 py-4 font-medium text-black">{ex.subjectName}</td>
                        <td className="px-6 py-4 text-xs font-mono text-neutral-600">{ex.date}</td>
                        <td className="px-6 py-4 text-xs text-neutral-700">{ex.durationMinutes} mins</td>
                        <td className="px-6 py-4 font-semibold text-black">
                          {ex.totalMarks}{' '}
                          <span className="text-xs text-neutral-500 font-normal">/ {ex.passMarks}</span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={ex.status === 'PUBLISHED' ? 'primary' : 'neutral'} size="sm">
                            {ex.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedExam(ex);
                              setShowPaperPreviewModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-black rounded text-xs font-medium transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Paper
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUESTION BANK */}
        {activeTab === 'questions' && (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
            {questionsError && questions.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-black">Failed to load question bank</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">{questionsError}</p>
                <Button onClick={loadPageData} variant="outline" size="sm" className="mt-4">
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </Button>
              </div>
            ) : questions.length === 0 && !loading ? (
              <div className="p-12 text-center">
                <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-black">Question Bank is empty</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  No questions exist in the repository. Use the &apos;AI Question Generator&apos; to draft curriculum items into the question bank.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-black">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Topic & Question</th>
                      <th className="px-6 py-3.5">Type</th>
                      <th className="px-6 py-3.5">Difficulty</th>
                      <th className="px-6 py-3.5 text-right">Marks</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Model Answer / Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {questions.map((q) => (
                      <tr key={q.id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="px-6 py-4 max-w-md">
                          <div className="font-semibold text-[#CC6B00] text-xs">{q.topic}</div>
                          <div className="text-black font-medium text-sm mt-0.5">{q.content}</div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" size="sm">
                            {q.questionType}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="neutral" size="sm">
                            {q.difficulty}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 font-bold text-black text-right">{q.maxMarks}M</td>
                        <td className="px-6 py-4">
                          <Badge variant={q.status === 'APPROVED' ? 'primary' : 'neutral'} size="sm">
                            {q.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-neutral-600 font-mono max-w-xs truncate">
                          {q.answerKeyText || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MARKS ENTRY */}
        {activeTab === 'marks' && (
          <div className="space-y-4">
            {exams.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-neutral-200">
                <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-black">No examinations available</h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Create an examination blueprint before recording candidate marks.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                      Active Examination
                    </label>
                    <select
                      value={selectedExamId}
                      onChange={(e) => setSelectedExamId(e.target.value)}
                      className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm font-bold text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title} ({ex.className} • {ex.batchName} • {ex.subjectName})
                        </option>
                      ))}
                    </select>
                    {selectedExam && (
                      <p className="text-xs text-neutral-500 mt-1.5">
                        Total Marks: {selectedExam.totalMarks} | Pass Marks: {selectedExam.passMarks} | Date:{' '}
                        {selectedExam.date}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleSaveMarks}
                      disabled={savingMarks || candidates.length === 0}
                      variant="outline"
                      size="sm"
                    >
                      {savingMarks ? 'Saving...' : 'Save Entered Marks'}
                    </Button>
                    <Button
                      onClick={handleFinalizeResults}
                      disabled={finalizingResults || candidates.length === 0}
                      variant="primary"
                      size="sm"
                    >
                      {finalizingResults ? 'Finalizing...' : 'Finalize & Publish Results'}
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
                  {candidatesLoading ? (
                    <div className="p-8 text-center text-xs text-neutral-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                      Loading candidate roster...
                    </div>
                  ) : candidatesError && candidates.length === 0 ? (
                    <div className="p-8 text-center text-xs text-red-600 bg-red-50/50">
                      <AlertCircle className="w-6 h-6 mx-auto mb-1 text-red-500" />
                      <p className="font-medium">{candidatesError}</p>
                      <Button
                        onClick={() => loadCandidates(selectedExamId)}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry Candidate Roster
                      </Button>
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Award className="w-7 h-7 text-neutral-300 mx-auto mb-1" />
                      <p className="text-xs text-neutral-500">
                        No enrolled students found for this examination class and batch.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-black">
                        <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                          <tr>
                            <th className="px-6 py-3.5">Student Code</th>
                            <th className="px-6 py-3.5">Candidate Name</th>
                            <th className="px-6 py-3.5">Attendance</th>
                            <th className="px-6 py-3.5 text-right">Marks (/{selectedExam?.totalMarks || 100})</th>
                            <th className="px-6 py-3.5 text-right">Percentage</th>
                            <th className="px-6 py-3.5 text-center">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {candidates.map((c) => (
                            <tr key={c.studentId} className="hover:bg-neutral-50/60">
                              <td className="px-6 py-4 font-mono font-semibold text-black">{c.studentCode}</td>
                              <td className="px-6 py-4 font-medium text-black">{c.studentName}</td>
                              <td className="px-6 py-4">
                                <Badge variant={c.attendanceStatus === 'PRESENT' ? 'primary' : 'neutral'} size="sm">
                                  {c.attendanceStatus}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  max={selectedExam?.totalMarks || 100}
                                  value={editableMarks[c.studentId] !== undefined ? editableMarks[c.studentId] : c.marks}
                                  onChange={(e) =>
                                    setEditableMarks({
                                      ...editableMarks,
                                      [c.studentId]: Number(e.target.value),
                                    })
                                  }
                                  className="w-20 px-2 py-1 text-sm font-bold text-center border border-neutral-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                                />
                              </td>
                              <td className="px-6 py-4 font-medium text-neutral-800 text-right">
                                {selectedExam?.totalMarks
                                  ? (
                                      ((editableMarks[c.studentId] !== undefined
                                        ? editableMarks[c.studentId]
                                        : c.marks) /
                                        selectedExam.totalMarks) *
                                      100
                                    ).toFixed(1)
                                  : '0.0'}
                                %
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge variant="dark" size="sm">
                                  {c.grade}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: RESULTS & AUDITED CORRECTIONS */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            {exams.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-xl border border-neutral-200">
                <p className="text-xs text-neutral-500">No examination blueprints exist.</p>
              </div>
            ) : (
              <>
                <div className="bg-white p-4 rounded-xl border border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Exam:</span>
                    <select
                      value={selectedExamId}
                      onChange={(e) => setSelectedExamId(e.target.value)}
                      className="px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-bold text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
                    >
                      {exams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    {selectedExam && (
                      <span>
                        Status: <strong>{selectedExam.status}</strong>
                      </span>
                    )}
                    {!canCorrectResults && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                        Correction requires Admin
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
                  {candidatesLoading ? (
                    <div className="p-8 text-center text-xs text-neutral-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#FF8500]" />
                      Loading candidate results...
                    </div>
                  ) : candidatesError && candidates.length === 0 ? (
                    <div className="p-8 text-center text-xs text-red-600 bg-red-50/50">
                      <AlertCircle className="w-6 h-6 mx-auto mb-1 text-red-500" />
                      <p className="font-medium">{candidatesError}</p>
                      <Button
                        onClick={() => loadCandidates(selectedExamId)}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Retry Results
                      </Button>
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="p-8 text-center">
                      <Award className="w-7 h-7 text-neutral-300 mx-auto mb-1" />
                      <p className="text-xs text-neutral-500">No candidate results available for this examination.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-black">
                        <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                          <tr>
                            <th className="px-6 py-3.5">Rank</th>
                            <th className="px-6 py-3.5">Candidate</th>
                            <th className="px-6 py-3.5 text-right">Marks (/{selectedExam?.totalMarks || 100})</th>
                            <th className="px-6 py-3.5 text-right">Percentage</th>
                            <th className="px-6 py-3.5 text-center">Grade</th>
                            <th className="px-6 py-3.5">Audited Correction Note</th>
                            <th className="px-6 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {candidates.map((c) => (
                            <tr key={c.studentId} className="hover:bg-neutral-50/60">
                              <td className="px-6 py-4 font-bold text-black">{c.rank ? `#${c.rank}` : '—'}</td>
                              <td className="px-6 py-4 font-medium text-black">
                                {c.studentName}{' '}
                                <span className="text-xs text-neutral-500 font-mono">({c.studentCode})</span>
                              </td>
                              <td className="px-6 py-4 font-bold text-black text-right">{c.marks}</td>
                              <td className="px-6 py-4 font-medium text-neutral-800 text-right">{c.percentage}%</td>
                              <td className="px-6 py-4 text-center">
                                <Badge variant="dark" size="sm">
                                  {c.grade}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-xs text-neutral-600 max-w-xs">
                                {c.correctionReason || 'None (Standard Evaluation)'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {canCorrectResults ? (
                                  <button
                                    onClick={() => {
                                      setSelectedCandidate(c);
                                      setCorrectionMarks(c.marks);
                                      setCorrectionReason(c.correctionReason || '');
                                      setShowCorrectionModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-black rounded text-xs font-medium cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" /> Correction
                                  </button>
                                ) : (
                                  <span
                                    className="text-[11px] text-neutral-400 font-medium px-2 py-1"
                                    title="Only SUPER_ADMIN and ACADEMY_ADMIN can apply mark corrections"
                                  >
                                    Admin only
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
              </>
            )}
          </div>
        )}
      </ResponsivePageContainer>

      {/* New Exam Modal */}
      <Modal
        isOpen={showNewExamModal}
        onClose={() => setShowNewExamModal(false)}
        title="Create Examination Blueprint"
        description="Establish paper details, class batch targeting and passing thresholds."
        maxWidth="md"
      >
        <form onSubmit={handleCreateExam} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-black block mb-1">Exam Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Unit Test 1 - Mechanics & Optics"
              value={newExamTitle}
              onChange={(e) => setNewExamTitle(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Class / Course *</label>
              <select
                required
                value={newExamClassId}
                onChange={(e) => {
                  setNewExamClassId(e.target.value);
                  const selectedCourse = coursesList.find((c) => c.id === e.target.value);
                  if (selectedCourse?.batches && selectedCourse.batches.length > 0) {
                    setNewExamBatchId(selectedCourse.batches[0].id);
                  } else {
                    setNewExamBatchId('');
                  }
                  if (selectedCourse?.subjects && selectedCourse.subjects.length > 0) {
                    setNewExamSubjectId(selectedCourse.subjects[0].id);
                  }
                }}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              >
                {coursesList.length === 0 ? (
                  <option value="">No courses configured</option>
                ) : (
                  coursesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-black block mb-1">Batch (Optional)</label>
              <select
                value={newExamBatchId}
                onChange={(e) => setNewExamBatchId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              >
                <option value="">All Batches</option>
                {coursesList
                  .find((c) => c.id === newExamClassId)
                  ?.batches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Subject *</label>
              <select
                required
                value={newExamSubjectId}
                onChange={(e) => setNewExamSubjectId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              >
                {coursesList
                  .find((c) => c.id === newExamClassId)
                  ?.subjects?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  )) || <option value="">No subjects found</option>}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-black block mb-1">Exam Date *</label>
              <input
                type="date"
                required
                value={newExamDate}
                onChange={(e) => setNewExamDate(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Duration (m)</label>
              <input
                type="number"
                min="1"
                required
                value={newExamDuration}
                onChange={(e) => setNewExamDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Total Marks</label>
              <input
                type="number"
                min="1"
                required
                value={newExamTotalMarks}
                onChange={(e) => setNewExamTotalMarks(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Pass Marks</label>
              <input
                type="number"
                min="0"
                required
                value={newExamPassMarks}
                onChange={(e) => setNewExamPassMarks(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button variant="outline" onClick={() => setShowNewExamModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submittingExam}>
              {submittingExam ? 'Saving...' : 'Save Blueprint'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* AI Question Generator Modal */}
      <Modal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        title="Local AI Question Synthesis"
        description="Generates curriculum questions and answer rubrics locally using on-premise template synthesis."
        maxWidth="md"
      >
        <form onSubmit={handleGenerateAi} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-black block mb-1">Target Subject *</label>
            <select
              required
              value={aiSubjectId}
              onChange={(e) => setAiSubjectId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            >
              {coursesList.flatMap((c) => c.subjects || []).length === 0 ? (
                <option value="">No subjects found</option>
              ) : (
                coursesList.flatMap((c) => c.subjects || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-black block mb-1">Curriculum Topic *</label>
            <input
              type="text"
              required
              placeholder="e.g. Electromagnetic Induction, Photosynthesis, Quadratic Equations..."
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Question Count</label>
              <input
                type="number"
                min="1"
                max="20"
                required
                value={aiCount}
                onChange={(e) => setAiCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Difficulty</label>
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value as any)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600">
            <strong>Engine Note:</strong> Questions are synthesized using backend curriculum heuristics and tagged as
            draft items. Live background queue dispatch to Ollama (qwen2.5) will execute when worker is connected.
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button variant="outline" onClick={() => setShowAiModal(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={generating}>
              {generating ? 'Synthesizing...' : 'Generate Questions'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Printable Question Paper Modal */}
      {showPaperPreviewModal && selectedExam && (
        <Modal
          isOpen={showPaperPreviewModal}
          onClose={() => setShowPaperPreviewModal(false)}
          title="Printable Examination Paper"
          description="Clean paper layout formatted with standard print stylesheet."
          maxWidth="2xl"
        >
          <div className="p-6 rounded-xl border border-neutral-200 bg-white space-y-5 print:p-0 print:border-none">
            <div className="text-center border-b border-neutral-200 pb-4">
              <div className="w-10 h-10 rounded-lg bg-[#FF8500] text-white flex items-center justify-center mx-auto mb-2 print:hidden">
                <Building2 className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-black tracking-tight">RC ACADEMY</h2>
              <p className="text-xs text-neutral-500 font-mono mt-0.5">
                {selectedExam.title} (Version {selectedExam.paperVersion})
              </p>
              <div className="flex justify-center gap-6 text-xs text-neutral-700 mt-2 font-medium">
                <span>Subject: {selectedExam.subjectName}</span>
                <span>Time: {selectedExam.durationMinutes} Minutes</span>
                <span>Max Marks: {selectedExam.totalMarks}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="font-bold text-xs text-neutral-500 uppercase tracking-wider border-b border-neutral-100 pb-1">
                Section A — Curriculum Questions
              </div>
              {questions.length === 0 ? (
                <p className="text-xs text-neutral-500 italic py-4">
                  No questions currently linked to this examination blueprint.
                </p>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id} className="text-sm space-y-1">
                    <div className="flex justify-between font-medium text-black">
                      <span>
                        Q{idx + 1}. {q.content}
                      </span>
                      <span className="font-bold text-neutral-700 ml-4 shrink-0">[{q.maxMarks}M]</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100 print:hidden">
            <Button variant="outline" onClick={() => setShowPaperPreviewModal(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              Print Examination Paper
            </Button>
          </div>
        </Modal>
      )}

      {/* Audited Result Correction Modal */}
      {showCorrectionModal && selectedCandidate && (
        <Modal
          isOpen={showCorrectionModal}
          onClose={() => setShowCorrectionModal(false)}
          title="Audited Result Correction"
          description="Adjust marks with a mandatory reason logged in the immutable audit history."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs">
              <span className="font-semibold text-black">Student: </span>
              {selectedCandidate.studentName} ({selectedCandidate.studentCode})
            </div>

            <div>
              <label className="text-xs font-semibold text-black block mb-1">
                Corrected Marks (/{selectedExam?.totalMarks || 100}) *
              </label>
              <input
                type="number"
                min="0"
                max={selectedExam?.totalMarks || 100}
                required
                value={correctionMarks}
                onChange={(e) => setCorrectionMarks(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black font-bold focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-black block mb-1">Mandatory Audit Reason *</label>
              <textarea
                required
                rows={3}
                placeholder="Reason for audited correction (e.g. Recounting error, teacher re-evaluation approved)..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleApplyCorrection}
                disabled={submittingCorrection}
              >
                {submittingCorrection ? 'Recording...' : 'Record Audited Correction'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
