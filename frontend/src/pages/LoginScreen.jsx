import React, { useState, useEffect } from 'react';
import Planos from './Planos';
import { apiFetch, readJsonResponse } from '../utils/api';

const familyImg = '/login_family.png?v=4';

export default function LoginScreen({ onLogin }) {
  const [showSobre, setShowSobre] = useState(false);
  const [flowState, setFlowState] = useState('login'); // 'login', 'register', 'verify', 'forgot', 'reset'
  
  // Campos
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isRegistering = flowState === 'register';

  // Limpa mensagens quando muda de fluxo
  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
  }, [flowState]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      const data = await readJsonResponse(response, 'Erro ao efetuar login');

      if (!response.ok) {
        if (data.needsVerification) {
          setFlowState('verify');
          setSuccessMsg(data.error || 'A sua conta precisa de ser verificada.');
          return;
        }
        throw new Error(data.error || 'Erro ao efetuar login');
      }

      onLogin(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, occupation })
      });

      const data = await readJsonResponse(response, 'Erro ao criar conta');

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar conta');
      }

      if (data.needsVerification) {
        setFlowState('verify');
        setSuccessMsg(data.message || 'Conta criada! Verifique o seu email com o código de 6 dígitos.');
      } else {
        onLogin(data);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await apiFetch('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code: verificationCode })
      });

      const data = await readJsonResponse(response, 'Erro ao verificar conta');

      if (!response.ok) {
        throw new Error(data.error || 'Código inválido');
      }

      // Verificação bem sucedida, faz login
      onLogin(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await apiFetch('/api/auth/resend-code', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      const data = await readJsonResponse(response, 'Erro ao reenviar código');
      if (!response.ok) throw new Error(data.error);
      setSuccessMsg('Novo código enviado com sucesso!');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });

      const data = await readJsonResponse(response, 'Erro ao pedir recuperação');

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao pedir recuperação');
      }

      setFlowState('reset');
      setSuccessMsg(data.message || 'Verifique o seu email com o código de recuperação.');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code: verificationCode, newPassword: password })
      });

      const data = await readJsonResponse(response, 'Erro ao redefinir senha');

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao redefinir senha');
      }

      setFlowState('login');
      setSuccessMsg('Senha redefinida com sucesso! Inicie sessão.');
      setPassword('');
      setVerificationCode('');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormContent = () => {
    if (flowState === 'verify') {
      return (
        <form onSubmit={handleVerify}>
          <p style={{ color: '#8a8ca3', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Enviámos um código de 6 dígitos para <strong>{email}</strong>.
          </p>
          <div className="input-group">
            <label>🔢 Código de Verificação</label>
            <input 
              type="text" 
              placeholder="000000" 
              maxLength="6"
              required 
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} 
              style={{ letterSpacing: '8px', fontSize: '1.5rem', textAlign: 'center', fontWeight: 'bold' }}
            />
          </div>
          <button type="submit" className="btn-login" disabled={isLoading || verificationCode.length !== 6}>
            {isLoading ? 'A VERIFICAR...' : 'VERIFICAR CONTA'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button type="button" onClick={handleResendCode} style={{ background: 'none', border: 'none', color: '#373392', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>
              Reenviar Código
            </button>
            <br/><br/>
            <button type="button" onClick={() => setFlowState('login')} style={{ background: 'none', border: 'none', color: '#8a8ca3', cursor: 'pointer' }}>
              Voltar ao Login
            </button>
          </div>
        </form>
      );
    }

    if (flowState === 'forgot') {
      return (
        <form onSubmit={handleForgotPassword}>
          <p style={{ color: '#8a8ca3', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Insira o seu email. Se a conta existir, enviaremos um código de recuperação.
          </p>
          <div className="input-group">
            <label>✉️ Email</label>
            <input 
              type="email" 
              placeholder="seuemail@exemplo.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <button type="submit" className="btn-login" disabled={isLoading}>
            {isLoading ? 'A ENVIAR...' : 'ENVIAR CÓDIGO'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setFlowState('login')} style={{ background: 'none', border: 'none', color: '#8a8ca3', cursor: 'pointer' }}>
              Voltar ao Login
            </button>
          </div>
        </form>
      );
    }

    if (flowState === 'reset') {
      return (
        <form onSubmit={handleResetPassword}>
          <p style={{ color: '#8a8ca3', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Insira o código enviado para <strong>{email}</strong> e a sua nova senha.
          </p>
          <div className="input-group">
            <label>🔢 Código de Recuperação</label>
            <input 
              type="text" 
              placeholder="000000" 
              maxLength="6"
              required 
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} 
              style={{ letterSpacing: '8px', fontSize: '1.5rem', textAlign: 'center', fontWeight: 'bold' }}
            />
          </div>
          <div className="input-group">
            <label>🔒 Nova Senha</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)} 
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <small style={{ color: '#8a8ca3', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
              No mínimo 10 caracteres, 1 letra, 1 número e 1 caractere especial.
            </small>
          </div>
          <button type="submit" className="btn-login" disabled={isLoading || verificationCode.length !== 6}>
            {isLoading ? 'A GUARDAR...' : 'REDEFINIR SENHA'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setFlowState('login')} style={{ background: 'none', border: 'none', color: '#8a8ca3', cursor: 'pointer' }}>
              Voltar ao Login
            </button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={isRegistering ? handleRegister : handleLogin}>
        {isRegistering && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>👤 Nome Completo</label>
              <input type="text" placeholder="Seu nome" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>💼 Profissão</label>
              <input type="text" placeholder="Opcional..." value={occupation} onChange={(e) => setOccupation(e.target.value)} />
            </div>
          </div>
        )}

        <div className="input-group">
          <label>✉️ Email</label>
          <input type="email" placeholder="seuemail@exemplo.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="input-group">
          <label>🔒 Senha</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="••••••••" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              style={{ width: '100%', paddingRight: '40px' }}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#6c757d', padding: 0 }}
              title={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {!isRegistering && (
          <div className="login-options">
            <label>
              <input type="checkbox" defaultChecked /> Manter-me conectado
            </label>
            <button type="button" onClick={() => setFlowState('forgot')} style={{ background: 'none', border: 'none', color: '#373392', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              Esqueceu a senha?
            </button>
          </div>
        )}

        <button type="submit" className="btn-login" disabled={isLoading}>
          {isLoading ? 'A PROCESSAR...' : (isRegistering ? 'CRIAR CONTA' : 'ENTRAR')}
        </button>
      </form>
    );
  };

  const getTitle = () => {
    if (flowState === 'verify') return 'Verifique o seu email';
    if (flowState === 'forgot') return 'Recuperar Senha';
    if (flowState === 'reset') return 'Nova Senha';
    if (flowState === 'register') return 'Crie a sua conta';
    return 'Acesse a sua conta';
  };

  return (
    <div className="login-split-container">
      
      {/* Lado Esquerdo - Imagem e Fundo Curvo */}
      <div className="login-left">
        <div className="login-left-content">
          <img src={familyImg} alt="Família feliz a poupar" />
          
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button 
              type="button" 
              onClick={() => setShowSobre(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.4)',
                padding: '1rem 2.5rem', borderRadius: '30px', fontWeight: 'bold', fontSize: '1.1rem',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '10px',
                backdropFilter: 'blur(10px)', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'all 0.3s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <span>🌍</span> Como funciona & Planos
            </button>
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="login-right">
        <div className="login-form-container">
          
          <div className="login-header">
            <div className="css-logo">Y</div>
            <h1>Yeto<span>{getTitle()}</span></h1>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(244, 91, 91, 0.1)', color: 'var(--danger-color)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid rgba(16,185,129,0.3)' }}>
              {successMsg}
            </div>
          )}

          {renderFormContent()}

          {(flowState === 'login' || flowState === 'register') && (
            <div className="btn-register-link" style={{ marginTop: '2rem', textAlign: 'center' }}>
              {isRegistering ? (
                <>Já tem uma conta? <button type="button" onClick={() => setFlowState('login')} style={{ background: 'none', border: 'none', color: '#FFB300', fontWeight: '800', cursor: 'pointer', fontSize: '0.9rem' }}>Faça Login</button></>
              ) : (
                <>Não tem uma conta? <button type="button" onClick={() => setFlowState('register')} style={{ background: 'none', border: 'none', color: '#FFB300', fontWeight: '800', cursor: 'pointer', fontSize: '0.9rem' }}>Crie uma conta</button></>
              )}
              
              <button 
                type="button" 
                className="show-on-mobile"
                onClick={() => setShowSobre(true)}
                style={{
                  display: 'none',
                  marginTop: '1.5rem', background: '#f2f3f9', color: '#373392', border: 'none',
                  padding: '0.8rem 2rem', borderRadius: '25px', fontWeight: 'bold',
                  cursor: 'pointer', width: '100%',
                }}
              >
                🌍 Como funciona & Planos
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Modal Centrado: Sobre o Sistema & Planos */}
      {showSobre && (
        <div className="sobre-modal-overlay">
          <div className="sobre-modal-container">
            <button className="sobre-modal-close" onClick={() => setShowSobre(false)}>×</button>
            
            <div className="sobre-modal-header">
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🌍</div>
              <h1>Yeto Finanças: O seu parceiro familiar</h1>
              <p>
                A palavra <strong>Yeto</strong> significa <em>"Nosso"</em> na nossa terra. E é exatamente esse o espírito: o <strong>Nosso</strong> dinheiro, a <strong>Nossa</strong> família, o <strong>Nosso</strong> futuro. 
              </p>
              <div style={{ textAlign: 'left', marginTop: '1.5rem', background: '#f8f9fc', padding: '1.5rem', borderRadius: '15px' }}>
                <h3 style={{ color: '#373392', marginBottom: '1rem', fontSize: '1.2rem' }}>Porquê usar o Yeto Finanças?</h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <li>✅ <strong>Simplicidade:</strong> Adeus às folhas de cálculo complicadas. Tudo é simples e visual.</li>
                  <li>✅ <strong>Controlo Total:</strong> Gira as despesas da casa, registe o fundo de emergência e partilhe o controlo das dívidas.</li>
                  <li>✅ <strong>Para a Família Angolana:</strong> Desenvolvido de raiz a pensar na nossa realidade (Kixikilas, propinas, divisas).</li>
                  <li>✅ <strong>Gamificação:</strong> Ganhe "YetoPoints" ao atingir metas e troque-os por meses gratuitos do plano Premium!</li>
                </ul>
              </div>
            </div>

            <div className="sobre-modal-bonus">
              <strong style={{ color: '#FFB300', fontSize: '1.2rem', display: 'block', marginBottom: '0.5rem' }}>🎁 Oferta de Boas-Vindas</strong>
              Ao criar a sua conta hoje, recebe <strong>1 MÊS GRÁTIS</strong> no Plano Premium para experimentar todas as funcionalidades sem qualquer compromisso.
            </div>
            
            <div className="sobre-modal-plans">
              <Planos />
            </div>

            <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Concebido com orgulho para as famílias de Angola 🇦🇴<br/>
                Desenvolvido por <a href="https://www.linkedin.com/in/abeldengue/" target="_blank" rel="noopener noreferrer" style={{ color: '#373392', fontWeight: 'bold', textDecoration: 'none' }}>Abel Dengue</a>
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
