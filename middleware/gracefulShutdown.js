/**
 * 🔄 Graceful Shutdown Handler
 */

const { logger } = require('./logger');

const gracefulShutdown = (server) => {
    process.on('SIGTERM', () => {
        logger.info('SIGTERM received, starting graceful shutdown...');

        server.close(() => {
            logger.info('HTTP server closed');

            const mongoose = require('mongoose');
            mongoose.connection.close(false, () => {
                logger.info('MongoDB connection closed');
                process.exit(0);
            });
        });

        setTimeout(() => {
            logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 30000);
    });

    process.on('SIGINT', () => {
        logger.info('SIGINT received, starting graceful shutdown...');
        server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
        });
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection:', reason);
    });

    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        process.exit(1);
    });
};

module.exports = { gracefulShutdown };
