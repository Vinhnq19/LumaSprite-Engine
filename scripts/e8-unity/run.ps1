param(
  [string]$Editor = 'D:/Unity/Unity Hub/6000.3.21f1/Editor/Unity.exe',
  [switch]$BuildOnly,
  [switch]$TestsOnly,
  [switch]$PlayerOnly
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
  if (-not (Test-Path -LiteralPath $Editor -PathType Leaf)) { throw 'UNITY_RUNTIME_NOT_AVAILABLE: Unity 6000.3.21f1 executable missing.' }
  $project = [IO.Path]::GetFullPath('.cache/e8-runtime-acceptance')
  $assets = Join-Path $project 'Assets'
  $packages = Join-Path $project 'Packages'
  $settings = Join-Path $project 'ProjectSettings'
  $out = [IO.Path]::GetFullPath('benchmarks/results/run/e83')
  $bin = Join-Path $project 'E83Player'
  $exe = Join-Path $bin 'LumaSpriteE83.exe'
  [IO.Directory]::CreateDirectory($out) | Out-Null

  function Process([string]$app, [string]$arguments, [string]$log, [string]$working, [int]$seconds, [string]$marker, [string]$window = 'Hidden') {
    $job = Start-Process -FilePath $app -WorkingDirectory $working -ArgumentList $arguments -WindowStyle $window -PassThru
    if (-not $job.WaitForExit($seconds * 1000)) {
      Stop-Process -Id $job.Id
      if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 40 }
      throw "E8 process timed out ($seconds s). See $log."
    }
    if ($job.ExitCode -ne 0 -or ($marker -and -not (Select-String -LiteralPath $log -Pattern $marker -Quiet))) {
      if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 70 }
      throw "E8 process exited $($job.ExitCode). See $log."
    }
  }
  if (-not ($TestsOnly -or $PlayerOnly)) {
    foreach ($dir in @($assets, $packages, $settings, $bin)) { [IO.Directory]::CreateDirectory($dir) | Out-Null }
    [IO.File]::WriteAllText((Join-Path $settings 'ProjectVersion.txt'), "m_EditorVersion: 6000.3.21f1`nm_EditorVersionWithRevision: 6000.3.21f1 (c02631ffc030)`n")
    [IO.File]::WriteAllText((Join-Path $packages 'manifest.json'), '{"dependencies":{"com.unity.modules.imageconversion":"1.0.0","com.unity.modules.jsonserialize":"1.0.0","com.unity.modules.tilemap":"1.0.0","com.unity.modules.physics2d":"1.0.0","com.unity.modules.imgui":"1.0.0","com.unity.modules.screencapture":"1.0.0","com.unity.test-framework":"1.6.0"}}')
    & node scripts/export-e8-runtime.ts --out (Join-Path $assets 'Resources/E8Input')
    if ($LASTEXITCODE) { throw 'E8 scene export failed.' }
    foreach ($folder in 'Runtime','Editor','Tests') {
      $from = Join-Path $PSScriptRoot $folder
      foreach ($file in Get-ChildItem -LiteralPath $from -Recurse -File) {
        $relative = [IO.Path]::GetRelativePath($PSScriptRoot,$file.FullName)
        $dest = Join-Path $assets $relative
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($dest)) | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $dest
      }
    }
    $log = Join-Path $project 'e8-build.log'
    Process $Editor ('-batchmode -nographics -quit -projectPath "' + $project + '" -buildTarget Win64 -executeMethod E8Build.Run -e8-build "' + $exe + '" -logFile "' + $log + '"') $log $project 420 'E8_BUILD_PASS'
    Copy-Item -LiteralPath (Join-Path $bin 'unity-import.json') -Destination $out
    Write-Output 'Unity Windows Standalone build PASS'
  }
  if ($BuildOnly) { return }
  if (-not $PlayerOnly) {
    foreach ($mode in 'EditMode','PlayMode') {
      $log = Join-Path $project ("e8-" + $mode + ".log")
      $xml = Join-Path $out ($mode + '.xml')
      Process $Editor ('-batchmode -nographics -projectPath "' + $project + '" -runTests -testPlatform ' + $mode + ' -testFilter E8 -testResults "' + $xml + '" -logFile "' + $log + '"') $log $project 180 ''
      $tests = [xml](Get-Content -LiteralPath $xml -Raw)
      if ($tests.'test-run'.result -ne 'Passed' -or [int]$tests.'test-run'.passed -lt 1) { throw "Unity $mode verification failed." }
      Write-Output "$mode PASS $($tests.'test-run'.passed)"
    }
  }
  if ($TestsOnly) { return }
  $log = Join-Path $project 'e8-player.log'
  Process $exe ('-force-d3d11 -screen-fullscreen 0 -screen-width 704 -screen-height 472 -e8-proof "' + $out + '" -logFile "' + $log + '"') $log $bin 155 'E8_PLAYER_PASS' 'Normal'
  Write-Output 'Unity Windows Standalone runtime PASS'
} finally { Pop-Location }
