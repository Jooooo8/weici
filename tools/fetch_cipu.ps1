param(
    [string]$TmpDir = "C:\Users\LENOVO\Desktop\新建文件夹\微词\tools\tmp"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null

# 需要收录的词牌（常见常用，覆盖平韵/仄韵/换韵/通叶）
$Wanted = @(
    "忆江南","渔歌子","捣练子","长相思","浣溪沙","采桑子","阮郎归",
    "画堂春","朝中措","武陵春","临江仙","鹧鸪天","小重山","一剪梅",
    "唐多令","破阵子","行香子","风入松","水调歌头","满庭芳","沁园春",
    "望海潮","八声甘州","扬州慢","声声慢","高阳台",
    "如梦令","生查子","点绛唇","卜算子","忆秦娥","谒金门","好事近",
    "霜天晓角","蝶恋花","渔家傲","苏幕遮","青玉案","满江红","念奴娇",
    "桂枝香","水龙吟","雨霖铃","永遇乐","贺新郎","摸鱼儿",
    "菩萨蛮","减字木兰花","清平乐","更漏子","相见欢","虞美人","定风波",
    "西江月","天净沙","平湖乐"
)

$listingHtml = Get-Content -Encoding UTF8 "$TmpDir\listing.html" -Raw
$matches = [regex]::Matches($listingHtml, 'href="[^"]*QueryCiTune\.aspx\?id=(\d+)[^"]*"[^>]*>([^<]+)<')
$map = @{}
foreach ($m in $matches) {
    $name = $m.Groups[2].Value.Trim()
    if (-not $map.ContainsKey($name)) {
        $map[$name] = $m.Groups[1].Value
    }
}

$missing = @()
$downloaded = 0
foreach ($name in $Wanted) {
    if (-not $map.ContainsKey($name)) {
        $missing += $name
        continue
    }
    $id = $map[$name]
    $file = "$TmpDir\tune_$id.html"
    if (Test-Path $file) {
        $downloaded++
        continue
    }
    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try {
            $r = Invoke-WebRequest -Uri "https://sou-yun.cn/QueryCiTune.aspx?id=$id" -UseBasicParsing -TimeoutSec 30
            [System.IO.File]::WriteAllText($file, $r.Content, [System.Text.Encoding]::UTF8)
            $downloaded++
            Write-Output "OK $id $name"
            break
        } catch {
            if ($attempt -eq 4) {
                Write-Output "FAIL $id $name : $($_.Exception.Message)"
            } else {
                Start-Sleep -Seconds 12
            }
        }
    }
    Start-Sleep -Seconds 3
}

$map | ConvertTo-Json | Set-Content -Encoding UTF8 "$TmpDir\tune_ids.json"
Write-Output "----"
Write-Output "downloaded/available: $downloaded / $($Wanted.Count)"
if ($missing.Count) {
    Write-Output "missing names: $($missing -join ', ')"
}
