import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, HEIC, and PDF files are allowed'));
  },
});

const router = Router();

// Upload receipt and attach to transaction
router.post('/:transactionId/receipt', authenticate, upload.single('receipt'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'No file uploaded');

      const tx = await prisma.transaction.findFirst({
        where: { id: req.params.transactionId as string, userId: req.user!.id, deletedAt: null },
      });
      if (!tx) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');

      const receiptPath = `/uploads/${req.file.filename}`;
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { receiptPath },
      });

      logger.info({ userId: req.user!.id, transactionId: tx.id }, 'Receipt uploaded');
      res.json({ success: true, data: { receiptPath } });
    } catch (err) { next(err); }
  }
);

// Serve uploaded files
router.get('/file/:filename', (req: Request, res: Response) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename as string);
  res.sendFile(filePath);
});

export default router;
