/**
 * 📊 Monitoring & Metrics
 * - Health checks
 * - Performance metrics
 * - Error tracking
 * - Alerts
 */

const os = require('os');

class MonitoringService {
    constructor() {
        this.startTime = Date.now();
        this.requestCount = 0;
        this.errorCount = 0;
        this.metrics = {
            endpoints: {},
            responseTimes: [],
            errors: []
        };
    }
    
    // Record request
    recordRequest(endpoint, responseTime, statusCode) {
        this.requestCount++;
        
        if (!this.metrics.endpoints[endpoint]) {
            this.metrics.endpoints[endpoint] = { count: 0, totalTime: 0, errors: 0 };
        }
        
        const ep = this.metrics.endpoints[endpoint];
        ep.count++;
        ep.totalTime += responseTime;
        if (statusCode >= 400) ep.errors++;
        
        this.metrics.responseTimes.push(responseTime);
        if (this.metrics.responseTimes.length > 1000) {
            this.metrics.responseTimes.shift();
        }
    }
    
    // Record error
    recordError(error, context = {}) {
        this.errorCount++;
        this.metrics.errors.push({
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        });
        
        if (this.metrics.errors.length > 100) {
            this.metrics.errors.shift();
        }
        
        // Alert on critical errors
        if (error.message.includes('MongoDB') || error.message.includes('Redis')) {
            this.alert('CRITICAL', error.message, context);
        }
    }
    
    // Alert
    alert(level, message, data) {
        console.error(`🚨 [${level}] ${message}`, data);
        // In production, send to Slack, PagerDuty, etc.
    }
    
    // Health check
    getHealth() {
        const uptime = Date.now() - this.startTime;
        const memUsage = process.memoryUsage();
        const cpuLoad = os.loadavg();
        
        return {
            status: 'healthy',
            uptime: Math.floor(uptime / 1000),
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            node: process.version,
            memory: {
                rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
            },
            cpu: {
                load: cpuLoad.map(l => l.toFixed(2)),
                cores: os.cpus().length
            },
            requests: {
                total: this.requestCount,
                errors: this.errorCount,
                errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount * 100).toFixed(2) + '%' : '0%'
            }
        };
    }
    
    // Metrics
    getMetrics() {
        const avgResponseTime = this.metrics.responseTimes.length > 0
            ? (this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length).toFixed(2)
            : 0;
        
        return {
            requests: {
                total: this.requestCount,
                errors: this.errorCount,
                avgResponseTime: avgResponseTime + 'ms'
            },
            endpoints: Object.entries(this.metrics.endpoints).map(([path, data]) => ({
                path,
                requests: data.count,
                avgTime: (data.totalTime / data.count).toFixed(2) + 'ms',
                errors: data.errors,
                errorRate: data.count > 0 ? (data.errors / data.count * 100).toFixed(2) + '%' : '0%'
            })),
            recentErrors: this.metrics.errors.slice(-10)
        };
    }
    
    // Middleware
    middleware() {
        return (req, res, next) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.recordRequest(req.path, duration, res.statusCode);
            });
            
            next();
        };
    }
}

global.monitoring = new MonitoringService();

module.exports = MonitoringService;
