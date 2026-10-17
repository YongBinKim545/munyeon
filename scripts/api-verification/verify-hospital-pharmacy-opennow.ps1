# Tests whether the location operations of 15000736 / 15000576 filter to "open right now":
#  - pulls ALL rows of the location search around a point
#  - checks each row's startTime/endTime (today's hours) against the current clock
#  - compares with list-op rows (full Seoul pull) whose hours for today's day code cover now
# Run at different times of day (e.g. 14:00 / 23:00 / 03:00) to see the filter move.
param(
    [string]$Lon = '126.9779692', [string]$Lat = '37.566535',
    [string]$Sido = '서울특별시'
)
. "$PSScriptRoot\common.ps1"
$key = Get-ApiKeyEncoded
$hosp = 'https://apis.data.go.kr/B552657/HsptlAsembySearchService'
$phar = 'https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService'

$now = Get-Date
$hhmm = [int]$now.ToString('HHmm')
# API day codes: 1=Mon .. 7=Sun (8=holiday). .NET DayOfWeek: Sunday=0.
$dayCode = [int]$now.DayOfWeek; if ($dayCode -eq 0) { $dayCode = 7 }
Write-Host ("now: {0} -> HHMM={1}, day code={2}" -f $now.ToString('yyyy-MM-dd HH:mm ddd'), $hhmm, $dayCode)

function Test-OpenAt([string]$s, [string]$c, [int]$t) {
    if ($s -notmatch '^\d{4}$' -or $c -notmatch '^\d{4}$') { return $null }
    $si = [int]$s; $ci = [int]$c
    if ($ci -gt $si) { return ($t -ge $si -and $t -lt $ci) }
    return ($t -ge $si -or $t -lt ($ci % 2400))   # overnight / 24h
}

foreach ($tg in @(
        @{ Label = 'hospital'; Loc = "$hosp/getHsptlMdcncLcinfoInqire"; List = "$hosp/getHsptlMdcncListInfoInqire" },
        @{ Label = 'pharmacy'; Loc = "$phar/getParmacyLcinfoInqire"; List = "$phar/getParmacyListInfoInqire" })) {
    Write-Host ''
    Write-Host "===== $($tg.Label) location search: open-now filter test ====="
    $t = Get-ApiText "$($tg.Loc)?serviceKey=$key&WGS84_LON=$Lon&WGS84_LAT=$Lat&pageNo=1&numOfRows=1000"
    $x = [xml]$t
    $items = Get-ItemArray $x.response.body.items.item
    $open = 0; $closed = 0; $unk = 0
    $dists = @()
    foreach ($i in $items) {
        $r = Test-OpenAt $i.startTime $i.endTime $hhmm
        if ($null -eq $r) { $unk++ } elseif ($r) { $open++ } else { $closed++ }
        $dists += [double]$i.distance
    }
    $maxD = ($dists | Measure-Object -Maximum).Maximum
    Write-Host ("totalCount={0} fetched={1} cnt(field)={2} maxDistance={3}km" -f $x.response.body.totalCount, $items.Count, $items[0].cnt, $maxD)
    Write-Host ("by today's startTime/endTime vs now: open={0} closed={1} unparsable={2}" -f $open, $closed, $unk)
    $ends = $items | Group-Object endTime | Sort-Object Count -Descending | Select-Object -First 6
    Write-Host ("endTime distribution: " + (@($ends | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '))

    # Cross-check against the list op: Seoul rows open now (today's day code) within maxDistance
    $rows = New-Object System.Collections.ArrayList
    $p = 1; $total = $null
    while ($true) {
        $tl = Get-ApiText "$($tg.List)?serviceKey=$key&Q0=$(Enc $Sido)&numOfRows=5000&pageNo=$p" -TimeoutSec 180
        $xl = [xml]$tl
        if ($null -eq $total) { $total = [int]$xl.response.body.totalCount }
        $pi = Get-ItemArray $xl.response.body.items.item
        if ($pi.Count -eq 0) { break }
        foreach ($i in $pi) { [void]$rows.Add($i) }
        if ($rows.Count -ge $total -or $p -ge 10) { break }
        $p++
    }
    $lat0 = [double]$Lat; $lon0 = [double]$Lon
    $inRadius = 0; $openInRadius = 0
    foreach ($r in $rows) {
        if (-not $r.wgs84Lat) { continue }
        $dLat = ([double]$r.wgs84Lat - $lat0) * 111.0
        $dLon = ([double]$r.wgs84Lon - $lon0) * 111.0 * [Math]::Cos($lat0 * [Math]::PI / 180)
        $d = [Math]::Sqrt($dLat * $dLat + $dLon * $dLon)
        if ($d -le $maxD) {
            $inRadius++
            $s = $r."dutyTime${dayCode}s"; $c = $r."dutyTime${dayCode}c"
            if (Test-OpenAt $s $c $hhmm) { $openInRadius++ }
        }
    }
    Write-Host ("list-op cross-check: Seoul rows within {0}km={1}; open now by dutyTime{2}s/c={3} (location op returned {4})" -f $maxD, $inRadius, $dayCode, $openInRadius, $x.response.body.totalCount)
}
