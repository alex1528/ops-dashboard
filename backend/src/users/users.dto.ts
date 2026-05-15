import { IsString, IsNotEmpty, IsOptional, IsIn, IsEmail, IsBoolean, MaxLength } from 'class-validator';

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
