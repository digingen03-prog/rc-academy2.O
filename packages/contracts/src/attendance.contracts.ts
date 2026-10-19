import { AttendanceStatusEnum, SessionTypeEnum } from './enums.js';

export interface CreateAttendanceSessionDto {
  batchId: string;
  date: string; // YYYY-MM-DD
  sessionType: SessionTypeEnum;
}

export interface QuickMarkAttendanceDto {
  studentCode: string;
  sessionId?: string; // Optional if auto-resolved by date & batch
  status?: AttendanceStatusEnum;
}

export interface AttendanceRecordDto {
  id: string;
  sessionId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  status: AttendanceStatusEnum;
  recordedAt: string;
  recordedByName?: string;
}

export interface AttendanceSummaryDto {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendanceRate: number;
}
