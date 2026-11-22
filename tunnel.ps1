$ErrorActionPreference = 'Continue'
$tunnelUrl = ''
npx.cmd --yes cloudflared tunnel --protocol http2 --url http://127.0.0.1:3005 2>&1 | ForEach-Object {
  $line = "$_"
  if ($line -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
    $tunnelUrl = $Matches[1]
    try { Set-Clipboard -Value $tunnelUrl } catch {}
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  [준비 완료!] 아래 주소를 친구에게 보내세요:" -ForegroundColor Yellow
    Write-Host "  $tunnelUrl" -ForegroundColor Cyan
    Write-Host "  (자동으로 복사되었습니다! 카톡에 Ctrl+V 하세요)" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
  } elseif ($line -match 'precheck complete') {
    if ($tunnelUrl) {
      Write-Host ">>> 친구 공유 주소: $tunnelUrl <<<" -ForegroundColor Cyan
    }
  } elseif ($line -match '\bERR\b') {
    Write-Host $line -ForegroundColor Red
  }
}
