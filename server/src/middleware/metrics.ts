import { Request, Response, NextFunction, Router } from 'express';
import {
  collectDefaultMetrics,
  Registry,
  Histogram,
  Counter,
} from 'prom-client';

export const register = new Registry();
collectDefaultMetrics({ register });

export const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 5],
  registers: [register],
});

export const httpErrors = new Counter({
  name: 'http_errors_total',
  help: 'Total HTTP errors',
  labelNames: ['method', 'route', 'status_class'] as const,
  registers: [register],
});

export const prismaQueryDuration = new Histogram({
  name: 'prisma_query_duration_seconds',
  help: 'Prisma query duration in seconds',
  labelNames: ['model', 'operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();

    httpDuration.observe({ method: req.method, route, status_code: statusCode }, duration);

    if (res.statusCode >= 400) {
      const statusClass = res.statusCode >= 500 ? '5xx' : '4xx';
      httpErrors.inc({ method: req.method, route, status_class: statusClass });
    }
  });

  next();
}

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end();
  }
});
