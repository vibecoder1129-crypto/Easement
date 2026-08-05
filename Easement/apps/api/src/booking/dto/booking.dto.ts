import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class GetSlotsDto {
  @IsString()
  @MinLength(1)
  businessId!: string;

  @IsString()
  @MinLength(1)
  serviceId!: string;

  @IsString()
  @MinLength(10)
  date!: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;
}

export class CreateBookingDto {
  @IsString()
  @MinLength(1)
  businessId!: string;

  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsString()
  @MinLength(1)
  serviceId!: string;

  @IsString()
  @MinLength(1)
  staffId!: string;

  @IsString()
  @MinLength(10)
  startDatetime!: string; // ISO String

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteBookingDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercentage?: number;
}

export class CreateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateOwnerBookingDto {
  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsString()
  @MinLength(1)
  serviceId!: string;

  @IsString()
  @MinLength(1)
  staffId!: string;

  @IsString()
  @MinLength(10)
  startDatetime!: string;

  @IsString()
  @MinLength(1)
  guestName!: string;

  @IsOptional()
  @IsString()
  guestEmail?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOwnerBookingDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  startDatetime?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  staffId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  serviceId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  guestName?: string;

  @IsOptional()
  @IsString()
  guestEmail?: string;

  @IsOptional()
  @IsString()
  guestPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RescheduleBookingDto {
  @IsString()
  @MinLength(10)
  startDatetime!: string;

  @IsOptional()
  @IsString()
  staffId?: string;
}
