# Deep verification for datasets 15000736 (병·의원) and 15000576 (약국), Seoul full pull:
#  1) union of response fields across ALL rows (empty fields are omitted per item in XML)
#  2) fill rates of dutyTime1s..8s / 1c..8c / dutyTel1 / dutyTel3 over every Seoul row
#  3) value-format anomalies of dutyTime (non-HHMM, close > 2400, close <= open, 24h)
#  4) QT filter consistency: rows returned with QT=7/8 vs rows that actually carry dutyTime7s/8s
#  5) nationwide totalCount without QT vs QT=8
param([string]$Sido = '서울특별시', [int]$PageSize = 5000)
. "$PSScriptRoot\common.ps1"
$key = Get-ApiKeyEncoded

$targets = @(
    @{ Label = 'hospital'; Url = 'https://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire' },
    @{ Label = 'pharmacy'; Url = 'https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire' }
)

function ConvertTo-RowHash($node) {
    $h = @{}
    foreach ($c in $node.ChildNodes) { $h[$c.Name] = $c.InnerText }
    return $h
}

function Get-AllRows([string]$baseUrl, [string]$extra) {
    $rows = New-Object System.Collections.ArrayList
    $p = 1; $total = $null
    while ($true) {
        $t = Get-ApiText "$baseUrl$extra&numOfRows=$PageSize&pageNo=$p" -TimeoutSec 180
        if (-not (Assert-NoPortalError $t 'deep')) { throw 'portal error' }
        $x = [xml]$t
        if ($null -eq $total) { $total = [int]$x.response.body.totalCount }
        $items = Get-ItemArray $x.response.body.items.item
        if ($items.Count -eq 0) { break }
        foreach ($i in $items) { [void]$rows.Add((ConvertTo-RowHash $i)) }
        if ($rows.Count -ge $total) { break }
        $p++
        if ($p -gt 40) { break }
    }
    return @{ Total = $total; Rows = $rows; Pages = $p }
}

