/**
 * Serviço de Email — Brevo (ex-Sendinblue)
 * Utiliza a API HTTP v3 da Brevo para envio de emails transacionais e marketing.
 * Documentação: https://developers.brevo.com/reference/sendtransacemail
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Função base para enviar emails via Brevo API
 */
const sendEmail = async ({ to, subject, htmlContent }) => {
  const apiKey = process.env.BREVO_SMTP_KEY; // Usando a chave que o utilizador forneceu

  if (!apiKey) {
    console.error('❌ BREVO_SMTP_KEY não configurada no .env');
    throw new Error('Serviço de email não configurado.');
  }

  const payload = {
    sender: {
      name: process.env.BREVO_SENDER_NAME || 'Yeto Finanças',
      email: process.env.BREVO_SENDER_EMAIL || 'yetofinancas@gmail.com'
    },
    to: Array.isArray(to) ? to : [{ email: to }],
    subject,
    htmlContent
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro Brevo:', data);
      throw new Error(data.message || 'Falha ao enviar email.');
    }

    console.log(`✅ Email enviado para: ${Array.isArray(to) ? to.map(t => t.email).join(', ') : to}`);
    return data;
  } catch (error) {
    console.error('❌ Erro ao enviar email via Brevo:', error.message);
    throw error;
  }
};

/**
 * Envia código de verificação de email no registo
 */
const sendVerificationCode = async (email, name, code) => {
  return sendEmail({
    to: email,
    subject: `${code} — Código de Verificação | Yeto Finanças`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fc; border-radius: 20px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #373392 0%, #4b46ba 100%); padding: 40px 30px; text-align: center;">
          <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FFB300, #FF8F00); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <span style="color: white; font-weight: 900; font-size: 28px;">Y</span>
          </div>
          <h1 style="color: white; margin: 0; font-size: 24px;">Yeto Finanças</h1>
          <p style="color: rgba(255,255,255,0.7); margin: 5px 0 0 0; font-size: 14px;">Gestão Financeira Familiar Inteligente</p>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
          <h2 style="color: #1f2130; margin: 0 0 10px 0;">Olá, ${name}! 👋</h2>
          <p style="color: #8a8ca3; font-size: 16px; line-height: 1.6;">
            Bem-vindo(a) ao Yeto Finanças! Use o código abaixo para verificar a sua conta:
          </p>
          <div style="background: white; border: 2px solid #373392; border-radius: 16px; padding: 25px; margin: 30px 0; display: inline-block;">
            <span style="font-size: 36px; font-weight: 900; color: #373392; letter-spacing: 12px;">${code}</span>
          </div>
          <p style="color: #8a8ca3; font-size: 14px;">
            Este código expira em <strong>15 minutos</strong>. Se não solicitou este código, ignore este email.
          </p>
        </div>
        <div style="background: #f2f3f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #8a8ca3; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Yeto Finanças — Todos os direitos reservados.</p>
        </div>
      </div>
    `
  });
};

/**
 * Envia notificação de pagamento aprovado
 */
const sendPaymentApproved = async (email, name, planType) => {
  const planName = planType === 'annual' ? 'Anual' : 'Semestral';
  return sendEmail({
    to: email,
    subject: `✅ Pagamento Aprovado — Plano ${planName} | Yeto Finanças`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fc; border-radius: 20px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #373392 0%, #4b46ba 100%); padding: 40px 30px; text-align: center;">
          <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FFB300, #FF8F00); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <span style="color: white; font-weight: 900; font-size: 28px;">Y</span>
          </div>
          <h1 style="color: white; margin: 0; font-size: 24px;">Pagamento Confirmado! 🎉</h1>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
          <h2 style="color: #1f2130; margin: 0 0 10px 0;">Parabéns, ${name}!</h2>
          <p style="color: #8a8ca3; font-size: 16px; line-height: 1.6;">
            O seu pagamento para o <strong>Plano ${planName}</strong> foi aprovado com sucesso.
          </p>
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 20px; margin: 25px 0;">
            <p style="color: #10b981; font-weight: bold; font-size: 18px; margin: 0;">✅ Premium Ativado</p>
            <p style="color: #666; margin: 10px 0 0 0;">Todas as funcionalidades Premium estão agora desbloqueadas, incluindo o Conselheiro Yeto AI, PDFs profissionais e muito mais.</p>
          </div>
          <a href="https://yetofinancas.ao" style="display: inline-block; background: #373392; color: white; text-decoration: none; padding: 14px 40px; border-radius: 30px; font-weight: bold; font-size: 16px;">Acessar o Yeto</a>
        </div>
        <div style="background: #f2f3f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #8a8ca3; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Yeto Finanças — Todos os direitos reservados.</p>
        </div>
      </div>
    `
  });
};

