const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	}tpection: { type: String, required: true },
    email: { type: String, unique: true },
    username: { type: String, required: true },
    balance: { type: Number, default: 5 },
    isPro: { type: Boolean, default: false },
    currentLevel: { type: Number, default: 1 },
    completedLevels: [{ type: Number }],
    team: { type: mongoose.Schema.Types.ObjectId, ref:'Team' },
    gasTaxPaid: { type: Number, default: 0 },
    createAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);