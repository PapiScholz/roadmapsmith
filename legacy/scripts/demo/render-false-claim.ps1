# Renders the false-claim demo as PNG frames + stitches them into GIF/MP4.
# Follows the cli-demo-recorder skill: banner + 3 acts + closing.
# Windows pipeline (PowerShell/System.Drawing + ffmpeg) — no asciinema/agg needed.

param(
  [string]$OutDir = "C:\Temp\rs-video-fc",
  [string]$Gif    = "C:\Temp\rs-video-fc\demo.gif",
  [string]$Mp4    = "C:\Temp\rs-video-fc\demo.mp4"
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$BG      = [System.Drawing.Color]::FromArgb(40, 42, 54)
$FG      = [System.Drawing.Color]::FromArgb(248, 248, 242)
$DIM     = [System.Drawing.Color]::FromArgb(136, 140, 168)
$GREEN   = [System.Drawing.Color]::FromArgb(80, 250, 123)
$YELLOW  = [System.Drawing.Color]::FromArgb(241, 250, 140)
$CYAN    = [System.Drawing.Color]::FromArgb(139, 233, 253)
$MAGENTA = [System.Drawing.Color]::FromArgb(255, 121, 198)

$frames = @(
  @{
    Name = '01-banner'; Duration = 3.8
    Lines = @(
      @{ text = '  +==================================================================+'; color = $CYAN },
      @{ text = '  | RoadmapSmith - auditable roadmap for AI-agent workflows          |'; color = $CYAN },
      @{ text = '  +==================================================================+'; color = $CYAN },
      @{ text = '' ; color = $FG },
      @{ text = '  Your agent marks a task [x]. RoadmapSmith checks the code:'; color = $FG },
      @{ text = '  no evidence, no completion. Receipts survive the claim.'; color = $FG },
      @{ text = '' ; color = $FG },
      @{ text = '  This demo:'; color = $DIM },
      @{ text = '    1. Agent marks a task done without writing code'; color = $DIM },
      @{ text = '    2. roadmapsmith update --audit catches it'; color = $DIM },
      @{ text = '    3. Exact task id surfaced for the human to act on'; color = $DIM }
    )
  },
  @{
    Name = '02-act1-claim'; Duration = 3.2
    Lines = @(
      @{ text = '  --- Act 1: Agent claims done ---'; color = $MAGENTA },
      @{ text = '' ; color = $FG },
      @{ text = '  $ roadmapsmith update --add-task "Add SHA-256 password hashing"'; color = $GREEN },
      @{ text = '  $ sed -i "s|- \[ \]|- [x]|" ROADMAP.md      # agent flips the box'; color = $GREEN },
      @{ text = '                                                  (writes zero code)'; color = $DIM },
      @{ text = '' ; color = $FG },
      @{ text = '  ROADMAP.md:'; color = $DIM },
      @{ text = '  - [x] Add SHA-256 password hashing'; color = $FG },
      @{ text = '        <!-- rs:task=add-sha-256-password-hashing rs:planned -->'; color = $DIM }
    )
  },
  @{
    Name = '03-act2-audit'; Duration = 3.8
    Lines = @(
      @{ text = '  --- Act 2: Validator runs ---'; color = $MAGENTA },
      @{ text = '' ; color = $FG },
      @{ text = '  $ roadmapsmith update --audit --project-root . --json \'; color = $GREEN },
      @{ text = '        | jq .checkedWithoutEvidence'; color = $GREEN },
      @{ text = '' ; color = $FG },
      @{ text = '  checkedWithoutEvidence: 1'; color = $YELLOW },
      @{ text = '  # ^ the audit disagrees with the agent'; color = $DIM }
    )
  },
  @{
    Name = '04-act3-taskid'; Duration = 3.5
    Lines = @(
      @{ text = '  --- Act 3: Exactly which task ---'; color = $MAGENTA },
      @{ text = '' ; color = $FG },
      @{ text = '  $ jq -r ".checkedWithoutEvidence[0].task.id" audit.json'; color = $GREEN },
      @{ text = '' ; color = $FG },
      @{ text = '  id: add-sha-256-password-hashing'; color = $CYAN },
      @{ text = '' ; color = $FG },
      @{ text = '  -> the human reviews this task.'; color = $FG },
      @{ text = '     the agent cannot gaslight the audit trail.'; color = $FG }
    )
  },
  @{
    Name = '05-closing'; Duration = 4.5
    Lines = @(
      @{ text = '  +==================================================================+'; color = $GREEN },
      @{ text = '  | v  Demo complete                                                 |'; color = $GREEN },
      @{ text = '  +==================================================================+'; color = $GREEN },
      @{ text = '' ; color = $FG },
      @{ text = '  Install:   npm install -g roadmapsmith'; color = $FG },
      @{ text = '  Repro:     bash scripts/demo/false-claim-repro.sh'; color = $FG },
      @{ text = '' ; color = $FG },
      @{ text = '  README:    github.com/PapiScholz/roadmapsmith'; color = $DIM }
    )
  }
)

$width = 1400
$height = 800
$fontName = 'Consolas'
$fontSize = 22

foreach ($f in $frames) {
  $bmp = New-Object System.Drawing.Bitmap $width, $height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear($BG)
  $font = New-Object System.Drawing.Font $fontName, $fontSize, ([System.Drawing.FontStyle]::Regular)
  $y = 60
  $lineH = 34
  foreach ($ln in $f.Lines) {
    $brush = New-Object System.Drawing.SolidBrush ($ln.color)
    $g.DrawString($ln.text, $font, $brush, 40, $y)
    $y += $lineH
    $brush.Dispose()
  }
  $outPng = Join-Path $OutDir ("frame-{0}.png" -f $f.Name)
  $bmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $font.Dispose()
  Write-Host "wrote $outPng"
}

$concatFile = Join-Path $OutDir 'concat.txt'
$sb = New-Object System.Text.StringBuilder
foreach ($f in $frames) {
  $png = ("frame-{0}.png" -f $f.Name)
  [void]$sb.AppendLine("file '$png'")
  [void]$sb.AppendLine("duration $($f.Duration)")
}
$lastPng = ("frame-{0}.png" -f $frames[-1].Name)
[void]$sb.AppendLine("file '$lastPng'")
Set-Content -Path $concatFile -Value $sb.ToString() -Encoding ASCII
Write-Host "wrote $concatFile"

$ffmpeg = Get-Command ffmpeg -ErrorAction Stop | Select-Object -ExpandProperty Source
Push-Location $OutDir
try {
  & $ffmpeg -y -f concat -i concat.txt -vf 'fps=15,scale=1400:-1:flags=lanczos,palettegen' palette.png 2>&1 | Out-Null
  & $ffmpeg -y -f concat -i concat.txt -i palette.png -filter_complex 'fps=15,scale=1400:-1:flags=lanczos[x];[x][1:v]paletteuse' $Gif 2>&1 | Out-Null
  Write-Host ("wrote $Gif ({0} KB)" -f [math]::Round((Get-Item $Gif).Length/1KB,1))

  & $ffmpeg -y -f concat -i concat.txt -movflags faststart -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p' -c:v libx264 -preset slow -crf 24 -tune stillimage $Mp4 2>&1 | Out-Null
  Write-Host ("wrote $Mp4 ({0} KB)" -f [math]::Round((Get-Item $Mp4).Length/1KB,1))
} finally {
  Pop-Location
}
