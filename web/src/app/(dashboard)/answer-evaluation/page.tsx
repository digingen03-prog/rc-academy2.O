'use client';

import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EvaluationItem {
  questionId: string;
  questionText: string;
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
  studentName: string;
  studentCode: string;
  examTitle: string;
  examTotalMarks: number;
  uploadedAt: string;
  fileName: string;
  status: 'UPLOADED' | 'AI_EVALUATED' | 'TEACHER_REVIEWED' | 'APPROVED' | 'REJECTED';
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

  // Submissions data
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([
    {
      id: 'sub-101',
      studentName: 'Aravind Kumar',
      studentCode: 'RCA-2026-001',
      examTitle: 'Unit Test 1 - Physics Mechanics',
      examTotalMarks: 50,
      uploadedAt: '2026-10-25 14:30',
      fileName: 'aravind_physics_paper.pdf',
      status: 'AI_EVALUATED',
      items: [
        {
          questionId: 'q-1',
          questionText: 'What is the speed of light in a vacuum?',
          maxMarks: 20,
          extractedAnswer: 'Option A (3 x 10^8 m/s)',
          aiSuggestedMarks: 20,
          teacherFinalMarks: 20,
          confidence: 1.0,
          explanation: 'Deterministic match with official answer key.',
          isOverridden: false,
          teacherNotes: '',
          criterionScores: [
            { criterion: 'Option Selection', allocatedMarks: 20, obtainedMarks: 20, feedback: 'Correct Option A' },
          ],
          approved: false,
        },
        {
          questionId: 'q-2',
          questionText: "State Newton's Second Law of Motion and derive F = ma.",
          maxMarks: 30,
          extractedAnswer: 'Rate of change of momentum is proportional to force applied. dp/dt = d(mv)/dt = m(dv/dt) = ma.',
          aiSuggestedMarks: 27,
          teacherFinalMarks: 28,
          confidence: 0.92,
          explanation: 'Covers core statement, momentum relation, and algebraic derivation correctly.',
          isOverridden: true,
          teacherNotes: 'Clear mathematical derivation step-by-step.',
          criterionScores: [
            { criterion: 'Statement of Law', allocatedMarks: 10, obtainedMarks: 10, feedback: 'Accurate definition' },
            { criterion: 'Derivation Steps', allocatedMarks: 20, obtainedMarks: 18, feedback: 'Well structured' },
          ],
          approved: false,
        },
      ],
    },
    {
      id: 'sub-102',
      studentName: 'Pranav Mukherjee',
      studentCode: 'RCA-2026-002',
      examTitle: 'Unit Test 1 - Physics Mechanics',
      examTotalMarks: 50,
      uploadedAt: '2026-10-25 14:45',
      fileName: 'pranav_physics_scan.pdf',
      status: 'APPROVED',
      approvedMarks: 48,
      items: [],
    },
  ]);

  const [activeSubmission, setActiveSubmission] = useState<SubmissionItem>(submissions[0]);

  // Upload Form States
  const [uploadExam, setUploadExam] = useState('Unit Test 1 - Physics Mechanics');
  const [uploadStudent, setUploadStudent] = useState('RCA-2026-001');

  // Calculations for current active submission
  const totalSuggested = activeSubmission.items.reduce((acc, i) => acc + i.aiSuggestedMarks, 0);
  const totalFinal = activeSubmission.items.reduce((acc, i) => acc + i.teacherFinalMarks, 0);
  const allApproved = activeSubmission.items.length > 0 && activeSubmission.items.every((i) => i.approved);

  const handleApproveItem = (qId: string) => {
    setActiveSubmission((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.questionId === qId ? { ...it, approved: true } : it)),
    }));
  };

  const handleFinalMarkChange = (qId: string, val: number) => {
    setActiveSubmission((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.questionId === qId
          ? { ...it, teacherFinalMarks: val, isOverridden: val !== it.aiSuggestedMarks }
          : it,
      ),
    }));
  };

  const handleFinalSignOff = () => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === activeSubmission.id
          ? { ...s, status: 'APPROVED', approvedMarks: totalFinal }
          : s,
      ),
    );
    setViewMode('queue');
  };

  const handleRejectSubmission = () => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === activeSubmission.id
          ? { ...s, status: 'REJECTED', rejectionReason: rejectReason || 'Poor scan quality' }
          : s,
      ),
    );
    setShowRejectModal(false);
    setViewMode('queue');
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (
      searchQuery &&
      !s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !s.studentCode.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <>
      <Header
        title="AI-Assisted Answer Evaluation"
        subtitle="Review OCR extracted papers against marking rubrics, adjust scores and authorize transfers into official records"
      />

      <ResponsivePageContainer>
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
                {['ALL', 'AI_EVALUATED', 'APPROVED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      statusFilter === st
                        ? 'bg-neutral-900 text-white shadow-subtle'
                        : 'text-neutral-600 hover:text-black hover:bg-neutral-100'
                    }`}
                  >
                    {st.replace('_', ' ')}
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
                          <Badge variant={sub.status === 'APPROVED' ? 'primary' : 'neutral'} size="sm">
                            {sub.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {sub.status !== 'APPROVED' ? (
                            <Button
                              onClick={() => {
                                setActiveSubmission(sub);
                                setViewMode('review');
                              }}
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
            </div>
          </div>
        )}

        {/* VIEW 2: TEACHER REVIEW WORKSPACE */}
        {viewMode === 'review' && (
          <div className="space-y-6">
            {/* Top Bar with Sign-Off Action */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <Button onClick={() => setViewMode('queue')} variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4" />
                Back to Evaluation Queue
              </Button>

              <div className="flex items-center gap-3">
                <Button onClick={() => setShowRejectModal(true)} variant="outline" size="sm">
                  <XCircle className="w-4 h-4" />
                  Reject Scan
                </Button>
                <Button
                  disabled={!allApproved}
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
                        Question {idx + 1} ({item.maxMarks} Marks)
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
          </div>
        )}
      </ResponsivePageContainer>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Answer Sheet"
        description="Attach PDF or high-resolution scan to run local on-premise OCR and rubric evaluation."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-black block mb-1">Target Examination</label>
            <select
              value={uploadExam}
              onChange={(e) => setUploadExam(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            >
              <option value="Unit Test 1 - Physics Mechanics">Unit Test 1 - Physics Mechanics</option>
              <option value="Monthly Assessment - Chemical Bonding">Monthly Assessment - Chemical Bonding</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-black block mb-1">Student Candidate</label>
            <select
              value={uploadStudent}
              onChange={(e) => setUploadStudent(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            >
              <option value="RCA-2026-001">Aravind Kumar (RCA-2026-001)</option>
              <option value="RCA-2026-002">Pranav Mukherjee (RCA-2026-002)</option>
            </select>
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
            <Button variant="primary" onClick={() => setShowUploadModal(false)}>
              Queue Local OCR
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
              <Button variant="danger" onClick={handleRejectSubmission}>
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
