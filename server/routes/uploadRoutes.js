import express from 'express';
import { upload } from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';

import fs from 'fs';
import { configureCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

const router = express.Router();

router.post('/', protect, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded or invalid file format.',
    });
  }

  let fileUrl = `/uploads/${req.file.filename}`;
  let storageProvider = 'local';
  let publicId = null;

  if (isCloudinaryConfigured()) {
    try {
      const cloudinary = configureCloudinary();
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'campussphere',
        resource_type: 'auto',
      });

      fileUrl = uploadResult.secure_url;
      storageProvider = 'cloudinary';
      publicId = uploadResult.public_id;

      // Clean up temporary local file after successful Cloudinary upload
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('[Upload] Error deleting temp local file:', err.message);
      });
    } catch (cloudErr) {
      console.warn('[Cloudinary Warning] Upload failed, falling back to local file storage:', cloudErr.message);
    }
  }

  res.status(200).json({
    success: true,
    message: 'File uploaded successfully.',
    data: {
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
      provider: storageProvider,
      publicId,
    },
  });
});

export default router;
