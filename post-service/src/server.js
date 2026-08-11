require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const cors = require("cors");
const helmet = require("helmet");
const PostRoutes = require("./routes/post-routes");
const errorHandler = require("./middlewares/errorHandler");
const logger = require("./utils/logger");
const { createRateLimiter } = require("./middlewares/postRateLimiter");
const { connectRabbitMQ } = require("./utils/rabbitmq");

const app = express();
const PORT = process.env.PORT || 3002;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("connected to MongoDb"))
  .catch((e) => logger.error("MongoDb connection error", e));

const redisClient = new Redis(process.env.REDIS_URL);

const createPostRateLimiter = createRateLimiter(
  redisClient,
  60 * 1000,
  10,
  "You can only create 10 posr per minutes",
);

const getPostRateLimiter = createRateLimiter(
  redisClient,
  60 * 1000,
  100,
  "Too many request",
);

const deletePostRateLimiter = createRateLimiter(
  redisClient,
  60 * 1000,
  5,
  "You can only delete 5 post per minute",
);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.redisClient = redisClient;
  next();
});

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request from ${req.url}`);
  logger.info("Request body: ", req.body);
  next();
});

app.use("/api/posts", PostRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectRabbitMQ();
    app.listen(PORT, () => {
      logger.info(`Post service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
}

startServer();

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection at", promise, "reason: ", reason);
});
