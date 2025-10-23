#!/usr/bin/env pwsh
#Requires -Version 7.0

<#
.SYNOPSIS
    Obsidian Plugin Release Build Agent
.DESCRIPTION
    Interactive end-to-end build & release automation for Obsidian plugins.
    Handles version bump, build, changelog, GitHub release creation, and artifact uploads.
#>

param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# ANSI color codes
$Red = "`e[31m"
$Green = "`e[32m"
$Yellow = "`e[33m"
$Blue = "`e[34m"
$Reset = "`e[0m"

function Write-Step {
    param([string]$Message)
    Write-Host "${Blue}[$(Get-Date -Format 'HH:mm:ss')]${Reset} $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Host "${Green}✓${Reset} $Message"
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "${Red}✗${Reset} $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "${Yellow}⚠${Reset} $Message" -ForegroundColor Yellow
}

function Test-Command {
    param([string]$Command)
    return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

function Invoke-WithRetry {
    param(
        [scriptblock]$ScriptBlock,
        [int]$MaxAttempts = 3,
        [int]$DelaySeconds = 2
    )
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            & $ScriptBlock
            return $true
        }
        catch {
            if ($i -eq $MaxAttempts) {
                throw
            }
            Write-Warning-Custom "Attempt $i failed. Retrying in $DelaySeconds seconds..."
            Start-Sleep -Seconds $DelaySeconds
        }
    }
    return $false
}

# ============================================================================
# STEP 1: Prerequisites
# ============================================================================
Write-Step "Checking prerequisites..."

# Check for required commands
$requiredCommands = @("node", "npm", "git", "gh")
foreach ($cmd in $requiredCommands) {
    if (-not (Test-Command $cmd)) {
        Write-Error-Custom "Required command '$cmd' not found. Please install it and try again."
        exit 1
    }
}
Write-Success "All required commands found"

# Check for GitHub token
if (-not $env:GITHUB_TOKEN) {
    Write-Error-Custom "GITHUB_TOKEN environment variable not set."
    Write-Host "Please set it with: `$env:GITHUB_TOKEN = 'your_token_here'"
    exit 1
}
Write-Success "GITHUB_TOKEN found"

# Get git remote name
$gitRemote = (git remote | Select-Object -First 1)
if (-not $gitRemote) {
    Write-Error-Custom "No git remote found. Please configure your remote."
    exit 1
}
Write-Success "Git remote: $gitRemote"

# ============================================================================
# STEP 2: Build & Test
# ============================================================================
if (-not $SkipTests) {
    Write-Step "Installing dependencies..."
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "npm ci failed"
        exit 1
    }
    Write-Success "Dependencies installed"

    Write-Step "Running type check..."
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Type check failed"
        exit 1
    }
    Write-Success "Type check passed"
} else {
    Write-Warning-Custom "Skipping tests (--SkipTests flag used)"
}

# ============================================================================
# STEP 3: Version Bump (Interactive)
# ============================================================================
Write-Step "Select version bump type:"
Write-Host "  ${Green}1${Reset} - Patch (bug fixes, small changes)"
Write-Host "  ${Yellow}2${Reset} - Minor (new features, backward compatible)"
Write-Host "  ${Red}3${Reset} - Major (breaking changes)"
Write-Host ""
$choice = Read-Host "Enter your choice (1-3)"

$versionCommand = switch ($choice) {
    "1" { "patch"; break }
    "2" { "minor"; break }
    "3" { "major"; break }
    default {
        Write-Error-Custom "Invalid choice. Aborting."
        exit 1
    }
}

Write-Step "Running npm version $versionCommand..."
npm version $versionCommand -m "chore(release): %s"
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "npm version failed"
    exit 1
}

# Extract new version
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$newVersion = $packageJson.version
Write-Success "Version bumped to $newVersion"

# ============================================================================
# STEP 4: Build Production Artifacts
# ============================================================================
Write-Step "Building production artifacts..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Production build failed"
    exit 1
}
Write-Success "Build completed"

