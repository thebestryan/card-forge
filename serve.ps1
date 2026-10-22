# Minimal static file server for Windows machines without Node or Python.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 [-Port 9090]
param([int]$Port = 9090)

$root = $PSScriptRoot
$url = "http://localhost:$Port/"

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
try {
  $listener.Start()
} catch {
  Write-Host "Error: could not start server on port $Port ($($_.Exception.Message))"
  exit 1
}

Write-Host "Serving $root at $url"
Write-Host 'Press Ctrl+C to stop'
Start-Process $url

try {
  while ($listener.IsListening) {
    # Poll instead of blocking in GetContext() so Ctrl+C can interrupt
    $pending = $listener.GetContextAsync()
    while (-not $pending.AsyncWaitHandle.WaitOne(250)) { }
    $context = $pending.GetAwaiter().GetResult()
    $request = $context.Request
    $response = $context.Response
    $response.StatusCode = 404

    try {
      $relative = [Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
      $path = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relative))
      if (Test-Path -LiteralPath $path -PathType Container) { $path = Join-Path $path 'index.html' }

      # Only serve files inside the app folder
      $inRoot = $path.StartsWith($root.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)
      if ($inRoot -and (Test-Path -LiteralPath $path -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($path)
        $type = $mimeTypes[[IO.Path]::GetExtension($path).ToLowerInvariant()]
        if (-not $type) { $type = 'application/octet-stream' }
        $response.StatusCode = 200
        $response.ContentType = $type
        $response.AddHeader('Cache-Control', 'no-cache')
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
      }
    } catch {
      # Malformed path or client disconnected mid-response; keep serving
    }
    try { $response.Close() } catch { }
  }
} finally {
  $listener.Stop()
}
