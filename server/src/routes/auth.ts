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
  const { username, password, deviceId, deviceModel, brand, deviceName, pushToken } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 1. Check if this device is already in our table
    const existingDevice = await prisma.userDevice.findFirst({
      where: { userId: user.id, deviceId: deviceId }
    });

    // --- CASE 1: SUCCESS (ALREADY ACTIVE) ---
    if (existingDevice && existingDevice.status === 'ACTIVE') {
      return res.json({ id: user.id, role: user.role, needsOTP: false });
    }

    // --- CASE 2: DENIED ---
    // If it's denied, just send to OTP page (the OTP page will show the "Banned" UI)
    if (existingDevice && existingDevice.status === 'DENIED') {
      return res.json({ id: user.id, role: user.role, needsOTP: true });
    }

    // --- CASE 3: NEW OR PENDING (NEEDS CODE) ---
    // We use UPSERT here to either create a new record or update the existing PENDING one
    await prisma.userDevice.upsert({
      where: { deviceId: deviceId },
      update: { lastUsed: new Date() }, // Don't update 'status' here!
      create: {
        userId: user.id,
        deviceId,
        deviceName,
        deviceModel,
        brand,
        status: 'PENDING'
      }
    });

    // ALWAYS generate/refresh the code for PENDING devices on login
    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000); // 5 Minutes

    await prisma.validationCode.upsert({
      where: { deviceId: deviceId }, 
      update: { code: generatedCode, expiresAt: expiresAt, createdAt: new Date() },
      create: {
        userId: user.id,
        deviceId: deviceId,
        code: generatedCode,
        expiresAt: expiresAt
      }
    });

    return res.json({ 
      id: user.id, 
      role: user.role, 
      needsOTP: true, 
      message: "Device verification required." 
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Login Error" });
  }
});

export default router;