import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListAdminBusinessesDto {
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'approved', 'rejected', 'all'])
  status?: 'pending' | 'approved' | 'rejected' | 'all';
}

export class UpdateBusinessStatusDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';
}
