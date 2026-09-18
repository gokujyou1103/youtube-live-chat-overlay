[CmdletBinding()]
param(
  [string]$ElectronVersion = '38.2.0'
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$cacheRoot = Join-Path $projectRoot '.build-cache'
$distRoot = Join-Path $projectRoot 'dist-no-npm'
$appRoot = Join-Path $distRoot 'YouTube Live Chat Overlay'
$archiveName = "electron-v$ElectronVersion-win32-x64.zip"
$archivePath = Join-Path $cacheRoot $archiveName
$baseUrl = "https://github.com/electron/electron/releases/download/v$ElectronVersion"

function Receive-File {
  param([string]$Uri, [string]$Destination)

  if (Test-Path -LiteralPath $Destination) { return }

  Write-Host "Downloading $Uri"
  try {
    Import-Module BitsTransfer -ErrorAction Stop
    Start-BitsTransfer -Source $Uri -Destination $Destination -ErrorAction Stop
    return
  } catch {
    Write-Warning "BITS failed; trying Invoke-WebRequest: $($_.Exception.Message)"
  }

  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination
    return
  } catch {
    Write-Warning "Invoke-WebRequest failed; trying certutil: $($_.Exception.Message)"
  }

  & "$env:SystemRoot\System32\certutil.exe" -urlcache -split -f $Uri $Destination
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $Destination)) {
    throw "Download failed: $Uri"
  }
}

New-Item -ItemType Directory -Force -Path $cacheRoot, $distRoot | Out-Null
Receive-File "$baseUrl/$archiveName" $archivePath

if (Test-Path -LiteralPath $appRoot) {
  Remove-Item -LiteralPath $appRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $appRoot | Out-Null
Expand-Archive -LiteralPath $archivePath -DestinationPath $appRoot -Force

$resourcesApp = Join-Path $appRoot 'resources\app'
New-Item -ItemType Directory -Force -Path $resourcesApp | Out-Null

# Keep the same runtime files as electron-builder; include new modules automatically.
foreach ($entry in @('main.js', 'preload.js', 'package.json', 'lib', 'renderer', 'build')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $entry) -Destination $resourcesApp -Recurse -Force
}

$electronExe = Join-Path $appRoot 'electron.exe'
$appExe = Join-Path $appRoot 'YouTube Live Chat Overlay.exe'
Move-Item -LiteralPath $electronExe -Destination $appExe -Force

$zipOutput = Join-Path $distRoot 'YouTube-Live-Chat-Overlay-Portable-x64.zip'
if (Test-Path -LiteralPath $zipOutput) {
  Remove-Item -LiteralPath $zipOutput -Force
}
Compress-Archive -Path $appRoot -DestinationPath $zipOutput -CompressionLevel Optimal

Write-Host ''
Write-Host 'Build completed:' -ForegroundColor Green
Write-Host $appExe
Write-Host $zipOutput
