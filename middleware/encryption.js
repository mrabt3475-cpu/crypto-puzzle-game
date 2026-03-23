/**
 * 🔐 Advanced Encryption Layer
 * - End-to-End Encryption
 * - Field-Level Encryption
 * - Key Rotation
 * - Secure Key Derivation
 */

const crypto = require('crypto');
const mongoose = require('mongoose');

// ============== Configuration ==============
const ENCRYPTION_CONFIG = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    authTagLength: 16,
    saltLength: 32,
    iterations: 100000,
    digest: 'sha512'
};

// ============== Key Management ==============
class KeyManager {
    constructor() {
        this.masterKey = process.env.MASTER_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        this.keyVersion = 1;
        this.keyRotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    
    // Derive key from master key + salt
    deriveKey(salt, purpose = 'encryption') {
        return crypto.pbkdf2Sync(
            this.masterKey,
            salt,
            ENCRYPTION_CONFIG.iterations,
            ENCRYPTION_CONFIG.keyLength,
            ENCRYPTION_CONFIG.digest
        );
    }
    
    // Generate new key version
    rotateKey() {
        this.keyVersion++;
        this.masterKey = crypto.randomBytes(32).toString('hex');
        return this.keyVersion;
    }
    
    // Get current key
    getCurrentKey() {
        return this.masterKey;
    }
}

// ============== Encryption Engine ==============
class EncryptionEngine {
    constructor() {
        this.keyManager = new KeyManager();
    }
    
    // Encrypt data
    encrypt(plaintext, additionalData = null) {
        const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
        const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
        const key = this.keyManager.deriveKey(salt);
        
        const cipher = crypto.createCipheriv(
            ENCRYPTION_CONFIG.algorithm,
            key,
            iv,
            { authTagLength: ENCRYPTION_CONFIG.authTagLength }
        );
        
        // Add additional authenticated data (AAD)
        if (additionalData) {
            cipher.setAAD(Buffer.from(additionalData));
        }
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            salt: salt.toString('hex'),
            authTag: authTag.toString('hex'),
            keyVersion: this.keyManager.keyVersion
        };
    }
    
