# =============================================================================
# ops-dashboard 手动备份触发脚本 (PowerShell)
# 用法:
#   .\backup-trigger.ps1                          # 使用 .env 中的凭据
#   .\backup-trigger.ps1 -Username admin -Password mypass
#   .\backup-trigger.ps1 -BaseUrl http://host:6000
# =============================================================================
param(
    [string]$Username,
    [string]$Password,
    [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile   = Join-Path $ScriptDir '.env'

# ---------- 读取 .env ----------
if (Test-Path $EnvFile) {
    $envLines = Get-Content $EnvFile | Where-Object { $_ -match '^[A-Z_]+=.+' }
    $envMap = @{}
    foreach ($line in $envLines) {
        $key, $val = $line -split '=', 2
        $envMap[$key.Trim()] = $val.Trim().Trim('"').Trim("'")
    }
    if (-not $Username) { $Username = $envMap['ADMIN_USERNAME'] }
    if (-not $Password) { $Password = $envMap['ADMIN_PASSWORD'] }
    if (-not $BaseUrl) {
        $port = $envMap['PORT']
        $BaseUrl = if ($port) { "http://localhost:$port" } else { 'http://localhost:6000' }
    }
}

if (-not $BaseUrl) { $BaseUrl = 'http://localhost:6000' }

# ---------- 参数校验 ----------
if (-not $Username -or -not $Password) {
    Write-Error "[ERROR] 未找到凭据。请在 .env 中配置 ADMIN_USERNAME/ADMIN_PASSWORD，或使用 -Username / -Password 参数。"
    exit 1
}

Write-Host "[backup-trigger] 服务地址: $BaseUrl"
Write-Host "[backup-trigger] 登录用户: $Username"

# ---------- 第一步：登录获取 Token ----------
Write-Host "[backup-trigger] 正在登录..."

$loginBody = @{ username = $Username; password = $Password } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" `
        -Method POST -Body $loginBody -ContentType 'application/json'
} catch {
    Write-Error "[ERROR] 登录失败: $_"
    exit 1
}

$token = $loginResp.access_token
if (-not $token) {
    Write-Error "[ERROR] 无法从响应中提取 access_token。"
    exit 1
}
Write-Host "[backup-trigger] 登录成功，Token 已获取。"

# ---------- 第二步：触发备份 ----------
Write-Host "[backup-trigger] 正在触发备份..."

try {
    $backupResp = Invoke-RestMethod -Uri "$BaseUrl/api/backup" `
        -Method POST -Headers @{ Authorization = "Bearer $token" }
} catch {
    Write-Error "[ERROR] 备份请求失败: $_"
    exit 1
}

if ($backupResp.skipped) {
    Write-Host "[backup-trigger] 备份已跳过（数据库内容与上次备份相同，无需重写）。"
} else {
    Write-Host "[backup-trigger] 备份成功！文件路径: $($backupResp.path)"
}

Write-Host "[backup-trigger] 完成。"
