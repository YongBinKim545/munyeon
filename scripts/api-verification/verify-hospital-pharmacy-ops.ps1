# Probes the non-list operations of 15000736 (병·의원) and 15000576 (약국):
#  - location search (WGS84 coords -> nearby, does it expose today's open/close?)
#  - basic info by HPID (extra fields vs list)
#  - FullData download (nationwide totalCount, page size limit, fields)
#  - 달빛어린이병원 list/location
param([string]$Lon = '126.9779692', [string]$Lat = '37.566535')
. "$PSScriptRoot\common.ps1"
$key = Get-ApiKeyEncoded
$hosp = 'https://apis.data.go.kr/B552657/HsptlAsembySearchService'
$phar = 'https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService'

function Invoke-Probe([string]$label, [string]$url, [int]$show = 3) {
    Write-Host ''
    Write-Host "----- $label -----"
    try { $t = Get-ApiText $url -TimeoutSec 180 } catch { Write-Host "  HTTP ERROR: $($_.Exception.Message)"; return $null }
    if (-not (Assert-NoPortalError $t $label)) { return $null }
    try { $x = [xml]$t } catch { Write-Host "  NOT XML: $($t.Substring(0, [Math]::Min(300, $t.Length)))"; return $null }
    Write-Host ("  resultCode={0} msg={1} totalCount={2}" -f $x.response.header.resultCode, $x.response.header.resultMsg, $x.response.body.totalCount)
    $items = Get-ItemArray $x.response.body.items.item
    $union = @{}
    foreach ($i in $items) { foreach ($c in $i.ChildNodes) { if ($c.InnerText) { $union[$c.Name] = 1 + [int]$union[$c.Name] } } }
    Write-Host ("  items={0} union of non-empty fields ({1}): {2}" -f $items.Count, $union.Count, (($union.Keys | Sort-Object) -join ', '))
    foreach ($i in ($items | Select-Object -First $show)) {
        $kv = @($i.ChildNodes | Where-Object { $_.InnerText } | ForEach-Object { '{0}={1}' -f $_.Name, ($_.InnerText -replace '\s+', ' ').Substring(0, [Math]::Min(60, $_.InnerText.Length)) })
        Write-Host ('    ' + ($kv -join '; '))
    }
    return $items
}

$now = Get-Date
Write-Host ("probe time: {0} ({1})" -f $now.ToString('yyyy-MM-dd HH:mm'), $now.DayOfWeek)

# Location search (near Seoul City Hall)
$hl = Invoke-Probe 'hospital location (getHsptlMdcncLcinfoInqire)' "$hosp/getHsptlMdcncLcinfoInqire?serviceKey=$key&WGS84_LON=$Lon&WGS84_LAT=$Lat&pageNo=1&numOfRows=20"
$pl = Invoke-Probe 'pharmacy location (getParmacyLcinfoInqire)' "$phar/getParmacyLcinfoInqire?serviceKey=$key&WGS84_LON=$Lon&WGS84_LAT=$Lat&pageNo=1&numOfRows=20"

# Basic info for the first hit of each location search
if ($hl) { [void](Invoke-Probe 'hospital basic info (getHsptlBassInfoInqire)' "$hosp/getHsptlBassInfoInqire?serviceKey=$key&HPID=$($hl[0].hpid)" 1) }
if ($pl) { [void](Invoke-Probe 'pharmacy basic info (getParmacyBassInfoInqire)' "$phar/getParmacyBassInfoInqire?serviceKey=$key&HPID=$($pl[0].hpid)" 1) }

# FullData download: nationwide counts and the max page size honoured
$hf = Invoke-Probe 'hospital FullData (getHsptlMdcncFullDown) numOfRows=10' "$hosp/getHsptlMdcncFullDown?serviceKey=$key&pageNo=1&numOfRows=10" 1
$pf = Invoke-Probe 'pharmacy FullData (getParmacyFullDown) numOfRows=10' "$phar/getParmacyFullDown?serviceKey=$key&pageNo=1&numOfRows=10" 1
foreach ($pair in @(@('hospital', "$hosp/getHsptlMdcncFullDown"), @('pharmacy', "$phar/getParmacyFullDown"))) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
        $t = Get-ApiText "$($pair[1])?serviceKey=$key&pageNo=1&numOfRows=10000" -TimeoutSec 300
        $sw.Stop()
        $x = [xml]$t
        $n = @(Get-ItemArray $x.response.body.items.item).Count
        Write-Host ("  {0} FullData numOfRows=10000 -> returned {1} rows, {2:N1} MB, {3:N1}s" -f $pair[0], $n, ($t.Length / 1MB), $sw.Elapsed.TotalSeconds)
    } catch { Write-Host "  $($pair[0]) FullData large page failed: $($_.Exception.Message)" }
}

# 달빛어린이병원
[void](Invoke-Probe 'moonlight pediatric list (getBabyListInfoInqire)' "$hosp/getBabyListInfoInqire?serviceKey=$key&pageNo=1&numOfRows=200" 3)
[void](Invoke-Probe 'moonlight pediatric location (getBabyLcinfoInqire)' "$hosp/getBabyLcinfoInqire?serviceKey=$key&WGS84_LON=$Lon&WGS84_LAT=$Lat&pageNo=1&numOfRows=10" 3)
