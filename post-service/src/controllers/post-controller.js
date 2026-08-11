const logger = require("../utils/logger");
const Post = require("../models/post");
const { validateCreatePost } = require("../utils/validation");
const { publishEvent } = require("../utils/rabbitmq");

async function invalidatePostCache(req, input) {
  const postCacheKey = `post:${input}`;

  console.log("Deleting:", postCacheKey);

  await req.redisClient.del(postCacheKey);

  const listKeys = await req.redisClient.keys("posts:*");

  console.log("List keys found:", listKeys);

  if (listKeys.length > 0) {
    await req.redisClient.del(...listKeys);

    console.log("Deleted list keys");
  }
}

const createPost = async (req, res) => {
  logger.info("Create post endpoint hit...");
  try {
    const { error } = validateCreatePost(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { content, mediaIds } = req.body;
    const newlyCreatedPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });
    await newlyCreatedPost.save();
    await publishEvent("post.created", {
      postId: newlyCreatedPost._id.toString(),
      userId: newlyCreatedPost.user.toString(),
      content: newlyCreatedPost.content,
      createdAt: newlyCreatedPost.createdAt,
    });
    await invalidatePostCache(req, newlyCreatedPost._id.toString());
    logger.info("Post created successfully!");
    res.status(201).json({
      success: true,
      message: "Post created successfully!",
    });
  } catch (error) {
    logger.error("Error creating Post", error);
    res.status(500).json({
      success: false,
      message: "Error creating Post",
    });
  }
};

const getAllPosts = async (req, res) => {
  logger.info("Get all posts endpoint hit ...");
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);

    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    const totalNoOfPosts = await Post.countDocuments();

    const result = {
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalNoOfPosts / limit),
      totalPosts: totalNoOfPosts,
    };

    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));

    res.json(result);
  } catch (error) {
    logger.error("Error getting Posts", error);
    res.status(500).json({
      success: false,
      message: "Error getting Posts",
    });
  }
};

const getPost = async (req, res) => {
  logger.info("Get post endpoint hit...");
  try {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cacheKey);

    if (cachedPost) {
      return res.json(JSON.parse(cachedPost));
    }

    const singlePostDetailsById = await Post.findById(postId);

    if (!singlePostDetailsById) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    await req.redisClient.setex(
      cacheKey,
      3600,
      JSON.stringify(singlePostDetailsById),
    );

    res.json(singlePostDetailsById);
  } catch (error) {
    logger.error("Error getting Post", error);
    res.status(500).json({
      success: false,
      message: "Error getting Post by ID",
    });
  }
};

const deletePost = async (req, res) => {
  logger.info("Delete Post endpoint hit....");
  try {
    const post = await Post.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    await publishEvent("post.deleted", {
      postId: post._id.toString(),
      userId: req.user.userId,
      mediaIds: post.mediaIds,
    });

    await invalidatePostCache(req, req.params.id);
    res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting Post", error);
    res.status(500).json({
      success: false,
      message: "Error deleting Post",
    });
  }
};

module.exports = { createPost, getAllPosts, getPost, deletePost };
