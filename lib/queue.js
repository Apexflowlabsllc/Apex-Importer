import { Queue } from 'bullmq';

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set.");
}

const redisUrl = new URL(process.env.REDIS_URL);

export const connectionOptions = {
    host: redisUrl.hostname,
    port: parseInt(redisUrl.port, 10),
    password: redisUrl.password,
    tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
};

console.log('[QUEUE_CONFIG] Created Redis connection options:', {
    host: connectionOptions.host,
    port: connectionOptions.port,
    password: connectionOptions.password ? '******' : 'none',
    tls: !!connectionOptions.tls,
});

export const QUEUE_NAME = 'import-jobs';

export const importQueue = new Queue(QUEUE_NAME, { connection: connectionOptions });
