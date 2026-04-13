import express from 'express';
import { prisma } from '../index';
import fs from 'fs';

// 1. Import Multer and path
import multer from 'multer';
import path from 'path';

const router = express.Router();


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

// PUT /api/profile/language
router.put('/language', async (req, res) => {
  const { userId, language } = req.body;

  try {
    // This will tell us if the data even reached the server
    console.log(`📡 Server received: UserID ${userId}, Lang ${language}`);

    const updated = await prisma.user.update({
      where: { id: Number(userId) },
      data: { language: language }
    });
    
    console.log("✅ Success!");
    res.json({ success: true });
  } catch (error: any) {
    // THIS IS THE IMPORTANT PART
    console.error("❌ PRISMA ERROR DETAILS:", error.code, error.message);
    
    res.status(400).json({ 
      message: "Update failed", 
      errorType: error.code, 
      errorMessage: error.message 
    });
  }
});




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
    const { id } = req.params as { id: string };
    
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
        const oldFileName = currentUser.avatar.split('/').pop();
        const oldFilePath = path.join(__dirname, '../../uploads', oldFileName as string);
        
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log("🗑️ Deleted old profile picture:", oldFileName);
        }
      } catch (err) {
        console.error("⚠️ Failed to delete old file, continuing anyway:", err);
      }
    }

    // 3. DYNAMIC URL LOGIC (The "Magic" Part)
    // This builds the URL based on the current request's IP and Port
    const protocol = req.protocol; 
    const host = req.get('host');  
    const avatarUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    // 4. UPDATE DATABASE
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { avatar: avatarUrl }
    });

    console.log(`📸 New avatar set: ${avatarUrl}`);
    res.json({ message: "Avatar updated", avatarUrl });

  } catch (error: any) {
    console.error("❌ Upload failed:", error.message);
    res.status(500).json({ message: "Update failed" });
  }
});



export default router;