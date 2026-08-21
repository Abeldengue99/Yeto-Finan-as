const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const testimonialController = require('../controllers/testimonialController');
const { authenticate, requireAdmin, requireAdminPermission } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/security');

router.use(authenticate, requireAdmin);

router.get('/stats', requireAdminPermission('dashboard'), adminController.getDashboardStats);
router.get('/users', requireAdminPermission('users'), adminController.getAllUsers);
router.get('/logs', requireAdminPermission('reports'), adminController.getLogs);
router.get('/gamification', requireAdminPermission('reports'), adminController.getGamificationReport);
router.get('/payments', requireAdminPermission('payments'), adminController.getPayments);
router.get('/payments/pending', requireAdminPermission('payments'), adminController.getPendingPayments);
router.get('/testimonials', requireAdminPermission('settings'), testimonialController.getAdminTestimonials);
router.post('/promotions', requireAdminPermission('marketing'), adminController.sendPromotions);
router.post('/users/remind-unverified', requireAdminPermission('users'), adminController.remindUnverifiedUsers);
router.put('/admin-access/:userId', validateUuidParam('userId'), requireAdminPermission('settings'), adminController.grantAdminAccess);
router.delete('/admin-access/:userId', validateUuidParam('userId'), requireAdminPermission('settings'), adminController.revokeAdminAccess);
router.put('/users/:userId/status', validateUuidParam('userId'), requireAdminPermission('users'), adminController.updateUserStatus);
router.put('/users/:userId/premium', validateUuidParam('userId'), requireAdminPermission('users'), adminController.grantUserPremium);
router.post('/users/:userId/resend-verification', validateUuidParam('userId'), requireAdminPermission('users'), adminController.resendUserVerification);
router.put('/users/:userId/admin-access', validateUuidParam('userId'), requireAdminPermission('settings'), adminController.grantAdminAccess);
router.delete('/users/:userId/admin-access', validateUuidParam('userId'), requireAdminPermission('settings'), adminController.revokeAdminAccess);
router.delete('/users/:userId', validateUuidParam('userId'), requireAdminPermission('users'), adminController.deleteUser);
router.put('/payments/:paymentId/approve', validateUuidParam('paymentId'), requireAdminPermission('payments'), adminController.approvePayment);
router.put('/payments/:paymentId/reject', validateUuidParam('paymentId'), requireAdminPermission('payments'), adminController.rejectPayment);
router.put('/testimonials/:testimonialId/approve', validateUuidParam('testimonialId'), requireAdminPermission('settings'), testimonialController.approveTestimonial);
router.put('/testimonials/:testimonialId/reject', validateUuidParam('testimonialId'), requireAdminPermission('settings'), testimonialController.rejectTestimonial);

module.exports = router;
