// config/db.js
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/syncboard';

const connectDB = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");

    const conn = await mongoose.connect(MONGO_URI);  // 🛠️ FIX: store result in 'conn'

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);  // ✅ now works
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
