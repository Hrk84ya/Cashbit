import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authRateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { registerSchema, loginSchema } from '../schemas/auth.schema';
import * as authService from '../services/auth.service';
import { config } from '../config';

const router = Router();

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.nodeEnv === 'production',
  maxAge: config.refreshTokenDaysValid * 24 * 60 * 60 * 1000,
  path: '/',
};

router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, password, categories } = req.body;
      const result = await authService.register(email, name, password, categories);

      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(201).json({
        success: true,
        data: { accessToken: result.accessToken, user: result.user },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get('/categories', (_req: Request, res: Response) => {
  res.json({ success: true, data: authService.getAvailableCategories() });
});

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json({
        success: true,
        data: { accessToken: result.accessToken, user: result.user },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/refresh',
  authRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.refreshToken;
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'No refresh token provided',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const result = await authService.refresh(token);

      res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json({
        success: true,
        data: { accessToken: result.accessToken },
      });
    } catch (err: any) {
      // On SESSION_COMPROMISED, try to revoke all tokens if we can extract userId
      if (err?.code === 'SESSION_COMPROMISED') {
        try {
          const authHeader = req.headers.authorization;
          if (authHeader?.startsWith('Bearer ')) {
            const decoded = jwt.decode(authHeader.slice(7)) as any;
            if (decoded?.id) {
              await authService.revokeAllUserTokens(decoded.id);
            }
          }
        } catch {
          // Best-effort revocation
        }
        res.clearCookie('refreshToken', { path: '/' });
      }
      next(err);
    }
  },
);

router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.refreshToken;
      await authService.logout(token);

      res.clearCookie('refreshToken', { path: '/' });
      res.status(200).json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/me',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.getMe(req.user!.id);
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
