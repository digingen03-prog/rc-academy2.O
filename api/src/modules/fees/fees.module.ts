import { Module } from '@nestjs/common';
import { FeesService } from './fees.service';
import { FeesController } from './fees.controller';
import { FeesProofService } from './fees-proof.service';
import { SalaryModule } from '../salary/salary.module';
import { S3StorageService } from '../../common/services/s3-storage.service';

@Module({
  imports: [SalaryModule],
  controllers: [FeesController],
  providers: [FeesService, FeesProofService, S3StorageService],
  exports: [FeesService, FeesProofService, S3StorageService],
})
export class FeesModule {}
