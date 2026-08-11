import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { BusinessService } from './business.service';
import {
  AssignStaffToServiceDto,
  CreateAvailabilityDto,
  CreateBusinessDto,
  CreateLocationDto,
  CreateServiceDto,
  CreateStaffDto,
  CreateTimeOffDto,
} from './dto/business.dto';

@Controller()
@UseGuards(SessionAuthGuard, RolesGuard)
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post('businesses')
  @Roles(UserRole.business_owner, UserRole.admin)
  create(@Body() dto: CreateBusinessDto, @Req() req: Request) {
    return this.businessService.createBusiness(req.session.user!.userId, dto);
  }

  @Get('businesses/my')
  @Roles(UserRole.business_owner, UserRole.admin)
  getMyBusinesses(@Req() req: Request) {
    return this.businessService.getMyBusinesses(req.session.user!.userId);
  }

  @Get('businesses/:id')
  @Roles(UserRole.business_owner, UserRole.admin, UserRole.consumer, UserRole.staff)
  getOne(@Param('id') id: string, @Req() req: Request) {
    return this.businessService.getBusiness(
      id,
      req.session.user!.userId,
      req.session.user!.role,
    );
  }

  @Post('businesses/:id/locations')
  @Roles(UserRole.business_owner, UserRole.admin)
  createLocation(
    @Param('id') id: string,
    @Body() dto: CreateLocationDto,
    @Req() req: Request,
  ) {
    return this.businessService.createLocation(
      id,
      req.session.user!.userId,
      dto,
    );
  }

  @Get('businesses/:id/locations')
  @Roles(UserRole.business_owner, UserRole.admin, UserRole.consumer, UserRole.staff)
  listLocations(@Param('id') id: string, @Req() req: Request) {
    return this.businessService.listLocations(id, req.session.user!.userId);
  }

  @Post('businesses/:id/staff')
  @Roles(UserRole.business_owner, UserRole.admin)
  createStaff(
    @Param('id') id: string,
    @Body() dto: CreateStaffDto,
    @Req() req: Request,
  ) {
    return this.businessService.createStaff(id, req.session.user!.userId, dto);
  }

  @Get('businesses/:id/staff')
  @Roles(UserRole.business_owner, UserRole.admin, UserRole.consumer, UserRole.staff)
  listStaff(@Param('id') id: string, @Req() req: Request) {
    return this.businessService.listStaff(id, req.session.user!.userId);
  }

  // SERVICES
  @Post('businesses/:id/services')
  @Roles(UserRole.business_owner, UserRole.admin)
  createService(
    @Param('id') id: string,
    @Body() dto: CreateServiceDto,
    @Req() req: Request,
  ) {
    return this.businessService.createService(id, req.session.user!.userId, dto);
  }

  @Get('businesses/:id/services')
  @Roles(UserRole.business_owner, UserRole.admin, UserRole.consumer, UserRole.staff)
  listServices(@Param('id') id: string) {
    return this.businessService.listServices(id);
  }

  @Post('businesses/:id/services/:serviceId/staff')
  @Roles(UserRole.business_owner, UserRole.admin)
  assignStaffToService(
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
    @Body() dto: AssignStaffToServiceDto,
    @Req() req: Request,
  ) {
    return this.businessService.assignStaffToService(
      id,
      serviceId,
      req.session.user!.userId,
      dto,
    );
  }

  // AVAILABILITY & TIME-OFF
  @Post('staff/:id/availability')
  @Roles(UserRole.business_owner, UserRole.staff, UserRole.admin)
  setStaffAvailability(
    @Param('id') staffId: string,
    @Body() dto: CreateAvailabilityDto,
    @Req() req: Request,
  ) {
    return this.businessService.setStaffAvailability(
      staffId,
      req.session.user!.userId,
      dto,
    );
  }

  @Get('staff/:id/availability')
  @Roles(UserRole.business_owner, UserRole.staff, UserRole.admin)
  getStaffAvailability(@Param('id') staffId: string, @Req() req: Request) {
    return this.businessService.listStaffAvailability(
      staffId,
      req.session.user!.userId,
      req.session.user!.role,
    );
  }

  @Delete('staff/:id/availability/:dayOfWeek')
  @Roles(UserRole.business_owner, UserRole.staff, UserRole.admin)
  clearStaffDay(
    @Param('id') staffId: string,
    @Param('dayOfWeek') dayOfWeek: string,
    @Req() req: Request,
  ) {
    return this.businessService.clearStaffDay(
      staffId,
      req.session.user!.userId,
      Number(dayOfWeek),
    );
  }

  @Post('staff/:id/time-off')
  @Roles(UserRole.business_owner, UserRole.staff, UserRole.admin)
  addStaffTimeOff(
    @Param('id') staffId: string,
    @Body() dto: CreateTimeOffDto,
    @Req() req: Request,
  ) {
    return this.businessService.addStaffTimeOff(
      staffId,
      req.session.user!.userId,
      dto,
    );
  }

  @Get('staff/:id/time-off')
  @Roles(UserRole.business_owner, UserRole.staff, UserRole.admin)
  getStaffTimeOff(@Param('id') staffId: string, @Req() req: Request) {
    return this.businessService.listStaffTimeOff(
      staffId,
      req.session.user!.userId,
      req.session.user!.role,
    );
  }
}
