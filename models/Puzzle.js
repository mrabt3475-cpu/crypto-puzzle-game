const mongoose = require('mongoose');

const puzzleSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Uper' },
    level: { type: Number, required: true },
    puzzleData: {
      type: String,
      question: String,
      hint: String,
      solution: String,
      difficulty: Number
    },
    solved: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    gasTax: { type: Number, default: 0.01 },
    createAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Puzzle', puzzleSchema);