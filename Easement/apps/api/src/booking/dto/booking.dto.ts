import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
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
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class RescheduleBookingDto {
  @IsString()
  @MinLength(10)
  startDatetime!: string;

  @IsOptional()
  @IsString()
  staffId?: string;
}
