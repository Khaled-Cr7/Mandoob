import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';

// 1. Import Multer and path
import multer from 'multer';
import path from 'path';

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


// 2. Configure Multer for local storage
// You'll need to create an 'uploads' folder in your backend project's root directory.
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // '../uploads' because we are inside src/routes and need to go to the root
        cb(null, path.join(__dirname, '../../uploads')); 
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}${path.extname(file.originalname)}`);
    }
});


const upload = multer({ storage: storage });



// 1. GET USER DATA (For the Profile Page)
// We use :id so the app knows WHICH user's profile to show
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  // Defensive check: Is the ID a number?
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) {
    return res.status(400).json({ message: "Invalid User ID format" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parsedId },
      select: {
        name: true,
        username: true,
        phoneNumber: true,
        avatar: true,
        role: true,
      }
    });

    if (!user) {
      // THIS IS CRITICAL: Return JSON, not a string or 404 page
      return res.status(404).json({ message: "User not found in database" });
    }
    
    return res.json(user);
  } catch (error) {
    console.error("❌ Prisma Error:", error);
    return res.status(500).json({ message: "Database connection error" });
  }
});

// 2. UPDATE PROFILE (Password or Avatar)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, avatar } = req.body;

    const updateData: any = {};
    
    // Only add to update object if the user actually sent them
    if (password && password.trim() !== "") {
        updateData.password = password;
    }
    if (avatar) {
        updateData.avatar = avatar;
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    res.status(400).json({ message: "Update failed" });
  }
});


// 3. NEW ROUTE: UPDATE AVATAR
// This handles the actual file upload and database update for the profile picture.
router.post('/avatar/:id', upload.single('avatar'), async (req, res) => {
  try {
    const id = req.params.id as string;
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    // 1. Find the user FIRST to get their current avatar path
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: { avatar: true }
    });

    // 2. DELETE OLD FILE (If it exists and isn't the default avatar)
    if (currentUser?.avatar && currentUser.avatar.includes('/uploads/')) {
      try {
        // Extract the filename from the URL (e.g., "171234567.jpg")
        const oldFileName = currentUser.avatar.split('/').pop();
        const oldFilePath = path.join(__dirname, '../../uploads', oldFileName as string);
        
        // Check if file exists before trying to delete
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath); // This deletes the file
          console.log("🗑️ Deleted old profile picture:", oldFileName);
        }
      } catch (err) {
        console.error("⚠️ Failed to delete old file, continuing anyway:", err);
      }
    }

    // 3. UPDATE TO NEW AVATAR
    const avatarUrl = `http://10.124.176.131:3000/uploads/${req.file.filename}`;
    
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { avatar: avatarUrl }
    });

    res.json({ message: "Avatar updated", avatarUrl });
  } catch (error) {
    console.error("❌ Upload failed:", error);
    res.status(500).json({ message: "Update failed" });
  }
});


export default router;