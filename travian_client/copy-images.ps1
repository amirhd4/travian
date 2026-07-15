# PowerShell script to copy TravianZ images to frontend public/assets/
# Source: C:\Users\Amir\Desktop\Travian Sources to copy\TravianZ-master\gpack\travian_t4\
# Destination: C:\Users\Amir\Desktop\webgame\travian_client\public\assets\

$src = "C:\Users\Amir\Desktop\Travian Sources to copy\TravianZ-master\gpack\travian_t4"
$dst = "C:\Users\Amir\Desktop\webgame\travian_client\public\assets"

# Create destination directories
$dirs = @(
    "$dst\bgs",
    "$dst\buildings",
    "$dst\fields",
    "$dst\troops",
    "$dst\tribes",
    "$dst\hero",
    "$dst\reports",
    "$dst\quests",
    "$dst\map",
    "$dst\ui",
    "$dst\screenshots"
)
foreach ($d in $dirs) {
    if (!(Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

Write-Host "=== Copying Backgrounds ===" -ForegroundColor Cyan

# Backgrounds
$bgFiles = @(
    @("$src\bodybg_fix.jpg", "$dst\bgs\bodybg.jpg"),
    @("$src\img\new\background.png", "$dst\bgs\background.png"),
    @("$src\img\new\background_messages.png", "$dst\bgs\bg-messages.png"),
    @("$src\img\new\background_reports.png", "$dst\bgs\bg-reports.png"),
    @("$src\img\new\background_statistics.png", "$dst\bgs\bg-statistics.png"),
    @("$src\img\new\background_map.png", "$dst\bgs\bg-map.png"),
    @("$src\img\new\background_settings.png", "$dst\bgs\bg-settings.png"),
    @("$src\img\new\background_plus.png", "$dst\bgs\bg-plus.png"),
    @("$src\img\new\background_warsim.png", "$dst\bgs\bg-warsim.png"),
    @("$src\img\new\background_alliance_name.png", "$dst\bgs\bg-alliance.png"),
    @("$src\img\new\background_village_name.png", "$dst\bgs\bg-village-name.png"),
    @("$src\img\l\dyn_bg1.jpg", "$dst\bgs\dyn-bg1.jpg"),
    @("$src\img\l\bigsize_bg.jpg", "$dst\bgs\bigsize-bg.jpg"),
    @("$src\images\artwork1-ltr.jpg", "$dst\bgs\artwork1.jpg"),
    @("$src\images\artwork2-ltr.jpg", "$dst\bgs\artwork2.jpg"),
    @("$src\images\header_background.jpg", "$dst\bgs\header-bg.jpg"),
    @("$src\images\footer_background.gif", "$dst\bgs\footer-bg.gif"),
    @("$src\img\l\day.gif", "$dst\bgs\day.gif"),
    @("$src\img\l\night.gif", "$dst\bgs\night.gif")
)
foreach ($f in $bgFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force; Write-Host "  OK: $($f[1] | Split-Path -Leaf)" -ForegroundColor Green }
    else { Write-Host "  SKIP: $($f[0] | Split-Path -Leaf) not found" -ForegroundColor Yellow }
}

Write-Host "`n=== Copying Building Backgrounds ===" -ForegroundColor Cyan

# Building backgrounds (dorf1/dorf2)
$buildBgFiles = @(
    @("$src\img\g\bg0.jpg", "$dst\bgs\bg0.jpg"),
    @("$src\img\g\bg1.jpg", "$dst\bgs\bg1.jpg"),
    @("$src\img\g\bg11.jpg", "$dst\bgs\bg11.jpg"),
    @("$src\img\g\bg12.jpg", "$dst\bgs\bg12.jpg"),
    @("$src\img\g\bg13.jpg", "$dst\bgs\bg13.jpg")
)
foreach ($f in $buildBgFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force; Write-Host "  OK: $($f[1] | Split-Path -Leaf)" -ForegroundColor Green }
    else { Write-Host "  SKIP: $($f[0] | Split-Path -Leaf) not found" -ForegroundColor Yellow }
}

Write-Host "`n=== Copying Resource Field Images ===" -ForegroundColor Cyan

# Resource fields f1-f12, f99
for ($i = 1; $i -le 12; $i++) {
    $srcFile = "$src\img\g\f$i.jpg"
    $dstFile = "$dst\fields\f$i.jpg"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force; Write-Host "  OK: f$i.jpg" -ForegroundColor Green }
    else { Write-Host "  SKIP: f$i.jpg not found" -ForegroundColor Yellow }
}
$f99src = "$src\img\g\f99.jpg"
$f99dst = "$dst\fields\f99.jpg"
if (Test-Path $f99src) { Copy-Item $f99src $f99dst -Force; Write-Host "  OK: f99.jpg" -ForegroundColor Green }

