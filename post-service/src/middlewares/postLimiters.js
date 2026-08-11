const Redis = require("ioredis");
const { createRateLimiter } = require("./postRateLimiter");

const redisClient = new Redis(process.env.REDIS_URL);

const createPostRateLimiter = createRateLimiter(
  redisClient,
  60 * 1000,
  10,
  "You can only create 10 posts per minute"
);

const getPostRateLimiter = createRateLimiter(
  redisClient,
  60 * 1000,
  100,
  "Too many requests"
);

const deletePostRateLimiter = createRateLimiter(
  redisClient,
  60 * 1000,
  5,
  "You can only delete 5 posts per minute"
);

module.exports = {
  createPostRateLimiter,
  getPostRateLimiter,
  deletePostRateLimiter,
};