require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./middlewares/errorHandler");
const logger = require("./utils/logger");
const { connectRabbitMQ, consumeEvents } = require("./utils/rabbitmq");
const searchRoutes = require("./routes/search-routes");
const {
  handlePostCreated,
  handlePostDeleted,
} = require("./event-handlers/search-event-handlers");

const app = express();
const PORT = process.env.PORT || 3004;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Connected to mongoDB"))
  .catch((e) => logger.error("MongoDB connection error", e));

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request from ${req.url}`);
  logger.info("Request body: ", req.body);
  next();
});

app.use("/api/search", searchRoutes);

async function startServer() {
  try {
    await connectRabbitMQ();

    await consumeEvents("post.created", handlePostCreated);
    await consumeEvents("post.deleted", handlePostDeleted);

    app.listen(PORT, () => {
      logger.info(`Search service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("failed to start search service", error);
    process.exit(1);
  }
}

startServer();

app.use(errorHandler);

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection at", promise, "reason: ", reason);
});
