import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsIn, IsUrl, MaxLength } from 'class-validator';

export class CreateResourceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsUrl({ require_tld: false }) @IsNotEmpty() url!: string;
  @IsString() @IsOptional() @MaxLength(50) group?: string;
  @IsString() @IsOptional() @IsIn(['link', 'auto', 'semi-auto']) loginMode?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
  @IsInt() @IsOptional() sortOrder?: number;
  @IsBoolean() @IsOptional() healthCheckEnabled?: boolean;

  // credential (optional, encrypted before storage)
  @IsString() @IsOptional() @MaxLength(200) credUsername?: string;
  @IsString() @IsOptional() @MaxLength(500) credPassword?: string;
  @IsString() @IsOptional() @MaxLength(2000) credExtra?: string;
}

export class UpdateResourceDto {
  @IsString() @IsOptional() @MaxLength(100) name?: string;
  @IsUrl({ require_tld: false }) @IsOptional() url?: string;
  @IsString() @IsOptional() @MaxLength(50) group?: string;
  @IsString() @IsOptional() @IsIn(['link', 'auto', 'semi-auto']) loginMode?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
  @IsInt() @IsOptional() sortOrder?: number;
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsBoolean() @IsOptional() healthCheckEnabled?: boolean;

  @IsString() @IsOptional() @MaxLength(200) credUsername?: string;
  @IsString() @IsOptional() @MaxLength(500) credPassword?: string;
  @IsString() @IsOptional() @MaxLength(2000) credExtra?: string;
}
