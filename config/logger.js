/**
 * 📝 Winston Logger Setup
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        if (stack) msg += `\n${stack}`;
        return msg;
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 7
        }),
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 7
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

module.exports = { logger };
