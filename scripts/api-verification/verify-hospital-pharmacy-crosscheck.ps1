# Cross-checks for 15000736 / 15000576 (run right after verify-hospital-pharmacy-opennow.ps1):
#  1) hpid-level diff between location-op "open now" results and list-op hours computed locally
#  2) dutyTel3 (emergency-room phone) non-empty share and equality with dutyTel1
#  3) QD (department) + QT=8 combinations for the paediatric / internal-medicine use case
param([string]$Lon = '126.9779692', [string]$Lat = '37.566535', [string]$Sido = '서울특별시')
. "$PSScriptRoot\common.ps1"
$key = Get-ApiKeyEncoded
$hosp = 'https://apis.data.go.kr/B552657/HsptlAsembySearchService'
$phar = 'https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService'

$now = Get-Date
$hhmm = [int]$now.ToString('HHmm')
$dayCode = [int]$now.DayOfWeek; if ($dayCode -eq 0) { $dayCode = 7 }
Write-Host ("now: {0} HHMM={1} day={2}" -f $now.ToString('yyyy-MM-dd HH:mm'), $hhmm, $dayCode)

function Test-OpenAt([string]$s, [string]$c, [int]$t) {
    if ($s -notmatch '^\d{4}$' -or $c -notmatch '^\d{4}$') { return $false }
    $si = [int]$s; $ci = [int]$c
    if ($ci -gt $si) { return ($t -ge $si -and $t -lt $ci) }
    return ($t -ge $si -or $t -lt ($ci % 2400))
}

function Get-ListRows([string]$listUrl, [string]$extra) {
    $rows = New-Object System.Collections.ArrayList
    $p = 1; $total = $null
    while ($true) {
        $x = [xml](Get-ApiText "$listUrl$extra&numOfRows=5000&pageNo=$p" -TimeoutSec 180)
        if ($null -eq $total) { $total = [int]$x.response.body.totalCount }
        $pi = Get-ItemArray $x.response.body.items.item
        if ($pi.Count -eq 0) { break }
        foreach ($i in $pi) { [void]$rows.Add($i) }
        if ($rows.Count -ge $total -or $p -ge 10) { break }
        $p++
    }
    return $rows
}

foreach ($tg in @(
        @{ Label = 'hospital'; Loc = "$hosp/getHsptlMdcncLcinfoInqire"; List = "$hosp/getHsptlMdcncListInfoInqire" },
        @{ Label = 'pharmacy'; Loc = "$phar/getParmacyLcinfoInqire"; List = "$phar/getParmacyListInfoInqire" })) {
    Write-Host ''
    Write-Host "===== $($tg.Label): location-op vs list-op hpid diff ====="
    $loc = Get-ItemArray ([xml](Get-ApiText "$($tg.Loc)?serviceKey=$key&WGS84_LON=$Lon&WGS84_LAT=$Lat&pageNo=1&numOfRows=1000")).response.body.items.item
    $locIds = @{}; foreach ($i in $loc) { $locIds[$i.hpid] = $i }
    $rows = Get-ListRows "$($tg.List)?serviceKey=$key&Q0=$(Enc $Sido)" ''
    $maxD = ($loc | ForEach-Object { [double]$_.distance } | Measure-Object -Maximum).Maximum
    $lat0 = [double]$Lat; $lon0 = [double]$Lon
    $listOpen = @{}
    foreach ($r in $rows) {
        if (-not $r.wgs84Lat) { continue }
        $dLat = ([double]$r.wgs84Lat - $lat0) * 111.0
        $dLon = ([double]$r.wgs84Lon - $lon0) * 111.0 * [Math]::Cos($lat0 * [Math]::PI / 180)
        if ([Math]::Sqrt($dLat * $dLat + $dLon * $dLon) -gt $maxD) { continue }
        if (Test-OpenAt $r."dutyTime${dayCode}s" $r."dutyTime${dayCode}c" $hhmm) { $listOpen[$r.hpid] = $r }
    }
    $onlyLoc = @($locIds.Keys | Where-Object { -not $listOpen.ContainsKey($_) })
    $onlyList = @($listOpen.Keys | Where-Object { -not $locIds.ContainsKey($_) })
    Write-Host ("location-op={0}, list-op open-now (Seoul, <= {1}km)={2}, both={3}" -f $locIds.Count, $maxD, $listOpen.Count, ($locIds.Count - $onlyLoc.Count))
    $onlyLocSeoul = @($onlyLoc | Where-Object { $locIds[$_].dutyAddr -like '서울*' })
    Write-Host ("only in location-op: {0} (of which Seoul address: {1})" -f $onlyLoc.Count, $onlyLocSeoul.Count)
    foreach ($id in ($onlyLoc | Select-Object -First 12)) {
        $i = $locIds[$id]
        $addr = $i.dutyAddr.Substring(0, [Math]::Min(14, $i.dutyAddr.Length))
        Write-Host ("  {0} | {1} | today {2}-{3} | {4}km" -f $i.dutyName, $addr, $i.startTime, $i.endTime, $i.distance)
    }
    Write-Host ("only in list-op (open by hours, but NOT returned by location-op): {0}" -f $onlyList.Count)
    foreach ($id in ($onlyList | Select-Object -First 12)) {
        $r = $listOpen[$id]
        Write-Host ("  {0} | day{1} {2}-{3}" -f $r.dutyName, $dayCode, $r."dutyTime${dayCode}s", $r."dutyTime${dayCode}c")
    }

    if ($tg.Label -eq 'hospital') {
        $tel3 = @($rows | Where-Object { $_.dutyTel3 }).Count
        $tel3diff = @($rows | Where-Object { $_.dutyTel3 -and $_.dutyTel3 -ne $_.dutyTel1 }).Count
        Write-Host ("dutyTel3 non-empty: {0}/{1} ({2}); differs from dutyTel1: {3}" -f $tel3, $rows.Count, (Pct $tel3 $rows.Count), $tel3diff)
    }
}

Write-Host ''
Write-Host "===== hospital: QD department x QT=8 (Seoul) ====="
$hl = "$hosp/getHsptlMdcncListInfoInqire?serviceKey=$key&Q0=$(Enc $Sido)"
foreach ($qd in @('D001', 'D002', 'D013', 'D022', 'D026')) {
    $xa = [xml](Get-ApiText "$hl&QD=$qd&numOfRows=5&pageNo=1")
    $xh = [xml](Get-ApiText "$hl&QD=$qd&QT=8&numOfRows=5&pageNo=1")
    $names = @(Get-ItemArray $xa.response.body.items.item | Select-Object -First 4 | ForEach-Object { $_.dutyName }) -join ' / '
    Write-Host ("  QD={0}: all={1} QT=8={2} | sample: {3}" -f $qd, $xa.response.body.totalCount, $xh.response.body.totalCount, $names)
}
