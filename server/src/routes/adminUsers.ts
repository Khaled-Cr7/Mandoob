import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();

// 1. Set up the connection pool (The Bridge)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// 2. Pass the adapter to Prisma (This fixes your error!)
const prisma = new PrismaClient({ adapter });

// 1. GET ALL USERS
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const users = await prisma.user.findMany({
      where: {
        role: 'USER',
        // We use AND to ensure role is ALWAYS USER, then filter by search if it exists
        ...(search ? {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' } },
            { email: { contains: String(search), mode: 'insensitive' } },
          ]
        } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch personnel" });
  }
});

// 2. CREATE NEW USER
router.post('/', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Generate avatar URL based on name
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=fbbf24`;

    const newUser = await prisma.user.create({
      data: { name, email, password, avatar, role: 'USER' }
    });
    
    res.json(newUser);
  } catch (error) {
    res.status(400).json({ message: "Email already exists" });
  }
});

// 3. UPDATE USER
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password } = req.body;

    const updatedData: any = { name, email };
    if (password) updatedData.password = password; // Only update password if provided

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updatedData
    });
    
    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: "Update failed" });
  }
});

// 4. DELETE USER
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Personnel removed" });
  } catch (error) {
    res.status(400).json({ message: "Delete failed" });
  }
});

export default router;