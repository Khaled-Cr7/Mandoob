import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();


console.log("🔍 Testing ENV URL:", process.env.DATABASE_URL ? "FOUND ✅" : "NOT FOUND ❌");


const router = express.Router();

// 1. Create the connection pool
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ POOL ERROR: Could not connect to PostgreSQL', err.stack);
  }
  console.log('✅ POOL SUCCESS: Connected to PostgreSQL');
  release();
});

// 2. Create the adapter
const adapter = new PrismaPg(pool);

// 3. Initialize Prisma with the adapter
const prisma = new PrismaClient({ adapter });

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log("🚀 Login attempt received:", username);

  try {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { username: username },
    });

    // 2. Check if user exists
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 3. Check password (Simple check for now)
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 4. Send back the User Data + Role
    res.json({
      id: user.id,
      name: user.name,
      role: user.role, // This is the 'ADMIN' or 'USER' string
    });
  } catch (error) {
    console.error("❌ DATABASE ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;