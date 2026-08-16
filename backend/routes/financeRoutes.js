const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { authenticate, requireAnnualFeatureAccess, requirePlanAccess, requireSelfBody, requireSelfParam } = require('../middleware/auth');
const { validateUuidParam } = require('../middleware/security');

router.use(authenticate);

router.get('/payment-status/:userId', validateUuidParam('userId'), requireSelfParam('userId'), financeController.getPaymentStatus);
router.get('/:userId/budgets', validateUuidParam('userId'), requireSelfParam('userId'), requirePlanAccess, financeController.getBudgets);
router.get('/:userId/calendar', validateUuidParam('userId'), requireSelfParam('userId'), requirePlanAccess, financeController.getFinancialCalendar);
router.get('/:userId/forecast', validateUuidParam('userId'), requireSelfParam('userId'), requireAnnualFeatureAccess, financeController.getMonthEndForecast);
router.get('/:userId/shopping-lists', validateUuidParam('userId'), requireSelfParam('userId'), requirePlanAccess, financeController.getShoppingLists);
router.get('/:userId', validateUuidParam('userId'), requireSelfParam('userId'), financeController.getUserFinances);

// Contas
router.post('/account', requireSelfBody('userId'), financeController.createAccount);
router.put('/account/:id', validateUuidParam('id'), financeController.updateAccount);
router.delete('/account/:id', validateUuidParam('id'), financeController.deleteAccount);

// Transacoes
router.post('/transaction', requireSelfBody('userId'), financeController.createTransaction);
router.put('/transaction/:id', validateUuidParam('id'), financeController.updateTransaction);
router.delete('/transaction/:id', validateUuidParam('id'), financeController.deleteTransaction);

// Dividas
router.post('/debt', requireSelfBody('userId'), financeController.createDebt);
router.put('/debt/:id', validateUuidParam('id'), financeController.updateDebt);
router.delete('/debt/:id', validateUuidParam('id'), financeController.deleteDebt);
router.put('/debt/:id/pay', validateUuidParam('id'), financeController.payDebt);

// Pagamentos fixos
router.post('/fixed-payment', requireSelfBody('userId'), financeController.createFixedPayment);
router.put('/fixed-payment/:id', validateUuidParam('id'), financeController.updateFixedPayment);
router.delete('/fixed-payment/:id', validateUuidParam('id'), financeController.deleteFixedPayment);
router.put('/fixed-payment/:id/pay', validateUuidParam('id'), financeController.payFixedPayment);

// Funcionalidades Premium: trial gratis ativo ou plano premium ativo
router.post('/kixikila', requirePlanAccess, requireSelfBody('userId'), financeController.createKixikila);
router.put('/kixikila/:id', validateUuidParam('id'), requirePlanAccess, financeController.updateKixikila);
router.delete('/kixikila/:id', validateUuidParam('id'), requirePlanAccess, financeController.deleteKixikila);
router.put('/kixikila/:id/pay', validateUuidParam('id'), requirePlanAccess, financeController.receiveKixikilaHand);

router.post('/project', requirePlanAccess, requireSelfBody('userId'), financeController.createProject);
router.put('/project/:id', validateUuidParam('id'), requirePlanAccess, financeController.updateProject);
router.delete('/project/:id', validateUuidParam('id'), requirePlanAccess, financeController.deleteProject);
router.put('/project/:id/fund', validateUuidParam('id'), requirePlanAccess, financeController.fundProject);

router.post('/currency', requirePlanAccess, requireSelfBody('userId'), financeController.createForeignCurrency);

router.post('/budget', requirePlanAccess, requireSelfBody('userId'), financeController.upsertBudget);
router.delete('/budget/:id', validateUuidParam('id'), requirePlanAccess, financeController.deleteBudget);

router.post('/shopping-list', requirePlanAccess, requireSelfBody('userId'), financeController.createShoppingList);
router.delete('/shopping-list/:id', validateUuidParam('id'), requirePlanAccess, financeController.deleteShoppingList);
router.post('/shopping-list/:listId/item', validateUuidParam('listId'), requirePlanAccess, financeController.addShoppingListItem);
router.put('/shopping-list-item/:id', validateUuidParam('id'), requirePlanAccess, financeController.updateShoppingListItem);
router.delete('/shopping-list-item/:id', validateUuidParam('id'), requirePlanAccess, financeController.deleteShoppingListItem);

// Subscricao
router.post('/payment-proof', requireSelfBody('userId'), financeController.uploadPaymentProof);

module.exports = router;
