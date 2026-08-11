const express = require("express");
const {
  createPost,
  getAllPosts,
  getPost,
  deletePost,
} = require("../controllers/post-controller");
const router = express.Router();
const { authenticateRequest } = require("../middlewares/authMiddleware");
const {
  createPostRateLimiter,
  getPostRateLimiter,
  deletePostRateLimiter,
} = require("../middlewares/postLimiters");

router.use(authenticateRequest);

router.post("/create-post", createPostRateLimiter, createPost);
router.get("/all-posts", getPostRateLimiter, getAllPosts);
router.get("/:id", getPostRateLimiter, getPost);
router.delete("/:id", deletePostRateLimiter, deletePost);

module.exports = router;
