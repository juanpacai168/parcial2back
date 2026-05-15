import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { UserBasicDto } from '../users/dto/user-basic.dto';
import { UserDetailDto } from '../users/dto/user-detail.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserBasicDto;
}

export interface AccessTokenResponse {
  accessToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

type TokenSubject = Pick<User, 'id' | 'email' | 'role'>;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepo: Repository<RefreshToken>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const user = await this.usersService.create({ ...dto, role: UserRole.MEMBER }, UserRole.MEMBER);
    return this.buildAuthResponseFromDetail(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(dto.email, dto.password);
    return this.buildAuthResponse(user);
  }

  async me(userId: string): Promise<UserDetailDto> {
    return this.usersService.findDetailById(userId);
  }

  async refresh(dto: RefreshTokenDto): Promise<AccessTokenResponse> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const storedToken = await this.refreshTokensRepo.findOne({
      where: { token: dto.refreshToken },
    });

    if (
      !storedToken ||
      storedToken.userId !== payload.sub ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date()
    ) {
      throw new ForbiddenException('Refresh token invalido o expirado');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }

    return { accessToken: await this.signAccessToken(user) };
  }

  async logout(dto: RefreshTokenDto, userId: string): Promise<void> {
    const storedToken = await this.refreshTokensRepo.findOne({
      where: { token: dto.refreshToken },
    });
    if (!storedToken || storedToken.userId !== userId || storedToken.revokedAt) {
      throw new ForbiddenException('Refresh token invalido');
    }

    storedToken.revokedAt = new Date();
    await this.refreshTokensRepo.save(storedToken);
  }

  private async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    return user;
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.issueTokens(user);
    return { accessToken, refreshToken, user: this.usersService.toBasic(user) };
  }

  private async buildAuthResponseFromDetail(user: UserDetailDto): Promise<AuthResponse> {
    const { accessToken, refreshToken } = await this.issueTokens(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  private signAccessToken(user: TokenSubject): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
      },
    );
  }

  private async issueTokens(user: TokenSubject): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.signRefreshToken(user),
    ]);

    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '7d');
    await this.refreshTokensRepo.save(
      this.refreshTokensRepo.create({
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + this.expiresInToMs(refreshExpiresIn)),
        revokedAt: null,
      }),
    );

    return { accessToken, refreshToken };
  }

  private signRefreshToken(user: TokenSubject): Promise<string> {
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role, jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
      },
    );
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new ForbiddenException('Refresh token invalido o expirado');
    }
  }

  private expiresInToMs(value: string): number {
    const trimmed = value.trim();
    const numericSeconds = Number(trimmed);
    if (Number.isFinite(numericSeconds)) {
      return numericSeconds * 1000;
    }

    const match = /^(\d+)([smhd])$/.exec(trimmed);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * multipliers[unit];
  }
}
