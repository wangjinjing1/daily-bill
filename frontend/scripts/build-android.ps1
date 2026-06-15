param(
  [ValidateSet("debug", "release")]
  [string]$BuildType = "debug",

  [string]$ApiBaseUrl = "",

  [string]$VersionName = "",

  [switch]$PromptForInput
)

$ErrorActionPreference = "Stop"
$appDisplayName = "$([char]0x6BCF)$([char]0x65E5)$([char]0x8BB0)$([char]0x8D26)"

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Invoke-Step {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($Arguments -join ' ')"
  }
}

function Get-EnvFileValue {
  param(
    [string]$Path,
    [string]$Name
  )

  if (-not (Test-Path $Path)) {
    return ""
  }

  $line = Get-Content $Path |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
    Select-Object -First 1

  if (-not $line) {
    return ""
  }

  return ($line -replace "^\s*$([regex]::Escape($Name))\s*=\s*", "").Trim()
}

function Get-JavaMajorVersion {
  param([string]$VersionText)

  if (-not $VersionText) {
    return $null
  }

  $normalizedText = $VersionText.Trim()
  $match = [regex]::Match($normalizedText, '(?i)(?:version\s+"|javac\s+|openjdk\s+version\s+")(\d+)(?:\.(\d+))?')
  if (-not $match.Success) {
    $match = [regex]::Match($normalizedText, '(\d+)(?:\.(\d+))?')
  }
  if (-not $match.Success) {
    return $null
  }

  $major = [int]$match.Groups[1].Value
  if ($major -eq 1 -and $match.Groups[2].Success) {
    return [int]$match.Groups[2].Value
  }

  return $major
}

function Get-AndroidSdkPath {
  if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    return $env:ANDROID_HOME
  }

  if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) {
    return $env:ANDROID_SDK_ROOT
  }

  $localPropertiesPath = Join-Path $projectRoot "android\local.properties"
  if (Test-Path $localPropertiesPath) {
    $sdkDirLine = Get-Content $localPropertiesPath | Where-Object { $_ -like "sdk.dir=*" } | Select-Object -First 1
    if ($sdkDirLine) {
      $sdkDir = $sdkDirLine.Substring("sdk.dir=".Length).Replace("\\", "\")
      if (Test-Path $sdkDir) {
        return $sdkDir
      }
    }
  }

  return $null
}

function Get-LatestBuildToolsDir {
  param([string]$SdkDir)

  $buildToolsRoot = Join-Path $SdkDir "build-tools"
  if (-not (Test-Path $buildToolsRoot)) {
    return $null
  }

  return Get-ChildItem $buildToolsRoot -Directory |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
}

function Get-JavacCommandInfo {
  if ($env:JAVA_HOME) {
    $javaHomeJavac = Join-Path $env:JAVA_HOME "bin\javac.exe"
    if (Test-Path $javaHomeJavac) {
      return Get-Item $javaHomeJavac
    }
  }

  return Get-Command "javac" -ErrorAction SilentlyContinue
}

function Ensure-DebugKeystore {
  $keystorePath = Join-Path $projectRoot "android\debug.keystore"
  if (Test-Path $keystorePath) {
    return $keystorePath
  }

  $keytoolPath = Join-Path $env:JAVA_HOME "bin\keytool.exe"
  if (-not (Test-Path $keytoolPath)) {
    throw "Could not find keytool.exe under JAVA_HOME: $($env:JAVA_HOME)"
  }

  Write-Host "Generating local Android debug keystore..."
  Invoke-Step -FilePath $keytoolPath -Arguments @(
    "-genkeypair",
    "-v",
    "-storetype", "PKCS12",
    "-keystore", $keystorePath,
    "-storepass", "android",
    "-alias", "androiddebugkey",
    "-keypass", "android",
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
    "-dname", "CN=Android Debug,O=Android,C=US"
  )

  return $keystorePath
}

