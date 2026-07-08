// middleware/validators.js
const { body, validationResult } = require("express-validator");
const { validate: validateEmail } = require("deep-email-validator");

// Runs after the per-route validation chains below; collects any errors
// and short-circuits with a 400 before the request reaches the controller.
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

const registerValidationRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name is too long"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .custom(async (email) => {
      const res = await validateEmail({
        email,
        validateRegex: true,
        validateMx: true,
        validateTypo: false,
        validateDisposable: false,
        validateSMTP: false,
      });
      if (!res.valid) {
        throw new Error(
          "This email domain does not appear to exist or cannot receive mail",
        );
      }
      return true;
    }),
  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must contain at least one uppercase letter")
    .matches(/[a-z]/)
    .withMessage("Password must contain at least one lowercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must contain at least one number")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Password must contain at least one special character"),
  body("pincode")
    .trim()
    .notEmpty()
    .withMessage("Pincode is required")
    .matches(/^\d{6}$/)
    .withMessage("Pincode must be a 6-digit number")
    .custom(async (pincode, { req }) => {
      const axios = require("axios");
      let result;
      try {
        const { data } = await axios.get(
          `https://api.postalpincode.in/pincode/${pincode}`,
          { timeout: 5000 },
        );
        result = data?.[0];
      } catch (err) {
        console.error("[pincode check] axios error:", err.message);
        throw new Error("Could not verify pincode — try again");
      }
      if (result?.Status !== "Success" || !result.PostOffice?.length) {
        throw new Error("Pincode not found");
      }
      const validCity = result.PostOffice.some(
        (po) =>
          po.District.toLowerCase() ===
          String(req.body.city || "")
            .trim()
            .toLowerCase(),
      );
      const validLocality = result.PostOffice.some(
        (po) =>
          po.Name.toLowerCase() ===
          String(req.body.locality || "")
            .trim()
            .toLowerCase(),
      );
      if (!validCity) throw new Error("City does not match the given pincode");
      if (!validLocality)
        throw new Error("Locality does not match the given pincode");
      return true;
    }),
  body("locality")
    .trim()
    .notEmpty()
    .withMessage("Locality is required")
    .isLength({ max: 150 })
    .withMessage("Locality is too long"),
  body("city")
    .trim()
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 100 })
    .withMessage("City is too long"),
];

const loginValidationRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];

const updateSettingsValidationRules = [
  body("alertThreshold")
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage("Alert threshold must be a number between 0 and 1000"),
  body("alertsEnabled")
    .optional()
    .isBoolean()
    .withMessage("alertsEnabled must be true or false"),
  body("alertEmail")
    .optional()
    .isBoolean()
    .withMessage("alertEmail must be true or false"),
  body("alertInApp")
    .optional()
    .isBoolean()
    .withMessage("alertInApp must be true or false"),
];

module.exports = {
  handleValidationErrors,
  registerValidationRules,
  loginValidationRules,
  updateSettingsValidationRules,
};
