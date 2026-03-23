/**
 * Competition Model - مسابقة الألغاز
 */

const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: 'Weekly Puzzle Championship'
    },
    description: {
        type: String,
        default: 'مسابقة الألغاز الأسبوعية'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    prize: {
        type: Number,
        required: true,
        default: 1000
    },
    prizeCurrency: {
        type: String,
        default: 'USDT'
    },
    minLevel: {
        type: Number,
        default: 1
    },
    status: {
        type: String,
        enum: ['upcoming', 'active', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    participants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        currentLevel: {
            type: Number,
            default: 1
        },
        completedPuzzles: {
            type: Number,
            default: 0
        },
        totalTime: {
            type: Number,
            default: 0
        },
        lastActiveAt: {
            type: Date,
            default: Date.now
        },
        rank: {
            type: Number,
            default: 0
        },
        isWinner: {
            type: Boolean,
            default: false
        },
        prizeClaimed: {
            type: Boolean,
            default: false
        }
    }],
    winners: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rank: Number,
        prize: Number,
        claimedAt: Date
    }],
    rules: {
        type: String,
        default: 'أسرع شخص يكمل جميع المستويات يفوز بالجائزة الكبرى!'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

competitionSchema.index({ status: 1, startDate: 1 });
competitionSchema.index({ 'participants.user': 1 });

competitionSchema.virtual('isActive').get(function() {
    const now = new Date();
    return this.status === 'active' && now >= this.startDate && now <= this.endDate;
});

competitionSchema.methods.canJoin = function(userId) {
    if (this.status !== 'active') return false;
    const now = new Date();
    if (now < this.startDate || now > this.endDate) return false;
    const participant = this.participants.find(p => p.user.toString() === userId.toString());
    return !participant;
};

competitionSchema.methods.checkWinner = async function() {
    const winner = this.participants.find(p => p.completedPuzzles >= 20 && !p.isWinner);
    if (winner) {
        winner.isWinner = true;
        this.winners.push({ user: winner.user, rank: 1, prize: this.prize, claimedAt: null });
        this.status = 'completed';
        await this.save();
        return winner;
    }
    return null;
};

competitionSchema.statics.getActive = async function() {
    return this.findOne({ status: 'active' }).populate('participants.user', 'username email').sort({ startDate: -1 });
};

competitionSchema.statics.createWeekly = async function(prize = 1000) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setHours(startDate.getHours() + 1);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    return this.create({
        name: 'Weekly Puzzle Championship',
        description: 'مسابقة الألغاز الأسبوعية - الجائزة الكبرى 1000$',
        startDate,
        endDate,
        prize,
        status: 'active',
        rules: '🎯 أول شخص يكمل جميع المستويات (20 مستوى) يفوز بالجائزة!\n\n📋 القواعد:\n• المسابقة مفتوحة للجميع\n• كل لغز يجب حله بشكل صحيح\n• السرعة مهمة للتصدر الترتيب\n• الجائزة: 1000 USDT'
    });
};

module.exports = mongoose.model('Competition', competitionSchema);
