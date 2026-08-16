import React, { useState } from 'react';
import familyImg from '../assets/login_family.png';
import Planos from './Planos';

export default function LoginScreen({ onLogin }) {
  const [showSobre, setShowSobre] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao efetuar login');
      }

      // Pass the user data up to the App
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
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password, occupation })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar conta');
      }

      // Pass the user data up to the App to auto-login
      onLogin(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
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
            <h1>
              Yeto
              <span>{isRegistering ? 'Crie a sua conta' : 'Acesse a sua conta'}</span>
            </h1>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            {errorMsg && (
              <div style={{ background: 'rgba(244, 91, 91, 0.1)', color: 'var(--danger-color)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            {isRegistering && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>👤 Nome Completo</label>
                  <input 
                    type="text" 
                    placeholder="Seu nome" 
                    required 
                    value={name}
                    onChange={(e) => setName(e.target.value)} 
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label>💼 Profissão</label>
                  <input 
                    type="text" 
                    placeholder="Opcional..." 
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)} 
                  />
                </div>
              </div>
            )}

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
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    color: '#6c757d',
                    padding: '0'
                  }}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {!isRegistering && (
              <div className="login-options">
                <label>
                  <input type="checkbox" defaultChecked />
                  Manter-me conectado
                </label>
                <a href="#esqueceu">Esqueceu a senha?</a>
              </div>
            )}

            <button type="submit" className="btn-login" disabled={isLoading}>
              {isLoading ? 'A PROCESSAR...' : (isRegistering ? 'CRIAR CONTA' : 'ENTRAR')}
            </button>
          </form>

          <div className="btn-register-link" style={{ marginTop: '2rem', textAlign: 'center' }}>
            {isRegistering ? (
              <>Já tem uma conta? <a href="#login" onClick={(e) => { e.preventDefault(); setIsRegistering(false); setErrorMsg(''); }} style={{ color: '#FFB300', fontWeight: '800' }}>Faça Login</a></>
            ) : (
              <>Não tem uma conta? <a href="#criar" onClick={(e) => { e.preventDefault(); setIsRegistering(true); setErrorMsg(''); }} style={{ color: '#FFB300', fontWeight: '800' }}>Crie uma conta</a></>
            )}
            
            {/* Botão visível apenas no mobile */}
            <button 
              type="button" 
              className="show-on-mobile"
              onClick={() => setShowSobre(true)}
              style={{
                display: 'none', // Oculto por padrão, mas você pode controlar via CSS no mobile
                marginTop: '1.5rem', background: '#f2f3f9', color: '#373392', border: 'none',
                padding: '0.8rem 2rem', borderRadius: '25px', fontWeight: 'bold',
                cursor: 'pointer', width: '100%',
              }}
            >
              🌍 Como funciona & Planos
            </button>
          </div>

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
