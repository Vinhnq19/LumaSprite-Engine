param([string]$Editor = 'D:/Unity/Unity Hub/6000.3.21f1/Editor/Unity.exe', [switch]$BuildOnly)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
  if (-not (Test-Path -LiteralPath $Editor -PathType Leaf)) { throw 'Unity 6000.3.21f1 Editor unavailable.' }
  $project = [IO.Path]::GetFullPath('.cache/e54-unity')
  $out = [IO.Path]::GetFullPath('benchmarks/results/run/e54/unity')
  $bin = Join-Path $project 'Player'
  $exe = Join-Path $bin 'E54Smoke.exe'
  $code = Join-Path $project 'Assets/Editor'
  New-Item -ItemType Directory -Force $code,(Join-Path $project 'Packages'),(Join-Path $project 'ProjectSettings'),$bin,$out | Out-Null
  [IO.File]::WriteAllText((Join-Path $project 'ProjectSettings/ProjectVersion.txt'), "m_EditorVersion: 6000.3.21f1`nm_EditorVersionWithRevision: 6000.3.21f1 (c02631ffc030)`n")
  [IO.File]::WriteAllText((Join-Path $project 'Packages/manifest.json'), '{"dependencies":{"com.unity.modules.imageconversion":"1.0.0","com.unity.modules.jsonserialize":"1.0.0"}}')
  & node scripts/export-e54.ts --unity
  if ($LASTEXITCODE) { throw 'Asset export failed.' }
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'E54Build.cs') -Destination $code
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'E54Playback.cs') -Destination (Join-Path $project 'Assets')
  $editorLog = Join-Path $project 'build.log'
  $build = Start-Process -FilePath $Editor -ArgumentList ('-batchmode -nographics -quit -projectPath "'+$project+'" -buildTarget Win64 -executeMethod E54Build.Run -e54-build "'+$exe+'" -logFile "'+$editorLog+'"') -WindowStyle Hidden -PassThru
  if (-not $build.WaitForExit(360000)) { Stop-Process -Id $build.Id; throw 'Isolated Unity Editor build timed out.' }
  if ($build.ExitCode -ne 0 -or -not (Select-String -LiteralPath $editorLog -Pattern 'E54_BUILD_PASS' -Quiet)) {
    Get-Content -LiteralPath $editorLog -Tail 55
    throw "Unity build exited $($build.ExitCode)."
  }
  Copy-Item -LiteralPath (Join-Path $bin 'unity-import.json') -Destination $out
  'Unity Windows Standalone build PASS'
  if ($BuildOnly) { return }
  $playerLog = Join-Path $project 'player.log'
  $player = Start-Process -FilePath $exe -WorkingDirectory $bin -ArgumentList ('-force-d3d11 -screen-fullscreen 0 -screen-width 320 -screen-height 176 -e54-proof "'+$out+'" -logFile "'+$playerLog+'"') -WindowStyle Hidden -PassThru
  if (-not $player.WaitForExit(120000)) { Stop-Process -Id $player.Id; Get-Content -LiteralPath $playerLog -Tail 55; throw 'Isolated Unity Player timed out.' }
  if ($player.ExitCode -ne 0 -or -not (Select-String -LiteralPath $playerLog -Pattern 'E54_PLAYER_PASS' -Quiet)) {
    Get-Content -LiteralPath $playerLog -Tail 55
    throw "Unity Player exited $($player.ExitCode)."
  }
  'Unity Windows Standalone runtime PASS'
} finally {
  Pop-Location
}
