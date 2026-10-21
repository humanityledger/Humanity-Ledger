import { redisClient } from './client';

export async function getRedisClient() {
  return redisClient;
}

export { redisClient as default, createRedisClient, createSubClient, checkRedisHealth } from './client';


