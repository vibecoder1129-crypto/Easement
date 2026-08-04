import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  category!: string;
}

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  address!: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsString()
  @MinLength(1)
  timezone!: string;
}

export class CreateStaffDto {
  @IsString()
  @MinLength(1)
  locationId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  /** Create a new employee login (preferred for dashboard "Add employee") */
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsString()
  @MinLength(1)
  category!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  staffIds?: string[];
}

export class CreateAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @MinLength(4)
  startTime!: string;

  @IsString()
  @MinLength(4)
  endTime!: string;
}

export class CreateTimeOffDto {
  @IsString()
  @MinLength(10)
  startDatetime!: string;

  @IsString()
  @MinLength(10)
  endDatetime!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignStaffToServiceDto {
  @IsArray()
  @IsString({ each: true })
  staffIds!: string[];
}
