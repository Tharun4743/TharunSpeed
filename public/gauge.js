/**
 * Gauge & Chart Visualizer Module
 * Handles circular glowing speedometer and live bandwidth waveform graph
 */
class SpeedVisualizer {
    constructor(gaugeCanvasId, chartCanvasId) {
        this.gaugeCanvas = document.getElementById(gaugeCanvasId);
        this.gaugeCtx = this.gaugeCanvas ? this.gaugeCanvas.getContext('2d') : null;

        this.chartCanvas = document.getElementById(chartCanvasId);
        this.chartCtx = this.chartCanvas ? this.chartCanvas.getContext('2d') : null;

        this.currentValue = 0;
        this.targetValue = 0;
        this.maxGaugeSpeed = 100; // auto-scales to 100, 500, 1000 Mbps
        this.stageColor = '#00f2fe';

        this.chartDataDownload = [];
        this.chartDataUpload = [];
        this.maxChartPoints = 60;

        this.animationFrame = null;
        this.initCanvasDPI();
        this.startLoop();

        window.addEventListener('resize', () => this.initCanvasDPI());
    }

    initCanvasDPI() {
        if (this.gaugeCanvas) {
            const rect = this.gaugeCanvas.getBoundingClientRect();
            this.gaugeCanvas.width = rect.width * window.devicePixelRatio || 360 * 2;
            this.gaugeCanvas.height = rect.height * window.devicePixelRatio || 360 * 2;
        }

        if (this.chartCanvas) {
            const rect = this.chartCanvas.getBoundingClientRect();
            this.chartCanvas.width = rect.width * window.devicePixelRatio || 800 * 2;
            this.chartCanvas.height = rect.height * window.devicePixelRatio || 160 * 2;
        }
    }

    setSpeed(speed, stage = 'download') {
        this.targetValue = Math.max(0, speed);
        if (this.targetValue > 800) this.maxGaugeSpeed = 1000;
        else if (this.targetValue > 400) this.maxGaugeSpeed = 1000;
        else if (this.targetValue > 80) this.maxGaugeSpeed = 500;
        else this.maxGaugeSpeed = 100;

        if (stage === 'upload') {
            this.stageColor = '#9d4edd';
        } else if (stage === 'ping') {
            this.stageColor = '#10b981';
        } else {
            this.stageColor = '#00f2fe';
        }
    }

    addChartPoint(value, type = 'download') {
        if (type === 'download') {
            this.chartDataDownload.push(value);
            if (this.chartDataDownload.length > this.maxChartPoints) {
                this.chartDataDownload.shift();
            }
        } else {
            this.chartDataUpload.push(value);
            if (this.chartDataUpload.length > this.maxChartPoints) {
                this.chartDataUpload.shift();
            }
        }
    }

    resetChart() {
        this.chartDataDownload = [];
        this.chartDataUpload = [];
        this.targetValue = 0;
        this.currentValue = 0;
    }

    startLoop() {
        const render = () => {
            // Smooth interpolation
            this.currentValue += (this.targetValue - this.currentValue) * 0.15;
            this.drawGauge();
            this.drawChart();
            this.animationFrame = requestAnimationFrame(render);
        };
        render();
    }

    drawGauge() {
        if (!this.gaugeCtx) return;
        const ctx = this.gaugeCtx;
        const width = this.gaugeCanvas.width;
        const height = this.gaugeCanvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const radius = (Math.min(width, height) / 2) - 30;

        ctx.clearRect(0, 0, width, height);

        const startAngle = 0.75 * Math.PI;
        const endAngle = 2.25 * Math.PI;
        const totalAngle = endAngle - startAngle;

        // Background Track Arc
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Active Speed Glow Arc
        const speedRatio = Math.min(1, this.currentValue / this.maxGaugeSpeed);
        const currentAngle = startAngle + (speedRatio * totalAngle);

        if (speedRatio > 0.005) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, currentAngle);
            ctx.strokeStyle = this.stageColor;
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.shadowColor = this.stageColor;
            ctx.shadowBlur = 24;
            ctx.stroke();
            ctx.restore();
        }

        // Scale Ticks
        const ticksCount = 20;
        for (let i = 0; i <= ticksCount; i++) {
            const angle = startAngle + (i / ticksCount) * totalAngle;
            const isMajor = i % 5 === 0;
            const innerR = radius - (isMajor ? 24 : 14);
            const outerR = radius - 8;

            const x1 = cx + Math.cos(angle) * innerR;
            const y1 = cy + Math.sin(angle) * innerR;
            const x2 = cx + Math.cos(angle) * outerR;
            const y2 = cy + Math.sin(angle) * outerR;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = (angle <= currentAngle && speedRatio > 0) ? this.stageColor : 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = isMajor ? 3 : 1.5;
            ctx.stroke();
        }
    }

    drawChart() {
        if (!this.chartCtx) return;
        const ctx = this.chartCtx;
        const width = this.chartCanvas.width;
        const height = this.chartCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let y = 0; y < height; y += height / 4) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw series function
        const drawSeries = (data, strokeColor, fillColor) => {
            if (data.length < 2) return;

            const maxVal = Math.max(...data, 50, this.maxGaugeSpeed);
            const stepX = width / (this.maxChartPoints - 1);

            ctx.beginPath();
            data.forEach((val, index) => {
                const x = index * stepX;
                const y = height - (val / maxVal) * (height - 20) - 10;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 4;
            ctx.shadowColor = strokeColor;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Fill under line
            const lastIndex = data.length - 1;
            ctx.lineTo(lastIndex * stepX, height);
            ctx.lineTo(0, height);
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
        };

        if (this.chartDataDownload.length > 1) {
            drawSeries(this.chartDataDownload, '#00f2fe', 'rgba(0, 242, 254, 0.1)');
        }

        if (this.chartDataUpload.length > 1) {
            drawSeries(this.chartDataUpload, '#9d4edd', 'rgba(157, 78, 221, 0.1)');
        }
    }
}
