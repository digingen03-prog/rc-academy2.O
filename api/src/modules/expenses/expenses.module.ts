import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { DatabaseModule } from '../../database/database.module';
import { S3StorageService } from '../../common/services/s3-storage.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, S3StorageService],
  exports: [ExpensesService],
})
export class ExpensesModule {}

