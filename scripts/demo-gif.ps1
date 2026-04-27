$ErrorActionPreference = "Stop"

Clear-Host

Write-Host ""
Write-Host "RoadmapSmith demo" -ForegroundColor Cyan
Write-Host "Evidence-backed roadmap sync for AI coding agents" -ForegroundColor Gray
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "1) Current ROADMAP.md task:" -ForegroundColor Yellow
Get-Content .\demo-gif\ROADMAP.md
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "2) Running sync before evidence exists..." -ForegroundColor Yellow
node .\roadmap-skill\bin\cli.js sync --project-root .\demo-gif
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "3) Creating repository evidence: SECURITY.md" -ForegroundColor Yellow
@'
# Security Policy

This file is repository evidence for the roadmap task.
'@ | Set-Content .\demo-gif\SECURITY.md -Encoding UTF8

Get-ChildItem .\demo-gif
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "4) Running sync again..." -ForegroundColor Yellow
node .\roadmap-skill\bin\cli.js sync --project-root .\demo-gif --audit
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "5) ROADMAP.md after evidence-backed sync:" -ForegroundColor Green
Get-Content .\demo-gif\ROADMAP.md

Write-Host ""
Write-Host "Done: task is complete only after repository evidence exists." -ForegroundColor Cyan
Start-Sleep -Seconds 4