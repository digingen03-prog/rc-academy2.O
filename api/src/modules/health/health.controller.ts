import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    let dbStatus = 'healthy';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'unreachable';
    }

    return {
      status: 'ok',
      service: 'api',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        uptime: process.uptime(),
      },
    };
  }
}
