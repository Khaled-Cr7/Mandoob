import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- BRAND ROUTES ---
router.get('/brands', async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    res.json(brands);
  } catch (error) {
    res.status(500).json([]);
  }
});

router.post('/brands', async (req, res) => {
  const { name } = req.body;
  try {
    const newBrand = await prisma.brand.create({
      data: { name: name.toUpperCase().trim() }
    });
    res.json(newBrand);
  } catch (e) {
    res.status(400).json({ message: "Brand already exists" });
  }
});

router.put('/brands/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const updated = await prisma.brand.update({
      where: { id: Number(id) },
      data: { name: name.toUpperCase().trim() }
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: "Update failed or brand name exists" });
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
  const { userId } = req.query; // Get userId from query params
  try {
    const changes = await prisma.systemChange.findMany({
      where: { userId: Number(userId) }, // Only show logs for this specific admin
      orderBy: { createdAt: 'desc' }
    });
    res.json(changes);
  } catch (error) {
    res.status(500).json([]);
  }
});

// --- PHONE ROUTES ---

// DELETE PHONE
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const phoneToDelete = await prisma.phone.findUnique({ where: { id } });
    if (phoneToDelete) {
      await prisma.systemChange.create({
        data: {
          type: 'DELETED',
          modelName: phoneToDelete.name,
          userId: Number(userId), // Save who did it
        }
      });
      await prisma.phone.delete({ where: { id } });
    }
    res.json({ message: "Deleted" });
  } catch (e) { res.status(400).json({ message: "Error" }); }
});

// POST NEW PHONE
router.post('/', async (req, res) => {
  try {
    // We extract userId from the body
    const { id, name, brandId, price, userId } = req.body; 
    
    const newPhone = await prisma.phone.create({
      data: { 
        id, 
        name, 
        brandId: Number(brandId), 
        price: parseFloat(price), 
        lastUpdated: new Date() 
      }
    });

    // Log the change with the Admin's ID
    await prisma.systemChange.create({
      data: {
        type: 'ADDED',
        modelName: name,
        userId: Number(userId), // Tracks who added it
      }
    });

    res.json(newPhone);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: "ID already exists or invalid data" });
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

    const direction = sortOrder === 'desc' ? 'desc' : 'asc';
    const type = sortType === 'DATE' ? 'lastUpdated' : 'id';

    const phones = await prisma.phone.findMany({
      where: AND_filters.length > 0 ? { AND: AND_filters } : {},
      include: {
        brand: true,
        favoritedBy: userId ? { where: { userId: Number(userId) } } : false
      },
      orderBy: { [type]: direction },
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