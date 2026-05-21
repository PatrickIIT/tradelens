// middleware/validate.js
const { body, param, query, validationResult } = require('express-validator');

// ─── Helper: run validation and return errors ───────────────────────────────
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((v) => v.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        errors: errors.array().map((e) => ({
          field: e.path,
          message: e.msg,
        })),
      });
    }

    next();
  };
};

// ─── Auth validators ────────────────────────────────────────────────────────
const validateRegister = validate([
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address'),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),

  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['trader', 'standards_officer', 'customs_officer', 'admin'])
    .withMessage('Role must be: trader, standards_officer, customs_officer, or admin'),

  body('country')
    .notEmpty().withMessage('Country is required')
    .isIn(['TZ', 'ZM']).withMessage('Country must be TZ (Tanzania) or ZM (Zambia)'),

  body('phone')
    .optional()
    .matches(/^\+?[1-9]\d{7,14}$/).withMessage('Must be a valid phone number'),
]);

const validateLogin = validate([
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address'),

  body('password')
    .notEmpty().withMessage('Password is required'),
]);

// ─── Document validators ─────────────────────────────────────────────────────
const validateDocumentUpload = validate([
  body('product_id')
    .notEmpty().withMessage('Product ID is required')
    .isUUID().withMessage('Product ID must be a valid UUID'),

  body('document_type')
    .notEmpty().withMessage('Document type is required')
    .isIn([
      'phytosanitary_certificate',
      'certificate_of_origin',
      'packing_list',
      'commercial_invoice',
      'import_permit',
      'quality_inspection_report',
    ])
    .withMessage('Invalid document type'),

  body('destination_country')
    .notEmpty().withMessage('Destination country is required')
    .isIn(['TZ', 'ZM']).withMessage('Destination must be TZ or ZM'),

  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters'),
]);

const validateDocumentStatus = validate([
  param('id')
    .notEmpty().withMessage('Document ID is required')
    .isUUID().withMessage('Document ID must be a valid UUID'),
]);

// ─── Certificate validators ──────────────────────────────────────────────────
const validateCertificateIssue = validate([
  body('document_id')
    .notEmpty().withMessage('Document ID is required')
    .isUUID().withMessage('Document ID must be a valid UUID'),

  body('trader_id')
    .notEmpty().withMessage('Trader ID is required')
    .isUUID().withMessage('Trader ID must be a valid UUID'),

  body('product_name')
    .trim()
    .notEmpty().withMessage('Product name is required')
    .isLength({ min: 2, max: 150 }).withMessage('Product name must be 2–150 characters'),

  body('certificate_type')
    .notEmpty().withMessage('Certificate type is required')
    .isIn(['TBS', 'ZABS']).withMessage('Certificate type must be TBS or ZABS'),

  body('valid_until')
    .notEmpty().withMessage('Expiry date is required')
    .isISO8601().withMessage('Expiry date must be a valid ISO 8601 date (YYYY-MM-DD)')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Expiry date must be in the future');
      }
      return true;
    }),

  body('issuing_country')
    .notEmpty().withMessage('Issuing country is required')
    .isIn(['TZ', 'ZM']).withMessage('Issuing country must be TZ or ZM'),
]);

const validateCertificateId = validate([
  param('id')
    .notEmpty().withMessage('Certificate ID is required')
    .isUUID().withMessage('Certificate ID must be a valid UUID'),
]);

// ─── Verify validators (Customs Portal) ─────────────────────────────────────
const validateQRVerify = validate([
  body('qr_payload')
    .trim()
    .notEmpty().withMessage('QR payload is required')
    .isLength({ min: 10 }).withMessage('QR payload appears invalid'),
]);

const validateIDVerify = validate([
  query('certificate_id')
    .optional()
    .isUUID().withMessage('Certificate ID must be a valid UUID'),

  query('trader_id')
    .optional()
    .isUUID().withMessage('Trader ID must be a valid UUID'),
]);

// ─── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  validateRegister,
  validateLogin,
  validateDocumentUpload,
  validateDocumentStatus,
  validateCertificateIssue,
  validateCertificateId,
  validateQRVerify,
  validateIDVerify,
};