function Finalize-ReleaseApk {
  param(
    [string]$ApkOutputDir,
    [string]$UnsignedApkPath,
    [string]$FinalApkPath
  )

  $sdkDir = Get-AndroidSdkPath
  if (-not $sdkDir) {
    throw "Android SDK path could not be resolved. Set ANDROID_HOME or ANDROID_SDK_ROOT, or ensure android/local.properties contains sdk.dir."
  }

  $buildToolsDir = Get-LatestBuildToolsDir -SdkDir $sdkDir
  if (-not $buildToolsDir) {
    throw "Android build-tools were not found under: $sdkDir\build-tools"
  }

  $zipalignPath = Join-Path $buildToolsDir.FullName "zipalign.exe"
  $apksignerPath = Join-Path $buildToolsDir.FullName "apksigner.bat"
  if (-not (Test-Path $zipalignPath)) {
    throw "zipalign.exe was not found: $zipalignPath"
  }
  if (-not (Test-Path $apksignerPath)) {
    throw "apksigner.bat was not found: $apksignerPath"
  }

  $keystorePath = Ensure-DebugKeystore
  $alignedApkPath = Join-Path $ApkOutputDir "app-release-aligned.apk"

  if (Test-Path $alignedApkPath) {
    Remove-Item $alignedApkPath -Force
  }

  Write-Host "Aligning release APK..."
  Invoke-Step -FilePath $zipalignPath -Arguments @("-f", "-p", "4", $UnsignedApkPath, $alignedApkPath)

  Write-Host "Signing release APK..."
  Invoke-Step -FilePath $apksignerPath -Arguments @(
    "sign",
    "--ks", $keystorePath,
    "--ks-key-alias", "androiddebugkey",
    "--ks-pass", "pass:android",
    "--key-pass", "pass:android",
    "--out", $FinalApkPath,
    $alignedApkPath
  )

  return $FinalApkPath
}

function Get-AvailableApkPath {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return $Path
  }

  $directory = Split-Path -Parent $Path
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($Path)
  $extension = [System.IO.Path]::GetExtension($Path)
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $candidate = Join-Path $directory "$baseName-$timestamp$extension"
  $counter = 2

  while (Test-Path $candidate) {
    $candidate = Join-Path $directory "$baseName-$timestamp-$counter$extension"
    $counter += 1
  }

  return $candidate
}

function Get-VersionedApkName {
  param(
    [string]$BuildType,
    [string]$VersionName
  )

  if ($BuildType -eq "release") {
    return "$appDisplayName-$VersionName.apk"
  }

  return "$appDisplayName-$VersionName-debug.apk"
}

function Get-ApkArchiveDir {
  param([string]$BuildType)

  return Join-Path $projectRoot "apks\$BuildType"
}

function Assert-AndroidJdk {
  $javacCommand = Get-JavacCommandInfo
  if (-not $javacCommand) {
    $javaHomeMessage = if ($env:JAVA_HOME) { "Current JAVA_HOME: $($env:JAVA_HOME)" } else { "JAVA_HOME is not set." }
    throw @"
Android APK builds for this project require JDK 21 or newer because Capacitor 7 generates Android sources with Java 21 compatibility.

Could not find 'javac' in PATH.
$javaHomeMessage

Install JDK 21+, then update JAVA_HOME and PATH before running this script again.
"@
  }

  $javacPath = if ($javacCommand.PSObject.Properties['Source']) { $javacCommand.Source } else { $javacCommand.FullName }
  $javacVersionOutput = & $javacPath -version 2>&1 | Out-String
  $javaMajor = Get-JavaMajorVersion -VersionText $javacVersionOutput
  if (-not $javaMajor) {
    throw "Unable to determine the installed JDK version from: $($javacVersionOutput.Trim())"
  }

  if ($javaMajor -lt 21) {
    $javaHomeMessage = if ($env:JAVA_HOME) { "Current JAVA_HOME: $($env:JAVA_HOME)" } else { "JAVA_HOME is not set." }
    throw @"
Android APK builds for this project require JDK 21 or newer because Capacitor 7 generates Android sources with Java 21 compatibility.

Detected javac: $javacPath
Detected version: $($javacVersionOutput.Trim())
$javaHomeMessage

Install JDK 21+, point JAVA_HOME to it, add %JAVA_HOME%\bin to PATH, and rerun the build.
"@
  }
}

function Resolve-ApiBaseUrl {
  param([string]$InputValue)

  if ($InputValue) {
    return $InputValue
  }

  if ($env:VITE_API_BASE_URL) {
    return $env:VITE_API_BASE_URL
  }

  $envExamplePath = Join-Path (Split-Path -Parent $projectRoot) ".env.example"
  $envFileApiUrl = Get-EnvFileValue -Path $envExamplePath -Name "BACKEND_API_URL"
  if ($envFileApiUrl) {
    return $envFileApiUrl
  }

  return "http://10.0.2.2:13101/api"
}

