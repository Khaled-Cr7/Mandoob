import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. GET USER NOTIFICATIONS
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Get user signup date to filter out ancient history
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { createdAt: true }
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const notifications = await prisma.notification.findMany({
      where: {
        createdAt: { gte: user.createdAt } 
      },
      include: {
        readBy: {
          where: { userId: Number(userId) }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // --- UPDATED MAPPING: INCLUDE ALL DATA FIELDS ---
    const results = notifications.map(n => ({
      id: n.id,
      type: n.type,           // Added
      modelName: n.modelName, // Added
      oldPrice: n.oldPrice,   // Added
      newPrice: n.newPrice,   // Added
      createdAt: n.createdAt,
      isRead: n.readBy.length > 0
    }));

    res.json(results);
  } catch (error) {
    console.error("GET Notifications error:", error);
    res.status(500).json([]);
  }
});

// 2. MARK ALL AS READ
router.post('/mark-all-read', async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { createdAt: true }
    });

    // Find IDs of all notifications this user is eligible to see
    const eligibleNotifications = await prisma.notification.findMany({
      where: { createdAt: { gte: user?.createdAt } },
      select: { id: true }
    });

    const readData = eligibleNotifications.map(n => ({
      userId: Number(userId),
      notificationId: n.id
    }));

    // Batch insert read receipts (skipping existing ones)
    await prisma.notificationRead.createMany({
      data: readData,
      skipDuplicates: true
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});


// POST /api/notifications/register-token
router.post('/register-token', async (req, res) => {
  const { userId, deviceId, pushToken, deviceName, deviceModel } = req.body;

  try {
    const device = await prisma.userDevice.upsert({
      where: {
        userId_deviceId: {
          userId: Number(userId),
          deviceId: deviceId,
        },
      },
      update: {
        pushToken: pushToken,
        lastUsed: new Date(),
      },
      create: {
        userId: Number(userId),
        deviceId: deviceId,
        pushToken: pushToken,
        deviceName: deviceName,
        deviceModel: deviceModel,
        status: 'ACTIVE', // Or PENDING if you want to manually approve devices
      },
    });

    res.json({ success: true, device });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to register device token" });
  }
});



export default router;