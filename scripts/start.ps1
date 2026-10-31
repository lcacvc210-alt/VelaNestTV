$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$node=(Get-Command node.exe).Source
foreach($file in @('backend/.env.local','companion/.env')) {if(!(Test-Path (Join-Path $repo $file))){throw "Missing $file; copy its example and configure it first."}}
foreach($port in @(8080,8090)) {if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Port $port already in use; stop the existing service first."}}
& $node (Join-Path $PSScriptRoot 'doctor.mjs') --config-only
if($LASTEXITCODE -ne 0){throw 'Configuration validation failed.'}
$log=Join-Path $repo 'runtime';New-Item -ItemType Directory -Force $log | Out-Null
$p=Start-Process $node -ArgumentList 'node_modules/next/dist/bin/next','start','-p','8080','-H','0.0.0.0' -WorkingDirectory (Join-Path $repo 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $log 'backend.log') -RedirectStandardError (Join-Path $log 'backend-error.log') -PassThru
$p.Id | Set-Content (Join-Path $log 'backend.pid')
try {
 for($i=0;$i -lt 30;$i++){try{Invoke-RestMethod http://127.0.0.1:8080/api/status -TimeoutSec 1 | Out-Null;break}catch{if($i -eq 29){throw 'Backend not ready'};Start-Sleep -Milliseconds 500}}
 $c=Start-Process $node -ArgumentList '--env-file=.env','server.mjs' -WorkingDirectory (Join-Path $repo 'companion') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $log 'companion.log') -RedirectStandardError (Join-Path $log 'companion-error.log') -PassThru
 $c.Id | Set-Content (Join-Path $log 'companion.pid')
 for($i=0;$i -lt 30;$i++){try{Invoke-RestMethod http://127.0.0.1:8090/health -TimeoutSec 1 | Out-Null;break}catch{if($i -eq 29){throw 'Companion not ready'};Start-Sleep -Milliseconds 500}}
 Write-Host 'Backend http://localhost:8080 ; companion http://localhost:8090/health'
} catch {if($c -and !$c.HasExited){$c.Kill()};if(!$p.HasExited){$p.Kill()};throw}
