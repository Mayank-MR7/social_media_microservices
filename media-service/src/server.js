require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const mediaRoutes = require("./routes/media-routes");
const errorHandler = require("./middlewares/errorHandler");
const logger = require("./utils/logger");
const { connectRabbitMQ, consumeEvents } = require("./utils/rabbitmq");
const { handlePostDeleted } = require("./event-handlers/media-event-handlers");

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

app.use("/api/media", mediaRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectRabbitMQ();

    await consumeEvents("post.deleted", handlePostDeleted);

    app.listen(PORT, () => {
      logger.info(`Media service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
}

startServer();


process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION");
  console.error("Reason:", reason);
  console.error("Promise:", promise);

  logger.error(`Unhandled Rejection: ${reason?.stack || reason}`);
});