function Normalize-ApiBaseUrl {
  param([string]$InputValue)

  $trimmedValue = $InputValue.Trim()
  if (-not [System.Uri]::IsWellFormedUriString($trimmedValue, [System.UriKind]::Absolute)) {
    throw "API URL must be an absolute URL, for example: https://your-api-domain/api"
  }

  $uri = [System.Uri]$trimmedValue
  if ($uri.Scheme -ne "http" -and $uri.Scheme -ne "https") {
    throw "API URL must start with http:// or https://"
  }

  if ($uri.Host.Contains("_")) {
    throw "API URL host cannot contain underscores: $($uri.Host). Use hyphens instead, for example daily-bill.example.com."
  }

  $builder = [System.UriBuilder]$uri
  $path = $builder.Path.TrimEnd("/")
  if (-not $path.EndsWith("/api")) {
    $builder.Path = "$path/api".TrimStart("/")
  } else {
    $builder.Path = $path.TrimStart("/")
  }
  $builder.Query = $uri.Query.TrimStart("?")

  return $builder.Uri.AbsoluteUri.TrimEnd("/")
}

function Get-AndroidBuildGradlePath {
  return Join-Path $projectRoot "android\app\build.gradle"
}

function Get-CurrentAndroidVersionName {
  $buildGradlePath = Get-AndroidBuildGradlePath
  if (-not (Test-Path $buildGradlePath)) {
    return "0.9.9"
  }

  $content = Get-Content -Raw $buildGradlePath
  $match = [regex]::Match($content, 'versionName\s+"([^"]+)"')
  if (-not $match.Success) {
    return "0.9.9"
  }

  return $match.Groups[1].Value
}

function Get-CurrentAndroidVersionCode {
  $buildGradlePath = Get-AndroidBuildGradlePath
  if (-not (Test-Path $buildGradlePath)) {
    return 0
  }

  $content = Get-Content -Raw $buildGradlePath
  $match = [regex]::Match($content, 'versionCode\s+(\d+)')
  if (-not $match.Success) {
    return 0
  }

  return [int]$match.Groups[1].Value
}

function Get-NextPatchVersion {
  param([string]$CurrentVersion)

  $match = [regex]::Match($CurrentVersion, '^(\d+)\.(\d+)\.(\d+)$')
  if (-not $match.Success) {
    return "1.0.0"
  }

  $major = [int]$match.Groups[1].Value
  $minor = [int]$match.Groups[2].Value
  $patch = [int]$match.Groups[3].Value + 1
  return "$major.$minor.$patch"
}

function Assert-VersionName {
  param([string]$InputValue)

  if ($InputValue -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version name must use semantic version format, for example: 1.0.2"
  }
}

