# fob installer for Windows: downloads the self-contained `fob.exe` and installs
# it to ~\.fob\bin. No admin, no Node. Like install.sh, it does NOT edit your
# PATH or profile; if ~\.fob\bin isn't on PATH it prints the command to run.
# Binaries are served from Cloudflare R2 (get.finopsbricks.com). Usage
# (PowerShell 5.1 or 7+):
#   irm https://get.finopsbricks.com/install.ps1 | iex
#   $env:FOB_VERSION = 'v1.2.0'; irm https://get.finopsbricks.com/install.ps1 | iex   # pin a version
# Overrides: FOB_BASE_URL, FOB_BIN_DIR, FOB_VERSION (default: latest).

# Run inside a script block: this is usually piped into `iex`, where `exit`
# would close the user's shell and variables would leak into their session.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue' # Invoke-WebRequest is very slow in 5.1 with the progress bar

  $BaseUrl = if ($env:FOB_BASE_URL) { $env:FOB_BASE_URL.TrimEnd('/') } else { 'https://get.finopsbricks.com' }
  $BinDir = if ($env:FOB_BIN_DIR) { $env:FOB_BIN_DIR } else { Join-Path $HOME '.fob\bin' }
  $Version = if ($env:FOB_VERSION) { $env:FOB_VERSION } else { 'latest' }

  # Windows PowerShell 5.1 on older .NET may default to TLS 1.0.
  if ($PSVersionTable.PSVersion.Major -lt 6) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  }

  # --- detect platform ---
  # Only windows-x64 is built. Windows on ARM runs it under x64 emulation.
  $arch = $env:PROCESSOR_ARCHITEW6432
  if (-not $arch) { $arch = $env:PROCESSOR_ARCHITECTURE }
  switch ($arch) {
    'AMD64' { }
    'ARM64' { Write-Host 'fob: no native ARM64 build yet; installing x64 (runs under emulation).' }
    default { Write-Error "fob: unsupported architecture '$arch'."; return }
  }
  $asset = 'fob-windows-x64.exe'

  # --- resolve download URLs (latest at root; pinned version under a prefix) ---
  $base = if ($Version -eq 'latest') { $BaseUrl } else { "$BaseUrl/$Version" }

  Write-Host "fob: installing $asset ($Version) -> $BinDir"
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("fob-" + [guid]::NewGuid().ToString('N') + '.exe')
  try {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile $tmp
    } catch {
      Write-Error "fob: download failed: $base/$asset ($($_.Exception.Message))"; return
    }

    # --- verify checksum against the release fob-SHA256SUMS (if present) ---
    $sums = $null
    try { $sums = (Invoke-WebRequest -UseBasicParsing -Uri "$base/fob-SHA256SUMS").Content } catch { }
    if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
    if ($sums) {
      $expected = $null
      foreach ($line in ($sums -split "`n")) {
        if ($line.Trim() -match '^([0-9a-fA-F]{64})\s+\*?(.+)$' -and $Matches[2].Trim() -eq $asset) { $expected = $Matches[1].ToLower(); break }
      }
      if ($expected) {
        $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $tmp).Hash.ToLower()
        if ($expected -ne $actual) { Write-Error "fob: checksum mismatch for $asset - aborting."; return }
        Write-Host 'fob: checksum ok'
      }
    }

    # --- install ---
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    $dest = Join-Path $BinDir 'fob.exe'
    try {
      Move-Item -LiteralPath $tmp -Destination $dest -Force
    } catch {
      Write-Error "fob: could not write $dest. Is fob running? Close it and retry. ($($_.Exception.Message))"; return
    }
    $ver = try { & $dest --version 2>$null } catch { $null }
    Write-Host "fob: installed $(if ($ver) { $ver } else { "-> $dest" })"
  } finally {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  }

  # --- PATH hint (we don't touch your environment) ---
  $norm = { param($p) $p.Trim().Trim('"').TrimEnd('\', '/').Replace('/', '\').ToLowerInvariant() }
  $want = & $norm $BinDir
  $onPath = @($env:Path -split ';' | Where-Object { $_ } | Where-Object { (& $norm $_) -eq $want }).Count -gt 0
  if ($onPath) {
    Write-Host "fob: ready - run 'fob help'"
  } else {
    $q = $BinDir.Replace("'", "''")
    Write-Host ''
    Write-Host "fob: $BinDir is not on your PATH. Add it for your user, then open a new terminal:"
    Write-Host "  [Environment]::SetEnvironmentVariable('Path', '$q;' + [Environment]::GetEnvironmentVariable('Path', 'User'), 'User')"
  }
}
