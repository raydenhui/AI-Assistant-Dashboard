import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

// Create a singleton Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isDevelopment
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
    datasources: {
      db: {
        url: config.databaseUrl,
      },
    },
  });

// Prevent multiple instances in development due to hot reloading
if (config.isDevelopment) {
  globalForPrisma.prisma = prisma;
}

// Database connection helper
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

// Database disconnection helper
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('📤 Database disconnected');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await disconnectDatabase();
});

export default prisma;
