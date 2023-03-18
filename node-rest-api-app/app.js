const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const mongoose = require("mongoose");

const { graphqlHTTP } = require("express-graphql");

const gqlSchema = require("./graphql/schema");
const gqlResolvers = require("./graphql/resolvers");

const fileUtil = require("./util/file");

const { auth } = require("./middleware/auth");

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, "images");
  },
  filename: (req, file, callback) => {
    let fileName = uuidv4() + "-" + file.originalname;
    callback(null, fileName);
  },
});

const fileFilter = (req, file, callback) => {
  if (
    file.mimetype == "image/png" ||
    file.mimetype == "image/jpg" ||
    file.mimetype == "image/jpeg"
  ) {
    return callback(null, true);
  }
  callback(null, false);
};

app.use(bodyParser.json({ extended: false }));
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);

app.use("/images", express.static(path.join(__dirname, "images")));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method == "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

app.put("/post-image", (req, res, next) => {
  if (!req.isAuth) {
    throw new Error("Not authenticated");
  }

  if (!req.file) {
    return res.status(200).json({ message: "No file provided" });
  }
  if (req.body.oldPath) {
    fileUtil.deleteFile(req.body.oldPath);
  }
  res
    .status(201)
    .json({
      message: "File stored",
      filePath: req.file.path.replace("\\", "/"),
    });
});

app.use(
  "/graphql",
  graphqlHTTP({
    schema: gqlSchema,
    rootValue: gqlResolvers,
    graphiql: true, //we can acccess this route and graphically query data, used in development
    customFormatErrorFn(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      const message = err.message || "An error occured";
      const code = err.originalError.code || 500;

      return {
        data: data,
        message: message,
        status: code,
      };
    },
  })
);

app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message || "Internal server error";
  const errorData = error.data || [];

  res.status(status).json({
    message: message,
    data: errorData,
  });
});

mongoose
  .connect(
    "mongodb uri"
  )
  .then((result) => {
    app.listen(8080);
  })
  .catch((err) => {
    console.log(err);
  });