Write-Host "`n=== Copying Building Icons ===" -ForegroundColor Cyan

# Building icons g1-g48
for ($i = 1; $i -le 48; $i++) {
    $srcFile = "$src\img\g\g$i.gif"
    $dstFile = "$dst\buildings\g$i.gif"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}
$gCount = (Get-ChildItem "$dst\buildings\g*.gif" -ErrorAction SilentlyContinue).Count
Write-Host "  Copied $gCount building icons (g1-g48)" -ForegroundColor Green

# Building alt icons
for ($i = 1; $i -le 48; $i++) {
    $srcFile = "$src\img\g\g${i}b.gif"
    $dstFile = "$dst\buildings\g${i}b.gif"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}
$gbCount = (Get-ChildItem "$dst\buildings\g*b.gif" -ErrorAction SilentlyContinue).Count
Write-Host "  Copied $gbCount building alt icons (g1b-g48b)" -ForegroundColor Green

# Building level indicators
$levelFiles = @(
    @("$src\img\g\s\glvl.gif", "$dst\buildings\glvl.gif"),
    @("$src\img\g\s\glvlm.gif", "$dst\buildings\glvlm.gif"),
    @("$src\img\g\s\glvlp.gif", "$dst\buildings\glvlp.gif"),
    @("$src\img\g\iso.gif", "$dst\buildings\iso.gif")
)
foreach ($f in $levelFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

Write-Host "`n=== Copying Troop/Unit Images ===" -ForegroundColor Cyan

# Unit icons 1-60
for ($i = 1; $i -le 60; $i++) {
    $srcFile = "$src\img\u\$i.gif"
    $dstFile = "$dst\troops\unit-$i.gif"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}
# Special units
$specialUnits = @(
    @("$src\img\u\98.gif", "$dst\troops\unit-98.gif"),
    @("$src\img\u\99.gif", "$dst\troops\unit-99.gif"),
    @("$src\img\u\point.gif", "$dst\troops\point.gif"),
    @("$src\img\u\specials.gif", "$dst\troops\specials.gif")
)
foreach ($f in $specialUnits) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}
# Tribe banners
$tribeBanners = @(
    @("$src\img\u\v1_romans2.gif", "$dst\troops\roman-banner.gif"),
    @("$src\img\u\v2_teutons2.gif", "$dst\troops\teuton-banner.gif"),
    @("$src\img\u\v3_gauls2.gif", "$dst\troops\gaul-banner.gif"),
    @("$src\img\u\v4_nature2.gif", "$dst\troops\nature-banner.gif"),
    @("$src\img\u\v5_natars2.gif", "$dst\troops\natar-banner.gif"),
    @("$src\img\u\v6_monsters2.gif", "$dst\troops\monster-banner.gif")
)
foreach ($f in $tribeBanners) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}
$troopCount = (Get-ChildItem "$dst\troops\unit-*.gif" -ErrorAction SilentlyContinue).Count
Write-Host "  Copied $troopCount unit icons + tribe banners" -ForegroundColor Green

Write-Host "`n=== Copying Tribe Selection Images ===" -ForegroundColor Cyan

$tribeFiles = @(
    @("$src\img\t\roman.gif", "$dst\tribes\roman-splash.gif"),
    @("$src\img\t\teutons.gif", "$dst\tribes\teuton-splash.gif"),
    @("$src\img\t\gauls.gif", "$dst\tribes\gaul-splash.gif"),
    @("$src\img\t\nature.png", "$dst\tribes\nature-splash.png"),
    @("$src\img\t\nature2.png", "$dst\tribes\nature2-splash.png")
)
foreach ($f in $tribeFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force; Write-Host "  OK: $($f[1] | Split-Path -Leaf)" -ForegroundColor Green }
}

