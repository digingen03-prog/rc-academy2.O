import { UserRoleEnum, UserStatusEnum } from './enums.js';

export interface JWTPayload {
  sub: string;
  email: string;
  roles: UserRoleEnum[];
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatusEnum;
  roles: UserRoleEnum[];
  permissions: string[];
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: AuthUserResponse;
}

export interface RefreshTokenDto {
  refreshToken: string;
}
