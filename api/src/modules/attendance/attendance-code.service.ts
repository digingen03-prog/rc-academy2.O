import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

import * as crypto from 'crypto';

export enum AttendanceCodeEntityType {
  STUDENT = 'STUDENT',
  STAFF = 'STAFF',
}

export const MIN_ATTENDANCE_CODE = 100;
export const MAX_ATTENDANCE_CODE = 999;
export const TOTAL_CAPACITY = MAX_ATTENDANCE_CODE - MIN_ATTENDANCE_CODE + 1; // 900

@Injectable()
export class AttendanceCodeService {
  private readonly logger = new Logger(AttendanceCodeService.name);
  private static readonly ADVISORY_LOCK_KEY = 748392;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check total capacity and return current allocation metrics
   */
  async getCapacityStatus() {
    const totalAllocated = await this.prisma.attendanceCode.count();
    const studentsAllocated = await this.prisma.attendanceCode.count({
      where: { entityType: AttendanceCodeEntityType.STUDENT },
    });
    const staffAllocated = await this.prisma.attendanceCode.count({
      where: { entityType: AttendanceCodeEntityType.STAFF },
    });

    return {
      totalCapacity: TOTAL_CAPACITY,
      totalAllocated,
      available: Math.max(0, TOTAL_CAPACITY - totalAllocated),
      percentUsed: Math.round((totalAllocated / TOTAL_CAPACITY) * 100),
      studentsAllocated,
      staffAllocated,
      isExhausted: totalAllocated >= TOTAL_CAPACITY,
    };
  }

  /**
   * Allocate a unique 3-digit attendance code for a student or staff.
   * Uses cryptographically secure random generation and PostgreSQL transaction-level
   * advisory locking to prevent concurrency collisions, with SAVEPOINT bounded retry.
   */
  async allocateCode(
    tx: Prisma.TransactionClient,
    entityType: AttendanceCodeEntityType,
    entityId: string,
  ): Promise<string> {
    // 1. Check existing allocation for entity - preserve existing code and historical attendance
    if (entityType === AttendanceCodeEntityType.STUDENT) {
      const existingStudentCode = await tx.attendanceCode.findUnique({
        where: { studentId: entityId },
      });
      if (existingStudentCode) {
        return existingStudentCode.code;
      }
    } else {
      const existingStaffCode = await tx.attendanceCode.findUnique({
        where: { userId: entityId },
      });
      if (existingStaffCode) {
        return existingStaffCode.code;
      }
    }

    // 2. Acquire transaction-level advisory lock to serialize code generation across concurrent admissions
    try {
      await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(${AttendanceCodeService.ADVISORY_LOCK_KEY})`,
      );
    } catch (e: any) {
      this.logger.debug(`Advisory lock not applicable or unsupported: ${e.message}`);
    }

    const maxRetries = 10;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // 3. Fetch all currently used codes from database
      const existingCodes = await tx.attendanceCode.findMany({
        select: { code: true },
      });

      if (existingCodes.length >= TOTAL_CAPACITY) {
        throw new BadRequestException(
          `Attendance code capacity reached: all ${TOTAL_CAPACITY} unique 3-digit codes in range 100-999 are allocated. A longer code format or inactive record archival is required.`,
        );
      }

      const usedSet = new Set(existingCodes.map((c) => parseInt(c.code, 10)));
      const availableNumbers: number[] = [];

      for (let n = MIN_ATTENDANCE_CODE; n <= MAX_ATTENDANCE_CODE; n++) {
        if (!usedSet.has(n)) {
          availableNumbers.push(n);
        }
      }

      if (availableNumbers.length === 0) {
        throw new BadRequestException(
          `Attendance code capacity reached: no available 3-digit codes remaining in range 100-999.`,
        );
      }

      // 4. Uniform cryptographically secure random selection from remaining available pool
      const randomIndex = crypto.randomInt(0, availableNumbers.length);
      const chosenNumber = availableNumbers[randomIndex];
      const codeString = chosenNumber.toString().padStart(3, '0');

      // Use SAVEPOINT to protect PostgreSQL transaction from aborting on unique collision
      const savepointName = `alloc_${Date.now()}_${attempt}`;
      let savepointCreated = false;

      try {
        await tx.$executeRawUnsafe(`SAVEPOINT ${savepointName}`);
        savepointCreated = true;
      } catch {
        savepointCreated = false;
      }

      try {
        await tx.attendanceCode.create({
          data: {
            code: codeString,
            entityType,
            studentId: entityType === AttendanceCodeEntityType.STUDENT ? entityId : undefined,
            userId: entityType === AttendanceCodeEntityType.STAFF ? entityId : undefined,
          },
        });

        // Update target entity with attendance code
        if (entityType === AttendanceCodeEntityType.STUDENT) {
          await tx.student.update({
            where: { id: entityId },
            data: { attendanceCode: codeString },
          });
        } else {
          await tx.user.update({
            where: { id: entityId },
            data: { attendanceCode: codeString },
          });
        }

        if (savepointCreated) {
          try {
            await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepointName}`);
          } catch {
            // ignore release error
          }
        }

        return codeString;
      } catch (err: any) {
        if (savepointCreated) {
          try {
            await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          } catch {
            // ignore rollback error
          }
        }

        if (err.code === 'P2002') {
          // Unique constraint collision under concurrency -> retry with newly read pool
          this.logger.warn(
            `Collision detected for attendance code ${codeString}, retrying attempt ${attempt + 1}/${maxRetries}`,
          );
          continue;
        }
        throw err;
      }
    }

    throw new ConflictException(
      'Failed to allocate unique attendance code after multiple concurrency attempts. Please retry.',
    );
  }

  /**
   * Pre-reserve multiple unique codes for batch import
   */
  async precheckCapacityForBulk(requiredCount: number): Promise<void> {
    const totalAllocated = await this.prisma.attendanceCode.count();
    const remaining = TOTAL_CAPACITY - totalAllocated;
    if (requiredCount > remaining) {
      throw new BadRequestException(
        `Insufficient attendance code capacity for bulk import. Requested: ${requiredCount}, Available: ${remaining} of ${TOTAL_CAPACITY}.`,
      );
    }
  }

  /**
   * Find entity by attendance code
   */
  async resolveCode(code: string) {
    const trimmed = code.trim();
    return this.prisma.attendanceCode.findUnique({
      where: { code: trimmed },
      include: {
        student: {
          include: {
            batchEnrollments: {
              where: { isActive: true },
              include: {
                batch: {
                  include: { class: true },
                },
              },
            },
          },
        },
        user: {
          include: {
            userRoles: {
              include: { role: true },
            },
            staffAssignments: {
              where: { isActive: true },
              include: {
                class: true,
                batch: true,
              },
            },
          },
        },
      },
    });
  }
}
