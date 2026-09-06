# =====================================================================
#  Fix: expose BOTH the WSL2 app ports 3000 (web production) and 3001
#       (dev server) via this machine's Tailscale IP.
#  RUN AS ADMINISTRATOR in PowerShell on Windows:
#      powershell -ExecutionPolicy Bypass -File .\fix-tailscale-ports.ps1
#  Re-run after every reboot / WSL restart (the WSL2 IP can change).
#
#  Difference vs fix-tailscale-port3000.ps1: this forwards 3001 too, so
#  your phone can open http://<tailscale-ip>:3001 (dev server).
# =====================================================================

$listenIP   = '100.106.149.116'   # this machine's Tailscale IPv4 (tailscale ip -4)
$ports      = @(3000, 3001)       # app ports to expose

# --- Discover the current WSL2 IPv4 (default distro) -------------------
$wslip = (wsl.exe hostname -I) 2>$null
if (-not $wslip) { Write-Host 'ERROR: cannot read WSL2 IP (wsl hostname -I failed).' -ForegroundColor Red; exit 1 }
$wslip = ($wslip.Trim() -split '\s+')[0]
Write-Host "WSL2 IP detected: $wslip"

foreach ($p in $ports) {
    # --- Remove any stale rule first -----------------------------------
    netsh interface portproxy delete v4tov4 listenaddress=$listenIP listenport=$p | Out-Null

    # --- Forward  Tailscale-IP:$p  ->  WSL2-IP:$p -----------------------
    netsh interface portproxy add v4tov4 listenaddress=$listenIP listenport=$p connectaddress=$wslip connectport=$p
    if ($LASTEXITCODE -ne 0) { Write-Host "portproxy add for port $p FAILED (need Administrator?)." -ForegroundColor Red; exit 1 }

    # --- Allow inbound TCP $p through Windows Firewall ------------------
    netsh advfirewall firewall delete rule name="WSL2 app $p via Tailscale" | Out-Null
    netsh advfirewall firewall add rule name="WSL2 app $p via Tailscale" dir=in action=allow protocol=TCP localport=$p profile=any
}

Write-Host ''
Write-Host '--- current portproxy rules ---'
netsh interface portproxy show v4tov4
Write-Host ''
Write-Host "DONE. On your phone (same Tailnet) open:" -ForegroundColor Green
foreach ($p in $ports) {
    Write-Host "      http://${listenIP}:${p}" -ForegroundColor Green
}
Write-Host ''
Write-Host 'TIP: if the WSL2 IP changes after a reboot, run this script again.'
Write-Host 'TIP: to also allow LAN access, change $listenIP to 0.0.0.0 and re-run.'
