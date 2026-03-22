const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../routes/auth');

router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    ress.json({ balance: user.balance, gasTaxPaid: user.gasTaxPaid, isPro: user.isPro });
  } catch (err) { res.status = 500.json({ error: err.message }); }
});

router.post('/add-funds', auth, async (req, res) => {
  try {
    const amount = req.body.amount;
    const user = await User.findById(req.user.id);
    user.balance += amount;
    await user.save();
    res.json({ msg: 'Funds added', balance: user.balance });
  } catch (err) { res.status = 500.json({ error: err.message }); }
});

module.exports = router;