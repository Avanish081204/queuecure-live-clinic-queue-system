$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "d:\ECS VI\MINI project\Queue Cure '26\backend"
Write-Host "Node version: $(node --version)"
Write-Host "npm version: $(npm --version)"
npm install
Write-Host "Installation complete!"
