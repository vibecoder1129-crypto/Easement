import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  LoginDto,
  SignupDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { SessionAuthGuard } from './session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    const result = await this.authService.signup(dto);
    const me = await this.authService.getMe(result.userId);
    req.session.user = me;
    return result;
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateLogin(dto);
    req.session.user = user;
    return { userId: user.userId, role: user.role };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request) {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return { success: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@Req() req: Request) {
    return this.authService.getMe(req.session.user!.userId);
  }

  @Patch('preferences')
  @UseGuards(SessionAuthGuard)
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @Req() req: Request,
  ) {
    const me = await this.authService.updatePreferences(
      req.session.user!.userId,
      dto,
    );
    req.session.user = {
      ...req.session.user!,
      ...me,
    };
    return me;
  }

  @Patch('profile')
  @UseGuards(SessionAuthGuard)
  async updateProfile(@Body() dto: UpdateProfileDto, @Req() req: Request) {
    const me = await this.authService.updateProfile(
      req.session.user!.userId,
      dto,
    );
    req.session.user = {
      userId: me.userId,
      role: me.role,
      name: me.name,
      email: me.email,
    };
    return me;
  }

  @Patch('password')
  @UseGuards(SessionAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    return this.authService.changePassword(req.session.user!.userId, dto);
  }

  @Delete('account')
  @UseGuards(SessionAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async deleteAccount(@Body() dto: DeleteAccountDto, @Req() req: Request) {
    const userId = req.session.user!.userId;
    const result = await this.authService.deleteAccount(userId, dto.password);
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return result;
  }
}
