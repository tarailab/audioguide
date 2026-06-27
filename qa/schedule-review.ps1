<#
.SYNOPSIS
  Registers a Windows Scheduled Task that runs the agentic QA review once a day.
  Run this ONCE to turn on the automatic loop. Safe to re-run (replaces the task).

.EXAMPLE
  pwsh -File qa/schedule-review.ps1                 # daily at 07:00, Sonnet
  pwsh -File qa/schedule-review.ps1 -At 06:30 -Deep # daily at 06:30, Opus (deeper)

.NOTES
  Cost: one scoped review per day (diff-only, Sonnet by default). Playwright steps
  are free. Remove with:  Unregister-ScheduledTask -TaskName 'audioguide-qa-review'
#>
param(
  [string]$At = '07:00',
  [switch]$Deep
)

$ErrorActionPreference = 'Stop'
$repo   = Split-Path $PSScriptRoot -Parent
$script = Join-Path $repo 'qa\run-review.ps1'
$taskName = 'audioguide-qa-review'

$pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue)?.Source
if (-not $pwsh) { $pwsh = (Get-Command powershell).Source }

$argList = "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
if ($Deep) { $argList += ' -Deep' }

$action  = New-ScheduledTaskAction -Execute $pwsh -Argument $argList -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Settings $settings -Description 'Daily agentic QA/design/security review of audioguide' `
  -Force | Out-Null

Write-Host "Registered scheduled task '$taskName' — runs daily at $At."
Write-Host "Reports will appear in qa/reports/. Run now to test:  pwsh -File qa/run-review.ps1"
