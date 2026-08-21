const {
  claimChallenge,
  getGamificationSummary,
  redeemPremiumMonth
} = require('../services/gamificationService');

const getSummary = async (req, res) => {
  try {
    const summary = await getGamificationSummary(req.params.userId);
    res.status(200).json(summary);
  } catch (error) {
    console.error('Erro ao carregar gamificação:', error);
    res.status(500).json({ error: 'Erro ao carregar gamificação.' });
  }
};

const claim = async (req, res) => {
  const { userId, challengeKey, sourceId } = req.body;

  if (!challengeKey) {
    return res.status(400).json({ error: 'Informe a missão que pretende resgatar.' });
  }

  try {
    const result = await claimChallenge({ userId, challengeKey, sourceId });
    res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao resgatar missão:', error);
    res.status(400).json({ error: error.message || 'Erro ao resgatar missão.' });
  }
};

const redeemPremium = async (req, res) => {
  const { userId } = req.body;

  try {
    const result = await redeemPremiumMonth(userId);
    res.status(200).json({
      success: true,
      message: result.message,
      user: result.user,
      summary: result.summary
    });
  } catch (error) {
    console.error('Erro ao resgatar premium:', error);
    res.status(400).json({ error: error.message || 'Erro ao resgatar recompensa.' });
  }
};

module.exports = {
  getSummary,
  claim,
  redeemPremium
};
