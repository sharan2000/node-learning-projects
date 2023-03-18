const brcypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const fileUtil = require("../util/file");
const User = require("../models/user");
const Post = require("../models/post");

module.exports = {
  createUser: async function ({ userInput }, req) {
    const email = userInput.email;
    const name = userInput.name;
    const password = userInput.password;

    const errors = [];
    if (!validator.isEmail(email)) {
      errors.push({ message: "email address is not valid" });
    }
    if (!validator.isLength(password, { min: 6 })) {
      errors.push({ message: "password length should be greater than 5" });
    }
    if (validator.isEmpty(name)) {
      errors.push({ message: "name should not be empty" });
    }

    if (errors.length > 0) {
      let error = new Error("Validation failed");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    //when using then-catch we need to return the promise so that graphql will wait for it to execute. in async-await it is automatically done.
    let existingUser = await User.findOne({ email: email });
    if (existingUser) {
      const error = new Error("Email already taken. Use another email.");
      throw error;
    }
    const hashedPassword = await brcypt.hash(password, 12);
    const newUser = new User({
      email: email,
      password: hashedPassword,
      name: name,
    });
    const createdUser = await newUser.save();
    return {
      ...createdUser._doc,
      _id: createdUser._id.toString(),
    };
  },

  login: async function ({ email, password }, req) {
    const identifiedUser = await User.findOne({ email: email });
    if (!identifiedUser) {
      let error = new Error("Invalid email");
      error.code = 401;
      throw error;
    }
    const isEqual = await brcypt.compare(password, identifiedUser.password);
    if (!isEqual) {
      let error = new Error("Invalid password");
      error.code = 401;
      throw error;
    }

    const payload = {
      email: email,
      userId: identifiedUser._id.toString(),
    };
    const token = jwt.sign(payload, "thisisasecret", {
      expiresIn: "1h",
    });
    return {
      token: token,
      userId: identifiedUser._id.toString(),
    };
  },

  createPost: async function ({ postInput }, req) {
    const errors = [];

    if (!req.isAuth) {
      let error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    if (!validator.isLength(postInput.title, { min: 6 })) {
      errors.push({ message: "title length should be greater than 5" });
    }
    if (!validator.isLength(postInput.content, { min: 6 })) {
      errors.push({ message: "content length should be greater than 5" });
    }

    if (errors.length > 0) {
      let error = new Error("Validation failed");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      let error = new Error("invalid user");
      error.code = 401;
      throw error;
    }

    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user._id,
    });
    let createdPost = await post.save();
    user.posts.push(post._id);
    await user.save();

    createdPost = createdPost._doc;
    return {
      ...createdPost,
      _id: createdPost._id.toString(),
      creator: {
        name: user.name,
        email: user.email,
        _id: user._id,
      },
      createdAt: createdPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },
  getPosts: async function ({ page }, req) {
    if (!req.isAuth) {
      let error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }
    if (!page) {
      page = 1;
    }

    let perPage = 2;
    let total = await Post.countDocuments();
    let posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((+page - 1) * perPage)
      .limit(perPage)
      .populate("creator");
    posts = posts.map((post) => {
      return {
        ...post._doc,
        _id: post._id.toString(),
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      };
    });
    return {
      posts: posts,
      totalItems: total,
    };
  },

  getPost: async function ({ postId }, req) {
    if (!req.isAuth) {
      let error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(postId).populate("creator");
    if (!post) {
      let error = new Error("Post not found");
      error.code = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      let error = new Error("Not authorized to view this post");
      error.code = 403;
      throw error;
    }
    console.log(post);

    return {
      ...post._doc,
      _id: post._id.toString(),
      creator: {
        name: post.creator.name,
      },
      createdAt: post.createdAt.toString(),
      updatedAt: post.updatedAt.toString(),
    };
  },

  updatePost: async function ({ postId, postInput }, req) {
    if (!req.isAuth) {
      let error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }
    const errors = [];

    if (!validator.isLength(postInput.title, { min: 6 })) {
      errors.push({ message: "title length should be greater than 5" });
    }
    if (!validator.isLength(postInput.content, { min: 6 })) {
      errors.push({ message: "content length should be greater than 5" });
    }

    if (errors.length > 0) {
      let error = new Error("Validation failed");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    let post = await Post.findById(postId).populate("creator");
    if (!post) {
      let error = new Error("Post not found");
      error.code = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      let error = new Error("Not authorized to view this post");
      error.code = 403;
      throw error;
    }

    post.title = postInput.title;
    post.content = postInput.content;
    if (postInput.imageUrl !== "undefined") {
      post.imageUrl = postInput.imageUrl;
    }
    const updatedPost = await post.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      creator: {
        name: updatedPost.creator.name,
      },
      createdAt: updatedPost.createdAt.toString(),
      updatedAt: updatedPost.updatedAt.toString(),
    };
  },

  deletePost: async function ({ postId }, req) {
    if (!req.isAuth) {
      let error = new Error("Not authenticated");
      error.code = 401;
      throw error;
    }
    let post = await Post.findById(postId).populate("creator");
    if (!post) {
      let error = new Error("Post not found");
      error.code = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      let error = new Error("Not authorized to view this post");
      error.code = 403;
      throw error;
    }
    fileUtil.deleteFile(post.imageUrl);
    await Post.findByIdAndDelete(postId);
    let user = await User.findById(req.userId);
    user.posts.pull({ _id: postId });
    await user.save();
    return true;
  },
};
