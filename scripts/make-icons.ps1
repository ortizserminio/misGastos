$ErrorActionPreference = 'Stop'
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$public = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\apps\web\public'))
if (-not (Test-Path -LiteralPath $edge)) { throw "Microsoft Edge no encontrado: $edge" }

$icons = @(
  @{ Source = 'icon-maskable.svg'; Output = 'apple-touch-icon.png'; Size = 180 },
  @{ Source = 'icon.svg'; Output = 'icon-192.png'; Size = 192 },
  @{ Source = 'icon.svg'; Output = 'icon-512.png'; Size = 512 },
  @{ Source = 'icon-maskable.svg'; Output = 'icon-maskable-512.png'; Size = 512 }
)

foreach ($icon in $icons) {
  $size = $icon.Size
  $svg = [IO.File]::ReadAllText((Join-Path $public $icon.Source))
  $svg = $svg -replace '<svg ', "<svg width=`"$size`" height=`"$size`" "
  $html = Join-Path $PSScriptRoot (".icon-$([guid]::NewGuid().ToString('N')).html")
  $profile = Join-Path $PSScriptRoot (".edge-icons-$([guid]::NewGuid().ToString('N'))")
  $output = Join-Path $public $icon.Output
  try {
    [IO.File]::WriteAllText($html, "<!doctype html><html><head><meta charset=`"utf-8`"><style>html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}</style></head><body>$svg</body></html>", [Text.UTF8Encoding]::new($false))
    Remove-Item -LiteralPath $output -ErrorAction SilentlyContinue
    & $edge --headless=new --disable-gpu --disable-software-rasterizer --no-sandbox --hide-scrollbars --force-device-scale-factor=1 "--user-data-dir=$profile" "--window-size=$size,$size" "--screenshot=$output" ([uri]::new($html).AbsoluteUri) 2>$null
    for ($attempt = 0; $attempt -lt 20 -and -not (Test-Path -LiteralPath $output); $attempt++) { Start-Sleep -Milliseconds 500 }
    if (-not (Test-Path -LiteralPath $output)) { throw "No se generó $output" }
  } finally {
    Remove-Item -LiteralPath $html -ErrorAction SilentlyContinue
    if (([IO.Path]::GetFullPath($profile)).StartsWith(([IO.Path]::GetFullPath($PSScriptRoot) + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}
