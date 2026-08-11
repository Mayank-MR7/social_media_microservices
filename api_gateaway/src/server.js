require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Redis = require("ioredis");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const logger = require("./utils/logger");
const errorHandler = require("./middlewares/errorHandler");
const proxy = require("express-http-proxy");
const { validate } = require("../../identity_services/src/models/RefreshToken");
const { validateToken } = require("./middlewares/authMiddleware");
const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = new Redis(process.env.REDIS_URL);

app.use(helmet());
app.use(cors());
app.use(express.json());

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many requests",
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

app.use(rateLimiter);

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request body, ${req.body}`);
  next();
});

const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHandler: (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`);
    res.status(500).json({
      message: `Internal server error`,
      error: err.message,
    });
  },
};

app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpt, srcReq) => {
      proxyReqOpt.headers["Content-Type"] = "application/json";
      return proxyReqOpt;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Identity service : ${proxyRes.statusCode}`,
      );
      return proxyResData;
    },
  }),
);

app.use(
  "/v1/posts",
  validateToken,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpt, srcReq) => {
      proxyReqOpt.headers["Content-Type"] = "application/json";
      proxyReqOpt.headers["x-user-id"] = srcReq.user.userId;
      return proxyReqOpt;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Post service : ${proxyRes.statusCode}`,
      );
      return proxyResData;
    },
  }),
);

app.use(
  "/v1/media",
  validateToken,
  proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;

      const contentType = srcReq.headers["content-type"];

      if (contentType?.startsWith("multipart/form-data")) {
        proxyReqOpts.headers["Content-Type"] = contentType;
      } else {
        proxyReqOpts.headers["Content-Type"] = "application/json";
      }

      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Media service : ${proxyRes.statusCode}`,
      );
      return proxyResData;
    },
    parseReqBody: false,
  }),
);

app.use(
  "/v1/search",
  validateToken,
  proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpt, srcReq) => {
      proxyReqOpt.headers["Content-Type"] = "application/json";
      proxyReqOpt.headers["x-user-id"] = srcReq.user.userId;
      return proxyReqOpt;
    },
    userResDecorator: (proxyRes, proxyResData, userReq, userRes) => {
      logger.info(
        `Response received from Post service : ${proxyRes.statusCode}`,
      );
      return proxyResData;
    },
  }),
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API gateway is running on ${PORT}`);
  logger.info(
    `Identity service is running on PORT ${process.env.IDENTITY_SERVICE_URL}`,
  );
  logger.info(
    `Post service is running on PORT ${process.env.POST_SERVICE_URL}`,
  );
  logger.info(
    `Media service is running on PORT ${process.env.MEDIA_SERVICE_URL}`,
  );
  logger.info(
    `Search service is running on PORT ${process.env.SEARCh_SERVICE_URL}`,
  );
  logger.info(`Redis URL: ${process.env.REDIS_URL}`);
});
