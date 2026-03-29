import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
} from '../schemas/category.schema';
import * as categoryService from '../services/category.service';

const router = Router();

router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await categoryService.list(req.user!.id);
      res.status(200).json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  authenticate,
  validate(createCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoryService.create(req.user!.id, req.body);
      res.status(201).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  authenticate,
  validate(updateCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoryService.update(req.user!.id, req.params.id as string, req.body);
      res.status(200).json({ success: true, data: category });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  authenticate,
  validate(deleteCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await categoryService.remove(req.user!.id, req.params.id as string);
      res.status(200).json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/reorder',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { orderedIds } = req.body;
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ success: false, error: 'orderedIds must be an array', code: 'VALIDATION_ERROR' });
      }
      await categoryService.reorder(req.user!.id, orderedIds);
      res.json({ success: true, data: null });
    } catch (err) { next(err); }
  },
);

export default router;
