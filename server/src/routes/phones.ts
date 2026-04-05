import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Brand } from '@prisma/client';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


router.get('/brands', (req, res) => {
  // Object.values(Brand) returns ["SAMSUNG", "HONOR", "TECHNO", "INFINIX"]
  const brandList = Object.values(Brand);
  res.json(brandList);
});

// DELETE /api/phones/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.phone.delete({ where: { id } });
  res.json({ message: "Phone deleted successfully" });
});

router.post('/', async (req, res) => {
  try {
    const { id, name, brand, price } = req.body;
    const newPhone = await prisma.phone.create({
      data: { id, name, brand, price, lastUpdated: new Date() }
    });
    res.json(newPhone);
  } catch (error) {
    res.status(400).json({ message: "ID already exists or invalid data" });
  }
});

// 2. EDIT PHONE (PUT)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, price } = req.body;
    const updated = await prisma.phone.update({
      where: { id },
      data: { name, brand, price, lastUpdated: new Date() }
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: "Update failed" });
  }
});

// 1. Toggle Favorite (Heart/Unheart)
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



// GET /api/phones
router.get('/', async (req, res) => {
  try {
    const { brands, sort, search, userId, favoritesOnly } = req.query;
    let AND_filters: any[] = [];
    const orderDir = sort === 'OLD' ? 'asc' : 'desc';

    // --- FAVORITES FILTER ---
    if (favoritesOnly === 'true' && userId) {
      const parsedUserId = parseInt(String(userId), 10);
      if (!isNaN(parsedUserId)) {
        AND_filters.push({
          favoritedBy: { some: { userId: parsedUserId } }
        });
      }
    }

    if (search) {
      AND_filters.push({
        OR: [
          { name: { contains: String(search), mode: 'insensitive' } },
          { id: { contains: String(search), mode: 'insensitive' } }
        ]
      });
    }

    // 2. Brand Logic - Strict Validation
    if (brands && brands !== 'ALL' && brands !== '') {
      const brandArray = String(brands).split(',').filter(b => b.length > 0);
      
      if (brandArray.length > 0) {
        AND_filters.push({
          brand: { in: brandArray as any }
        });
      }
    }

    const orderBy = sort === 'OLD' ? 'asc' : 'desc';

    const phones = await prisma.phone.findMany({
      where: AND_filters.length > 0 ? { AND: AND_filters } : {},
      include: {
        favoritedBy: userId ? { where: { userId: Number(userId) } } : false
      },
      // --- THE NEW SORTING LOGIC ---
      orderBy: favoritesOnly === 'true' && userId 
        ? { 
            // Sort by the date the user added it to their heart list
            favoritedBy: {
              _count: orderDir // This is a trick to sort by the join table date indirectly
            } 
          }
        : { lastUpdated: orderDir }, // Default: sort by phone's last update
    });

    // Map the result so "isFavorite" is a simple boolean for the frontend
    let results = phones.map(p => ({
      ...p,
      isFavorite: p.favoritedBy?.length > 0,
      favDate: p.favoritedBy?.[0]?.createdAt || null
    }));

    if (favoritesOnly === 'true') {
      results.sort((a, b) => {
        const dateA = new Date(a.favDate).getTime();
        const dateB = new Date(b.favDate).getTime();
        return orderDir === 'desc' ? dateB - dateA : dateA - dateB;
      });
    }

    res.json(results);
  } catch (error) { 
    console.error(error);
    res.status(500).json([]); 
  }
});

export default router;