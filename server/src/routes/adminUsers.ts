import express from 'express';
import { prisma } from '../index';


const router = express.Router();


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
        id: { not: { in: [1, 2, 4] } },
        
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
    let { name, username, password, phoneNumber, role } = req.body;

    // 1. Clean and Validate Inputs
    name = name?.trim();
    username = username?.toLowerCase().trim();
    phoneNumber = phoneNumber?.trim();

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    const phoneRegex = /^05\d{8}$/;
    const passRegex = /^[a-zA-Z0-9]{4,8}$/;

    if (!name || name.length > 50) return res.status(400).json({ message: "Invalid Name" });
    if (!usernameRegex.test(username)) return res.status(400).json({ message: "Invalid Username format" });
    if (!passRegex.test(password)) return res.status(400).json({ message: "Password too weak" });
    if (!phoneRegex.test(phoneNumber)) return res.status(400).json({ message: "Invalid Phone format" });

    const targetRole = (role === 'ADMIN') ? 'ADMIN' : 'USER';
    
    // Avatar Logic (using the cleaned name)
    const avatar = targetRole === 'ADMIN' 
      ? `https://ui-avatars.com/api/?name=Admin&background=475569&color=fff` 
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=fbbf24`;

    const newUser = await prisma.user.create({
      data: { name, username, password, avatar, phoneNumber, role: targetRole }
    });

    return res.json(newUser);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ message: "Username is already taken" });
    res.status(500).json({ message: "System Error" });
  }
});

// 3. UPDATE USER
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let { name, username, password, phoneNumber } = req.body;
    const updatedData: any = {};

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    const phoneRegex = /^05\d{8}$/;
    const passRegex = /^[a-zA-Z0-9]{4,8}$/;

    if (name) {
      if (name.trim().length > 50) return res.status(400).json({ message: "Name too long" });
      updatedData.name = name.trim();
    }

    if (username) {
      const cleanUsername = username.toLowerCase().trim();
      if (!usernameRegex.test(cleanUsername)) return res.status(400).json({ message: "Invalid Username" });
      updatedData.username = cleanUsername;
    }

    if (password && password.trim() !== "") {
      if (!passRegex.test(password)) return res.status(400).json({ message: "Password too weak" });
      updatedData.password = password;
    }

    if (phoneNumber) {
      const cleanPhone = phoneNumber.trim();
      if (!phoneRegex.test(cleanPhone)) return res.status(400).json({ message: "Invalid Phone" });
      updatedData.phoneNumber = cleanPhone;
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updatedData
    });
    
    res.json(updatedUser);
  } catch (error) {
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