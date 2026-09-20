/**
 * Fast & High-Accuracy Speed Measurement Engine
 * 5-6 Second Total Test Window with Ultra-Rapid 45ms Refresh Rate
 */
class SpeedEngine {
    constructor(options = {}) {
        this.downloadDurationMs = options.downloadDurationMs || 3000; // 3.0s Download
        this.uploadDurationMs = options.uploadDurationMs || 2000;     // 2.0s Upload
        this.concurrency = options.concurrency || 6;                  // 6x Parallel saturation
        this.targetNode = options.targetNode || 'cloudflare';
        this.isRunning = false;
        this.abortController = null;
    }

    // High-Accuracy Download (3.0 seconds, 45ms sample rate)
    async testDownload(onProgress) {
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        let totalBytes = 0;
        const startTime = performance.now();
        const endTime = startTime + this.downloadDurationMs;

        let lastCheckTime = startTime;
        let lastCheckBytes = 0;

        // Ultra-fast 45ms telemetry monitor
        const monitorInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = (now - startTime) / 1000;
            const deltaSec = (now - lastCheckTime) / 1000;
            const deltaBytes = totalBytes - lastCheckBytes;

            if (deltaSec >= 0.045 && totalBytes > 0) {
                const instantMbps = (deltaBytes * 8) / deltaSec / 1000000;
                const overallMbps = (totalBytes * 8) / elapsed / 1000000;

                // Accurate weighted moving rate
                const currentMbps = (elapsed > 0.5) ? (overallMbps * 0.7 + instantMbps * 0.3) : instantMbps;

                if (onProgress && currentMbps > 0) {
                    onProgress(currentMbps, overallMbps, totalBytes);
                }

                lastCheckTime = now;
                lastCheckBytes = totalBytes;
            }
        }, 45);

        // 6 Parallel high-throughput streams for instant saturation
        const startWorker = async () => {
            while (performance.now() < endTime && !signal.aborted) {
                try {
                    const chunkBytes = 20 * 1024 * 1024;
                    const url = (this.targetNode === 'cloudflare')
                        ? `https://speed.cloudflare.com/__down?bytes=${chunkBytes}&r=${Math.random()}`
                        : `/api/download?bytes=${chunkBytes}&r=${Math.random()}`;

                    const res = await fetch(url, { signal, cache: 'no-store' });
                    if (!res.body) break;
                    const reader = res.body.getReader();

                    while (performance.now() < endTime && !signal.aborted) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (value && value.length > 0) {
                            totalBytes += value.length;
                        }
                    }
                } catch (e) {
                    if (signal.aborted) break;
                    await new Promise(r => setTimeout(r, 40));
                }
            }
        };

        const workers = [];
        for (let i = 0; i < this.concurrency; i++) {
            workers.push(startWorker());
        }

        await new Promise(r => setTimeout(r, this.downloadDurationMs));
        this.abortController.abort();
        clearInterval(monitorInterval);

        const totalDuration = (performance.now() - startTime) / 1000;
        const finalMbps = (totalDuration > 0 && totalBytes > 0)
            ? ((totalBytes * 8) / totalDuration / 1000000)
            : 0;

        return {
            mbps: Number(finalMbps.toFixed(2)),
            totalBytes,
            duration: totalDuration
        };
    }

    // High-Accuracy Upload (2.0 seconds)
    async testUpload(onProgress) {
        this.abortController = new AbortController();
        const startTime = performance.now();
        const endTime = startTime + this.uploadDurationMs;
        let totalBytesUploaded = 0;

        const payloadSize = 1024 * 1024; // 1 MB chunks
        const randomPayload = new Uint8Array(payloadSize);
        crypto.getRandomValues(randomPayload.subarray(0, 32768));

        let lastCheckTime = startTime;
        let lastCheckBytes = 0;

        const monitorInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = (now - startTime) / 1000;
            const deltaSec = (now - lastCheckTime) / 1000;
            const deltaBytes = totalBytesUploaded - lastCheckBytes;

            if (deltaSec >= 0.045 && totalBytesUploaded > 0) {
                const instantMbps = (deltaBytes * 8) / deltaSec / 1000000;
                const overallMbps = (totalBytesUploaded * 8) / elapsed / 1000000;
                const currentMbps = (elapsed > 0.4) ? (overallMbps * 0.7 + instantMbps * 0.3) : instantMbps;

                if (onProgress && currentMbps > 0) {
                    onProgress(currentMbps, overallMbps, totalBytesUploaded);
                }

                lastCheckTime = now;
                lastCheckBytes = totalBytesUploaded;
            }
        }, 45);

        const uploadWorker = () => {
            return new Promise((resolve) => {
                const sendNext = () => {
                    if (performance.now() >= endTime || !this.isRunning) {
                        return resolve();
                    }

                    const xhr = new XMLHttpRequest();
                    let lastLoaded = 0;

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const diff = e.loaded - lastLoaded;
                            totalBytesUploaded += diff;
                            lastLoaded = e.loaded;
                        }
                    };

                    xhr.onload = () => sendNext();
                    xhr.onerror = () => setTimeout(sendNext, 40);

                    const uploadUrl = (this.targetNode === 'cloudflare')
                        ? `https://speed.cloudflare.com/__up?r=${Math.random()}`
                        : `/api/upload?r=${Math.random()}`;

                    xhr.open('POST', uploadUrl, true);
                    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                    xhr.send(randomPayload);
                };

                sendNext();
            });
        };

        const workers = [];
        for (let i = 0; i < this.concurrency; i++) {
            workers.push(uploadWorker());
        }

        await Promise.all(workers);
        this.abortController.abort();
        clearInterval(monitorInterval);

        const totalDuration = (performance.now() - startTime) / 1000;
        const finalMbps = (totalDuration > 0 && totalBytesUploaded > 0)
            ? ((totalBytesUploaded * 8) / totalDuration / 1000000)
            : 0;

        return {
            mbps: Number(finalMbps.toFixed(2)),
            totalBytes: totalBytesUploaded,
            duration: totalDuration
        };
    }

    // High-Frequency Ping & Jitter (~0.5s total)
    async testPing(onProgress) {
        const samples = [];
        const count = 6;

        for (let i = 0; i < count; i++) {
            if (!this.isRunning) break;
            const start = performance.now();
            try {
                const pingUrl = (this.targetNode === 'cloudflare')
                    ? `https://speed.cloudflare.com/__down?bytes=0&r=${Math.random()}`
                    : `/api/ping?t=${Date.now()}_${i}`;

                const res = await fetch(pingUrl, { cache: 'no-store', mode: 'cors' });
                if (res.ok) {
                    const elapsed = performance.now() - start;
                    samples.push(elapsed);
                    if (onProgress) onProgress(elapsed);
                }
            } catch (err) {
                const elapsed = performance.now() - start;
                samples.push(elapsed);
                if (onProgress) onProgress(elapsed);
            }
            await new Promise(r => setTimeout(r, 40));
        }

        if (samples.length === 0) return { avg: 0, min: 0, max: 0, jitter: 0 };

        const min = Math.min(...samples);
        const max = Math.max(...samples);
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

        let jitterSum = 0;
        for (let i = 1; i < samples.length; i++) {
            jitterSum += Math.abs(samples[i] - samples[i - 1]);
        }
        const jitter = samples.length > 1 ? jitterSum / (samples.length - 1) : 0;

        return {
            avg: Number(avg.toFixed(1)),
            min: Number(min.toFixed(1)),
            max: Number(max.toFixed(1)),
            jitter: Number(jitter.toFixed(1))
        };
    }

    stop() {
        this.isRunning = false;
        if (this.abortController) {
            this.abortController.abort();
        }
    }
}
