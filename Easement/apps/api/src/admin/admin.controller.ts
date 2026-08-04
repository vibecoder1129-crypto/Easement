import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { AdminService } from './admin.service';
import {
  ListAdminBusinessesDto,
  UpdateBusinessStatusDto,
} from './dto/admin.dto';

@Controller('admin')
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('businesses')
  list(@Query() query: ListAdminBusinessesDto) {
    return this.admin.listBusinesses(query.status ?? 'pending');
  }

  @Patch('businesses/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBusinessStatusDto,
  ) {
    return this.admin.updateStatus(id, dto.status);
  }
}
