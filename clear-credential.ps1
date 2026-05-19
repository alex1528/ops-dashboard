<#
.SYNOPSIS
  ops-dashboard 凭据字段清空脚本

.DESCRIPTION
  通过调用系统 API 接口，清空指定目标资源的用户名、密码或附加信息字段。
  默认从项目根目录 .env 文件读取 ADMIN_USERNAME/ADMIN_PASSWORD/PORT，无需手动输入凭据。

.EXAMPLE
  .\clear-credential.ps1 -r Beszel -f password

.EXAMPLE
  .\clear-credential.ps1 -r "聚合DNS" -f all

.EXAMPLE
  .\clear-credential.ps1 -r Certd -f username -u admin -p mypass -H http://host:6000
#>

param(
  [Alias('r')]
  [Parameter(Mandatory=$true)]
  [string]$Resource,

  [Alias('f')]
  [Parameter(Mandatory=$true)]
  [ValidateSet('username','password','extra','privateKey','all')]
  [string]$Field,

  [Alias('H')]
  [string]$BaseUrl,

  [Alias('u')]
  [string]$AdminUser,

  [Alias('p')]
  [string]$LoginSecret
)

$ErrorActionPreference = "Stop"
$InformationPreference = "Continue"

# ---------- 读取 .env ----------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir ".env"

function Get-EnvValue([string]$Key) {
  if (Test-Path $EnvFile) {
    $line = Get-Content $EnvFile | Where-Object { $_ -match "^$Key=" } | Select-Object -Last 1
    if ($line) {
      $val = ($line -split '=', 2)[1].Trim()
      return $val.Trim('"').Trim("'")
    }
  }
  return ""
}

function Write-Info([string]$Message) {
  Write-Information $Message -InformationAction Continue
}

if (-not $AdminUser)  { $AdminUser = Get-EnvValue "ADMIN_USERNAME" }
if (-not $LoginSecret)  { $LoginSecret = Get-EnvValue "ADMIN_PASSWORD" }
if (-not $BaseUrl) {
  $port = Get-EnvValue "PORT"
  if ($port) { $BaseUrl = "http://localhost:$port" } else { $BaseUrl = "http://localhost:6000" }
}

# ---------- 参数校验 ----------
if (-not $AdminUser -or -not $LoginSecret) {
  Write-Error "[ERROR] 未找到凭据。请在 .env 中配置 ADMIN_USERNAME/ADMIN_PASSWORD，或使用 -u / -p 参数。"
  exit 1
}

Write-Info "[clear-credential] 服务地址: $BaseUrl"
Write-Info "[clear-credential] 目标资源: $Resource"
Write-Info "[clear-credential] 清空字段: $Field"

# ---------- 第一步：登录获取 Token ----------
Write-Info "[clear-credential] 正在登录..."
$loginBody = @{ username = $AdminUser; password = $LoginSecret } | ConvertTo-Json
try {
  $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST `
    -ContentType "application/json" -Body $loginBody
} catch {
  Write-Error "[ERROR] 登录失败: $($_.Exception.Message)"
  exit 1
}

$token = if ($loginResp.access_token) { $loginResp.access_token } else { "" }
if (-not $token) {
  Write-Error "[ERROR] 无法从响应中提取 access_token"
  exit 1
}
Write-Info "[clear-credential] 登录成功，Token 已获取。"

$headers = @{ Authorization = "Bearer $token" }

# ---------- 第二步：获取资源列表并匹配 ----------
Write-Info "[clear-credential] 正在查找资源..."
try {
  $resources = Invoke-RestMethod -Uri "$BaseUrl/api/resources" -Method GET -Headers $headers
} catch {
  Write-Error "[ERROR] 获取资源列表失败: $($_.Exception.Message)"
  exit 1
}

$found = $null
foreach ($r in $resources) {
  if ($r.id -eq $Resource -or $r.name -eq $Resource) {
    $found = $r
    break
  }
}

if (-not $found) {
  Write-Error "[ERROR] 未找到资源: $Resource"
  exit 1
}
Write-Info "[clear-credential] 找到资源: $($found.name) ($($found.id))"

# ---------- 第三步：调用清空凭据接口 ----------
Write-Info "[clear-credential] 正在清空凭据字段..."
$clearBody = @{ field = $Field } | ConvertTo-Json
try {
  $null = Invoke-RestMethod -Uri "$BaseUrl/api/resources/$($found.id)/credential/clear" `
    -Method POST -ContentType "application/json" -Headers $headers -Body $clearBody
} catch {
  $errMsg = $_.Exception.Message
  if ($_.Exception.Response) {
    try {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      $errMsg = $reader.ReadToEnd()
      $reader.Close()
    } catch {}
  }
  Write-Error "[ERROR] 清空凭据失败: $errMsg"
  exit 1
}

$cleared = if ($Field -eq "all") { "username, password, extra, privateKey" } else { $Field }
Write-Info "[clear-credential] 已清空资源 `"$($found.name)`" 的凭据字段: $cleared"
Write-Info "[clear-credential] 完成。"
