# Measures how precise the QD=D002 (소아청소년과) filter of 15000736 is for the
# "sick child at night/holiday" persona: QD matches ANY registered department, so check
# how many results look like paediatric-led institutions by name, and how many of those
# are reachable on holidays (QT=8) or late weekday evenings.
param([string]$Sido = '서울특별시')
. "$PSScriptRoot\common.ps1"
$key = Get-ApiKeyEncoded
$hl = "https://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire?serviceKey=$key&Q0=$(Enc $Sido)"
$pedPattern = '소아|아동|어린이|아이|키즈|베이비|우리아이'

function Get-Rows([string]$extra) {
    $x = [xml](Get-ApiText "$hl$extra&numOfRows=5000&pageNo=1" -TimeoutSec 180)
    return @{ Total = [int]$x.response.body.totalCount; Rows = @(Get-ItemArray $x.response.body.items.item) }
}

$d2 = Get-Rows '&QD=D002'
$d2h = Get-Rows '&QD=D002&QT=8'
$ped = @($d2.Rows | Where-Object { $_.dutyName -match $pedPattern })
$pedH = @($d2h.Rows | Where-Object { $_.dutyName -match $pedPattern })
$late = @($ped | Where-Object {
        $r = $_; $hit = $false
        for ($d = 1; $d -le 5; $d++) { $c = $r."dutyTime${d}c"; if ($c -match '^\d{4}$' -and [int]$c -ge 2100) { $hit = $true } }
        $hit })
Write-Host ("QD=D002 ({0}): total={1}, name looks paediatric={2} ({3})" -f $Sido, $d2.Total, $ped.Count, (Pct $ped.Count $d2.Rows.Count))
Write-Host ("QD=D002 & QT=8: total={0}, name looks paediatric={1} ({2})" -f $d2h.Total, $pedH.Count, (Pct $pedH.Count $d2h.Rows.Count))
Write-Host ("paediatric-named rows closing >= 21:00 on some weekday: {0}" -f $late.Count)
$byDiv = $d2.Rows | Group-Object dutyDivNam | Sort-Object Count -Descending | Select-Object -First 6
Write-Host ("QD=D002 by dutyDivNam: " + (@($byDiv | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ', '))
Write-Host ("sample non-paediatric names in QD=D002: " + ((@($d2.Rows | Where-Object { $_.dutyName -notmatch $pedPattern } | Select-Object -First 6 | ForEach-Object { $_.dutyName })) -join ' / '))

# Code-mapping check: paediatric-named institutions across ALL of Seoul vs. those inside QD=D002.
$allRows = New-Object System.Collections.ArrayList
for ($p = 1; $p -le 10; $p++) {
    $x = [xml](Get-ApiText "$hl&numOfRows=5000&pageNo=$p" -TimeoutSec 180)
    $pi = Get-ItemArray $x.response.body.items.item
    if ($pi.Count -eq 0) { break }
    foreach ($i in $pi) { [void]$allRows.Add($i) }
    if ($allRows.Count -ge [int]$x.response.body.totalCount) { break }
}
$d2Ids = @{}; foreach ($r in $d2.Rows) { $d2Ids[$r.hpid] = 1 }
$pedAll = @($allRows | Where-Object { $_.dutyName -match '소아청소년과|소아과' })
$pedIn = @($pedAll | Where-Object { $d2Ids.ContainsKey($_.hpid) }).Count
Write-Host ("names containing 소아청소년과/소아과 in all Seoul: {0}; inside QD=D002: {1} ({2})" -f $pedAll.Count, $pedIn, (Pct $pedIn $pedAll.Count))
$entAll = @($allRows | Where-Object { $_.dutyName -match '이비인후과' })
$x13 = Get-Rows '&QD=D013'
$d13Ids = @{}; foreach ($r in $x13.Rows) { $d13Ids[$r.hpid] = 1 }
$entIn = @($entAll | Where-Object { $d13Ids.ContainsKey($_.hpid) }).Count
Write-Host ("names containing 이비인후과 in all Seoul: {0}; inside QD=D013: {1} ({2})" -f $entAll.Count, $entIn, (Pct $entIn $entAll.Count))
$x26 = Get-Rows '&QD=D026'
$dentNamed = @($x26.Rows | Where-Object { $_.dutyName -match '치과' }).Count
Write-Host ("QD=D026 rows with 치과 in name: {0}/{1} ({2})" -f $dentNamed, $x26.Rows.Count, (Pct $dentNamed $x26.Rows.Count))
