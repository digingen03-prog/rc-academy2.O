import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase().trim() },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      // Prevent timing attacks by executing a dummy bcrypt compare
      await bcrypt.compare(loginDto.password, '$2b$10$e7Z1w7N8y6a4a1s8b2n9qub1o8v0v2y7s5l4g8k2h9d7s6j5k4l3m');
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId: null,
            action: 'AUTH_LOGIN_FAILED',
            entityType: 'User',
            entityId: null,
            details: { email: loginDto.email, reason: 'USER_NOT_FOUND' },
            ipAddress,
          },
        });
      } catch (_) {}
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'AUTH_LOGIN_FAILED',
            entityType: 'User',
            entityId: user.id,
            details: { email: user.email, reason: 'ACCOUNT_INACTIVE' },
            ipAddress,
          },
        });
      } catch (_) {}
      throw new UnauthorizedException('Account is not active. Please contact administration.');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      try {
        await this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: 'AUTH_LOGIN_FAILED',
            entityType: 'User',
            entityId: user.id,
            details: { email: user.email, reason: 'INVALID_PASSWORD' },
            ipAddress,
          },
        });
      } catch (_) {}
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    );

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload);

    // Record audit event for login
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: 'AUTH_LOGIN_SUCCESS',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not record audit log: ${(err as Error).message}`);
    }

    return {
      accessToken,
      expiresIn: 86400,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        roles,
        permissions,
      },
    };
  }
}
