import express, { Request, Response } from 'express';
import { DeviceStatus } from '@prisma/client';
import { prisma } from '../index';


const router = express.Router();


// --- 1. GET ALL DEVICES ---
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as DeviceStatus;

    const devices = await prisma.userDevice.findMany({
      where: { status: status },
      include: {
        user: {
          select: {
            name: true,
            username: true,
            // This pulls the code and expiresAt from the related table
            validationCode: true, 
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return res.json(devices);
  } catch (error) {
    console.error("Security Fetch Error:", error);
    return res.status(500).json({ message: "Failed to fetch devices" });
  }
});

// --- 2. UPDATE DEVICE STATUS ---
router.put('/devices/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: DeviceStatus };

    // Prepare the update data
    const updateData: any = { status: status };

    // 🛡️ SECURITY FIX: If Admin denies/bans the device, wipe the push token
    // This prevents the device from receiving any future background notifications.
    if (status === 'DENIED') {
      updateData.pushToken = null;
    }



    const updatedDevice = await prisma.userDevice.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // If Admin authorizes the device, clean up the validation code table
    if (status === 'ACTIVE') {
      await prisma.validationCode.deleteMany({
        where: { deviceId: updatedDevice.deviceId }
      });
    }

    console.log(`🛡️ Device ${id} status changed to ${status}${status === 'DENIED' ? ' (Token Purged)' : ''}`);
    return res.json(updatedDevice);
  } catch (error) {
    console.error("Update Status Error:", error);
    return res.status(500).json({ message: "Status update failed" });
  }
});

router.get('/check-status', async (req, res) => {
  const { deviceId, userId } = req.query;

  try {

    const stringDeviceId = String(deviceId);

    // 🎯 FRONTEND EXCEPTION: Define your test device ID
    // Add your physical test device ID string to this condition if needed
    const isExceptionDevice = stringDeviceId === 'UNKNOWN_ID' || stringDeviceId === '24d1fec2af727c32';

    // Search using both pieces of info to ensure we get the EXACT record
    const device = await prisma.userDevice.findFirst({
      where: { 
        deviceId: String(deviceId),
        userId: Number(userId)
      },
      include: {
        user: { select: { role: true } }
      }
    });

    // 🛡️ If no database record exists but it is our test exception device, simulate a successful active state
    if (!device && isExceptionDevice) {
      console.log(`🛡️ Guardian Exception: Simulating ACTIVE state for exception device ${stringDeviceId}`);
      
      // Look up the user's role directly since the device record mapping isn't there
      const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
      
      return res.json({
        status: 'ACTIVE', // Force ACTIVE so the guardian stays quiet
        role: user?.role || 'USER',
        expiresAt: null
      });
    }


    if (!device) {
      console.log(`⚠️ Status check failed: No record for User ${userId} on Device ${deviceId}`);
      return res.status(404).json({ status: 'NOT_FOUND', message: "Device not found" });
    }

    // This is for your OTP screen countdown
    const otpRecord = await prisma.validationCode.findUnique({
      where: { userId: Number(userId) }
    });

    // 🛡️ If a device row exists but it's our exception device, force its status to return 'ACTIVE'
    const finalStatus = isExceptionDevice ? 'ACTIVE' : device.status;

    console.log(`🔍 Status Check: User ${userId} is currently ${finalStatus} (DB Status: ${device.status})`);

    res.json({
      status: finalStatus,
      role: device.user.role,
      expiresAt: otpRecord ? otpRecord.expiresAt : null 
    });
  } catch (e: any) {
    console.error("❌ Status Check Error:", e.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { userId, deviceId, code } = req.body;

  const validRecord = await prisma.validationCode.findFirst({
    where: {
      userId: Number(userId),
      deviceId: String(deviceId),
      code: String(code),
      expiresAt: { gt: new Date() }
    }
  });

  if (validRecord) {
    // 1. Update device to ACTIVE
    await prisma.userDevice.update({
      where: { deviceId: String(deviceId) },
      data: { status: 'ACTIVE' }
    });

    // 2. Fetch the user to get their role
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { role: true } // Only grab what we need
    });

    // 3. Cleanup code
    await prisma.validationCode.deleteMany({ where: { deviceId: String(deviceId) } });

    // 4. RETURN THE ROLE SO THE FRONTEND CAN ROUTE
    return res.status(200).json({ 
      message: "Verified", 
      role: user?.role || 'USER',
      userId: userId 
    });
  }

  return res.status(401).json({ message: "Invalid or expired code" });
});


router.post('/resend-otp', async (req, res) => {
  const { userId, deviceId } = req.body;

  try {
    // 1. Check for existing rate limit
    const existingCode = await prisma.validationCode.findUnique({
      where: { deviceId: String(deviceId) }
    });

    if (existingCode) {
      const now = new Date();
      const secondsSinceLast = (now.getTime() - existingCode.createdAt.getTime()) / 1000;
      
      // Block if they asked for a code less than 60 seconds ago
      if (secondsSinceLast < 60) {
        return res.status(429).json({ 
          message: "RATE_LIMIT_EXCEEDED", 
          secondsRemaining: Math.ceil(60 - secondsSinceLast) 
        });
      }
    }

    const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60000);

    await prisma.validationCode.upsert({
      where: { deviceId: String(deviceId) },
      update: { 
        code: generatedCode, 
        expiresAt: expiresAt, 
        createdAt: new Date() // CRITICAL: Reset the 60s timer
      },
      create: {
        userId: Number(userId),
        deviceId: String(deviceId),
        code: generatedCode,
        expiresAt: expiresAt
      }
    });

    res.json({ message: "New code generated" });
  } catch (error) {
    res.status(500).json({ message: "Resend failed" });
  }
});




export default router;