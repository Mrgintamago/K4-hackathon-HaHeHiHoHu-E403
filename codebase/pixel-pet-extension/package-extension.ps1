$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$destination = Join-Path (Split-Path -Parent $source) 'pixel-pet-extension.zip'
if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
Compress-Archive -Path (Join-Path $source '*') -DestinationPath $destination -CompressionLevel Optimal
Write-Host "Created $destination"
