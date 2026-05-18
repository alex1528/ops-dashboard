import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsIn, IsUrl, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResourceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsUrl({ require_tld: false }) @IsNotEmpty() url!: string;
  @IsString() @IsOptional() @MaxLength(50) group?: string;
  @IsString() @IsOptional() @IsIn(['link', 'auto', 'semi-auto']) loginMode?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
  @IsInt() @IsOptional() sortOrder?: number;
  @IsInt() @IsOptional() groupSortOrder?: number;
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
  @IsInt() @IsOptional() groupSortOrder?: number;
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsBoolean() @IsOptional() healthCheckEnabled?: boolean;

  @IsString() @IsOptional() @MaxLength(200) credUsername?: string;
  @IsString() @IsOptional() @MaxLength(500) credPassword?: string;
  @IsString() @IsOptional() @MaxLength(2000) credExtra?: string;
}

// --- Reorder DTOs ---

export class ReorderGroupItem {
  @IsString() @IsNotEmpty() group!: string;
  @IsInt() sortOrder!: number;
}

export class ReorderGroupsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderGroupItem)
  groups!: ReorderGroupItem[];
}

export class ReorderResourceItem {
  @IsString() @IsNotEmpty() id!: string;
  @IsInt() sortOrder!: number;
}

export class ReorderResourcesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderResourceItem)
  items!: ReorderResourceItem[];
}

export class ClearCredentialFieldsDto {
  @IsString() @IsIn(['username', 'password', 'extra', 'all']) field!: string;
}
