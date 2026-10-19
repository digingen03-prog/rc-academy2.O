'use client';

import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ExamItem {
  id: string;
  title: string;
  className: string;
  batchName: string;
  subjectName: string;
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
}

interface CandidateResult {
  studentId: string;
  studentName: string;
  studentCode: string;
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'EXEMPT';
  marks: number;
  percentage: number;
  grade: string;
  rank?: number;
  correctedMarks?: number;
  correctionReason?: string;
}

export default function ExaminationsPage() {
  const [activeTab, setActiveTab] = useState<'exams' | 'questions' | 'marks' | 'results'>('exams');

  const [exams, setExams] = useState<ExamItem[]>([
    {
      id: 'ex-1',
      title: 'Unit Test 1 - Physics Mechanics',
      className: 'Grade 10',
      batchName: 'Section A',
      subjectName: 'Physics',
      date: '2026-10-25',
      durationMinutes: 90,
      totalMarks: 50,
      passMarks: 17.5,
      status: 'PUBLISHED',
      isPublished: true,
      paperVersion: 2,
      questionsCount: 2,
    },
    {
      id: 'ex-2',
      title: 'Monthly Assessment - Chemical Bonding',
      className: 'Grade 11',
      batchName: 'Section B',
      subjectName: 'Chemistry',
      date: '2026-11-05',
      durationMinutes: 60,
      totalMarks: 25,
      passMarks: 9,
      status: 'SCHEDULED',
      isPublished: true,
      paperVersion: 1,
      questionsCount: 5,
    },
  ]);

  const [questions, setQuestions] = useState<QuestionItem[]>([
    {
      id: 'q-1',
      topic: 'Optics',
      subjectName: 'Physics',
      questionType: 'MCQ',
      difficulty: 'MEDIUM',
      content: 'What is the speed of light in a vacuum?',
      maxMarks: 20,
      status: 'APPROVED',
      answerKeyText: 'Option A (3 x 10^8 m/s)',
      explanation: 'Fundamental constant c in vacuum.',
    },
    {
      id: 'q-2',
      topic: 'Mechanics',
      subjectName: 'Physics',
      questionType: 'SHORT_ANSWER',
      difficulty: 'HARD',
      content: "State Newton's Second Law of Motion and derive F = ma.",
      maxMarks: 30,
      status: 'APPROVED',
      answerKeyText: 'Rate of change of momentum proportional to force applied.',
    },
    {
      id: 'q-3',
      topic: 'Thermodynamics',
      subjectName: 'Physics',
      questionType: 'MCQ',
      difficulty: 'MEDIUM',
      content: 'Which law of thermodynamics defines the concept of entropy?',
      maxMarks: 5,
      status: 'DRAFT',
      answerKeyText: 'Second Law of Thermodynamics',
    },
  ]);

  const [candidates, setCandidates] = useState<CandidateResult[]>([
    {
      studentId: 'st-1',
      studentName: 'Pranav Mukherjee',
      studentCode: 'RCA-2026-001',
      attendanceStatus: 'PRESENT',
      marks: 48,
      percentage: 96,
      grade: 'A+',
      rank: 1,
      correctedMarks: 48,
      correctionReason: 'Recounting error in Section B: +3 marks awarded',
    },
    {
      studentId: 'st-2',
      studentName: 'Ananya Iyer',
      studentCode: 'RCA-2026-002',
      attendanceStatus: 'PRESENT',
      marks: 42,
      percentage: 84,
      grade: 'A',
      rank: 2,
    },
    {
      studentId: 'st-3',
      studentName: 'Aravind Kumar',
      studentCode: 'RCA-2026-003',
      attendanceStatus: 'ABSENT',
      marks: 0,
      percentage: 0,
      grade: 'F',
    },
  ]);

  // Modal States
  const [showNewExamModal, setShowNewExamModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showPaperPreviewModal, setShowPaperPreviewModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(exams[0]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null);

  // Form States
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamSubject, setNewExamSubject] = useState('Physics');
  const [newExamDate, setNewExamDate] = useState('2026-11-20');
  const [newExamDuration, setNewExamDuration] = useState(90);
  const [newExamTotalMarks, setNewExamTotalMarks] = useState(50);
  const [newExamPassMarks, setNewExamPassMarks] = useState(17.5);

  const [aiTopic, setAiTopic] = useState('Electromagnetism & Induction');
  const [aiCount, setAiCount] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [generating, setGenerating] = useState(false);

  const [correctionMarks, setCorrectionMarks] = useState(48);
  const [correctionReason, setCorrectionReason] = useState('');

  // Handlers
  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    const newExam: ExamItem = {
      id: `ex-${Date.now()}`,
      title: newExamTitle,
      className: 'Grade 10',
      batchName: 'Section A',
      subjectName: newExamSubject,
      date: newExamDate,
      durationMinutes: newExamDuration,
      totalMarks: newExamTotalMarks,
      passMarks: newExamPassMarks,
      status: 'DRAFT',
      isPublished: false,
      paperVersion: 1,
      questionsCount: 0,
    };
    setExams([newExam, ...exams]);
    setShowNewExamModal(false);
    setNewExamTitle('');
  };

  const handleGenerateAi = (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      const newAiQuestions: QuestionItem[] = [
        {
          id: `q-ai-1-${Date.now()}`,
          topic: aiTopic,
          subjectName: 'Physics',
          questionType: 'MCQ',
          difficulty: aiDifficulty,
          content: `State Faraday's law regarding induced electromotive force in a closed loop.`,
          maxMarks: 5,
          status: 'DRAFT',
          answerKeyText: 'Induced EMF is proportional to negative rate of change of magnetic flux.',
          explanation: 'Synthesized via local on-premise Ollama qwen2.5:3b.',
        },
        {
          id: `q-ai-2-${Date.now()}`,
          topic: aiTopic,
          subjectName: 'Physics',
          questionType: 'SHORT_ANSWER',
          difficulty: aiDifficulty,
          content: `Derive the expression for magnetic field inside an ideal solenoid carrying current I.`,
          maxMarks: 10,
          status: 'DRAFT',
          answerKeyText: 'B = mu_0 * n * I',
        },
      ];
      setQuestions([...newAiQuestions, ...questions]);
      setShowAiModal(false);
    }, 1200);
  };

  const handleApplyCorrection = () => {
    if (!selectedCandidate) return;
    setCandidates((prev) =>
      prev.map((c) =>
        c.studentId === selectedCandidate.studentId
          ? {
              ...c,
              marks: correctionMarks,
              percentage: (correctionMarks / (selectedExam?.totalMarks || 50)) * 100,
              correctedMarks: correctionMarks,
              correctionReason,
              grade: correctionMarks >= 45 ? 'A+' : correctionMarks >= 40 ? 'A' : 'B',
            }
          : c,
      ),
    );
    setShowCorrectionModal(false);
  };

  return (
    <>
      <Header
        title="Examination & Paper Builder"
        subtitle="Curriculum blueprints, question bank, local AI synthesis, marks entry and finalized results"
      />

      <ResponsivePageContainer>
        {/* Metric Row (2x2 Grid on Mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">Scheduled Exams</span>
            <div className="text-2xl font-bold text-black mt-2">{exams.length}</div>
            <span className="text-xs text-neutral-500 mt-1 block">Active blueprints</span>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">Question Bank</span>
            <div className="text-2xl font-bold text-black mt-2">{questions.length}</div>
            <span className="text-xs text-neutral-500 mt-1 block">
              {questions.filter((q) => q.status === 'APPROVED').length} approved items
            </span>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">Class Average</span>
            <div className="text-2xl font-bold text-black mt-2">90.0%</div>
            <span className="text-xs text-[#CC6B00] mt-1 block font-medium">100% pass rate appeared</span>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl border border-neutral-200 shadow-card flex flex-col justify-between h-full">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">Local AI Engine</span>
            <div className="text-base font-bold text-black mt-2">Ollama (qwen2.5)</div>
            <span className="text-xs text-neutral-500 mt-1 block">100% On-Premise Privacy</span>
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

        {/* TAB 1: EXAMINATIONS */}
        {activeTab === 'exams' && (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
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
                        {ex.totalMarks} <span className="text-xs text-neutral-500 font-normal">/ {ex.passMarks}</span>
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
                          className="inline-flex items-center gap-1 px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-black rounded text-xs font-medium transition-colors"
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
          </div>
        )}

        {/* TAB 2: QUESTION BANK */}
        {activeTab === 'questions' && (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
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
          </div>
        )}

        {/* TAB 3: MARKS ENTRY */}
        {activeTab === 'marks' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-black text-base">{exams[0].title}</h4>
                <p className="text-xs text-neutral-500">
                  Class: Grade 10 • Section A | Total Marks: 50 | Pass Marks: 17.5
                </p>
              </div>
              <Button onClick={() => setActiveTab('results')} variant="primary" size="sm">
                Finalize & Publish Results
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-black">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Student Code</th>
                      <th className="px-6 py-3.5">Candidate Name</th>
                      <th className="px-6 py-3.5">Attendance</th>
                      <th className="px-6 py-3.5 text-right">Marks (/50)</th>
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
                        <td className="px-6 py-4 font-bold text-black text-right">{c.marks}</td>
                        <td className="px-6 py-4 font-medium text-neutral-800 text-right">{c.percentage}%</td>
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
            </div>
          </div>
        )}

        {/* TAB 4: RESULTS & AUDITED CORRECTIONS */}
        {activeTab === 'results' && (
          <div className="bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-black">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Rank</th>
                    <th className="px-6 py-3.5">Candidate</th>
                    <th className="px-6 py-3.5 text-right">Marks (/50)</th>
                    <th className="px-6 py-3.5 text-right">Percentage</th>
                    <th className="px-6 py-3.5 text-center">Grade</th>
                    <th className="px-6 py-3.5">Audited Correction Note</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {candidates.map((c) => (
                    <tr key={c.studentId} className="hover:bg-neutral-50/60">
                      <td className="px-6 py-4 font-bold text-black">{c.rank ? `#${c.rank}` : '-'}</td>
                      <td className="px-6 py-4 font-medium text-black">
                        {c.studentName} <span className="text-xs text-neutral-500 font-mono">({c.studentCode})</span>
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
                        <button
                          onClick={() => {
                            setSelectedCandidate(c);
                            setCorrectionMarks(c.marks);
                            setShowCorrectionModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 text-black rounded text-xs font-medium"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Correction
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              placeholder="e.g. Unit Test 2 - Thermodynamics"
              value={newExamTitle}
              onChange={(e) => setNewExamTitle(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-black block mb-1">Subject</label>
              <select
                value={newExamSubject}
                onChange={(e) => setNewExamSubject(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Biology">Biology</option>
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
                min="1"
                required
                value={newExamPassMarks}
                onChange={(e) => setNewExamPassMarks(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button variant="outline" onClick={() => setShowNewExamModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Blueprint
            </Button>
          </div>
        </form>
      </Modal>

      {/* AI Question Generator Modal */}
      <Modal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        title="Local AI Question Synthesis"
        description="Generates curriculum questions and answer rubrics locally using Ollama (qwen2.5:3b)."
        maxWidth="md"
      >
        <form onSubmit={handleGenerateAi} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-black block mb-1">Curriculum Topic *</label>
            <input
              type="text"
              required
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

          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
            <Button variant="outline" onClick={() => setShowAiModal(false)}>
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
                Section A — Core Examination Questions
              </div>
              {questions.map((q, idx) => (
                <div key={q.id} className="text-sm space-y-1">
                  <div className="flex justify-between font-medium text-black">
                    <span>Q{idx + 1}. {q.content}</span>
                    <span className="font-bold text-neutral-700 ml-4 shrink-0">[{q.maxMarks}M]</span>
                  </div>
                  {q.questionType === 'MCQ' && (
                    <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 pl-4 pt-1">
                      <div>A. Option 1</div>
                      <div>B. Option 2</div>
                      <div>C. Option 3</div>
                      <div>D. Option 4</div>
                    </div>
                  )}
                </div>
              ))}
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
              <label className="text-xs font-semibold text-black block mb-1">Corrected Marks (/50) *</label>
              <input
                type="number"
                min="0"
                max="50"
                required
                value={correctionMarks}
                onChange={(e) => setCorrectionMarks(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black font-bold focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-black block mb-1">Mandatory Reason *</label>
              <textarea
                required
                rows={3}
                placeholder="Reason for audited correction (e.g. Recounting, re-evaluation approved by Dean)..."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#FF8500]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100">
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleApplyCorrection}>
                Record Audited Correction
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
