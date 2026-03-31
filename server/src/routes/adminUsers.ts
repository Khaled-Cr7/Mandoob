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
    const { search, role } = req.query;
    
    // 1. Decide which role to look for (default to USER if nothing sent)
    const targetRole = (role === 'ADMIN') ? 'ADMIN' : 'USER';

    const users = await prisma.user.findMany({
      where: {
        role: targetRole,
        // 2. CRITICAL: Hide the Super Admin (ID 1) from the list
        id: { not: 1 }, 
        
        ...(search ? {
          OR: [
            { name: { contains: String(search), mode: 'insensitive' } },
            { username: { contains: String(search), mode: 'insensitive' } },
          ]
        } : {})
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, username, password, phoneNumber, role } = req.body;
    const targetRole = (role === 'ADMIN') ? 'ADMIN' : 'USER';
    
    // For Admins, you mentioned no profile pic. 
    // We can still give them a generic one, or just a placeholder.
    const avatar = targetRole === 'ADMIN' 
      ? `https://ui-avatars.com/api/?name=Admin&background=475569&color=fff` 
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=fbbf24`;

    const newUser = await prisma.user.create({
      data: { name, username: username.toLowerCase().trim(), password, avatar, phoneNumber, role: targetRole }
    });

    return res.json(newUser);
  } catch (error : any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ message: "Username is already taken" });
      }
      res.status(500).json({ message: "System Error" });
    }
});

// 3. UPDATE USER
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, phoneNumber } = req.body;

    // Create an empty object for updates
    const updatedData: any = {};

    // 1. Only add name if it exists
    if (name) updatedData.name = name;

    // 2. Only clean and add username if it's provided
    if (username) {
      updatedData.username = username.toLowerCase().trim();
    }

    // 3. Only update password if provided and not empty
    if (password && password.trim() !== "") {
      updatedData.password = password;
    }

    if (phoneNumber) updatedData.phoneNumber = phoneNumber;

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updatedData
    });
    
    res.json(updatedUser);
  } catch (error) {
    // If the error is a duplicate username, Prisma will throw a P2002 error
    res.status(400).json({ message: "Update failed. Username might be taken." });
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