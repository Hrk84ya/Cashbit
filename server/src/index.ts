import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './logger';
import { metricsMiddleware, metricsRouter } from './middleware/metrics';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import transactionRoutes from './routes/transaction.routes';
import categoryRoutes from './routes/category.routes';
import budgetRoutes from './routes/budget.routes';
import analyticsRoutes from './routes/analytics.routes';
import profileRoutes from './routes/profile.routes';
import uploadRoutes from './routes/upload.routes';
import recurringRoutes from './routes/recurring.routes';

const app = express();

// Trust first proxy (nginx) so rate limiter sees real client IPs
app.set('trust proxy', 1);

// Global middleware
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(metricsMiddleware);

// Routes
app.use('/auth', authRoutes);
app.use('/transactions', transactionRoutes);
app.use('/categories', categoryRoutes);
app.use('/budgets', budgetRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/profile', profileRoutes);
app.use('/uploads', uploadRoutes);
app.use('/recurring', recurringRoutes);
app.use(metricsRouter);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info({ port: config.port }, `Server started on port ${config.port}`);
});

export default app;
