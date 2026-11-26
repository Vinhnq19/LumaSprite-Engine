param([string]$Editor = 'D:/Unity/Unity Hub/6000.3.21f1/Editor/Unity.exe')

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Push-Location $repo
try {
  $project = [IO.Path]::GetFullPath('.cache/e62-unity')
  $out = [IO.Path]::GetFullPath('benchmarks/results/run/e62/unity-import.json')
  $inputRoot = Join-Path $project 'Assets/E62Input'
  $editorScripts = Join-Path $project 'Assets/Editor'
  New-Item -ItemType Directory -Force $inputRoot,$editorScripts,(Join-Path $project 'Packages'),(Join-Path $project 'ProjectSettings'),(Split-Path $out) | Out-Null
  [IO.File]::WriteAllText((Join-Path $project 'ProjectSettings/ProjectVersion.txt'), "m_EditorVersion: 6000.3.21f1`nm_EditorVersionWithRevision: 6000.3.21f1 (c02631ffc030)`n")
  [IO.File]::WriteAllText((Join-Path $project 'Packages/manifest.json'), '{"dependencies":{"com.unity.modules.imageconversion":"1.0.0","com.unity.modules.jsonserialize":"1.0.0"}}')
  $importer = (Get-Content -Raw 'scripts/e54-unity/E54Build.cs').Replace('static Texture2D Texture(', 'internal static Texture2D Texture(')
  [IO.File]::WriteAllText((Join-Path $editorScripts 'E54Build.cs'),$importer)
  Copy-Item -LiteralPath 'scripts/e54-unity/E54Playback.cs' -Destination (Join-Path $project 'Assets')
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'E62ImportSmoke.cs') -Destination $editorScripts
  $studio = Get-Content -Raw 'benchmarks/results/e62/studio-parity.json' | ConvertFrom-Json
  $cases = @($studio.cases | ForEach-Object {
    $bundle = Split-Path (Split-Path $_.path) -Leaf
    $file = Split-Path $_.path -Leaf
    $localName = "$bundle-$file"
    Copy-Item -LiteralPath $_.path -Destination (Join-Path $inputRoot $localName)
    @{ file = $localName; width = $_.width; height = $_.height; rgbaSha256 = $_.rgbaSha256; transparent = ($file -ne 'scene.png') }
  })
  [IO.File]::WriteAllText((Join-Path $inputRoot 'cases.json'), (@{cases=$cases} | ConvertTo-Json -Depth 5))
  $log = Join-Path $project 'e62-editor.log'
  & unity --non-interactive run $project --editor-path $Editor --timeout 160 --log-file $log --no-tail -- -nographics -buildTarget Win64 -executeMethod E62ImportSmoke.Run -e62-proof $out
  if ($LASTEXITCODE -ne 0 -or -not (Select-String -LiteralPath $log -Pattern 'E62_IMPORT_PASS' -Quiet)) {
    if (Test-Path -LiteralPath $log) { Get-Content -LiteralPath $log -Tail 45 }
    throw "Unity Editor import smoke exited $LASTEXITCODE."
  }
  Get-Content -LiteralPath $out
} finally {
  Pop-Location
}
