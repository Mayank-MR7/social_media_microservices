const { uploadMediaToCloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");
const Media = require("../models/Media");

const uploadMedia = async (req, res) => {
  logger.info("Upload media endpoint hit...");
  try {
    if (!req.file) {
      logger.error("No file found. Please add a file and try again!");
      return res.status(400).json({
        success: false,
        message: "No file found. Please add a file and try again!",
      });
    }

    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;
    logger.info(`File details: name=${originalname}, type=${mimetype}`);
    logger.info("Uploading to cloudinary started...");

    const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
    logger.info(
      `Cloudinary upload successfull! , public Id : ${cloudinaryUploadResult.public_id}`,
    );

    const newlyCreatedMedia = new Media({
      publicId: cloudinaryUploadResult.public_id,
      originalName: originalname,
      mimeType: mimetype,
      url: cloudinaryUploadResult.secure_url,
      userId,
    });
    await newlyCreatedMedia.save();
    return res.status(201).json({
      success: true,
      message: "Media uploaded successfully",
      mediaId: newlyCreatedMedia._id,
    });
  } catch (error) {
    (logger.error("Error uploading media", error),
      res.status(500).json({
        success: false,
        message: "Error uploading media",
      }));
  }
};

const getAllMedia = async (req, res) => {
  try {
    const results = await Media.find({});
    res.json(results);
  } catch (error) {
    (logger.error("Error fetching medias", error),
      res.status(500).json({
        success: false,
        message: "Error fetching medias",
      }));
  }
};

module.exports = { uploadMedia, getAllMedia };
