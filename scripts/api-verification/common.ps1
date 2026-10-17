# Common helpers for data.go.kr API verification scripts.
# Requires: $env:DATA_GO_KR_KEY = decoding key (일반 인증키). The key is read from
# the environment only and must never be written to files, logs, or reports.

$sp = [Net.ServicePointManager]::SecurityProtocol
[Net.ServicePointManager]::SecurityProtocol = $sp -bor [Net.SecurityProtocolType]::Tls12
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

function Get-ApiKeyEncoded {
    if (-not $env:DATA_GO_KR_KEY) {
        throw "DATA_GO_KR_KEY environment variable is not set. Set it to your data.go.kr decoding key."
    }
    return [uri]::EscapeDataString($env:DATA_GO_KR_KEY)
}

function Enc([string]$s) { return [uri]::EscapeDataString($s) }

# GET a URL and return the body decoded as UTF-8 text (Invoke-WebRequest in PS 5.1
# can mis-decode Korean when the charset header is missing, so decode bytes ourselves).
function Get-ApiText {
    param([string]$Url, [int]$Retries = 2, [int]$TimeoutSec = 90)
    for ($i = 0; $i -le $Retries; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
            $bytes = $resp.RawContentStream.ToArray()
            return [Text.Encoding]::UTF8.GetString($bytes)
        } catch {
            if ($i -eq $Retries) { throw }
            Start-Sleep -Seconds (2 * ($i + 1))
        }
    }
}

# Detect the portal's gateway-level error envelope (wrong key, quota exceeded, ...).
function Assert-NoPortalError {
    param([string]$Text, [string]$Label)
    if ($Text -match 'OpenAPI_ServiceResponse|returnReasonCode|SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ERROR') {
        Write-Host "[$Label] PORTAL ERROR RESPONSE:"
        $len = [Math]::Min(800, $Text.Length)
        Write-Host $Text.Substring(0, $len)
        return $false
    }
    return $true
}

# Save evidence files (raw API samples, derived lists) under scripts\out\.
function Save-Out {
    param([string]$Name, [string]$Content)
    $dir = Join-Path $PSScriptRoot 'out'
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    $path = Join-Path $dir $Name
    $Content | Out-File -FilePath $path -Encoding utf8
    Write-Host "  saved: $path"
}

# Normalize a JSON/XML "item" node into an array (single item comes back as one object).
function Get-ItemArray($node) {
    if ($null -eq $node) { return @() }
    if ($node -is [System.Array]) { return $node }
    return @($node)
}

function Pct([int]$part, [int]$whole) {
    if ($whole -eq 0) { return 'n/a' }
    return ('{0:N1}%' -f (100.0 * $part / $whole))
}

function Get-Percentile([double[]]$values, [double]$p) {
    if ($values.Count -eq 0) { return $null }
    $sorted = $values | Sort-Object
    $idx = [int][Math]::Floor(($sorted.Count - 1) * $p)
    return $sorted[$idx]
}
