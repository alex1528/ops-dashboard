import { IsString, IsNotEmpty, IsOptional, IsIn, IsEmail, IsBoolean, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(50) username!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) password!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @IsOptional() @IsIn(['admin', 'user']) role?: string;
}

export class UpdateUserDto {
  @IsString() @IsOptional() @MaxLength(200) password?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @IsOptional() @IsIn(['admin', 'user']) role?: string;
  @IsBoolean() @IsOptional() mfaEnabled?: boolean;
}

export class PermissionItem {
  @IsString() @IsIn(['group', 'resource']) type!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) target!: string;
}

export class UpdateUserPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItem)
  permissions!: PermissionItem[];
}
