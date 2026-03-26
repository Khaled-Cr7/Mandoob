import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth'; // The file we talked about earlier
import phoneRoutes from './routes/phones';

const app = express();
const PORT = 3000;

// 1. Middleware
app.use(cors()); // Allows your Expo app to talk to this server
app.use(express.json()); // Allows the server to read the Email/Password JSON

// 2. Routes
app.use('/api', authRoutes); // This makes your login live at /api/login

app.use('/api/phones', phoneRoutes);

// 3. Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://192.168.8.100`);
});