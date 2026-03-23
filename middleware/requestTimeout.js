/**
 * ⏱️ Request Utilities
 * Request ID, Timeout, and API Version
 */

const { v4: uuidv4 } = require('uuid');

const requestId = (req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
};

const createRequestTimeout = (timeoutMs = 30000) => {
    return (req, res, next) => {
        res.setTimeout(timeoutMs, () => {
            res.status(408).json({
                error: 'Request timeout',
                message: 'The server took too long to process your request'
            });
        });
        next();
    };
};

const apiVersion = (req, res, next) => {
    req.apiVersion = req.headers['accept-version'] || 'v1';
    next();
};

module.exports = {
    requestId,
    createRequestTimeout,
    apiVersion
};
