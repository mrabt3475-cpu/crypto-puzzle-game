/**
 * 🔒 Environment Variables Validator
 */

const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET'
];

const validateEnvironment = () => {
    const missing = [];

    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    if (missing.length > 0) {
        console.error(`❌ Missing required environment variables:\n  - ${missing.join('\n  - ')}`);
        process.exit(1);
    }

    if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
    if (!process.env.LOG_LEVEL) process.env.LOG_LEVEL = 'info';

    console.log('✅ Environment validation passed');
};

module.exports = { validateEnvironment };
