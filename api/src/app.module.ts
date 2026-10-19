import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { CoursesModule } from './modules/courses/courses.module';
import { StaffModule } from './modules/staff/staff.module';
import { FeesModule } from './modules/fees/fees.module';
import { ExaminationsModule } from './modules/examinations/examinations.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SalaryModule } from './modules/salary/salary.module';
import { ScheduleModule } from './modules/schedule/schedule.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CoursesModule,
    StaffModule,
    StudentsModule,
    AttendanceModule,
    FeesModule,
    SalaryModule,
    ExaminationsModule,
    EvaluationsModule,
    DashboardModule,
    ScheduleModule,
  ],
})
export class AppModule {}
