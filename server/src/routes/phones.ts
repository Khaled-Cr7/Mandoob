import express from 'express';
import { prisma } from '../index';
import { sendBroadcastNotification } from '../services/pushNotification';

const router = express.Router();

// --- BRAND ROUTES ---
router.get('/brands', async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    res.json(brands);
  } catch (error) {
    res.status(500).json([]);
  }
});

// CREATE BRAND
router.post('/brands', async (req, res) => {
  let { name } = req.body;
  try {
    name = name?.trim().toUpperCase();
    
    // 1. Validation
    if (!name || name.length < 2 || name.length > 30) {
      return res.status(400).json({ message: "Brand name must be 2-30 characters" });
    }

    const newBrand = await prisma.brand.create({
      data: { name }
    });
    res.json(newBrand);
  } catch (e) {
    res.status(400).json({ message: "Brand already exists" });
  }
});

router.put('/brands/:id', async (req, res) => {
  const { id } = req.params;
  let { name } = req.body;

  try {
    name = name?.trim().toUpperCase();

    // 1. Length Validation
    if (!name || name.length < 2 || name.length > 30) {
      return res.status(400).json({ message: "Brand name must be 2-30 characters" });
    }

    const updated = await prisma.brand.update({
      where: { id: Number(id) },
      data: { name }
    });

    res.json(updated);
  } catch (e: any) {
    // 2. Handle Unique Constraint (P2002)
    if (e.code === 'P2002') {
      return res.status(400).json({ message: "Another brand already has this name" });
    }
    res.status(400).json({ message: "Update failed" });
  }
});

router.delete('/brands/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.brand.delete({ where: { id: Number(id) } });
    res.json({ message: "Brand removed" });
  } catch (e) {
    res.status(400).json({ message: "Cannot delete brand with active stock" });
  }
});

// --- SYSTEM CHANGES LOGGING ROUTE ---
router.get('/changes', async (req, res) => {
  const { userId } = req.query;
  const isAdminOne = Number(userId) === 1 || Number(userId) === 4; // User 1 and User 4 are Super Admins who see everything

  try {
    const changes = await prisma.systemChange.findMany({
      where: isAdminOne 
        ? {} // 👈 User 1 sees EVERYTHING
        : { 
            userId: Number(userId),
            isPublished: false 
          },
      include: {
        user: { // 👈 Include user info so we know WHO made the change
          select: { name: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(changes);
  } catch (error) {
    res.status(500).json([]);
  }
});


// DELETE /api/phones/changes/:id
router.delete('/changes/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query; // Pass userId to verify ownership

  try {
    const log = await prisma.systemChange.findUnique({ where: { id: Number(id) } });

    if (!log) {
      return res.status(404).json({ message: "Log not found" });
    }

    if (log.userId !== Number(userId)) {
      return res.status(403).json({ message: "Unauthorized to delete this log" });
    }

    await prisma.systemChange.delete({ where: { id: Number(id) } });
    res.json({ message: "Log deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting log" });
  }
});


// POST /api/phones/changes/:id/publish
router.post('/changes/:id/publish', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.systemChange.findUnique({ where: { id: Number(id) } });
      if (!log || log.isPublished) throw new Error("Log not found or already published");

      // 1. Create the persistent record for the in-app notification list
      await tx.notification.create({
        data: { 
          type: log.type,
          modelName: log.modelName,
          oldPrice: log.oldValue,
          newPrice: log.newValue
        }
      });

      // 2. Mark the draft as published so it disappears from "Pending Tasks"
      const updatedLog = await tx.systemChange.update({
        where: { id: Number(id) },
        data: { isPublished: true }
      });

      return updatedLog; // Return the log so we have access to oldValue/newValue for the push
    });

    // 📢 Trigger push using the log data
    sendBroadcastNotification(result, Number(userId));

    res.json({ message: "Published and Pushed" });
  } catch (error : any) {
    res.status(400).json({ message: error.message });
  }
});






// --- PHONE ROUTES ---

// DELETE PHONE
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const phoneToDelete = await prisma.phone.findUnique({ where: { id } });
    
    if (!phoneToDelete) {
      return res.status(404).json({ message: "Phone not found" });
    }

    await prisma.phone.delete({ where: { id } });
    
    res.json({ message: "Phone deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(400).json({ message: "Delete failed" });
  }
});

