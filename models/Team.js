const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
	name: {type: String, required: true},
    leader: { type: mongoose.Schema.Types.ObjectId, ref:'Uper' },
    members: [{type: ObjectId, ref:'Uper'}],
    totalBalance: {type: Number, default: 0},
    currentLevel: { type: Number, default: 1 },
    createAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', teamSchema);