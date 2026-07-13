Add-Type -AssemblyName System.Drawing

$frames = @{
  '01' = @'

   RoadmapSmith Dogfood Demo
   -------------------------

   Two identical claude-code sessions.
   One reads ROADMAP.md. One does not.

   Same repo. Same time budget.

'@
  '02' = @'

   ROADMAP.md - 6 unchecked tasks:

   [ ]  [P0]  Release v0.12.1
   [ ]  [P1]  Documentar rs:kind=rollup semantics
   [ ]  [P1]  CHANGELOG entry for v0.12.1
   [ ]  [P1]  Wire the dogfood demo
   [ ]  [P2]  Unit tests for taskLine helpers
   [ ]  [P2]  moduleMetadata config example

   Both sessions face the same worktree at v0.12.0.

'@
  '03' = @'

   Session A - can read ROADMAP.md
   -------------------------------

   picked 4 tasks, mixed priority
   wrote 8 Evidence: bullets pointing at real files
   tests: 264 pass (+9 new) / 1 skip / 0 fail
   10 files touched, aligned with the plan

   Closed:
     [x]  release-0-12-1       bumped package.json to 0.12.1
     [x]  doc-rs-kind-rollup   created docs/rs-kind-rollup.md
     [x]  changelog-0-12-1     CHANGELOG entry
     [x]  test-taskline-helpers    9 unit tests added

   Audit summary:
     0 checked-without-evidence, 0 ready-but-unchecked   PASS

'@
  '04' = @'

   Session B - ROADMAP.md hidden
   -----------------------------

   picked 3 improvements on its own
   wrote 0 Evidence: bullets
   tests: 278 pass (+24 new)
   7 files touched, unrelated to the plan

   Did:
     fixed regex bug in src/addTask.js
     added parseArgv tests (10)
     added match module tests (13)

   From its own transcript:
     "Skipped the WIP files - no way to know they were intentional"

   Audit summary:
     Ready but unchecked: [release-0-12-1, changelog-0-12-1, ...]   FAIL

'@
  '05' = @'

   Result                        |  A (reads ROADMAP)  |  B (hidden)
   ------------------------------+---------------------+-------------
   Tasks closed with Evidence    |         4           |       0
   Audit clean                   |        yes          |      no
   Aligned with plan             |       10/10         |    0/7 files
   Coordination with WIP         |       aware         |    had to skip

   Both wrote real, useful code.
   Only one left an auditable trail.

   That is what roadmapsmith adds.

'@
}

foreach ($k in $frames.Keys) {
  $bmp = New-Object System.Drawing.Bitmap 1400, 800
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::FromArgb(40, 42, 54))
  $font = New-Object System.Drawing.Font('Consolas', 22, [System.Drawing.FontStyle]::Regular)
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(248, 248, 242))
  $out = "C:\Temp\rs-video\frame-$k.png"
  $g.DrawString($frames[$k], $font, $brush, 60, 40)
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $font.Dispose(); $brush.Dispose()
  Write-Host "$out : $((Get-Item $out).Length) bytes"
}