$sidoEnc = Enc $Sido
foreach ($tg in $targets) {
    $label = $tg.Label
    $base = "$($tg.Url)?serviceKey=$key&Q0=$sidoEnc"
    Write-Host ''
    Write-Host "===== $label : full pull of $Sido ====="
    $all = Get-AllRows $base ''
    $rows = $all.Rows
    Write-Host ("totalCount={0} collected={1} pages={2}" -f $all.Total, $rows.Count, $all.Pages)

    $fieldCount = @{}
    foreach ($r in $rows) { foreach ($k in $r.Keys) { $fieldCount[$k] = 1 + [int]$fieldCount[$k] } }
    Write-Host ("union of fields ({0}):" -f $fieldCount.Count)
    $fieldCount.GetEnumerator() | Sort-Object Name | ForEach-Object {
        Write-Host ("  {0}: {1}/{2} ({3})" -f $_.Name, $_.Value, $rows.Count, (Pct $_.Value $rows.Count))
    }

    # Opening-hour value checks per day code 1..8
    Write-Host 'dutyTime value checks (per day code):'
    $hhmm = '^\d{4}$'
    for ($d = 1; $d -le 8; $d++) {
        $sK = "dutyTime${d}s"; $cK = "dutyTime${d}c"
        $both = 0; $onlyOne = 0; $badFmt = 0; $over24 = 0; $closeLeOpen = 0; $full24 = 0
        foreach ($r in $rows) {
            $s = $r[$sK]; $c = $r[$cK]
            if ($s -and $c) {
                $both++
                if ($s -notmatch $hhmm -or $c -notmatch $hhmm) { $badFmt++; continue }
                $si = [int]$s; $ci = [int]$c
                if ($ci -gt 2400) { $over24++ }
                if ($ci -le $si) { $closeLeOpen++ }
                if ($si -eq 0 -and $ci -ge 2359) { $full24++ }
            } elseif ($s -or $c) { $onlyOne++ }
        }
        Write-Host ("  day{0}: open+close={1} ({2}) onlyOne={3} badFormat={4} close>2400={5} close<=open={6} 24h(0000-2359/2400)={7}" -f $d, $both, (Pct $both $rows.Count), $onlyOne, $badFmt, $over24, $closeLeOpen, $full24)
    }

    # Night-open coverage: rows open on weekday after 22:00 (any of days 1..5)
    $late = 0
    foreach ($r in $rows) {
        $hit = $false
        for ($d = 1; $d -le 5; $d++) {
            $s = $r["dutyTime${d}s"]; $c = $r["dutyTime${d}c"]
            if (($s -match $hhmm) -and ($c -match $hhmm)) {
                $ci = [int]$c; $si = [int]$s
                if ($ci -ge 2200) { $hit = $true }
                elseif ($ci -lt $si) { $hit = $true }
            }
        }
        if ($hit) { $late++ }
    }
    Write-Host ("rows closing at/after 22:00 on some weekday: {0} ({1})" -f $late, (Pct $late $rows.Count))

    # Phone format
    $telOk = @($rows | Where-Object { $_['dutyTel1'] -match '^\d{2,4}-\d{3,4}-\d{4}$' }).Count
    Write-Host ("dutyTel1 matches NN(N)-NNN(N)-NNNN: {0}/{1} ({2})" -f $telOk, $rows.Count, (Pct $telOk $rows.Count))
    $telBad = @($rows | Where-Object { $_['dutyTel1'] -and $_['dutyTel1'] -notmatch '^\d{2,4}-\d{3,4}-\d{4}$' } | Select-Object -First 5 | ForEach-Object { $_['dutyTel1'] })
    if ($telBad.Count) { Write-Host ("  examples of other formats: " + ($telBad -join ' / ')) }

    # QT filter consistency for 7 (Sun) and 8 (holiday)
    $allIds = @{}
    foreach ($r in $rows) { $allIds[$r['hpid']] = $r }
    foreach ($qt in @(7, 8)) {
        $res = Get-AllRows $base "&QT=$qt"
        $qRows = $res.Rows
        $withField = @($qRows | Where-Object { $_["dutyTime${qt}s"] }).Count
        $fullWithField = @($rows | Where-Object { $_["dutyTime${qt}s"] }).Count
        $qIds = @{}; foreach ($q in $qRows) { $qIds[$q['hpid']] = 1 }
        $missedByFilter = @($rows | Where-Object { $_["dutyTime${qt}s"] -and -not $qIds.ContainsKey($_['hpid']) }).Count
        Write-Host ("QT=${qt}: filter totalCount={0} collected={1}; of those carrying dutyTime${qt}s={2} ({3}); full-set rows carrying dutyTime${qt}s={4}; carrying but NOT returned by filter={5}" -f $res.Total, $qRows.Count, $withField, (Pct $withField $qRows.Count), $fullWithField, $missedByFilter)
        if ($qt -eq 8) {
            $sample = @($qRows | Select-Object -First 5 | ForEach-Object { '{0} [{1}] 8s={2} 8c={3}' -f $_['dutyName'], $_['dutyDivNam'], $_['dutyTime8s'], $_['dutyTime8c'] })
            Write-Host ("  QT=8 sample: " + ($sample -join ' | '))
            if ($label -eq 'hospital') {
                $byDiv = $qRows | Group-Object { $_['dutyDivNam'] } | Sort-Object Count -Descending | Select-Object -First 8
                Write-Host ("  QT=8 by dutyDivNam: " + (@($byDiv | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '))
                $byDivAll = $rows | Group-Object { $_['dutyDivNam'] } | Sort-Object Count -Descending | Select-Object -First 8
                Write-Host ("  all rows by dutyDivNam: " + (@($byDivAll | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '))
            }
        }
    }

    # Order bias check: share of dutyTime8s in first 200 rows (default order) vs all rows
    $first200 = @($rows | Select-Object -First 200 | Where-Object { $_['dutyTime8s'] }).Count
    Write-Host ("dutyTime8s share: first 200 rows (default order)={0} vs all={1}" -f (Pct $first200 200), (Pct (@($rows | Where-Object { $_['dutyTime8s'] }).Count) $rows.Count))

    # Nationwide counts
    $natAll = ([xml](Get-ApiText "$($tg.Url)?serviceKey=$key&numOfRows=1&pageNo=1")).response.body.totalCount
    $natHol = ([xml](Get-ApiText "$($tg.Url)?serviceKey=$key&QT=8&numOfRows=1&pageNo=1")).response.body.totalCount
    $natSun = ([xml](Get-ApiText "$($tg.Url)?serviceKey=$key&QT=7&numOfRows=1&pageNo=1")).response.body.totalCount
    Write-Host ("nationwide totalCount: all={0} / QT=7(Sun)={1} / QT=8(holiday)={2}" -f $natAll, $natSun, $natHol)

    $summary = @($rows | Select-Object -First 30 | ForEach-Object { ($_.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join '; ' })
    Save-Out "$label-seoul-first30.txt" ($summary -join "`r`n")
}
