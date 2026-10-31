$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$javaRoot = if ($env:JDK_HOME) { $env:JDK_HOME } else { $env:JAVA_HOME }
if (!$javaRoot) { throw 'Set JAVA_HOME or JDK_HOME to JDK 8.' }
$jdk = Join-Path $javaRoot 'bin'
$sdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { $env:ANDROID_HOME }
if (!$sdk) { throw 'Set ANDROID_SDK_ROOT to the Android SDK directory.' }
$tools = Join-Path $sdk 'build-tools\30.0.3'
$android = Join-Path $sdk 'platforms\android-30\android.jar'
foreach ($required in @("$jdk\javac.exe", "$tools\aapt.exe", $android)) {
 if (!(Test-Path -LiteralPath $required)) { throw "Missing dependency: $required" }
}
function Run-Tool([string]$exe, [string[]]$arguments) {
  & $exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "Build command failed: $exe ($LASTEXITCODE)" }
}
New-Item -ItemType Directory -Force -Path build\generated,build\classes,build\dex,dist,private | Out-Null
Run-Tool "$tools\aapt.exe" @('package','-f','-m','-J','build\generated','-M','app\AndroidManifest.xml','-S','app\res','-I',$android,'-F','build\resources.ap_')
$javaFiles = @(Get-ChildItem app\src,build\generated -Filter '*.java' -Recurse | ForEach-Object { '"' + $_.FullName.Substring($PSScriptRoot.Length+1).Replace('\','/') + '"' })
$javaFiles | Set-Content build\sources.txt -Encoding ascii
Run-Tool "$jdk\javac.exe" @('-encoding','UTF-8','-source','8','-target','8','-classpath',$android,'-d','build\classes','@build\sources.txt')
Run-Tool "$jdk\jar.exe" @('cf','build\classes.jar','-C','build\classes','.')
Run-Tool "$jdk\java.exe" @('-cp',"$tools\lib\d8.jar",'com.android.tools.r8.D8','--release','--min-api','21','--lib',$android,'--output','build\dex','build\classes.jar')
Copy-Item build\resources.ap_ build\unsigned.apk -Force
Run-Tool "$jdk\jar.exe" @('uf','build\unsigned.apk','-C','build\dex','classes.dex')
Run-Tool "$tools\zipalign.exe" @('-f','4','build\unsigned.apk','build\aligned.apk')
$keyPath = Join-Path $PSScriptRoot 'private\cinema-release.jks'
$passwordPath = Join-Path $PSScriptRoot 'private\signing-password.txt'
if (!(Test-Path $keyPath)) {
  $randomBytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($randomBytes)
  $rng.Dispose()
  $signingPassword = [Convert]::ToBase64String($randomBytes)
  [IO.File]::WriteAllText($passwordPath,$signingPassword,[Text.Encoding]::ASCII)
  Run-Tool "$jdk\keytool.exe" @('-genkeypair','-keystore',$keyPath,'-storepass',$signingPassword,'-keypass',$signingPassword,'-alias','private-cinema','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Private Cinema, OU=Home, O=LC, C=CN')
}
Run-Tool "$jdk\java.exe" @('-jar',"$tools\lib\apksigner.jar",'sign','--ks',$keyPath,'--ks-key-alias','private-cinema','--ks-pass',"file:$passwordPath",'--out','dist\VelaNestTV-3.1.1.apk','build\aligned.apk')
Run-Tool "$jdk\java.exe" @('-jar',"$tools\lib\apksigner.jar",'verify','--verbose','--print-certs','dist\VelaNestTV-3.1.1.apk')
Run-Tool "$tools\aapt.exe" @('dump','badging','dist\VelaNestTV-3.1.1.apk')
Get-FileHash dist\VelaNestTV-3.1.1.apk -Algorithm SHA256 | Format-List




