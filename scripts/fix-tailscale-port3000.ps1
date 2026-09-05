# =====================================================================
#  Fix: expose the WSL2 app (port 3000) via this machine's Tailscale IP
#  RUN AS ADMINISTRATOR in PowerShell on Windows:
#      powershell -ExecutionPolicy Bypass -File .\fix-tailscale-port3000.ps1
#  Re-run after every reboot / WSL restart (the WSL2 IP can change).
# =====================================================================

$listenIP   = '100.106.149.116'   # this machine's Tailscale IPv4 (tailscale ip -4)
$listenPort = 3000
$targetPort = 3000

# --- Discover the current WSL2 IPv4 (default distro) -------------------
$wslip = (wsl.exe hostname -I) 2>$null
if (-not $wslip) { Write-Host 'ERROR: cannot read WSL2 IP (wsl hostname -I failed).' -ForegroundColor Red; exit 1 }
$wslip = ($wslip.Trim() -split '\s+')[0]
Write-Host "WSL2 IP detected: $wslip"

# --- Remove any stale rule first ---------------------------------------
netsh interface portproxy delete v4tov4 listenaddress=$listenIP listenport=$listenPort | Out-Null

# --- Forward  Tailscale-IP:3000  ->  WSL2-IP:3000 ----------------------
netsh interface portproxy add v4tov4 listenaddress=$listenIP listenport=$listenPort connectaddress=$wslip connectport=$targetPort
if ($LASTEXITCODE -ne 0) { Write-Host 'portproxy add FAILED (need Administrator?).' -ForegroundColor Red; exit 1 }

# --- Allow inbound TCP 3000 through Windows Firewall -------------------
netsh advfirewall firewall delete rule name="WSL2 app 3000 via Tailscale" | Out-Null
netsh advfirewall firewall add rule name="WSL2 app 3000 via Tailscale" dir=in action=allow protocol=TCP localport=$listenPort profile=any

Write-Host ''
Write-Host '--- current portproxy rules ---'
netsh interface portproxy show v4tov4
Write-Host ''
Write-Host "DONE. On your phone (same Tailnet) open:  http://${listenIP}:${listenPort}" -ForegroundColor Green
Write-Host ''
Write-Host 'TIP: if the WSL2 IP changes after a reboot, run this script again.'
Write-Host 'TIP: to also allow LAN access, change $listenIP to 0.0.0.0 and re-run.'
