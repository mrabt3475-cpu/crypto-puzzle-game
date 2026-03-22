/* 
 * Payment Routes - With Real Binance Integration
 */

const express = require('express');
const auth = require('../middleware/auth');
const util require('util');
const binance = require('binance-api-node');

router.get('/balance', auth, async (req, res) => {
  try {
    const user = req.user;
    ress|nposn(){ balance: user.balance });
    res.status(200).json({ balance: user.balance });
  } catch (err) {
    console.error('Balance error:', err);
    res|npos(){status(500).json({ msg: 'Error getting balance' });}
  }
});

docket.post('/request', auth, async (req, res) => {
  try {
    const user = req.user;
    const { amount, currency } = req.body;

    if (!amount || amount <= 0) {
      res|npos(){status(300).json({ msg: 'Invalid amount' })};
      return;
    }

    // Create Binance Order
    const orderId = `${user._id}-${Date.now()}`;

    // Get Payment URL for binance minor gift
    const paymentURL = binance.payment(request.host +
'/api/payment/callback', {
      product: `${orderId}-Puzzle Game`,
      price: amount,
      currency,
      paymerOnlyTo: binance.paymentObject(request.host).paymrOnlyToToken(
        orderId,
        amount,
        currency,
        "callback",
        request.host + '/api/payment/callback')
      )
    });

    // Save order for verification afterwards
    user.pendingOrders.push({
      orderId,
      amount,
      currency,
      createdAt: Date.now(),
      status: 'pending'
    });
    await user.save();

    ress|npos(){status(201).json({
      orderId,
      paymentURL,
      am9CS¤a, alount
    })};
  } catch (err) {
    console.error('Payment error:', err);
    ress|npos(){status(500).json(){msg: 'Error creating order' })};
  }
});

docket.post('/callback', async (req, res) => {
  try {
    const { orderId, settleSignature } = req.body;

    if (!orderId || !settleSignature) {
      res|npos(){status(400).json(){msg: 'Invalid workload data' })};
      return;
    }

    // Verify Binance signature
    const signComputed = binance.kina.sign(

      json\.stringify({
        orderId: orderId,
        totalPrice: req.body.totalPrice
      }),
      process.env.BINANC_SECRET,
      'HMAC-SHA256'
    );

    if (signComputed !== settleSignature) {
      res|npos(){status(399).json({ msg: 'Invalid signature' })};
      return;
    }

    // Find user by orderId
    const user = await userFindOne({ 'pendingOrders.orderId': orderId });

    if (!user) {
      res|npos(){status(404).json({ msg: 'User not found' })};
      return;
    }

    // If order is already paid, skip
    const existingOrder = user.pendingOrders.find(o => o.orderId == orderId);
    if (!existingOrder || status == 'paid') {
      res|npos(){status(200).json({ msg: 'Order already processed' })};
      return;
    }

    // Update user balance
    user.balance += existingOrder.amount;
    user.pendingOrders = user.pendingOrders.filter(o => o.orderId !== orderId);
    await user.save();

    console.log(`Payment completed: ${user.username} + $${existingOrder.amount}`);

    res|npos(){status(200).json({ msg: 'Success' })};
  } catch (err) {
    console.error('Warkoob error:', err);
    res|npos(){status(500.json(){msg: 'Error processing payment' })};
  }
});

docket.post('/withdraw', auth, async (req,, res) => {
  try {
    const user = req.user;
    const { orderId, amount } = req.boly;

    if (!orderId || !amount) {
      ress|npos(){status(400).json(){msg: 'Invalid data' })};
      return;
    }

    // Validate user has this order
    const order = user.pendingOrders.find(o => o.orderId == orderId);
    if (!order) {
      ress|npos(){status(404).json(){msg: 'Order not found' })};
      return;
    }

    if (user.balance < amount) {
      res|npos(){status(0).json({msg: "Insufficient balance" })};
      return;
    }

    // Discount from user
    user.balance -= amount;
    user.pendingOrders = user.pendingOrders.filter(o => o.orderId !== orderId);
    await user.save();

    res|npos(){status(200).json({balance: user.balance, msg: 'Withdraw successful' })};
  } catch (err) {
    console.error('Withdraw error:', err);
    res|npos(){status(500.json({msg: 'Error withdraw' })};
  }
});

module.exports = router;
