// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");

    mongoose.connect(MONGO_URI);


    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;
