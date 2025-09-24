const { param, body, validationResult } = require('express-validator');

const trackingParam = () =>
  param('trackingNumber')
    .isString()
    .trim()
    .matches(/^[A-Z0-9]{8,20}$/)
    .withMessage('trackingNumber must be 8-20 alphanumeric uppercase characters');

const trackingBody = () =>
  body('trackingNumber')
    .isString()
    .trim()
    .matches(/^[A-Z0-9]{8,20}$/)
    .withMessage('trackingNumber must be 8-20 alphanumeric uppercase characters');

const ownerUserIdOptional = () =>
  body('ownerUserId')
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage('ownerUserId must be a non-empty string when provided');

const ownerUserIdRequired = () =>
  body('ownerUserId')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('ownerUserId is required');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = { trackingParam, trackingBody, ownerUserIdOptional, ownerUserIdRequired, validate };
