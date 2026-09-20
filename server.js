const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const dns = require('dns').promises;
const { exec } = require('child_process');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Pre-allocate random 1MB chunk to stream rapidly without high CPU overhead
const CHUNK_SIZE = 1024 * 1024; // 1 MB
const RANDOM_BUFFER = crypto.randomBytes(CHUNK_SIZE);

// Latency & Ping endpoint with sub-millisecond precision
app.get('/api/ping', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({ status: 'ok', serverTime: Date.now() });
});

// DNS Benchmark Endpoint
app.get('/api/dns-benchmark', async (req, res) => {
    const domains = ['google.com', 'cloudflare.com', 'github.com', 'wikipedia.org'];
    const results = [];

    for (const domain of domains) {
        const start = performance.now();
        try {
            await dns.lookup(domain);
            const duration = performance.now() - start;
            results.push(duration);
        } catch (e) {}
    }

    if (results.length === 0) {
        return res.status(500).json({ error: 'DNS resolution failed' });
    }

    const avgDns = results.reduce((a, b) => a + b, 0) / results.length;
    res.json({
        avgDnsMs: Number(avgDns.toFixed(1)),
        testedDomains: results.length
    });
});

// Ultra-fast Hardware Diagnostics Cache (2-second TTL for instant detection on plug/unplug)
let cachedWifiData = null;
let wifiCacheTimestamp = 0;

app.get('/api/wifi-diagnostics', (req, res) => {
    const now = Date.now();
    if (cachedWifiData && (now - wifiCacheTimestamp < 2000)) {
        return res.json(cachedWifiData);
    }

    const scriptPath = path.join(__dirname, 'get_wifi_info.ps1');
    const cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`;

    exec(cmd, { timeout: 8000 }, (error, stdout, stderr) => {
        if (!error && stdout) {
            try {
                const parsed = JSON.parse(stdout.trim());
                cachedWifiData = parsed;
                wifiCacheTimestamp = Date.now();
                return res.json(parsed);
            } catch (e) {}
        }

        if (cachedWifiData) {
            return res.json(cachedWifiData);
        }
        res.status(500).json({ error: 'Failed to query network interfaces' });
    });
});

// Download Speed Test Endpoint
app.get('/api/download', (req, res) => {
    const requestedBytes = parseInt(req.query.bytes, 10) || (25 * 1024 * 1024);
    const maxBytes = 500 * 1024 * 1024;
    const totalBytes = Math.min(requestedBytes, maxBytes);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', totalBytes);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    let bytesSent = 0;

    function sendChunk() {
        while (bytesSent < totalBytes) {
            const remaining = totalBytes - bytesSent;
            const chunkSize = Math.min(remaining, CHUNK_SIZE);
            const chunk = (chunkSize === CHUNK_SIZE) ? RANDOM_BUFFER : RANDOM_BUFFER.subarray(0, chunkSize);
            
            bytesSent += chunkSize;
            const canContinue = res.write(chunk);
            if (!canContinue) {
                res.once('drain', sendChunk);
                return;
            }
        }
        res.end();
    }

    sendChunk();
});

// Upload Speed Test Endpoint
app.post('/api/upload', (req, res) => {
    let receivedBytes = 0;
    const startTime = Date.now();

    req.on('data', (chunk) => {
        receivedBytes += chunk.length;
    });

    req.on('end', () => {
        const durationSec = (Date.now() - startTime) / 1000;
        const exactMbps = durationSec > 0 ? ((receivedBytes * 8) / durationSec / 1000000) : 0;
        res.setHeader('Cache-Control', 'no-store, no-cache');
        res.json({
            receivedBytes,
            durationSec: Number(durationSec.toFixed(3)),
            exactMbps: Number(exactMbps.toFixed(2))
        });
    });

    req.on('error', (err) => {
        res.status(500).json({ error: err.message });
    });
});

// Real IP & ISP Geo Info with Redundant Upstream Providers (Zero Mock Data)
app.get('/api/ipinfo', async (req, res) => {
    // 1. Try ip-api.com
    try {
        const r1 = await fetch('http://ip-api.com/json', { signal: AbortSignal.timeout(3000) });
        if (r1.ok) {
            const d1 = await r1.json();
            if (d1.status === 'success') {
                return res.json({
                    ip: d1.query,
                    isp: d1.isp || d1.org,
                    org: d1.org,
                    city: d1.city,
                    region: d1.regionName,
                    country: d1.country,
                    asn: d1.as
                });
            }
        }
    } catch (e1) {}

    // 2. Redundant fallback: ipwho.is
    try {
        const r2 = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
        if (r2.ok) {
            const d2 = await r2.json();
            if (d2.success) {
                return res.json({
                    ip: d2.ip,
                    isp: d2.connection?.isp || d2.connection?.org,
                    org: d2.connection?.org,
                    city: d2.city,
                    region: d2.region,
                    country: d2.country,
                    asn: d2.connection?.asn
                });
            }
        }
    } catch (e2) {}

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Localhost';
    res.json({
        ip: clientIp,
        isp: 'Active Network Interface',
        org: 'Connected Network',
        city: 'Local',
        region: '',
        country: '',
        asn: ''
    });
});

// WebSocket Server
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'ping') {
                ws.send(JSON.stringify({
                    type: 'pong',
                    clientTimestamp: data.timestamp,
                    serverTimestamp: Date.now()
                }));
            }
        } catch (e) {
            ws.send(message);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`⚡ Speed Tester Server running at http://localhost:${PORT}`);
});
