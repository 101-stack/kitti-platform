$token = "175f1ca0-89ee-4382-8c44-dd9e4fbaf461"
$envId = "c6edc515-c3e0-4a8a-82e4-b364d029eff6"
$projectId = "14ebd829-8804-4876-8775-7bc4eb4d5056"

$frontendId = "ee3be07f-2e78-4c6b-be66-5d18e7f7ef3f"
$fastapiId  = "23da9b49-f6f2-4a1f-9fcf-3ce719fe35ef"
$nodeId     = "fdb752d5-1dad-4304-9cae-ff1c539fb73b"
$redisId    = "redis-service-id-if-exists"
$postgresId = "postgres-service-id-if-exists"

$frontendUrl = "https://kitti-platform-kitti.up.railway.app"
$fastapiUrl  = "https://fastapi-kitti.up.railway.app"
$nodeUrl     = "https://node-server-kitti.up.railway.app"

# Generate secure keys
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
$internalKey = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("kitti-internal-$(Get-Random)"))

$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

function Set-Var($serviceId, $name, $value) {
    $q = 'mutation { variableUpsert(input: { projectId: "' + $projectId + '", environmentId: "' + $envId + '", serviceId: "' + $serviceId + '", name: "' + $name + '", value: "' + $value + '" }) }'
    $body = @{ query = $q } | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri "https://backboard.railway.app/graphql/v2" -Method Post -Headers $headers -Body $body | Out-Null
        Write-Host "  [OK] $name"
    } catch {
        Write-Host "  [WARN] Failed to set $name : $_"
    }
}

Write-Host "=== Setting environment variables ==="

Write-Host "Frontend:"
Set-Var $frontendId "NEXT_PUBLIC_NODE_SERVER_URL" $nodeUrl
Set-Var $frontendId "NEXT_PUBLIC_FASTAPI_URL" $fastapiUrl

Write-Host "FastAPI:"
Set-Var $fastapiId "FRONTEND_URL" $frontendUrl
Set-Var $fastapiId "NODE_SERVER_URL" $nodeUrl
Set-Var $fastapiId "JWT_SECRET" $jwtSecret
Set-Var $fastapiId "INTERNAL_API_KEY" $internalKey
Set-Var $fastapiId "NODE_ENV" "production"

Write-Host "Node Server:"
Set-Var $nodeId "FASTAPI_URL" $fastapiUrl
Set-Var $nodeId "FRONTEND_URL" $frontendUrl
Set-Var $nodeId "JWT_SECRET" $jwtSecret
Set-Var $nodeId "INTERNAL_API_KEY" $internalKey
Set-Var $nodeId "NODE_ENV" "production"

Write-Host ""
Write-Host "=== Important: Configure on Railway Dashboard ==="
Write-Host "BEFORE deployment, ensure:"
Write-Host "  1. PostgreSQL service is created and linked to FastAPI"
Write-Host "  2. Redis service is created and linked to Node Server & FastAPI"
Write-Host ""
Write-Host "Once linked, Railway will auto-set:"
Write-Host "  - DATABASE_URL (PostgreSQL connection)"
Write-Host "  - REDIS_URL (Redis connection)"
Write-Host ""
Write-Host "For Node Server to use Redis URL instead of individual vars,"
Write-Host "update the redisService.js to parse REDIS_URL environment variable"
Write-Host ""

Write-Host "=== Triggering deployments ==="

function Deploy-Service($serviceId, $name) {
    $q = 'mutation { serviceInstanceRedeploy(environmentId: "' + $envId + '", serviceId: "' + $serviceId + '") }'
    $body = @{ query = $q } | ConvertTo-Json -Compress
    try {
        $r = Invoke-RestMethod -Uri "https://backboard.railway.app/graphql/v2" -Method Post -Headers $headers -Body $body
        Write-Host "  [OK] Deployed $name"
    } catch {
        Write-Host "  [ERROR] Failed to deploy $name : $_"
    }
}

Deploy-Service $fastapiId "fastapi"
Start-Sleep -Seconds 3
Deploy-Service $nodeId "node-server"
Start-Sleep -Seconds 3
Deploy-Service $frontendId "kitti-platform (frontend)"

Write-Host ""
Write-Host "========================================"
Write-Host "Deployment triggered!"
Write-Host "Frontend:    $frontendUrl"
Write-Host "FastAPI:     $fastapiUrl"
Write-Host "Node Server: $nodeUrl"
Write-Host ""
Write-Host "Monitor deployments at:"
Write-Host "https://railway.app/project/$projectId"
Write-Host "========================================"
