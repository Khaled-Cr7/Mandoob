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


// GET /api/phones
router.get('/', async (req, res) => {
  try {
    const { brands, sort, search } = req.query;
    
    // Clean the search string (remove accidental spaces)
    const cleanSearch = search ? String(search).trim() : "";

    let whereClause: any = { AND: [] }; // Use AND to combine Brand + Search

    // 1. Search Logic
    if (cleanSearch) {
      whereClause.AND.push({
        OR: [
          { name: { contains: cleanSearch, mode: 'insensitive' } },
          { id: { contains: cleanSearch, mode: 'insensitive' } }
        ]
      });
    }

    // 2. Brand Logic
    if (brands && brands !== 'ALL') {
      const brandArray = String(brands).split(',');
      whereClause.AND.push({
        brand: { in: brandArray as any }
      });
    }

    const orderBy = sort === 'OLD' ? 'asc' : 'desc';

    const phones = await prisma.phone.findMany({
      where: whereClause.AND.length > 0 ? whereClause : {}, // Only apply if filters exist
      orderBy: { lastUpdated: orderBy },
    });

    res.json(phones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error" });
  }
});

export default router;