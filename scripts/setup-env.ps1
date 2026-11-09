# Wrapper chạy script sinh .env trên Windows PowerShell
param(
  [string]$Domain = "localhost",
  [string]$ApiKey = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$nodeScript = Join-Path $scriptDir "setup-env.js"

node $nodeScript $Domain $ApiKey

