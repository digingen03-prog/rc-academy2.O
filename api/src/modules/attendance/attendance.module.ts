import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceCodeService } from './attendance-code.service';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceCodeService],
  exports: [AttendanceService, AttendanceCodeService],
})
export class AttendanceModule {}
