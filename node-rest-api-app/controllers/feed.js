const { validationResult } = require("express-validator");

const fs = require("fs");
const path = require("path");

const io = require("../socket");
const Post = require("../models/post");
const User = require("../models/user");

const { deleteFile } = require("../util/file");

exports.getPosts = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 2;
  const skipPosts = perPage * (currentPage - 1);
  try {
    let totalItems = await Post.countDocuments();
    let posts = await Post.find()
      .skip(skipPosts)
      .limit(perPage)
      .populate("creator")
      .sort({ createdAt: -1 });
    res.status(200).json({
      posts: posts,
      totalItems: totalItems,
    });
  } catch (err) {
    throw err;
  }
};

exports.createPost = (req, res, next) => {
  const userId = req.userId;
  const title = req.body.title;
  const content = req.body.content;
  const fileData = req.file;

  let createdPost;
  let creator;

  if (!fileData) {
    let error = new Error("no image uploaded");
    error.statusCode = 422;
    throw error;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    let error = new Error("validation filed");
    error.statusCode = 422;
    throw error;
  }

  let post = new Post({
    title: title,
    content: content,
    imageUrl: fileData.path.replace("\\", "/"),
    creator: userId,
  });

  post
    .save()
    .then((result) => {
      createdPost = result;
      return User.findById(userId);
    })
    .then((user) => {
      creator = user;
      user.posts.push(createdPost._id);
      return user.save();
    })
    .then((result) => {
      io.getIO().emit("posts", {
        action: "create",
        post: {
          ...post._doc,
          creator: { _id: creator._id, name: creator.name },
        },
      });
      res.status(201).json({
        message: "post created successfully",
        post: post,
        creator: {
          _id: creator._id,
          name: creator.name,
        },
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.putPost = (req, res, next) => {
  const pid = req.params.pid;
  const userId = req.userId;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    let error = new Error("validation failed");
    error.statusCode = 422;
    throw error;
  }

  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = req.file.path.replace("\\", "/");
  }

  if (!imageUrl) {
    const error = new Error("no image file picked");
    error.statusCode = 422;
    throw error;
  }

  Post.findById(pid)
    .populate("creator")
    .then((post) => {
      if (!post) {
        const error = new Error("post not found");
        error.statusCode = 404;
        throw error;
      }
      if (post.creator._id.toString() !== userId.toString()) {
        const error = new Error("not authorized");
        error.statusCode = 403;
        throw error;
      }

      post.title = title;
      post.content = content;
      if (req.file) {
        deleteFile(post.imageUrl);
        post.imageUrl = imageUrl;
      }
      return post.save();
    })
    .then((result) => {
      io.getIO().emit("posts", {
        action: "update",
        post: result._doc,
      });
      res.status(200).json({
        message: "post updated",
        post: result._doc,
      });
    })
    .catch((err) => {
      next(err);
    });
};

exports.getPost = (req, res, next) => {
  const pid = req.params.pid;

  Post.findById(pid)
    .then((post) => {
      if (!post) {
        const error = new Error("Could not find post");
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({
        message: "post fetched",
        post: post,
      });
    })
    .catch((err) => {
      next(err);
    });
};

exports.deletePost = (req, res, next) => {
  const pid = req.params.pid;
  const userId = req.userId;

  Post.findById(pid)
    .then((post) => {
      if (!post) {
        const error = new Error(
          "post not deleted, no post was found with given id"
        );
        error.statusCode = 404;
        throw error;
      }
      if (post.creator.toString() !== userId.toString()) {
        const error = new Error("not authorized");
        error.statusCode = 403;
        throw error;
      }

      deleteFile(post.imageUrl);
      return Post.findByIdAndDelete(pid);
    })
    .then((result) => {
      return User.findById(userId);
    })
    .then((user) => {
      user.posts.pull(pid);
      return user.save();
    })
    .then((result) => {
      io.getIO().emit("posts", { action: "delete", post: pid });
      res.status(200).json({
        message: "post deleted successfully",
      });
    })
    .catch((err) => {
      next(err);
    });
};