/**
 * Envia código de recuperação de senha
 */
const sendPasswordReset = async (email, name, code) => {
  return sendEmail({
    to: email,
    subject: `${code} — Recuperação de Senha | Yeto Finanças`,
    htmlContent: `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fc; border-radius: 20px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #373392 0%, #4b46ba 100%); padding: 40px 30px; text-align: center;">
          <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FFB300, #FF8F00); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
            <span style="color: white; font-weight: 900; font-size: 28px;">Y</span>
          </div>
          <h1 style="color: white; margin: 0; font-size: 24px;">Recuperação de Senha 🔑</h1>
        </div>
        <div style="padding: 40px 30px; text-align: center;">
          <h2 style="color: #1f2130; margin: 0 0 10px 0;">Olá, ${name}!</h2>
          <p style="color: #8a8ca3; font-size: 16px; line-height: 1.6;">
            Recebemos um pedido para redefinir a sua senha. Use o código abaixo:
          </p>
          <div style="background: white; border: 2px solid #f45b5b; border-radius: 16px; padding: 25px; margin: 30px 0; display: inline-block;">
            <span style="font-size: 36px; font-weight: 900; color: #f45b5b; letter-spacing: 12px;">${code}</span>
          </div>
          <p style="color: #8a8ca3; font-size: 14px;">
            Este código expira em <strong>15 minutos</strong>. Se não solicitou esta recuperação, ignore este email e a sua senha permanecerá inalterada.
          </p>
        </div>
        <div style="background: #f2f3f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #8a8ca3; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Yeto Finanças — Todos os direitos reservados.</p>
        </div>
      </div>
    `
  });
};

/**
 * Envia email promocional em massa
 */
const sendMassPromotion = async (recipients, subject, htmlContent) => {
  // Brevo permite enviar para múltiplos destinatários de uma vez (até 50 por chamada)
  // Para listas maiores, dividimos em lotes
  const batchSize = 50;
  let sent = 0;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const toList = batch.map(r => ({ email: r.email, name: r.name || r.email }));

    // Enviar individualmente para cada destinatário (BCC) para proteger a privacidade
    for (const recipient of toList) {
      try {
        await sendEmail({
          to: recipient.email,
          subject,
          htmlContent: `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fc; border-radius: 20px; overflow: hidden;">
              <div style="background: linear-gradient(135deg, #373392 0%, #4b46ba 100%); padding: 40px 30px; text-align: center;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FFB300, #FF8F00); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                  <span style="color: white; font-weight: 900; font-size: 28px;">Y</span>
                </div>
                <h1 style="color: white; margin: 0; font-size: 24px;">Yeto Finanças</h1>
              </div>
              <div style="padding: 40px 30px;">
                ${htmlContent}
              </div>
              <div style="background: #f2f3f9; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="color: #8a8ca3; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Yeto Finanças — Todos os direitos reservados.</p>
              </div>
            </div>
          `
        });
        sent++;
      } catch (error) {
        console.error(`❌ Falha ao enviar para ${recipient.email}:`, error.message);
      }
    }
  }

  return { sent, total: recipients.length };
};

module.exports = {
  sendVerificationCode,
  sendPaymentApproved,
  sendPasswordReset,
  sendMassPromotion
};
