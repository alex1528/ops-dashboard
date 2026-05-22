import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * 修改密码请求体 DTO。
 *
 * 用于 `POST /api/auth/change-password` 接口。此处仅做基础非空与长度校验；
 * 密码强度规则（长度、字符类别等中文文案）统一在 `AuthService.assertPasswordStrength`
 * 中实现，以便返回与前端一致的中文错误提示。
 */
export class ChangePasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(200) oldPassword!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) newPassword!: string;
}
