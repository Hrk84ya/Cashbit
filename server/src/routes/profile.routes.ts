import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/authenticate';
import * as profileService from '../services/profile.service';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

router.patch('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await profileService.updateProfile(req.user!.id, req.body);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

router.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Invalid input', code: 'VALIDATION_ERROR' });
    }
    await profileService.changePassword(req.user!.id, currentPassword, newPassword);
    res.json({ success: true, data: { message: 'Password changed' } });
  } catch (err) { next(err); }
});

router.post('/change-currency', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currency, conversionRate } = req.body;
    if (!currency || typeof currency !== 'string' || currency.length !== 3) {
      return res.status(400).json({ success: false, error: 'Invalid currency code', code: 'VALIDATION_ERROR' });
    }
    if (!conversionRate || typeof conversionRate !== 'number' || conversionRate <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid conversion rate', code: 'VALIDATION_ERROR' });
    }
    const result = await profileService.changeCurrency(req.user!.id, currency, conversionRate);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

export default router;