# Large tribe splashes from Admin
$adminSrc = "C:\Users\Amir\Desktop\Travian Sources to copy\TravianZ-master\Admin\img\rpage"
$tribeLargeFiles = @(
    @("$adminSrc\Roman1.jpg", "$dst\tribes\roman-large.jpg"),
    @("$adminSrc\Teuton1.jpg", "$dst\tribes\teuton-large.jpg"),
    @("$adminSrc\Gaul1.jpg", "$dst\tribes\gaul-large.jpg"),
    @("$adminSrc\travian_logo.png", "$dst\ui\travian-logo.png"),
    @("$adminSrc\Nature.jpg", "$dst\tribes\nature-large.jpg"),
    @("$adminSrc\Natars.jpg", "$dst\tribes\natar-large.jpg")
)
foreach ($f in $tribeLargeFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force; Write-Host "  OK: $($f[1] | Split-Path -Leaf)" -ForegroundColor Green }
}

Write-Host "`n=== Copying Hero Images ===" -ForegroundColor Cyan

$heroFiles = @(
    @("$src\img\t\MH.png", "$dst\hero\hero-portrait.png"),
    @("$src\img\t\shadow.png", "$dst\hero\shadow.png"),
    @("$src\img\t\shadow0.png", "$dst\hero\shadow0.png"),
    @("$src\img\t\builderWW.png", "$dst\hero\builder-ww.png"),
    @("$src\img\t\g40_11-ltr.png", "$dst\hero\g40-11.png"),
    @("$src\img\t\winnerww.png", "$dst\hero\winner-ww.png"),
    @("$src\img\t\taskmaster.png", "$dst\hero\taskmaster.png"),
    @("$src\img\t\taskmaster2.png", "$dst\hero\taskmaster2.png"),
    @("$src\img\t\team.png", "$dst\hero\team.png")
)
foreach ($f in $heroFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force; Write-Host "  OK: $($f[1] | Split-Path -Leaf)" -ForegroundColor Green }
}

# Hero appearance parts (a1_1 to a4_10)
for ($a = 1; $a -le 4; $a++) {
    for ($n = 1; $n -le 10; $n++) {
        $srcFile = "$src\img\t\a${a}_${n}.jpg"
        $dstFile = "$dst\hero\a${a}_${n}.jpg"
        if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
    }
}
# Hero tribal parts (t1_1 to t6_10)
for ($t = 1; $t -le 6; $t++) {
    for ($n = 1; $n -le 10; $n++) {
        $srcFile = "$src\img\t\t${t}_${n}.jpg"
        $dstFile = "$dst\hero\t${t}_${n}.jpg"
        if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
    }
}
$heroCount = (Get-ChildItem "$dst\hero\*" -ErrorAction SilentlyContinue).Count
Write-Host "  Copied $heroCount hero images" -ForegroundColor Green

Write-Host "`n=== Copying Report Images ===" -ForegroundColor Cyan

$reportFiles = @(
    @("$src\img\report\attack.jpg", "$dst\reports\attack.jpg"),
    @("$src\img\report\spy.jpg", "$dst\reports\spy.jpg"),
    @("$src\img\report\reinforcement.jpg", "$dst\reports\reinforcement.jpg"),
    @("$src\img\report\resourcetrade.jpg", "$dst\reports\trade.jpg"),
    @("$src\img\report\units.jpg", "$dst\reports\units.jpg"),
    @("$src\img\report\adventure_report.jpg", "$dst\reports\adventure.jpg")
)
foreach ($f in $reportFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force; Write-Host "  OK: $($f[1] | Split-Path -Leaf)" -ForegroundColor Green }
}

Write-Host "`n=== Copying Quest Images ===" -ForegroundColor Cyan

$questFiles = Get-ChildItem "$src\img\q\*.jpg" -ErrorAction SilentlyContinue
foreach ($f in $questFiles) {
    Copy-Item $f.FullName "$dst\quests\$($f.Name)" -Force
}
$questCount = (Get-ChildItem "$dst\quests\*.jpg" -ErrorAction SilentlyContinue).Count
Write-Host "  Copied $questCount quest images" -ForegroundColor Green

Write-Host "`n=== Copying Map Tiles ===" -ForegroundColor Cyan

# Direction tiles d00-d35
for ($i = 0; $i -le 35; $i++) {
    $num = $i.ToString("D2")
    $srcFile = "$src\img\m\d$num.gif"
    $dstFile = "$dst\map\d$num.gif"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}

