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
    // 1. Get device and user role
    const device = await prisma.userDevice.findUnique({
      where: { deviceId: String(deviceId) },
      include: {
        user: { select: { role: true } }
      }
    });

    if (!device) return res.status(404).json({ message: "Device not found" });

    // 2. Get the expiry time for the current active code
    const otpRecord = await prisma.validationCode.findUnique({
      where: { userId: Number(userId) }
    });

    res.json({
      status: device.status,
      role: device.user.role,
      expiresAt: otpRecord ? otpRecord.expiresAt : null 
    });
  } catch (e) {
    console.error("Status Check Error:", e);
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

  const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60000);

  await prisma.validationCode.upsert({
    where: { deviceId: String(deviceId) },
    update: { code: generatedCode, expiresAt: expiresAt, createdAt: new Date() },
    create: {
      userId: Number(userId),
      deviceId: String(deviceId),
      code: generatedCode,
      expiresAt: expiresAt
    }
  });

  res.json({ message: "New code generated" });
});




export default router;