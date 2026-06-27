<#
.SYNOPSIS
  Runs one agentic QA / design / security review of this project and writes a
  dated report to qa/reports/. This is the "test agent loop" — schedule it
  (see qa/README.md / TESTING.md) to run automatically, or run it by hand.

  After writing the report it also PUBLISHES a copy to the local dashboard
  (C:\ai\data\dashboard\html\qa-reports) so reports are browsable at the
  dashboard's /reports.html page.

.NOTES
  Cost control: only the review step spends tokens, scoped to the diff since the
  last review. Defaults to Sonnet (cheap). -Deep uses Opus (use weekly).
  Playwright steps cost nothing.

  Requires the Claude CLI to be authenticated once: run `claude` interactively
  and `/login` (or set ANTHROPIC_API_KEY) before the scheduled job can work.
#>
param(
  [string]$Model = 'claude-sonnet-4-6',
  [switch]$Deep,
  [string]$DashboardDir = 'C:\ai\data\dashboard\html\qa-reports'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
$project = Split-Path $repo -Leaf
if ($Deep) { $Model = 'claude-opus-4-8' }

$today      = Get-Date -Format 'yyyy-MM-dd'
$shotsDir   = 'qa/reports/_shots'
$markerFile = '.last-qa-review'
$reportRel  = "qa/reports/$today-review.md"

New-Item -ItemType Directory -Force -Path $shotsDir | Out-Null

# Locate the Claude CLI (Get-Command, else the versioned install dir).
function Resolve-Claude {
  $cmd = Get-Command claude -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cands = Get-ChildItem "$env:APPDATA\Claude\claude-code\*\claude.exe" -ErrorAction SilentlyContinue |
    Sort-Object { try { [version]$_.Directory.Name } catch { [version]'0.0.0' } } -Descending
  if ($cands) { return $cands[0].FullName }
  return $null
}

# Publish a finished report to the dashboard and rebuild its index.json.
function Publish-ToDashboard($reportPath) {
  if (-not (Test-Path $reportPath)) { return }
  if (-not (Test-Path (Split-Path $DashboardDir -Parent))) { return } # no dashboard here
  $dest = Join-Path $DashboardDir $project
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item $reportPath (Join-Path $dest "$today-review.md") -Force

  # Rebuild index.json across all published projects/reports.
  $entries = Get-ChildItem (Join-Path $DashboardDir '*') -Directory -ErrorAction SilentlyContinue |
    ForEach-Object {
      $proj = $_.Name
      Get-ChildItem (Join-Path $_.FullName '*-review.md') -ErrorAction SilentlyContinue |
        ForEach-Object {
          [pscustomobject]@{
            project = $proj
            date    = ($_.BaseName -replace '-review$', '')
            file    = "qa-reports/$proj/$($_.Name)"
          }
        }
    }
  $entries = @($entries | Sort-Object date -Descending)
  ($entries | ConvertTo-Json -Depth 4) | Out-File -Encoding utf8 (Join-Path $DashboardDir 'index.json')
  Write-Host "Published to dashboard: $dest\$today-review.md"
}

# 1. Diff since the last review.
$head = (git rev-parse HEAD).Trim()
if (Test-Path $markerFile) {
  $base = (Get-Content $markerFile -Raw).Trim()
} else {
  $base = (git rev-parse HEAD~20 2>$null)
  if (-not $base) { $base = (git rev-list --max-parents=0 HEAD | Select-Object -Last 1) }
  $base = "$base".Trim()
}
Write-Host "Reviewing changes $base..$head"
git --no-pager diff "$base..$head" | Out-File -Encoding utf8 'qa/reports/_diff.txt'

# 2. Functional UI tests (deterministic, free).
Write-Host 'Running functional UI tests...'
npx playwright test 2>&1 | Tee-Object 'qa/reports/_test-results.txt'

# 3. Screenshots for the agent to look at.
Write-Host 'Capturing screenshots...'
npx playwright test --config qa/capture.config.js 2>&1 | Out-Null

# 4. Agentic review (the only token-spending step).
$claude = Resolve-Claude
if (-not $claude) {
  Write-Warning "Claude CLI not found. Install it or run reviews from Claude Code. Skipping the review step; screenshots + tests still ran."
  return
}
Write-Host "Running agentic review with $Model ..."
$prompt = @"
Follow the instructions in qa/review-playbook.md exactly.
Today's date for the report filename is $today.
The diff to review is in qa/reports/_diff.txt, screenshots are in qa/reports/_shots/,
and functional test output is in qa/reports/_test-results.txt.
Write the report to $reportRel and nothing else.
"@
$out = & $claude -p $prompt --model $Model --permission-mode acceptEdits 2>&1 | Out-String
Write-Host $out

if ($out -match 'Not logged in|Please run /login|Invalid API key|credit balance') {
  Write-Warning "Claude CLI is not authenticated. Run 'claude' once and /login (or set ANTHROPIC_API_KEY in the environment), then re-run. No report was written this run."
  return
}

# 5. Publish + advance the marker.
Publish-ToDashboard $reportRel
$head | Out-File -Encoding ascii $markerFile
Write-Host "Done. Report: $reportRel"
