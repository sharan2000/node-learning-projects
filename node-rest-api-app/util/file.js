const fs = require("fs");
const path = require("path");

exports.deleteFile = (filePath) => {
  let finalPath = path.join(__dirname, "..", filePath);

  fs.unlink(finalPath, (err) => {
    if (err) {
      throw new Error(err);
    }
  });
};
