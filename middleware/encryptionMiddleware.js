/**
 * 🛡️ Encryption Middleware
 * Apply encryption to sensitive data
 */

const {
    EncryptionEngine,
    FieldEncryptor,
    E2EEncryption,
    ENCRYPTION_CONFIG
} = require('./encryption');

// ============== Middleware ==============

// Encrypt response data for sensitive fields
const encryptResponse = (fields = []) => {
    return async (req, res, next) => {
        const originalJson = res.json.bind(res);
        
        res.json = function(data) {
            if (data && typeof data === 'object' && fields.length > 0) {
                const encryptor = global.fieldEncryptor || new FieldEncryptor(global.encryptionEngine || new EncryptionEngine());
                
                // Encrypt specified fields
                for (const field of fields) {
                    if (data[field]) {
                        try {
                            const encrypted = (global.encryptionEngine || new EncryptionEngine()).encrypt(
                                JSON.stringify(data[field]),
                                `${req.user?.userId || 'public'}:${field}`
                            );
                            data[field] = `[ENCRYPTED:${encrypted.encrypted.substring(0, 20)}...]`;
                        } catch (e) {
                            console.error('Encryption error:', e);
                        }
                    }
                }
            }
            
            return originalJson(data);
        };
        
        next();
    };
};

// Decrypt request data
const decryptRequest = (fields = []) => {
    return async (req, res, next) => {
        if (req.body && typeof req.body === 'object') {
            const encryptor = global.encryptionEngine || new EncryptionEngine();
            
            for (const field of fields) {
                if (req.body[field] && typeof req.body[field] === 'object') {
                    try {
                        const decrypted = encryptor.decrypt(
                            req.body[field],
                            `${req.user?.userId || 'public'}:${field}`
                        );
                        req.body[field] = JSON.parse(decrypted);
                    } catch (e) {
                        console.error('Decryption error:', e);
                    }
                }
            }
        }
        
        next();
    };
};

// Generate encrypted API key for user
const generateSecureAPIKey = async (userId) => {
    const engine = global.encryptionEngine || new EncryptionEngine();
    const apiKey = engine.generateAPIKey('mrbt');
    
    // Hash the API key for storage
    const { hash, salt } = engine.hash(apiKey);
    
    return {
        apiKey,
        apiKeyHash: hash,
        apiKeySalt: salt
    };
};

// Verify API key
const verifyAPIKey = async (apiKey, storedHash, salt) => {
    const engine = global.encryptionEngine || new EncryptionEngine();
    return engine.verifyHash(apiKey, storedHash, salt);
};

// Encrypt sensitive user data before saving
const encryptUserData = (userData, fields = ['walletAddress', 'apiKeys', 'privateData']) => {
    const encryptor = global.fieldEncryptor || new FieldEncryptor(global.encryptionEngine || new EncryptionEngine());
    return encryptor.encryptFields(userData, fields);
};

// Decrypt sensitive user data after retrieval
const decryptUserData = (userData, fields = ['walletAddress', 'apiKeys', 'privateData']) => {
    const encryptor = global.fieldEncryptor || new FieldEncryptor(global.encryptionEngine || new EncryptionEngine());
    return encryptor.decryptFields(userData, fields);
};

// Generate key pair for user
const generateUserKeyPair = () => {
    const e2e = global.e2eEncryption || new E2EEncryption();
    return e2e.generateKeyPair();
};

// Sign data
const signData = (data, privateKey) => {
    const e2e = global.e2eEncryption || new E2EEncryption();
    return e2e.sign(data, privateKey);
};

// Verify signature
const verifySignature = (data, signature, publicKey) => {
    const e2e = global.e2eEncryption || new E2EEncryption();
    return e2e.verify(data, signature, publicKey);
};

// ============== Export ==============
module.exports = {
    encryptResponse,
    decryptRequest,
    generateSecureAPIKey,
    verifyAPIKey,
    encryptUserData,
    decryptUserData,
    generateUserKeyPair,
    signData,
    verifySignature,
    ENCRYPTION_CONFIG
};