// POST NEW PHONE
router.post('/', async (req, res) => {
  try {
    let { id, name, brandId, price, userId } = req.body;
    
    // 1. Sanitize & Validate
    id = id?.trim().toUpperCase(); // e.g., "IPH15PRO"
    name = name?.trim();
    const cleanPrice = parseFloat(price);

    if (!id || id.length > 20) return res.status(400).json({ message: "Invalid Model ID" });
    if (!name || name.length > 50) return res.status(400).json({ message: "Invalid Name" });
    if (isNaN(cleanPrice) || cleanPrice < 0) return res.status(400).json({ message: "Invalid Price" });

    const newPhone = await prisma.phone.create({
      data: { 
        id, 
        name, 
        brandId: Number(brandId), 
        price: cleanPrice, 
        lastUpdated: new Date() 
      }
    });

    // 2. Audit Log
    await prisma.systemChange.create({
      data: {
        type: 'ADDED',
        modelName: name,
        userId: Number(userId),
      }
    });

    res.json(newPhone);
  } catch (error) {
    res.status(400).json({ message: "ID already exists or Brand not found" });
  }
});

// UPDATE PHONE (With Price Change Detection)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // We extract userId from the body
    const { name, brandId, price, userId } = req.body; 
    const newPrice = parseFloat(price);

    // Get old data to check for price change
    const oldPhone = await prisma.phone.findUnique({ where: { id } });

    const updated = await prisma.phone.update({
      where: { id },
      data: { 
        name, 
        brandId: Number(brandId), 
        price: newPrice, 
        lastUpdated: new Date() 
      }
    });

    // Check if price specifically changed
    if (oldPhone && oldPhone.price !== newPrice) {
      await prisma.systemChange.create({
        data: {
          type: 'PRICE_UPDATE',
          modelName: name,
          oldValue: oldPhone.price.toString(),
          newValue: newPrice.toString(),
          userId: Number(userId), // Tracks who changed the price
        }
      });
    }

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "Update failed" });
  }
});

// TOGGLE FAVORITE
router.post('/favorite', async (req, res) => {
  const { userId, phoneId } = req.body;
  try {
    const existing = await prisma.favorite.findUnique({
      where: { userId_phoneId: { userId, phoneId } }
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return res.json({ isFavorite: false });
    } else {
      await prisma.favorite.create({ data: { userId, phoneId } });
      return res.json({ isFavorite: true });
    }
  } catch (error) {
    res.status(500).json({ message: "Error toggling favorite" });
  }
});

// GET PHONES LIST
router.get('/', async (req, res) => {
  try {
    const { brands, sortType, sortOrder, search, userId, favoritesOnly } = req.query;
    let AND_filters: any[] = [];
 
    if (favoritesOnly === 'true' && userId) {
      AND_filters.push({ favoritedBy: { some: { userId: Number(userId) } } });
    }
 
    if (search) {
      AND_filters.push({
        OR: [
          { name: { contains: String(search), mode: 'insensitive' } },
          { id: { contains: String(search), mode: 'insensitive' } }
        ]
      });
    }
 
    if (brands && brands !== 'ALL' && brands !== '') {
      const brandIdArray = String(brands).split(',').map(Number).filter(id => !isNaN(id));
      if (brandIdArray.length > 0) {
        AND_filters.push({ brandId: { in: brandIdArray } });
      }
    }
 
    const direction: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
 
    const orderBy = sortType === 'DATE'
      ? { lastUpdated: direction }
      : [{ brand: { name: direction } }, { id: direction }];
 
    const phones = await prisma.phone.findMany({
      where: AND_filters.length > 0 ? { AND: AND_filters } : {},
      include: {
        brand: true,
        favoritedBy: userId ? { where: { userId: Number(userId) } } : false
      },
      orderBy,
    });
 
    let results = phones.map(p => ({
      ...p,
      brand: p.brand ? p.brand.name : "UNKNOWN", 
      isFavorite: p.favoritedBy?.length > 0,
      favDate: p.favoritedBy?.[0]?.createdAt || null
    }));
 
    res.json(results);
  } catch (error) { 
    console.error("❌ GET /phones error:", error);
    res.status(500).json({ message: "Internal Server Error" }); 
  }
});

export default router;