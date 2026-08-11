const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

const createRateLimiter = (redisClient, windowMs, maxRequest, message) => {
  return rateLimit({
    windowMs,
    max: maxRequest,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    }),
    message: {
      success: false,
      message,
    },
    keyGenerator: (req) => {
      return req.user?.userId || ipKeyGenerator(req);
    },
  });
};

module.exports = { createRateLimiter };
