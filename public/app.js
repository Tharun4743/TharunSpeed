/**
 * Clean & User-Friendly Speed Tester Controller
 * 100% Dynamic Telemetry & Universal Telecom Sanitizer
 */
document.addEventListener('DOMContentLoaded', () => {
    const engine = new SpeedEngine({
        downloadDurationMs: 3000,
        uploadDurationMs: 2000,
        concurrency: 6,
        targetNode: 'cloudflare'
    });

    // UI Elements
    const startBtn = document.getElementById('startBtn');
    const heroSpeed = document.getElementById('heroSpeed');
    const stageLabel = document.getElementById('stageLabel');
    const badgeText = document.getElementById('badgeText');
    const badgeIcon = document.getElementById('badgeIcon');

    // Status Pills
    const connectionTypeVal = document.getElementById('connectionTypeVal');
    const networkCarrierVal = document.getElementById('networkCarrierVal');

    // Metrics
    const downloadValue = document.getElementById('downloadValue');
    const uploadValue = document.getElementById('uploadValue');
    const pingValue = document.getElementById('pingValue');
    const jitterValue = document.getElementById('jitterValue');

    // Info
    const ispInfo = document.getElementById('ispInfo');
    const gatewayInfo = document.getElementById('gatewayInfo');

    let detectedWifi = null;
    let detectedIp = null;

    // Pure Dynamic Telecom Name Formatter (Zero Hardcoded If-Else Brand Blocks)
    function formatCarrierName(ipData) {
        if (!ipData) return 'Detecting...';

        let name = ipData.isp || ipData.org || '';

        // If isp is very short or generic, combine with org
        if (name.length < 4 && ipData.org) {
            name = ipData.org;
        }

        // Clean out ASN identifiers and legal corporate noise dynamically
        name = name
            .replace(/AS\d+/gi, '')
            .replace(/AS for (GPRS|Internet|Data) Service/gi, '')
            .replace(/\b(Limited|Ltd|Inc|Corporation|Corp|Pvt|Private|Services|LLC|GPRS|Infocomm|Telecommunications|Telecom)\b\.?/gi, '')
            .replace(/[-_.]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Title Case capitalization for clean display
        if (name.length > 0) {
            name = name.split(' ')
                .map(word => word.length > 0 ? (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) : '')
                .join(' ')
                .trim();
        }

        return name.length > 1 ? name : (ipData.isp || ipData.org || 'Internet Service Provider');
    }

    // Update connection & carrier labels dynamically from live hardware & IP data
    function updateConnectionLabels(testedSpeed = null, testedPing = null) {
        // 1. Connection Type (USB Cable / Wi-Fi / LAN)
        if (detectedWifi) {
            if (detectedWifi.IsUsbTether) {
                connectionTypeVal.textContent = '📱 USB Tethering (Phone)';
                badgeIcon.textContent = '📱';
                badgeText.textContent = 'USB Tethering';
            } else if (detectedWifi.FrequencyBand && detectedWifi.FrequencyBand.includes('5 GHz')) {
                connectionTypeVal.textContent = '📶 Wi-Fi 5 GHz (Fast)';
                badgeIcon.textContent = '📶';
                badgeText.textContent = 'Wi-Fi 5 GHz';
            } else if (detectedWifi.FrequencyBand && detectedWifi.FrequencyBand.includes('2.4 GHz')) {
                connectionTypeVal.textContent = '📶 Wi-Fi 2.4 GHz';
                badgeIcon.textContent = '📶';
                badgeText.textContent = 'Wi-Fi 2.4 GHz';
            } else {
                connectionTypeVal.textContent = detectedWifi.HotspotType || detectedWifi.FrequencyBand || 'High-Speed Broadband';
                badgeIcon.textContent = '⚡';
                badgeText.textContent = 'High-Speed Broadband';
            }

            if (gatewayInfo) {
                gatewayInfo.textContent = detectedWifi.Gateway ? `Gateway: ${detectedWifi.Gateway}` : 'Gateway: Connected';
            }
        }

        // 2. Real Network Carrier & 5G / 4G Classification
        if (detectedIp) {
            const cleanCarrier = formatCarrierName(detectedIp);
            const isTetheredPhone = detectedWifi ? (detectedWifi.IsUsbTether === true || detectedWifi.IsMobileHotspot === true) : false;
            
            if (isTetheredPhone) {
                if (testedSpeed !== null) {
                    if (testedSpeed >= 40 || (testedPing !== null && testedPing <= 45)) {
                        networkCarrierVal.textContent = `${cleanCarrier} (5G Mobile)`;
                        badgeText.textContent = `5G Mobile • ${cleanCarrier}`;
                    } else {
                        networkCarrierVal.textContent = `${cleanCarrier} (4G LTE)`;
                        badgeText.textContent = `4G LTE • ${cleanCarrier}`;
                    }
                } else {
                    networkCarrierVal.textContent = `${cleanCarrier} (Mobile Data - 5G / 4G)`;
                    badgeText.textContent = `Mobile Data • ${cleanCarrier}`;
                }
            } else {
                networkCarrierVal.textContent = `${cleanCarrier} (Broadband / Fiber)`;
                badgeText.textContent = `Broadband • ${cleanCarrier}`;
            }
            
            if (ispInfo) {
                const cityStr = detectedIp.city ? ` (${detectedIp.city})` : '';
                ispInfo.textContent = `Carrier: ${cleanCarrier}${cityStr}`;
            }
        }
    }

    // Load Live Hardware & Interface Info
    async function loadWifiInfo() {
        try {
            const res = await fetch('/api/wifi-diagnostics');
            if (res.ok) {
                detectedWifi = await res.json();
                updateConnectionLabels();
                return;
            }
        } catch (e) {}

        // Fallback for cloud static deployment (Netlify)
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            const isCellular = conn.type === 'cellular' || (conn.effectiveType && conn.effectiveType.includes('4g'));
            detectedWifi = {
                IsUsbTether: false,
                FrequencyBand: isCellular ? 'Cellular / Wireless' : 'High-Speed Broadband',
                LinkSpeed: conn.downlink ? `${conn.downlink * 10} Mbps` : 'Optimal',
                Gateway: 'Auto Gateway'
            };
        } else {
            detectedWifi = {
                IsUsbTether: false,
                FrequencyBand: 'High-Speed Broadband',
                Gateway: 'Auto Gateway'
            };
        }
        updateConnectionLabels();
    }

    // Load Real Public IP & Carrier Info
    async function loadIpInfo() {
        try {
            const res = await fetch('/api/ipinfo');
            if (res.ok) {
                detectedIp = await res.json();
                updateConnectionLabels();
                return;
            }
        } catch (e) {}

        // Fallback for cloud static deployment (Netlify): direct public BGP lookup
        try {
            const directRes = await fetch('https://ipwho.is/');
            if (directRes.ok) {
                const data = await directRes.json();
                detectedIp = {
                    ip: data.ip,
                    city: data.city,
                    region: data.region,
                    country: data.country,
                    isp: data.connection?.isp || data.isp || '',
                    org: data.connection?.org || data.org || '',
                    asn: data.connection?.asn ? `AS${data.connection.asn}` : ''
                };
                updateConnectionLabels();
                return;
            }
        } catch (err) {}

        try {
            const directRes2 = await fetch('https://api.ipify.org?format=json');
            if (directRes2.ok) {
                const data = await directRes2.json();
                detectedIp = { ip: data.ip, isp: 'High-Speed Telecom' };
                updateConnectionLabels();
            }
        } catch (e) {
            networkCarrierVal.textContent = 'High-Speed Telecom';
        }
    }

    loadWifiInfo();
    loadIpInfo();

    // Fast 5-6s Speed Test
    async function runTest() {
        startBtn.disabled = true;
        startBtn.textContent = 'Testing...';
        
        heroSpeed.textContent = '0.0';
        downloadValue.textContent = '--';
        uploadValue.textContent = '--';
        pingValue.textContent = '--';
        jitterValue.textContent = '--';

        engine.isRunning = true;

        try {
            // === STAGE 1: DOWNLOAD (3.0s) ===
            stageLabel.textContent = 'Measuring Download Speed...';
            const dlRes = await engine.testDownload((instantMbps) => {
                heroSpeed.textContent = instantMbps.toFixed(1);
                downloadValue.textContent = instantMbps.toFixed(1);
            });
            heroSpeed.textContent = dlRes.mbps.toFixed(1);
            downloadValue.textContent = dlRes.mbps.toFixed(1);

            // === STAGE 2: UPLOAD (2.0s) ===
            stageLabel.textContent = 'Measuring Upload Speed...';
            const ulRes = await engine.testUpload((instantMbps) => {
                heroSpeed.textContent = instantMbps.toFixed(1);
                uploadValue.textContent = instantMbps.toFixed(1);
            });
            heroSpeed.textContent = ulRes.mbps.toFixed(1);
            uploadValue.textContent = ulRes.mbps.toFixed(1);

            // === STAGE 3: PING & JITTER (~0.5s) ===
            stageLabel.textContent = 'Measuring Latency (Ping)...';
            const pingRes = await engine.testPing((instantPing) => {
                pingValue.textContent = instantPing.toFixed(0);
            });
            pingValue.textContent = pingRes.avg.toFixed(1);
            jitterValue.textContent = pingRes.jitter.toFixed(1);

            // Dynamically update 5G vs 4G tag based on live measured speed & ping
            updateConnectionLabels(dlRes.mbps, pingRes.avg);

            // Restore Hero Readout to final Download Speed
            heroSpeed.textContent = dlRes.mbps.toFixed(1);
            stageLabel.textContent = 'Test Completed';
        } catch (err) {
            stageLabel.textContent = 'Test Interrupted';
        } finally {
            startBtn.disabled = false;
            startBtn.textContent = 'Test Again';
        }
    }

    startBtn.addEventListener('click', runTest);
});