# Verify artifacts in Copy PlainText folder
$requiredFiles = @("main.js", "styles.css", "manifest.json")
foreach ($file in $requiredFiles) {
    $path = Join-Path "Copy PlainText" $file
    if (-not (Test-Path $path)) {
        Write-Error-Custom "Missing required file: $path"
        exit 1
    }
}
Write-Success "All required files present in 'Copy PlainText' folder"

# Verify artifacts in root (should be copied by copy-dist-files.mjs)
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error-Custom "Missing required file in root: $file"
        exit 1
    }
}
Write-Success "All required files copied to root"

# Create zip
Write-Step "Creating release archive..."
$zipPath = "Copy PlainText.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path "Copy PlainText\*" -DestinationPath $zipPath -CompressionLevel Optimal
Write-Success "Archive created: $zipPath"

# Stage root files for commit
Write-Step "Staging root files..."
git add -f main.js manifest.json styles.css
git commit --amend --no-edit
Write-Success "Root files staged and commit amended"

# ============================================================================
# STEP 5: Changelog (Interactive)
# ============================================================================
$changelogPath = "CHANGELOG.md"
$changelogEntry = @"
## $newVersion

- feat: add "Copy entire note as plain-text" command
- Updated manifest and package descriptions

"@

if (-not (Test-Path $changelogPath)) {
    Write-Step "Creating CHANGELOG.md..."
    Set-Content -Path $changelogPath -Value "# Changelog`n`n$changelogEntry"
} else {
    Write-Step "Updating CHANGELOG.md..."
    $existingContent = Get-Content $changelogPath -Raw
    $newContent = "# Changelog`n`n$changelogEntry`n$($existingContent -replace '^# Changelog\s*\n', '')"
    Set-Content -Path $changelogPath -Value $newContent
}

Write-Host "`n${Blue}=== Release Notes Preview ===${Reset}"
Write-Host $changelogEntry
Write-Host "${Blue}=============================${Reset}`n"

$confirmChangelog = Read-Host "Use these release notes? (y/n/edit)"
if ($confirmChangelog -eq "edit" -or $confirmChangelog -eq "e") {
    Write-Host "Enter your release notes (press Ctrl+Z then Enter when done):"
    $changelogEntry = [System.Console]::In.ReadToEnd()
    $existingContent = Get-Content $changelogPath -Raw
    $newContent = "# Changelog`n`n$changelogEntry`n$($existingContent -replace '^# Changelog\s*\n', '')"
    Set-Content -Path $changelogPath -Value $newContent
    Write-Success "Changelog updated with custom notes"
} elseif ($confirmChangelog -ne "y") {
    Write-Error-Custom "Release aborted by user"
    exit 1
}

# ============================================================================
# STEP 6: Push to GitHub
# ============================================================================
Write-Step "Pushing to GitHub..."
Invoke-WithRetry {
    git push $gitRemote master
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
}
Write-Success "Commit pushed"

Write-Step "Pushing tags..."
Invoke-WithRetry {
    git push $gitRemote --tags
    if ($LASTEXITCODE -ne 0) { throw "git push tags failed" }
}
Write-Success "Tags pushed"

# ============================================================================
# STEP 7: Create GitHub Release
# ============================================================================
Write-Step "Creating GitHub release $newVersion..."

$releaseNotes = $changelogEntry.Trim()
$releaseNotesFile = "release-notes-temp.md"
Set-Content -Path $releaseNotesFile -Value $releaseNotes

try {
    Invoke-WithRetry {
        gh release create $newVersion `
            --title "$newVersion" `
            --notes-file $releaseNotesFile `
            main.js `
            styles.css `
            manifest.json `
            "Copy PlainText.zip"
        
        if ($LASTEXITCODE -ne 0) { throw "GitHub release creation failed" }
    }
    Write-Success "GitHub release created: $newVersion"
} finally {
    if (Test-Path $releaseNotesFile) {
        Remove-Item $releaseNotesFile -Force
    }
}

# ============================================================================
# DONE
# ============================================================================
Write-Host "`n${Green}========================================${Reset}"
Write-Host "${Green}   Release $newVersion completed! 🎉${Reset}"
Write-Host "${Green}========================================${Reset}`n"
Write-Host "Release URL: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/$newVersion"
Write-Host "`nUsers will see the update in Obsidian Community Plugins within 1 hour."
