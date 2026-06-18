import express from 'express';
import {prisma} from '../index';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();


router.post('/login', async (req, res) => {
  let { username, password, deviceId, deviceModel, brand, deviceName, pushToken } = req.body;

  try {
    username = username?.toLowerCase().trim();
    password = password?.trim();
    deviceId = String(deviceId).trim();

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "INVALID_CREDENTIALS" });
    }

    const existingDeviceOwner = await prisma.userDevice.findUnique({
      where: { deviceId }
    });

    const isExceptionDevice = deviceId === 'UNKNOWN_ID' || deviceId === '24d1fec2af727c32';

    if (existingDeviceOwner && existingDeviceOwner.userId !== user.id && !isExceptionDevice) {
      return res.status(403).json({ 
        message: "DEVICE_LINKED_ELSEWHERE",
        errorDetail: "This device is already linked to another account." 
      });
    }

    // --- RATE LIMIT CHECK ---
    const existingCode = await prisma.validationCode.findUnique({
      where: { deviceId }
    });

    const now = new Date();
    if (existingCode) {
      const secondsSinceLastCode = (now.getTime() - existingCode.createdAt.getTime()) / 1000;
      if (secondsSinceLastCode < 60) {
        return res.status(429).json({ 
          message: "RATE_LIMIT_EXCEEDED",
          secondsRemaining: Math.ceil(60 - secondsSinceLastCode)
        });
      }
    }

    // 1. Get current device state
    const existingDevice = await prisma.userDevice.findUnique({
      where: { deviceId }
    });

    // --- CASE 1: SUCCESS (ALREADY ACTIVE) ---
    if (existingDevice && existingDevice.status === 'ACTIVE') {
      await prisma.userDevice.update({
        where: { deviceId },
        // 🔑 FIX: Don't overwrite with null if pushToken is missing this time
        data: { userId: user.id, pushToken: pushToken || existingDevice.pushToken, lastUsed: now }
      });
      return res.json({ id: user.id, role: user.role, needsOTP: false });
    }

    // --- CASE 2: DENIED ---
    if (existingDevice && existingDevice.status === 'DENIED') {
      return res.json({ id: user.id, role: user.role, needsOTP: true, message: "DEVICE_DENIED" });
    }

    // --- CASE 3: NEW OR PENDING ---
    await prisma.userDevice.upsert({
      where: { deviceId },
      update: {
        userId: user.id,
        lastUsed: now,
        // 🔑 FIX: Keep old token if new one is empty
        pushToken: pushToken || existingDevice?.pushToken 
      },
      create: {
        userId: user.id,
        deviceId,
        deviceName,
        deviceModel,
        brand,
        pushToken: pushToken || null,
        status: 'PENDING'
      }
    });

    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    await prisma.validationCode.upsert({
      where: { deviceId }, 
      update: { code: generatedCode, expiresAt, createdAt: now, userId: user.id },
      create: {
        userId: user.id,
        deviceId,
        code: generatedCode,
        expiresAt
      }
    });

    return res.json({ 
      id: user.id, 
      role: user.role, 
      needsOTP: true, 
      message: "OTP_REQUIRED" // If we reached here, it's a normal OTP flow
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "SYSTEM_ERROR" });
  }
});

// POST /api/logout
router.post('/logout', async (req, res) => {
  const { userId, deviceId } = req.body;

  try {
    await prisma.userDevice.update({
      where: {
        userId_deviceId: {
          userId: Number(userId),
          deviceId: deviceId,
        },
      },
      data: { pushToken: null },
    });

    res.json({ success: true });
  } catch (error) {
    // We don't want to block the user from logging out if the server fails
    res.status(500).json({ message: "Logout recorded locally only" });
  }
});



export default router;