import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CronOrAdminGuard } from './cron-or-admin.guard';
import { RolesGuard } from './roles.guard';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, RolesGuard, CronOrAdminGuard],
  exports: [AuthService, SessionAuthGuard, RolesGuard, CronOrAdminGuard],
})
export class AuthModule {}
