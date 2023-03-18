const path = require("path");

const express = require("express");

const { body } = require("express-validator");

const isAuthMiddleware = require("../middleware/is-auth");
const adminController = require("../controllers/admin");

const router = express.Router();

router.use(isAuthMiddleware);

const validationArray = [
  body("title", "Title should not be empty").not().isEmpty().trim(),
  body("price", "Price should be a greater than 0").isFloat({ min: 0.01 }),
  body("description", "Description should not be empty").not().isEmpty().trim(),
];

// /admin/add-product => GET
router.get("/add-product", adminController.getAddProduct);

// /admin/products => GET
router.get("/products", adminController.getProducts);

// /admin/add-product => POST
router.post("/add-product", validationArray, adminController.postAddProduct);

router.get("/edit-product/:productId", adminController.getEditProduct);

router.post("/edit-product", validationArray, adminController.postEditProduct);

router.delete("/product/:productId", adminController.deleteProduct);

module.exports = router;
