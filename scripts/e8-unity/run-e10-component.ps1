param(
  [string]$Editor = 'D:/Unity/Unity Hub/6000.3.21f1/Editor/Unity.exe',
  [string]$Proof
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (!$Proof) {
  $Proof = (Get-Content -LiteralPath (Join-Path $repo '.cache/e10-v1/workflow/latest.txt') -Raw).Trim()
}
$Proof = (Resolve-Path -LiteralPath $Proof).Path
$project = (Resolve-Path -LiteralPath (Join-Path $repo '.cache/e8-runtime-acceptance')).Path
$probe = Join-Path $project 'Assets/Editor/E10ComponentSmoke.cs'
$probeMeta = "$probe.meta"
if ((Test-Path -LiteralPath $probe) -or (Test-Path -LiteralPath $probeMeta)) { throw 'A Unity probe is already staged.' }
$log = Join-Path $Proof 'unity-component.log'
[IO.File]::Copy((Join-Path $PSScriptRoot 'E10ComponentSmoke.cs'), $probe, $false)
try {
  $arguments = '-batchmode -nographics -quit -buildTarget Win64 -projectPath "' + $project +
    '" -executeMethod E10ComponentSmoke.Run -e10-proof "' + $Proof + '" -logFile "' + $log + '"'
  $job = Start-Process -FilePath $Editor -WorkingDirectory $project -ArgumentList $arguments -WindowStyle Hidden -PassThru
  if (!$job.WaitForExit(240000)) { Stop-Process -Id $job.Id; throw 'Unity component import timed out.' }
  if ($job.ExitCode -ne 0 -or !(Select-String -LiteralPath $log -Pattern 'E10_COMPONENT_UNITY_PASS' -Quiet)) {
    if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 45 }
    throw 'Unity component import failed.'
  }
  Select-String -LiteralPath $log -Pattern 'E10_COMPONENT_UNITY_PASS' | ForEach-Object { $_.Line }
} finally {
  Remove-Item -LiteralPath $probe -Force
  if (Test-Path -LiteralPath $probeMeta) { Remove-Item -LiteralPath $probeMeta -Force }
}
