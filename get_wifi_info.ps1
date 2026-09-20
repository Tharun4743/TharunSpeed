# Production-Grade Network Interface & Hardware Analyzer
$ErrorActionPreference = 'SilentlyContinue'

# Step 1: Query all IPv4 Default Routes (0.0.0.0/0)
$defaultRoutes = Get-NetRoute -DestinationPrefix '0.0.0.0/0'

$candidateAdapters = @()
foreach ($r in $defaultRoutes) {
    $iface = Get-NetIPInterface -InterfaceIndex $r.InterfaceIndex -AddressFamily IPv4
    $adapter = Get-NetAdapter -ifIndex $r.InterfaceIndex
    $ipConfig = Get-NetIPConfiguration -InterfaceIndex $r.InterfaceIndex
    $profile = Get-NetConnectionProfile -InterfaceAlias $adapter.Name

    if ($adapter -and $adapter.Status -eq 'Up') {
        $combinedMetric = [int]$r.RouteMetric + [int]$iface.InterfaceMetric
        $candidateAdapters += [PSCustomObject]@{
            InterfaceIndex  = $r.InterfaceIndex
            AdapterName     = $adapter.Name
            Description     = $adapter.InterfaceDescription
            MediaType       = $adapter.MediaType
            LinkSpeed       = $adapter.LinkSpeed
            NextHop         = $r.NextHop
            CombinedMetric  = $combinedMetric
            IPv4            = if ($ipConfig -and $ipConfig.IPv4Address) { ($ipConfig.IPv4Address | Select-Object -First 1).IPAddress } else { "" }
            SSID            = if ($profile) { $profile.Name } else { $adapter.Name }
        }
    }
}

# Step 2: Sort strictly by Lowest CombinedMetric (The true active path for all outgoing internet packets)
$primary = $candidateAdapters | Sort-Object CombinedMetric | Select-Object -First 1

# Fallback to any connected up adapter if route table is empty
if (-not $primary) {
    $ad = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1
    if ($ad) {
        $ipConfig = Get-NetIPConfiguration -InterfaceIndex $ad.ifIndex
        $primary = [PSCustomObject]@{
            InterfaceIndex  = $ad.ifIndex
            AdapterName     = $ad.Name
            Description     = $ad.InterfaceDescription
            MediaType       = $ad.MediaType
            LinkSpeed       = $ad.LinkSpeed
            NextHop         = if ($ipConfig) { $ipConfig.IPv4DefaultGateway.NextHop } else { "" }
            CombinedMetric  = 0
            IPv4            = if ($ipConfig -and $ipConfig.IPv4Address) { ($ipConfig.IPv4Address | Select-Object -First 1).IPAddress } else { "" }
            SSID            = $ad.Name
        }
    }
}

$desc = if ($primary.Description) { $primary.Description } else { "" }
$mediaType = if ($primary.MediaType) { $primary.MediaType } else { "" }
$gateway = if ($primary.NextHop) { $primary.NextHop } else { "" }
$linkSpeed = if ($primary.LinkSpeed) { $primary.LinkSpeed } else { "Active" }
$ssid = if ($primary.SSID) { $primary.SSID } else { "" }

$isUsbTether = $false
$isWifi = $false
$isEthernet = $false
$band = "Connected"
$hotspotType = "Broadband"
$isHotspot = $false

# 1. USB Tethering Detection (Remote NDIS, Apple Mobile, Samsung NDIS, CDC NDIS)
if ($desc -match "NDIS|RNDIS|Internet Sharing|SAMSUNG Mobile|Apple Mobile|Mobile USB|CDC NDIS" -or $primary.AdapterName -match "Ethernet 2") {
    $isUsbTether = $true
    $isHotspot = $true
    $hotspotType = "USB Tethering (Mobile Phone)"
    $band = "USB Cable"
}
# 2. Wi-Fi Wireless Detection
elseif ($mediaType -eq 'Native 802.11' -or $primary.AdapterName -match "Wi-Fi|Wireless|WLAN") {
    $isWifi = $true
    if ($linkSpeed -match "Gbps" -or [double]($linkSpeed -replace '[^\d.]') -ge 300) {
        $band = "5 GHz (Fast)"
    } else {
        $band = "2.4 GHz"
    }

    # Wi-Fi Mobile Hotspot Subnet / Name Detection
    if ($gateway -like "192.168.43.*" -or $gateway -like "172.20.10.*" -or $ssid -match "iPhone|Android|Galaxy|Redmi|Realme|OnePlus|Pixel|Hotspot|Vivo|Oppo|POCO|Jio|Airtel") {
        $isHotspot = $true
        $hotspotType = "Wi-Fi Mobile Hotspot"
    } else {
        $isHotspot = $false
        $hotspotType = "Wi-Fi Router"
    }
}
# 3. Wired Ethernet
else {
    $isEthernet = $true
    $band = "Ethernet"
    $hotspotType = "Wired Network"
}

[PSCustomObject]@{
    AdapterName     = $primary.AdapterName
    Description     = $desc
    LinkSpeed       = if ($isUsbTether) { "USB High-Speed" } else { $linkSpeed }
    SSID            = $ssid
    IPv4            = $primary.IPv4
    Gateway         = $gateway
    FrequencyBand   = $band
    IsMobileHotspot = $isHotspot
    IsUsbTether     = $isUsbTether
    HotspotType     = $hotspotType
    ActiveMetric    = $primary.CombinedMetric
} | ConvertTo-Json
