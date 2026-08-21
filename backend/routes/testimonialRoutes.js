const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonialController');
const { createRateLimiter } = require('../middleware/security');

router.get('/', testimonialController.getApprovedTestimonials);
router.post(
  '/',
  createRateLimiter({ windowMs: 10 * 60 * 1000, max: 8, keyPrefix: 'testimonials' }),
  testimonialController.submitTestimonial
);

module.exports = router;
