const express = require("express");

const { check, body } = require("express-validator");

const authController = require("../controllers/auth");
const User = require("../models/user");

const router = express.Router();

router.get("/login", authController.getLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/login",
  [
    check("email")
      .isEmail()
      .withMessage("invalid email address")
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("password should be of length greater than 5")
      .trim(),
  ],
  authController.postLogin
);

router.post(
  "/signup",
  [
    check("email")
      .isEmail()
      .withMessage("invalid email address")
      .custom((emailVal, { req }) => {
        return User.findOne({ email: emailVal }).then((user) => {
          if (user) {
            return Promise.reject("email address already exists");
          }
        });
      })
      .normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("password should be of length greater than 5")
      .trim(),
    body("confirmPassword")
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("passwords should match");
        }
        return true;
      }),
  ],
  authController.postSignup
);

router.post("/logout", authController.postLogout);

module.exports = router;