# Oasis tiles o1-o12, o99
for ($i = 1; $i -le 12; $i++) {
    $srcFile = "$src\img\m\o$i.gif"
    $dstFile = "$dst\map\oasis-$i.gif"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}
$o99src = "$src\img\m\o99.gif"
if (Test-Path $o99src) { Copy-Item $o99src "$dst\map\oasis-99.gif" -Force }

# Water tiles w1-w12
for ($i = 1; $i -le 12; $i++) {
    $srcFile = "$src\img\m\w$i.jpg"
    $dstFile = "$dst\map\water-$i.jpg"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}

# Tribe tiles t0-t9
for ($i = 0; $i -le 9; $i++) {
    $srcFile = "$src\img\m\t$i.gif"
    $dstFile = "$dst\map\tribe-$i.gif"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}

# Map misc
$mapMisc = @(
    @("$src\img\m\map.gif", "$dst\map\marker.gif"),
    @("$src\img\m\mapl.gif", "$dst\map\mapl.gif"),
    @("$src\img\m\dir.gif", "$dst\map\dir.gif"),
    @("$src\img\m\matt.gif", "$dst\map\matt.gif"),
    @("$src\img\m\max.gif", "$dst\map\max.gif"),
    @("$src\img\m\mret.gif", "$dst\map\mret.gif"),
    @("$src\img\m\mspy.gif", "$dst\map\mspy.gif"),
    @("$src\img\m\msup.gif", "$dst\map\msup.gif"),
    @("$src\img\m\map.jpg", "$dst\map\map-bg.jpg")
)
foreach ($f in $mapMisc) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}
$mapCount = (Get-ChildItem "$dst\map\*" -ErrorAction SilentlyContinue).Count
Write-Host "  Copied $mapCount map tiles" -ForegroundColor Green

Write-Host "`n=== Copying UI Elements ===" -ForegroundColor Cyan

