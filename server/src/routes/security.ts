import express, { Request, Response } from 'express';
import { PrismaClient, DeviceStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';

const { Pool } = pkg;
const router = express.Router();

// 1. Set up the connection pool (The Bridge)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// 2. Pass the adapter to Prisma (Matches your other routes!)
const prisma = new PrismaClient({ adapter });

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

    const updatedDevice = await prisma.userDevice.update({
      where: { id: Number(id) },
      data: { status: status },
    });

    // If Admin authorizes the device, clean up the validation code table
    if (status === 'ACTIVE') {
      await prisma.validationCode.deleteMany({
        where: { deviceId: updatedDevice.deviceId }
      });
    }

    return res.json(updatedDevice);
  } catch (error) {
    console.error("Update Status Error:", error);
    return res.status(500).json({ message: "Status update failed" });
  }
});

router.get('/check-status', async (req, res) => {
  const { deviceId, userId } = req.query;

  try {
    // 1. Check device status
    const device = await prisma.userDevice.findFirst({
      where: { deviceId: String(deviceId), userId: Number(userId) }
    });

    // 2. Get current validation code
    const valCode = await prisma.validationCode.findFirst({
      where: { deviceId: String(deviceId), userId: Number(userId) },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: device?.status || 'PENDING',
      code: valCode?.code || '----',
      expiresAt: valCode?.expiresAt
    });
  } catch (error) {
    res.status(500).json({ error: "Check failed" });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { userId, deviceId, code } = req.body;

  const validRecord = await prisma.validationCode.findFirst({
    where: {
      userId: Number(userId),
      deviceId: String(deviceId),
      code: String(code),
      expiresAt: { gt: new Date() } // Must not be expired
    }
  });

  if (validRecord) {
    // 1. Update device to ACTIVE
    await prisma.userDevice.update({
      where: { deviceId: String(deviceId) },
      data: { status: 'ACTIVE' }
    });

    // 2. Cleanup code
    await prisma.validationCode.deleteMany({ where: { deviceId: String(deviceId) } });

    return res.status(200).json({ message: "Verified" });
  }

  return res.status(401).json({ message: "Invalid or expired code" });
});



export default router;