import express from 'express';
import { prisma } from '../index';

const router = express.Router();

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
  const { userId, deviceId, pushToken } = req.body;

  try {
    // Attempt updating assuming the hardware entry was initialized during login/device sync
    const result = await prisma.userDevice.updateMany({
      where: {
        userId: Number(userId),
        deviceId: String(deviceId),
      },
      data: {
        pushToken: pushToken,
        lastUsed: new Date(),
      },
    });

    // Fallback: Create row immediately if it's a first-time native launch registration
    if (result.count === 0) {
      console.log(`⚠️ Initializing a fresh userDevice record for UID ${userId}`);
      await prisma.userDevice.create({
        data: {
          userId: Number(userId),
          deviceId: String(deviceId),
          pushToken: pushToken,
          status: "ACTIVE", // Match your standard system enum status token
          lastUsed: new Date(),
        }
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Token Register Error:", error.message);
    res.status(500).json({ error: "Failed to sync token" });
  }
});



export default router;