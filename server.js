const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors);
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/puzzle-game')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log(err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/puzzles', require('./routes/puzzles'));
app.use('/api/puzzles-v2', require('./routes/puzzles_v2')); // ✅ النظام الجديد
app.use('/api/payment', require('./routes/payment'));
app.use('/api/teams', require('./routes/teams'));

app.use('/file', express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));