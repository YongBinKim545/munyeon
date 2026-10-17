# Verifies dataset 15000736 (국립중앙의료원 전국 병·의원 찾기) and
# 15000576 (전국 약국 정보 조회):
#  1) actual response fields of the list operation (dutyTime1~8 s/c, dutyTel*)
#  2) field fill rates on a 200-row Seoul sample
#  3) holiday filter behavior: totalCount without QT vs QT=1 (Mon) vs QT=8 (holiday)
. "$PSScriptRoot\common.ps1"
$key = Get-ApiKeyEncoded

$hospBase = 'https://apis.data.go.kr/B552657/HsptlAsembySearchService'
$pharBase = 'https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService'

function Test-ListApi {
    param([string]$Label, [string]$ListUrl, [string]$BassOp, [string]$Base)

    Write-Host ""
    Write-Host "===== $Label ====="
    $t = Get-ApiText "$ListUrl&numOfRows=3&pageNo=1"
    if (-not (Assert-NoPortalError $t $Label)) { return }
    Save-Out "$Label-list-sample.xml" $t
    $xml = [xml]$t
    Write-Host "resultCode: $($xml.response.header.resultCode) / resultMsg: $($xml.response.header.resultMsg)"
    $items = Get-ItemArray $xml.response.body.items.item
    if ($items.Count -eq 0) { Write-Host 'NO ITEMS RETURNED'; return }

    $fields = @($items[0].ChildNodes | ForEach-Object { $_.Name })
    Write-Host ("list item fields ({0}): {1}" -f $fields.Count, ($fields -join ', '))
    $dutyTimeS = @($fields | Where-Object { $_ -match '^dutyTime[1-8]s$' })
    $dutyTimeC = @($fields | Where-Object { $_ -match '^dutyTime[1-8]c$' })
    $telFields = @($fields | Where-Object { $_ -match '^dutyTel' })
    Write-Host ("dutyTime open fields: [{0}] close fields: [{1}] tel fields: [{2}]" -f ($dutyTimeS -join ','), ($dutyTimeC -join ','), ($telFields -join ','))

    # If the list operation lacks opening-hour fields, check the per-entity basic-info operation.
    if ($dutyTimeS.Count -eq 0 -and $BassOp) {
        $hpid = $items[0].hpid
        Write-Host "dutyTime not in list response; checking ${BassOp} (HPID=$hpid)..."
        $t2 = Get-ApiText "${Base}/${BassOp}?serviceKey=$key&HPID=$hpid"
        Save-Out "$Label-bass-sample.xml" $t2
        $x2 = [xml]$t2
        $bi = Get-ItemArray $x2.response.body.items.item
        if ($bi.Count -gt 0) {
            $f2 = @($bi[0].ChildNodes | ForEach-Object { $_.Name })
            Write-Host ("basic-info fields ({0}): {1}" -f $f2.Count, ($f2 -join ', '))
        }
    }

    # Fill rates over a bigger Seoul sample.
    $t3 = Get-ApiText "$ListUrl&numOfRows=200&pageNo=1"
    $x3 = [xml]$t3
    $sample = Get-ItemArray $x3.response.body.items.item
    Write-Host "fill rates over $($sample.Count) Seoul rows:"
    foreach ($f in @('dutyTime1s', 'dutyTime6s', 'dutyTime7s', 'dutyTime8s', 'dutyTel1')) {
        $have = @($sample | Where-Object { $_.$f }).Count
        Write-Host ("  {0}: {1}/{2} ({3})" -f $f, $have, $sample.Count, (Pct $have $sample.Count))
    }

    # Holiday filter: compare totalCount.
    $cAll = ([xml](Get-ApiText "$ListUrl&numOfRows=1&pageNo=1")).response.body.totalCount
    $cMon = ([xml](Get-ApiText "$ListUrl&QT=1&numOfRows=1&pageNo=1")).response.body.totalCount
    $cHol = ([xml](Get-ApiText "$ListUrl&QT=8&numOfRows=1&pageNo=1")).response.body.totalCount
    Write-Host ("totalCount (Seoul): no-QT={0} / QT=1(Mon)={1} / QT=8(holiday)={2}" -f $cAll, $cMon, $cHol)
}

$q0 = Enc '서울특별시'
Test-ListApi -Label 'hospital' -ListUrl "$hospBase/getHsptlMdcncListInfoInqire?serviceKey=$key&Q0=$q0" -BassOp 'getHsptlBassInfoInqire' -Base $hospBase
Test-ListApi -Label 'pharmacy' -ListUrl "$pharBase/getParmacyListInfoInqire?serviceKey=$key&Q0=$q0" -BassOp 'getParmacyBassInfoInqire' -Base $pharBase
