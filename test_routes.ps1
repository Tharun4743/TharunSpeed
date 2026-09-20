$routes = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue

$results = foreach ($r in $routes) {
    $iface = Get-NetIPInterface -InterfaceIndex $r.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
    $adapter = Get-NetAdapter -ifIndex $r.InterfaceIndex -ErrorAction SilentlyContinue
    $ipConfig = Get-NetIPConfiguration -InterfaceIndex $r.InterfaceIndex -ErrorAction SilentlyContinue

    $cMetric = 9999
    if ($iface) {
        $cMetric = $r.RouteMetric + $iface.InterfaceMetric
    }

    [PSCustomObject]@{
        Index = $r.InterfaceIndex
        Alias = $r.InterfaceAlias
        NextHop = $r.NextHop
        RouteMetric = $r.RouteMetric
        InterfaceMetric = if ($iface) { $iface.InterfaceMetric } else { 0 }
        CombinedMetric = $cMetric
        Description = if ($adapter) { $adapter.InterfaceDescription } else { "" }
        Status = if ($adapter) { $adapter.Status } else { "" }
        LinkSpeed = if ($adapter) { $adapter.LinkSpeed } else { "" }
        IPv4 = if ($ipConfig -and $ipConfig.IPv4Address) { ($ipConfig.IPv4Address | Select-Object -First 1).IPAddress } else { "" }
    }
}

$results | Sort-Object CombinedMetric | Format-Table -AutoSize
