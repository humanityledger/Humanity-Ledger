import { redisClient, safeRedisGet, safeRedisSet } from './client';

export async function getRedisClient() {
  return redisClient;
}

export { redisClient as default, createRedisClient, createSubClient, checkRedisHealth, safeRedisGet, safeRedisSet } from './client';