$uiFiles = @(
    @("$src\img\new\gold.gif", "$dst\ui\gold.gif"),
    @("$src\img\new\gold_g.gif", "$dst\ui\gold_g.gif"),
    @("$src\img\new\plus.png", "$dst\ui\plus.png"),
    @("$src\img\new\gp.png", "$dst\ui\gp.png"),
    @("$src\img\new\npc.png", "$dst\ui\npc.png"),
    @("$src\img\new\level.png", "$dst\ui\level.png"),
    @("$src\img\new\top10.png", "$dst\ui\top10.png"),
    @("$src\img\new\tick.png", "$dst\ui\tick.png"),
    @("$src\img\new\cancel.gif", "$dst\ui\cancel.gif"),
    @("$src\img\new\opened.png", "$dst\ui\opened.png"),
    @("$src\img\new\closed.png", "$dst\ui\closed.png"),
    @("$src\img\new\header.png", "$dst\ui\header.png"),
    @("$src\img\new\header-gold-grad.png", "$dst\ui\header-gold-grad.png"),
    @("$src\img\new\header-grad.gif", "$dst\ui\header-grad.gif"),
    @("$src\img\new\header-line.png", "$dst\ui\header-line.png"),
    @("$src\img\new\footer.png", "$dst\ui\footer.png"),
    @("$src\img\new\menu.png", "$dst\ui\menu.png"),
    @("$src\img\new\off.png", "$dst\ui\off.png"),
    @("$src\img\new\def.png", "$dst\ui\def.png"),
    @("$src\img\new\ff.png", "$dst\ui\ff.png"),
    @("$src\img\new\ie.png", "$dst\ui\ie.png"),
    @("$src\img\new\opera.png", "$dst\ui\opera.png"),
    @("$src\img\new\minus.png", "$dst\ui\minus.png"),
    @("$src\img\new\switch_levels.png", "$dst\ui\switch-levels.png"),
    @("$src\img\new\building_border.png", "$dst\ui\building-border.png"),
    @("$src\img\new\wood_border.png", "$dst\ui\wood-border.png"),
    @("$src\img\new\clay_border.png", "$dst\ui\clay-border.png"),
    @("$src\img\new\iron_border.png", "$dst\ui\iron-border.png"),
    @("$src\img\new\crop_border.png", "$dst\ui\crop-border.png"),
    @("$src\img\new\gaulwall_border.png", "$dst\ui\gaulwall-border.png"),
    @("$src\img\new\romanwall_border.png", "$dst\ui\romanwall-border.png"),
    @("$src\img\new\teutonwall_border.png", "$dst\ui\teutonwall-border.png"),
    @("$src\img\new\rallypoint_border.png", "$dst\ui\rallypoint-border.png"),
    @("$src\img\new\glvl.gif", "$dst\ui\glvl.gif"),
    @("$src\img\new\c2.gif", "$dst\ui\c2.gif"),
    @("$src\img\new\clock.gif", "$dst\ui\clock.gif"),
    @("$src\img\new\white.gif", "$dst\ui\white.gif"),
    @("$src\img\new\textmenu.gif", "$dst\ui\textmenu.gif"),
    @("$src\img\new\g22.gif", "$dst\ui\g22.gif"),
    @("$src\img\new\worldcup_background.png", "$dst\ui\worldcup-bg.png"),
    @("$src\img\new\adr.png", "$dst\ui\adr.png"),
    @("$src\img\new\anl.png", "$dst\ui\anl.png"),
    @("$src\img\new\bb_buttons.png", "$dst\ui\bb-buttons.png")
)
foreach ($f in $uiFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

# Navigation elements
for ($i = 1; $i -le 5; $i++) {
    $srcFile = "$src\img\new\navi$i.png"
    $dstFile = "$dst\ui\navi-$i.png"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}

# Action icons from img/a/
$actionFiles = @(
    @("$src\img\a\online.gif", "$dst\ui\online.gif"),
    @("$src\img\a\attack_symbol.gif", "$dst\ui\attack-symbol.gif"),
    @("$src\img\a\buildings.gif", "$dst\ui\buildings-icon.gif"),
    @("$src\img\a\troops.gif", "$dst\ui\troops-icon.gif"),
    @("$src\img\a\report_icons.gif", "$dst\ui\report-icons.gif"),
    @("$src\img\a\friends.gif", "$dst\ui\friends-icon.gif"),
    @("$src\img\a\gold.gif", "$dst\ui\gold-icon.gif"),
    @("$src\img\a\gold_g.gif", "$dst\ui\gold-icon-g.gif"),
    @("$src\img\a\plus.gif", "$dst\ui\plus-icon.gif"),
    @("$src\img\a\help.gif", "$dst\ui\help-icon.gif"),
    @("$src\img\a\car.gif", "$dst\ui\car-icon.gif"),
    @("$src\img\a\del.gif", "$dst\ui\del.gif"),
    @("$src\img\a\del_g.gif", "$dst\ui\del-g.gif"),
    @("$src\img\a\close.gif", "$dst\ui\close.gif"),
    @("$src\img\a\clock.gif", "$dst\ui\clock-a.gif"),
    @("$src\img\a\clock-inactive.gif", "$dst\ui\clock-inactive.gif"),
    @("$src\img\a\navi.gif", "$dst\ui\navi.gif"),
    @("$src\img\a\random.gif", "$dst\ui\random.gif"),
    @("$src\img\a\unknown.gif", "$dst\ui\unknown.gif"),
    @("$src\img\a\refresh.png", "$dst\ui\refresh.png")
)
foreach ($f in $actionFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

# Resource production icons from img/r/
for ($i = 1; $i -le 7; $i++) {
    $srcFile = "$src\img\r\$i.gif"
    $dstFile = "$dst\ui\res-$i.gif"
    if (Test-Path $srcFile) { Copy-Item $srcFile $dstFile -Force }
}

# Special effects from img/r/
$effectFiles = @(
    @("$src\img\r\easter.gif", "$dst\ui\easter.gif"),
    @("$src\img\r\newy.gif", "$dst\ui\newy.gif"),
    @("$src\img\r\peace.gif", "$dst\ui\peace.gif"),
    @("$src\img\r\xmas.gif", "$dst\ui\xmas.gif")
)
foreach ($f in $effectFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

# Status icons from img/s/
$statusFiles = @(
    @("$src\img\s\off.gif", "$dst\ui\status-off.gif"),
    @("$src\img\s\def.gif", "$dst\ui\status-def.gif"),
    @("$src\img\s\top10.gif", "$dst\ui\status-top10.gif"),
    @("$src\img\s\v1.gif", "$dst\ui\status-v1.gif"),
    @("$src\img\s\v2.gif", "$dst\ui\status-v2.gif"),
    @("$src\img\s\v3.gif", "$dst\ui\status-v3.gif")
)
foreach ($f in $statusFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

# Misc icons
$miscFiles = @(
    @("$src\img\misc\vip.gif", "$dst\ui\vip.gif"),
    @("$src\img\misc\artefacts.gif", "$dst\ui\artefacts.gif"),
    @("$src\img\misc\cropfinder.gif", "$dst\ui\cropfinder.gif"),
    @("$src\img\misc\win.png", "$dst\ui\win.png"),
    @("$src\img\misc\xlo.gif", "$dst\ui\xlo.gif"),
    @("$src\img\misc\403.gif", "$dst\ui\error-403.gif"),
    @("$src\img\misc\404.gif", "$dst\ui\error-404.gif"),
    @("$src\img\misc\500.gif", "$dst\ui\error-500.gif")
)
foreach ($f in $miscFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

# Message BBCode icons from img/msg/
$msgFiles = @(
    @("$src\img\msg\bb_buttons.png", "$dst\ui\bb-buttons-msg.png"),
    @("$src\img\msg\block_bg.gif", "$dst\ui\msg-block-bg.gif"),
    @("$src\img\msg\block_bg2.gif", "$dst\ui\msg-block-bg2.gif"),
    @("$src\img\msg\line.gif", "$dst\ui\msg-line.gif"),
    @("$src\img\msg\underline.gif", "$dst\ui\msg-underline.gif")
)
foreach ($f in $msgFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

# Artifacts from img/artefact/
$artFiles = @(
    @("$src\img\artefact\type1.gif", "$dst\ui\artifact-type1.gif"),
    @("$src\img\artefact\type2.gif", "$dst\ui\artifact-type2.gif"),
    @("$src\img\artefact\type3.gif", "$dst\ui\artifact-type3.gif"),
    @("$src\img\artefact\type4.gif", "$dst\ui\artifact-type4.gif"),
    @("$src\img\artefact\type5.gif", "$dst\ui\artifact-type5.gif"),
    @("$src\img\artefact\type6.gif", "$dst\ui\artifact-type6.gif"),
    @("$src\img\artefact\type7.gif", "$dst\ui\artifact-type7.gif"),
    @("$src\img\artefact\type8.gif", "$dst\ui\artifact-type8.gif"),
    @("$src\img\artefact\type9.gif", "$dst\ui\artifact-type9.gif"),
    @("$src\img\artefact\type-1.gif", "$dst\ui\artifact-type-n1.gif"),
    @("$src\img\artefact\type-2.gif", "$dst\ui\artifact-type-n2.gif"),
    @("$src\img\artefact\type-4.gif", "$dst\ui\artifact-type-n4.gif"),
    @("$src\img\artefact\type-5.gif", "$dst\ui\artifact-type-n5.gif"),
    @("$src\img\artefact\type-6.gif", "$dst\ui\artifact-type-n6.gif"),
    @("$src\img\artefact\type-8.gif", "$dst\ui\artifact-type-n8.gif"),
    @("$src\img\artefact\type-9.gif", "$dst\ui\artifact-type-n9.gif"),
    @("$src\img\artefact\type-10.gif", "$dst\ui\artifact-type-n10.gif"),
    @("$src\img\artefact\type-fool.gif", "$dst\ui\artifact-type-fool.gif"),
    @("$src\img\artefact\typeww.gif", "$dst\ui\artifact-typeww.gif")
)
foreach ($f in $artFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

# Gloriamedals from img/gloriamedals/
if (Test-Path "$src\img\gloriamedals") {
    $medalFiles = Get-ChildItem "$src\img\gloriamedals\*" -ErrorAction SilentlyContinue
    foreach ($f in $medalFiles) {
        Copy-Item $f.FullName "$dst\ui\$($f.Name)" -Force
    }
}

# Special effects from img/special/
if (Test-Path "$src\img\special") {
    $specialFiles = Get-ChildItem "$src\img\special\*" -ErrorAction SilentlyContinue
    foreach ($f in $specialFiles) {
        Copy-Item $f.FullName "$dst\ui\$($f.Name)" -Force
    }
}

# Layout images from img/l/
$layoutFiles = @(
    @("$src\img\l\m1.gif", "$dst\ui\m1.gif"),
    @("$src\img\l\m2.gif", "$dst\ui\m2.gif"),
    @("$src\img\l\m3.gif", "$dst\ui\m3.gif"),
    @("$src\img\l\m4.gif", "$dst\ui\m4.gif"),
    @("$src\img\l\n1.gif", "$dst\ui\n1.gif"),
    @("$src\img\l\n2.gif", "$dst\ui\n2.gif"),
    @("$src\img\l\n3.gif", "$dst\ui\n3.gif"),
    @("$src\img\l\n4.gif", "$dst\ui\n4.gif"),
    @("$src\img\l\mp.gif", "$dst\ui\mp.gif"),
    @("$src\img\l\mw.gif", "$dst\ui\mw.gif"),
    @("$src\img\l\navi.gif", "$dst\ui\navi-l.gif"),
    @("$src\img\l\skyscraper_bg.gif", "$dst\ui\skyscraper-bg.gif"),
    @("$src\img\l\ad0.jpg", "$dst\ui\ad0.jpg"),
    @("$src\img\l\ad1.jpg", "$dst\ui\ad1.jpg"),
    @("$src\img\l\ad2.jpg", "$dst\ui\ad2.jpg")
)
foreach ($f in $layoutFiles) {
    if (Test-Path $f[0]) { Copy-Item $f[0] $f[1] -Force }
}

# World map images from img/wm/
if (Test-Path "$src\img\wm") {
    $wmFiles = Get-ChildItem "$src\img\wm\*" -ErrorAction SilentlyContinue
    foreach ($f in $wmFiles) {
        Copy-Item $f.FullName "$dst\map\$($f.Name)" -Force
    }
}

# Screenshots from images/
if (Test-Path "$src\images\screenshots") {
    $ssFiles = Get-ChildItem "$src\images\screenshots\*" -ErrorAction SilentlyContinue
    foreach ($f in $ssFiles) {
        Copy-Item $f.FullName "$dst\screenshots\$($f.Name)" -Force
    }
}

# Payment images
$paySrc = "C:\Users\Amir\Desktop\Travian Sources to copy\TravianZ-master"
if (Test-Path "$paySrc\img\payment") {
    $payFiles = Get-ChildItem "$paySrc\img\payment\*" -ErrorAction SilentlyContinue
    foreach ($f in $payFiles) {
        Copy-Item $f.FullName "$dst\ui\$($f.Name)" -Force
    }
}

Write-Host "`n=== Copy Summary ===" -ForegroundColor Cyan

$bgs = (Get-ChildItem "$dst\bgs\*" -ErrorAction SilentlyContinue).Count
$fields = (Get-ChildItem "$dst\fields\*" -ErrorAction SilentlyContinue).Count
$buildings = (Get-ChildItem "$dst\buildings\*" -ErrorAction SilentlyContinue).Count
$troops = (Get-ChildItem "$dst\troops\*" -ErrorAction SilentlyContinue).Count
$tribes = (Get-ChildItem "$dst\tribes\*" -ErrorAction SilentlyContinue).Count
$hero = (Get-ChildItem "$dst\hero\*" -ErrorAction SilentlyContinue).Count
$reports = (Get-ChildItem "$dst\reports\*" -ErrorAction SilentlyContinue).Count
$quests = (Get-ChildItem "$dst\quests\*" -ErrorAction SilentlyContinue).Count
$map = (Get-ChildItem "$dst\map\*" -ErrorAction SilentlyContinue).Count
$ui = (Get-ChildItem "$dst\ui\*" -ErrorAction SilentlyContinue).Count
$total = $bgs + $fields + $buildings + $troops + $tribes + $hero + $reports + $quests + $map + $ui

Write-Host "  Backgrounds:     $bgs" -ForegroundColor White
Write-Host "  Fields:          $fields" -ForegroundColor White
Write-Host "  Buildings:       $buildings" -ForegroundColor White
Write-Host "  Troops:          $troops" -ForegroundColor White
Write-Host "  Tribes:          $tribes" -ForegroundColor White
Write-Host "  Hero:            $hero" -ForegroundColor White
Write-Host "  Reports:         $reports" -ForegroundColor White
Write-Host "  Quests:          $quests" -ForegroundColor White
Write-Host "  Map:             $map" -ForegroundColor White
Write-Host "  UI:              $ui" -ForegroundColor White
Write-Host "  ---------------------" -ForegroundColor Gray
Write-Host "  TOTAL:           $total images" -ForegroundColor Green
Write-Host ""
Write-Host "All images copied successfully!" -ForegroundColor Green
