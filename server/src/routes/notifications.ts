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
        createdAt: { gte: user.createdAt } // Only show news since they joined
      },
      include: {
        readBy: {
          where: { userId: Number(userId) }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const results = notifications.map(n => ({
      id: n.id,
      message: n.message,
      createdAt: n.createdAt,
      isRead: n.readBy.length > 0
    }));

    res.json(results);
  } catch (error) {
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

export default router;