import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsIn, IsUrl, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResourceDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsUrl({ require_tld: false }) @IsNotEmpty() url!: string;
  @IsString() @IsOptional() @MaxLength(50) group?: string;
  @IsString() @IsOptional() @MaxLength(50) subGroup?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
  @IsInt() @IsOptional() sortOrder?: number;
  @IsInt() @IsOptional() groupSortOrder?: number;
  @IsBoolean() @IsOptional() healthCheckEnabled?: boolean;

  // Web system credential (encrypted before storage)
  @IsBoolean() @IsOptional() credWebEnabled?: boolean; // master switch for web credentials
  @IsString() @IsOptional() @MaxLength(200) credUsername?: string;
  @IsString() @IsOptional() @MaxLength(500) credPassword?: string;
  @IsString() @IsOptional() @MaxLength(2000) credExtra?: string;
  // Linux SSH credential
  @IsBoolean() @IsOptional() credSshEnabled?: boolean; // enable Web Terminal (SSH)
  @IsString() @IsOptional() credPrivateKey?: string; // PEM private key, no length limit
}

export class UpdateResourceDto {
  @IsString() @IsOptional() @MaxLength(100) name?: string;
  @IsUrl({ require_tld: false }) @IsOptional() url?: string;
  @IsString() @IsOptional() @MaxLength(50) group?: string;
  @IsString() @IsOptional() @MaxLength(50) subGroup?: string;
  @IsString() @IsOptional() @MaxLength(500) description?: string;
  @IsInt() @IsOptional() sortOrder?: number;
  @IsInt() @IsOptional() groupSortOrder?: number;
  @IsBoolean() @IsOptional() enabled?: boolean;
  @IsBoolean() @IsOptional() healthCheckEnabled?: boolean;

  // Web system credential
  @IsBoolean() @IsOptional() credWebEnabled?: boolean; // master switch for web credentials
  @IsString() @IsOptional() @MaxLength(200) credUsername?: string;
  @IsString() @IsOptional() @MaxLength(500) credPassword?: string;
  @IsString() @IsOptional() @MaxLength(2000) credExtra?: string;
  // Linux SSH credential
  @IsBoolean() @IsOptional() credSshEnabled?: boolean;
  @IsString() @IsOptional() credPrivateKey?: string;
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
  @IsString() @IsIn(['username', 'password', 'extra', 'privateKey', 'all']) field!: string;
}
