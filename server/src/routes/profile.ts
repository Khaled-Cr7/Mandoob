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
    let { password, avatar } = req.body; // use 'let' so we can trim

    const updateData: any = {};
    const passRegex = /^[a-zA-Z0-9]{4,8}$/;

    // 1. Validate Password
    if (password && password.trim() !== "") {
      if (!passRegex.test(password)) {
        return res.status(400).json({ message: "Password too weak" });
      }
      updateData.password = password;
    }

    // 2. Validate Avatar String (if provided manually)
    if (avatar) {
      updateData.avatar = avatar;
    }

    // Safety: If someone sends an empty body, don't trigger Prisma
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    res.status(400).json({ message: "Update failed" });
  }
});


// 3. UPDATED ROUTE: UPDATE AVATAR (Storing Relative Path)
router.post('/avatar/:id', upload.single('avatar'), async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    // 🛡️ SECURITY CHECK: Validate MimeType
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      // 🗑️ Delete the invalid file from 'uploads' immediately
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Invalid file type. Only JPG, PNG, and WEBP allowed." });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: { avatar: true }
    });

    // 2. DELETE OLD FILE
    // Now we check if it includes '/uploads/' regardless of the domain
    if (currentUser?.avatar && currentUser.avatar.includes('/uploads/')) {
      try {
        // Extract just the filename even if it's a full URL or a relative path
        const segments = currentUser.avatar.split('/');
        const fileName = segments[segments.length - 1];
        const filePath = path.join(__dirname, '../../uploads', fileName);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("🗑️ Deleted old profile picture:", fileName);
        }
      } catch (err) {
        console.error("⚠️ Cleanup failed, continuing:", err);
      }
    }

    // 3. THE FIX: SAVE ONLY THE RELATIVE PATH
    // We stop using req.protocol and host. We just save the path.
    const relativePath = `/uploads/${req.file.filename}`;
    
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { avatar: relativePath }
    });

    res.json({ 
      message: "Avatar updated", 
      avatarUrl: relativePath 
    });

  } catch (error: any) {
    // 🛡️ SECURITY CHECK: Clean up file if database update fails
    if (req.file && fs.existsSync(req.file.path)) {
       fs.unlinkSync(req.file.path);
    }
    console.error("❌ Upload failed:", error.message);
    res.status(500).json({ message: "Update failed" });
  }
});



export default router;