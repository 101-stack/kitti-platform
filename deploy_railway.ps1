param(
    [string]$Environment = "",
    [string]$FrontendService = "frontend",
    [string]$FastAPIService = "fastapi-service",
    [string]$NodeService = "node-server",
    [string]$FrontendUrl = "",
    [string]$FastAPIUrl = "",
    [string]$NodeUrl = "",
    [switch]$SkipRedeploy
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
    Write-Host ""
    Write-Host "== $message ==" -ForegroundColor Cyan
}

function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Required command '$name' was not found. Install it first."
    }
}

function Invoke-Railway($arguments) {
    $output = & railway @arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($output -join [Environment]::NewLine)
    }
    return $output
}

function Set-RailwayVariables($service, $variables) {
    $args = @("variable", "set")
    if ($Environment) {
        $args += @("--environment", $Environment)
    }
    $args += @("--service", $service, "--skip-deploys")
    $args += $variables

    Write-Host "Setting variables for $service..."
    Invoke-Railway $args | Out-Null
}

function Redeploy-Service($service) {
    $args = @("service", "redeploy", "--service", $service, "--yes")
    if ($Environment) {
        $args += @("--environment", $Environment)
    }

    Write-Host "Redeploying $service..."
    Invoke-Railway $args | Out-Null
}

function New-RandomSecret([int]$length = 48) {
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    -join (1..$length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

function Assert-NotEmpty($value, $name) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "$name is required."
    }
}

Require-Command "railway"

Write-Step "Checking Railway authentication"
try {
    Invoke-Railway @("whoami") | Out-Null
} catch {
    throw "Railway CLI is not logged in. Run 'railway login' and try again."
}

Write-Step "Checking project link"
try {
    $statusArgs = @("status")
    if ($Environment) {
        $statusArgs += @("--environment", $Environment)
    }
    Invoke-Railway $statusArgs | Out-Null
} catch {
    throw "This folder is not linked to a Railway project. Run 'railway link' and try again."
}

Assert-NotEmpty $FrontendUrl "FrontendUrl"
Assert-NotEmpty $FastAPIUrl "FastAPIUrl"
Assert-NotEmpty $NodeUrl "NodeUrl"

$jwtSecret = New-RandomSecret 64
$internalApiKey = New-RandomSecret 48

Write-Step "Setting shared application variables"
Set-RailwayVariables $FrontendService @(
    "NEXT_PUBLIC_NODE_SERVER_URL=$NodeUrl",
    "NEXT_PUBLIC_FASTAPI_URL=$FastAPIUrl"
)

Set-RailwayVariables $FastAPIService @(
    "FRONTEND_URL=$FrontendUrl",
    "NODE_SERVER_URL=$NodeUrl",
    "JWT_SECRET=$jwtSecret",
    "INTERNAL_API_KEY=$internalApiKey",
    "NODE_ENV=production"
)

Set-RailwayVariables $NodeService @(
    "FASTAPI_URL=$FastAPIUrl",
    "FRONTEND_URL=$FrontendUrl",
    "JWT_SECRET=$jwtSecret",
    "INTERNAL_API_KEY=$internalApiKey",
    "NODE_ENV=production"
)

Write-Step "Reminder about managed services"
Write-Host "PostgreSQL must be linked to $FastAPIService so Railway provides DATABASE_URL."
Write-Host "Redis must be linked to $FastAPIService and $NodeService so Railway provides REDIS_URL."

if (-not $SkipRedeploy) {
    Write-Step "Redeploying services"
    Redeploy-Service $FastAPIService
    Redeploy-Service $NodeService
    Redeploy-Service $FrontendService
}

Write-Step "Done"
Write-Host "Frontend URL: $FrontendUrl"
Write-Host "FastAPI URL:  $FastAPIUrl"
Write-Host "Node URL:     $NodeUrl"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Confirm DATABASE_URL exists on $FastAPIService."
Write-Host "2. Confirm REDIS_URL exists on $FastAPIService and $NodeService."
Write-Host "3. Check 'railway service logs -s <service>' if a deploy fails."
