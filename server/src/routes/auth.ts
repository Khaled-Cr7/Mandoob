import express from 'express';
import {prisma} from '../index';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();


router.post('/login', async (req, res) => {
  const { username, password, deviceId, deviceModel, brand, deviceName, pushToken } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim()},
    });

    if (!user || user.password !== password.trim()) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const existingDeviceOwner = await prisma.userDevice.findUnique({
      where: { deviceId: String(deviceId) }
    });

    // If the device exists AND it belongs to someone else
    if (existingDeviceOwner && existingDeviceOwner.userId !== user.id) {
      return res.status(403).json({ 
        message: "DEVICE_LINKED_ELSEWHERE",
        errorDetail: "This device is already linked to another account." 
      });
    }



    // 1. Check if this device is already in our table
    const existingDevice = await prisma.userDevice.findFirst({
      where: { userId: user.id, deviceId: deviceId }
    });

    // --- CASE 1: SUCCESS (ALREADY ACTIVE) ---
    if (existingDevice && existingDevice.status === 'ACTIVE') {
      await prisma.userDevice.update({
        where: { deviceId: deviceId },
        data: { pushToken: pushToken || existingDevice.pushToken, lastUsed: new Date() }
      });
      return res.json({ id: user.id, role: user.role, needsOTP: false });
    }

    // --- CASE 2: DENIED ---
    // If it's denied, just send to OTP page (the OTP page will show the "Banned" UI)
    if (existingDevice && existingDevice.status === 'DENIED') {
      return res.json({ id: user.id, role: user.role, needsOTP: true, message: "DEVICE_DENIED" });
    }

    // --- CASE 3: NEW OR PENDING (NEEDS CODE) ---
    // We use UPSERT here to either create a new record or update the existing PENDING one
    await prisma.userDevice.upsert({
      where: { deviceId: deviceId },
      update: {
        lastUsed: new Date(),
        pushToken: pushToken || null
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

    // ALWAYS generate/refresh the code for PENDING devices on login
    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000); // 5 Minutes

    await prisma.validationCode.upsert({
      where: { deviceId: deviceId }, 
      update: { code: generatedCode, expiresAt: expiresAt, createdAt: new Date(), userId: user.id },
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