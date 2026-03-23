/**
 * ✅ Input Validation Middleware
 * Using Joi for schema validation
 */

const Joi = require('joi');

// Validation schemas
const schemas = {
    register: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/).required(),
        walletAddress: Joi.string().allow('', null),
        referralCode: Joi.string().allow('', null)
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    puzzleStart: Joi.object({
        level: Joi.number().integer().min(1).max(50).required()
    }),

    puzzleSubmit: Joi.object({
        puzzleId: Joi.string().uuid().required(),
        answer: Joi.string().min(1).max(1000).required(),
        timeSpent: Joi.number().integer().min(0)
    }),

    paymentCreate: Joi.object({
        amount: Joi.number().positive().min(1).max(10000).required(),
        currency: Joi.string().valid('USDT', 'TON', 'BTC').required(),
        network: Joi.string().valid('TRC20', 'ERC20', 'BEP20').required()
    })
};

const validate = (schemaName) => {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return res.status(500).json({ error: 'Validation schema not found' });
        }

        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        req.validatedBody = value;
        next();
    };
};

module.exports = { validate, schemas };