function Set-AndroidVersion {
  param(
    [string]$NextVersionName,
    [int]$NextVersionCode
  )

  $buildGradlePath = Get-AndroidBuildGradlePath
  if (-not (Test-Path $buildGradlePath)) {
    return
  }

  $content = Get-Content -Raw $buildGradlePath
  $content = [regex]::Replace($content, 'versionCode\s+\d+', "versionCode $NextVersionCode")
  $content = [regex]::Replace($content, 'versionName\s+"[^"]+"', "versionName `"$NextVersionName`"")
  Set-Content -Path $buildGradlePath -Value $content -NoNewline
}

function Read-OptionalInput {
  param(
    [string]$Prompt,
    [string]$DefaultValue
  )

  $value = Read-Host "$Prompt [$DefaultValue]"
  if ($value) {
    return $value.Trim()
  }

  return $DefaultValue
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Require-Command "node"
Require-Command "npm.cmd"
Require-Command "npx.cmd"
Assert-AndroidJdk

$defaultApiUrl = Resolve-ApiBaseUrl -InputValue $ApiBaseUrl
$currentVersionName = Get-CurrentAndroidVersionName
$defaultVersionName = Get-NextPatchVersion -CurrentVersion $currentVersionName

if ($PromptForInput) {
  Write-Host ""
  Write-Host "Android build settings"
  Write-Host "Press Enter to use the value shown in brackets."
  $ApiBaseUrl = Read-OptionalInput -Prompt "Backend API URL" -DefaultValue $defaultApiUrl
  $VersionName = Read-OptionalInput -Prompt "Version name" -DefaultValue $defaultVersionName
}

$apiUrl = Normalize-ApiBaseUrl -InputValue (Resolve-ApiBaseUrl -InputValue $ApiBaseUrl)
$resolvedVersionName = if ($VersionName) { $VersionName.Trim() } else { $defaultVersionName }
Assert-VersionName -InputValue $resolvedVersionName
$nextVersionCode = Get-CurrentAndroidVersionCode
$nextVersionCode += 1

Write-Host "Using API base URL: $apiUrl"
Write-Host "Using version: $resolvedVersionName ($nextVersionCode)"

Set-AndroidVersion -NextVersionName $resolvedVersionName -NextVersionCode $nextVersionCode

$androidLocalEnv = Join-Path $projectRoot ".env.android.local"
"VITE_API_BASE_URL=$apiUrl" | Set-Content -Path $androidLocalEnv -Encoding UTF8

try {
  $capacitorCliPath = Join-Path $projectRoot "node_modules\.bin\cap.cmd"
  if (-not (Test-Path $capacitorCliPath)) {
    Write-Host "Installing frontend dependencies..."
    Invoke-Step -FilePath "npm.cmd" -Arguments @("install")
  }

  if (-not (Test-Path (Join-Path $projectRoot "android"))) {
    Write-Host "Creating Android project..."
    Invoke-Step -FilePath "npx.cmd" -Arguments @("cap", "add", "android")
  }

  Write-Host "Building frontend..."
  Invoke-Step -FilePath "npm.cmd" -Arguments @("run", "build", "--", "--mode", "android")

  Write-Host "Syncing Capacitor Android project..."
  Invoke-Step -FilePath "npx.cmd" -Arguments @("cap", "sync", "android")

  $androidDir = Join-Path $projectRoot "android"
  $gradleCmd = Join-Path $androidDir "gradlew.bat"
  $apkTask = if ($BuildType -eq "release") { "assembleRelease" } else { "assembleDebug" }

  if (-not (Test-Path $gradleCmd)) {
    throw "Android Gradle wrapper not found: $gradleCmd"
  }

  Write-Host "Building APK with Gradle task: $apkTask"
  Push-Location $androidDir
  try {
    Invoke-Step -FilePath $gradleCmd -Arguments @($apkTask)
  }
  finally {
    Pop-Location
  }

  $apkOutputDir = if ($BuildType -eq "release") {
    Join-Path $androidDir "app\build\outputs\apk\release"
  } else {
    Join-Path $androidDir "app\build\outputs\apk\debug"
  }

  $versionedApkName = Get-VersionedApkName -BuildType $BuildType -VersionName $resolvedVersionName
  $apkArchiveDir = Get-ApkArchiveDir -BuildType $BuildType
  New-Item -ItemType Directory -Force -Path $apkArchiveDir | Out-Null
  $versionedApkPath = Join-Path $apkArchiveDir $versionedApkName
  $finalVersionedApkPath = Get-AvailableApkPath -Path $versionedApkPath
  $preferredApkName = if ($BuildType -eq "release") { $versionedApkName } else { "app-debug.apk" }
  $preferredApkPath = Join-Path $apkOutputDir $preferredApkName

  if (Test-Path $preferredApkPath) {
    $apkPath = $preferredApkPath
  } else {
    $apkFile = Get-ChildItem -Path $apkOutputDir -Filter *.apk -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1

    if (-not $apkFile) {
      throw "APK build finished but no .apk file was found under: $apkOutputDir"
    }

    $apkPath = $apkFile.FullName
  }

  if ($BuildType -eq "release" -and $apkPath -like "*-unsigned.apk") {
    $apkPath = Finalize-ReleaseApk -ApkOutputDir $apkOutputDir -UnsignedApkPath $apkPath -FinalApkPath $finalVersionedApkPath
  } elseif ($apkPath -ne $finalVersionedApkPath) {
    Copy-Item -Path $apkPath -Destination $finalVersionedApkPath
    $apkPath = $finalVersionedApkPath
  }

  Write-Host ""
  Write-Host "APK created successfully:"
  Write-Host $apkPath
}
finally {
  if (Test-Path $androidLocalEnv) {
    Remove-Item $androidLocalEnv -Force
  }
}
