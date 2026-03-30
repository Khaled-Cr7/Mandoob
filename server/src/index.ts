import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth'; // The file we talked about earlier
import phoneRoutes from './routes/phones';
import adminUserRoutes from './routes/adminUsers';
import profileRouter from './routes/profile';
import path from 'path';

const app = express();
const PORT = 3000;

// 1. Middleware
app.use(cors()); // Allows your Expo app to talk to this server
app.use(express.json()); // Allows the server to read the Email/Password JSON

// 2. Routes
app.use('/api', authRoutes); // This makes your login live at /api/login

app.use('/api/phones', phoneRoutes);

app.use('/api/admin/users', adminUserRoutes);

app.use('/api/profile', profileRouter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 3. Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on Khaled's Laptop`);
});