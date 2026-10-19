import { StudentStatusEnum } from './enums.js';

export interface GuardianDto {
  id?: string;
  fullName: string;
  phone: string;
  email?: string;
  relationship: string;
  isPrimary?: boolean;
}

export interface CreateStudentDto {
  studentCode: string;
  admissionNumber: string;
  firstName: string;
  lastName?: string;
  schoolName?: string;
  dateOfJoining?: string;
  academicBoard?: string;
  referralSource?: string;
  alternativePhone?: string;
  dob: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  email?: string;
  phone?: string;
  address?: string;
  batchId: string;
  guardians: GuardianDto[];
}

export interface UpdateStudentDto extends Partial<CreateStudentDto> {
  status?: StudentStatusEnum;
}

export interface StudentDto {
  id: string;
  studentCode: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  schoolName?: string | null;
  dateOfJoining?: string | null;
  academicBoard?: string | null;
  referralSource?: string | null;
  alternativePhone?: string | null;
  dob: string;
  gender: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: StudentStatusEnum;
  currentBatch?: {
    id: string;
    name: string;
    class: {
      id: string;
      name: string;
    };
  };
  guardians: GuardianDto[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentQueryFilters {
  search?: string;
  batchId?: string;
  classId?: string;
  status?: StudentStatusEnum;
  page?: number;
  limit?: number;
}
