# Install or update the Bill Split Chrome extension from GitHub Releases (Windows).
#
#   irm https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.ps1 | iex
#
# macOS and Linux: use tools/install-extension.sh instead (see the README).
#
# Downloads the latest release into %USERPROFILE%\Bill Split Extension. Chrome doesn't let scripts
# install extensions from outside the Web Store, so the first time you load that folder yourself
# ("Load unpacked"); after that, rerun this command and click reload on the extension in Chrome.
#
# Works in Windows PowerShell 5.1 and PowerShell 7. ASCII only: 5.1 misreads UTF-8 without a BOM.
# Set GITHUB_TOKEN to avoid GitHub's anonymous rate limit; not required.
# Run it as a file to pick a release (install-extension.ps1 ext-v0.2.0) or a local zip (--zip file.zip).

# Everything runs inside a script block so `irm | iex` leaves no variables behind and an error
# never closes the user's PowerShell window.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'  # the 5.1 progress bar makes downloads crawl
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $repo = 'SansCaar/billsplit'
  $ext = Join-Path $HOME 'Bill Split Extension'
  $stage = Join-Path $HOME '.billsplit-extension-download'
  $tmpZip = Join-Path ([IO.Path]::GetTempPath()) ("billsplit-" + [guid]::NewGuid() + ".zip")

  function Get-Version($dir) {
    $m = Join-Path $dir 'manifest.json'
    if (Test-Path $m) { try { return (Get-Content $m -Raw | ConvertFrom-Json).version } catch {} }
    return ''
  }

  try {
    $installed = Get-Version $ext

    # 1. Download
    if ($args.Count -ge 1 -and $args[0] -eq '--zip') {
      if ($args.Count -lt 2 -or -not (Test-Path $args[1])) { throw 'Usage: install-extension.ps1 --zip billsplit-extension-x.y.z.zip' }
      Copy-Item $args[1] $tmpZip
    } else {
      $url = if ($args.Count -ge 1) { "https://api.github.com/repos/$repo/releases/tags/$($args[0])" } else { "https://api.github.com/repos/$repo/releases/latest" }
      $headers = @{ 'X-GitHub-Api-Version' = '2022-11-28' }
      if ($env:GITHUB_TOKEN) { $headers['Authorization'] = "Bearer $env:GITHUB_TOKEN" }
      try { $release = Invoke-RestMethod -Uri $url -Headers $headers -UseBasicParsing }
      catch { throw "Couldn't reach the release on GitHub. Check your connection and try again." }
      $asset = $release.assets | Where-Object { $_.name -like 'billsplit-extension-*.zip' } | Select-Object -First 1
      if (-not $asset) { throw "Release $($release.tag_name) has no billsplit-extension zip" }
      Write-Host "> Downloading Bill Split $($release.tag_name)..."
      Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmpZip -UseBasicParsing
    }

    # 2. Unpack next to the installed copy, check it, then swap it in (keeps the same folder path,
    #    so Chrome keeps the extension and its settings)
    if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
    Expand-Archive -Path $tmpZip -DestinationPath $stage
    if (-not (Test-Path (Join-Path $stage 'manifest.json'))) { throw 'The download has no manifest.json' }
    if (Test-Path $ext) { Remove-Item $ext -Recurse -Force }
    Move-Item $stage $ext
    $version = Get-Version $ext

    if ($installed -eq $version) { Write-Host "OK  Bill Split $version is up to date in $ext" -ForegroundColor Green }
    elseif ($installed) { Write-Host "OK  Updated Bill Split $installed -> $version in $ext" -ForegroundColor Green }
    else { Write-Host "OK  Bill Split $version downloaded to $ext" -ForegroundColor Green }
    Write-Host ''

    # 3. Open Chrome's extensions page and tell the user what to click
    $chrome = @(
      "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
      "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
      "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

    # Has Chrome already loaded this folder? Chrome records unpacked extensions' folders (with JSON-
    # escaped backslashes) in each profile's preferences file, so a text search answers it.
    $needle = '"' + ($ext -replace '\\', '\\') + '"'
    $prefs = @()
    if ($env:LOCALAPPDATA) {
      $prefs = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Google/Chrome/User Data') -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName 'Preferences'; Join-Path $_.FullName 'Secure Preferences' } |
        Where-Object { Test-Path $_ -PathType Leaf }
    }
    $loaded = [bool]($prefs -and (Select-String -LiteralPath $prefs -SimpleMatch -Pattern $needle -Quiet -ErrorAction SilentlyContinue))

    if ($loaded) {
      Write-Host '  Bill Split is already in Chrome. In chrome://extensions, click the reload arrow on it to use the new version.'
    } else {
      Write-Host '  Now add it to Chrome (one time only):'
      Write-Host '    1. Open chrome://extensions and turn on Developer mode (switch at the top right).'
      Write-Host "    2. A File Explorer window shows the 'Bill Split Extension' folder. Drag it onto the Chrome page."
      Write-Host '       Or click Load unpacked, paste the path into the address bar (it is on your clipboard) and press Enter.'
      Write-Host '    3. Bill Split appears in the list. Pin it from the puzzle-piece menu if you like.'
      Write-Host ''
      Write-Host "  Folder: $ext"
      Write-Host '  To update later, run this command again.'
      try { Set-Clipboard -Value $ext } catch {}
    }
    try { $null = Read-Host "`n  Press Enter to open Chrome" } catch {}
    if (-not $loaded) { Start-Process explorer.exe -ArgumentList "/select,`"$ext`"" }
    if ($chrome) { Start-Process $chrome -ArgumentList 'chrome://extensions' }
    else { Write-Host "  Couldn't find Google Chrome. Install it, then open chrome://extensions yourself." }
  } catch {
    Write-Host "X  $($_.Exception.Message)" -ForegroundColor Red
  } finally {
    Remove-Item $tmpZip, $stage -Recurse -Force -ErrorAction SilentlyContinue
  }
} @args