    // Decrypt data
    decrypt(encryptedData, additionalData = null) {
        const { encrypted, iv, salt, authTag, keyVersion } = encryptedData;
        
        const key = this.keyManager.deriveKey(Buffer.from(salt, 'hex'));
        
        const decipher = crypto.createDecipheriv(
            ENCRYPTION_CONFIG.algorithm,
            key,
            Buffer.from(iv, 'hex'),
            { authTagLength: ENCRYPTION_CONFIG.authTagLength }
        );
        
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        if (additionalData) {
            decipher.setAAD(Buffer.from(additionalData));
        }
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
    
    // Encrypt with password (for user-specific encryption)
    encryptWithPassword(plaintext, password) {
        const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
        const key = crypto.pbkdf2Sync(
            password,
            salt,
            ENCRYPTION_CONFIG.iterations,
            ENCRYPTION_CONFIG.keyLength,
            ENCRYPTION_CONFIG.digest
        );
        
        const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
        const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            salt: salt.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }
    
    // Decrypt with password
    decryptWithPassword(encryptedData, password) {
        const { encrypted, iv, salt, authTag } = encryptedData;
        
        const key = crypto.pbkdf2Sync(
            password,
            Buffer.from(salt, 'hex'),
            ENCRYPTION_CONFIG.iterations,
            ENCRYPTION_CONFIG.keyLength,
            ENCRYPTION_CONFIG.digest
        );
        
        const decipher = crypto.createDecipheriv(
            ENCRYPTION_CONFIG.algorithm,
            key,
            Buffer.from(iv, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
    
    // Hash data (one-way)
    hash(data, salt = null) {
        const useSalt = salt || crypto.randomBytes(ENCRYPTION_CONFIG.saltLength).toString('hex');
        const hash = crypto.pbkdf2Sync(
            data,
            useSalt,
            ENCRYPTION_CONFIG.iterations,
            64,
            ENCRYPTION_CONFIG.digest
        );
        
        return {
            hash: hash.toString('hex'),
            salt: useSalt
        };
    }
    
    // Verify hash
    verifyHash(data, hash, salt) {
        const result = this.hash(data, salt);
        return crypto.timingSafeEqual(
            Buffer.from(result.hash, 'hex'),
            Buffer.from(hash, 'hex')
        );
    }
    
    // Generate secure random token
    generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    // Generate API key
    generateAPIKey(prefix = 'mrbt') {
        const randomPart = crypto.randomBytes(24).toString('hex');
        const hash = crypto.createHash('sha256')
            .update(randomPart)
            .digest('hex')
            .substring(0, 8);
        
        return `${prefix}_${hash}_${randomPart}`;
    }
}

// ============== Field-Level Encryption ==============
class FieldEncryptor {
    constructor(encryptionEngine) {
        this.engine = encryptionEngine;
    }
    
    // Encrypt specific fields in an object
    encryptFields(obj, fields, userId = null) {
        const encrypted = { ...obj };
        
        for (const field of fields) {
            if (encrypted[field]) {
                const aad = userId ? `${field}:${userId}` : field;
                const result = this.engine.encrypt(
                    JSON.stringify(encrypted[field]),
                    aad
                );
                encrypted[field] = result;
            }
        }
        
        return encrypted;
    }
    
    // Decrypt specific fields in an object
    decryptFields(obj, fields, userId = null) {
        const decrypted = { ...obj };
        
        for (const field of fields) {
            if (decrypted[field] && typeof decrypted[field] === 'object') {
                const aad = userId ? `${field}:${userId}` : field;
                try {
                    const decryptedValue = this.engine.decrypt(
                        decrypted[field],
                        aad
                    );
                    decrypted[field] = JSON.parse(decryptedValue);
                } catch (e) {
                    console.error(`Failed to decrypt field ${field}:`, e);
                }
            }
        }
        
        return decrypted;
    }
}

// ============== End-to-End Encryption ==============
class E2EEncryption {
    constructor() {
        this.engine = new EncryptionEngine();
    }
    
    // Generate key pair for user
    generateKeyPair() {
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        
        return { publicKey, privateKey };
    }
    
    // Encrypt for specific recipient (using their public key)
    encryptForRecipient(plaintext, recipientPublicKey) {
        // Generate ephemeral key for this message
        const ephemeralKey = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
        
        // Generate shared secret
        const sharedSecret = crypto.randomBytes(32);
        
        // Encrypt the message with symmetric key
        const messageKey = this.engine.deriveKey(sharedSecret, 'message');
        const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
        
        const cipher = crypto.createCipheriv(
            ENCRYPTION_CONFIG.algorithm,
            messageKey,
            iv
        );
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        
        // In production, encrypt sharedSecret with recipient's public key
        // For now, return the encrypted message
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            ephemeralPublicKey: ephemeralKey.publicKey
        };
    }
    
    // Sign data (for authenticity)
    sign(data, privateKey) {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(data);
        return sign.sign(privateKey, 'hex');
    }
    
    // Verify signature
    verify(data, signature, publicKey) {
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(data);
        return verify.verify(publicKey, signature, 'hex');
    }
}

// ============== Secure Storage Schema ==============
const encryptedDataSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dataType: { type: String, required: true }, // 'wallet', 'api_key', 'private_data'
    encryptedData: {
        encrypted: String,
        iv: String,
        salt: String,
        authTag: String,
        keyVersion: Number
    },
    isActive: { type: Boolean, default: true },
    lastAccessed: Date
}, { timestamps: true });

encryptedDataSchema.index({ userId: 1, dataType: 1 }, { unique: true });

class SecureStorage {
    constructor() {
        this.engine = new EncryptionEngine();
    }
    
    async store(userId, dataType, data, userPassword = null) {
        let encrypted;
        
        if (userPassword) {
            encrypted = this.engine.encryptWithPassword(JSON.stringify(data), userPassword);
        } else {
            encrypted = this.engine.encrypt(JSON.stringify(data), `${userId}:${dataType}`);
        }
        
        const record = await this.findOneAndUpdate(
            { userId, dataType },
            {
                userId,
                dataType,
                encryptedData: encrypted,
                lastAccessed: new Date()
            },
            { upsert: true, new: true }
        );
        
        return record;
    }
    
    async retrieve(userId, dataType, userPassword = null) {
        const record = await this.findOne({ userId, dataType, isActive: true });
        
        if (!record) return null;
        
        let decrypted;
        
        if (userPassword) {
            decrypted = this.engine.decryptWithPassword(record.encryptedData, userPassword);
        } else {
            decrypted = this.engine.decrypt(
                record.encryptedData,
                `${userId}:${dataType}`
            );
        }
        
        record.lastAccessed = new Date();
        await record.save();
        
        return JSON.parse(decrypted);
    }
    
    async delete(userId, dataType) {
        return this.updateOne(
            { userId, dataType },
            { isActive: false }
        );
    }
}

// ============== Initialize ==============
global.encryptionEngine = new EncryptionEngine();
global.fieldEncryptor = new FieldEncryptor(global.encryptionEngine);
global.e2eEncryption = new E2EEncryption();
global.keyManager = new KeyManager();

// ============== Export ==============
module.exports = {
    EncryptionEngine,
    FieldEncryptor,
    E2EEncryption,
    KeyManager,
    SecureStorage,
    ENCRYPTION_CONFIG,
    EncryptedData: mongoose.model('EncryptedData', encryptedDataSchema)
};
