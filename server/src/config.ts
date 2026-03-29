export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET || 'default-dev-secret-change-in-production',
  databaseUrl: process.env.DATABASE_URL || '',
  accessTokenExpiresIn: '15m',
  refreshTokenDaysValid: 7,
  /** IST offset in hours: +05:30 = 5.5 hours */
  IST_OFFSET_HOURS: 5.5,
  /** IST offset string for timezone representation */
  IST_OFFSET: '+05:30',
  /** IST offset in milliseconds */
  IST_OFFSET_MS: 5.5 * 60 * 60 * 1000,
} as const;
