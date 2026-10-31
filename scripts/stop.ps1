$repo=Split-Path $PSScriptRoot -Parent
foreach($name in @('backend','companion')){
 $file=Join-Path $repo "runtime/$name.pid"
 if(Test-Path $file){$serviceId=[int](Get-Content $file);$p=Get-CimInstance Win32_Process -Filter "ProcessId=$serviceId" -ErrorAction SilentlyContinue
 if($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'next/dist/bin/next|server.mjs'){Stop-Process -Id $serviceId};Remove-Item -LiteralPath $file}
}
