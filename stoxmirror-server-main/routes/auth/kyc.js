const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { sendKycAlert } = require("../../utils");
const { requireAdmin } = require("../../middleware/auth");

const Image = require("../../models/Image");

// Create a MongoDB model for storing image URLs
// const Image = mongoose.model('Image', {
//   imageUrl: String,
//   owner: String,
//   docNum: String,
//   ownerdet:String,
// status:String,
// });

// Middleware to parse JSON in requests
router.use(express.json());

// Endpoint to store image URL
router.post('/kyc', async (req, res) => {
  try {
    const { imageUrl, owner, docNum,ownerdet } = req.body;

    // Create a new document in the 'images' collection
    const image = new Image({ imageUrl, owner, docNum,ownerdet,status:"pending"});
    await image.save();
sendKycAlert({owner})
    res.status(201).json({ message: 'Image URL stored successfully' });
    
  } catch (error) {
    console.error('Error storing image URL:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Generic endpoint to handle 'kyc2' and 'kyc3' logic
router.post('/kyc/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const imageUrlKey = `imageUrl${type.slice(-1)}`; // Determines if it's kyc2 or kyc3
    const imageUrl = req.body[imageUrlKey];

    if (!imageUrl) {
      return res.status(400).json({ error: 'Invalid image URL' });
    }

    // Create a new document in the 'images' collection
    const image = new Image({ imageUrl });
    await image.save();

    res.status(201).json({ message: `Image URL ${imageUrlKey} stored successfully` });
  } catch (error) {
    console.error('Error storing image URL:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint for fetching images
router.get('/kyc/fetch-images', requireAdmin, async (req, res) => {
  try {
    const images = await Image.find();
    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ✅ DELETE a specific KYC image by ID
router.delete('/kyc/delete-image/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if image exists
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // Optional: Remove the physical file if stored locally
    if (image.imageUrl && image.imageUrl.startsWith('./uploads')) {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(image.imageUrl);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ Deleted file:', filePath);
      }
    }

    // Remove from MongoDB
    await Image.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting image',
      error: error.message,
    });
  }
});


module.exports = router;
