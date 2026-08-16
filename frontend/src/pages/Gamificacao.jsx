import React, { useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';

export default function Gamificacao() {
  const { yetoPoints, nivelAtual, desafiosAtivos, conquistas, completarDesafio, resgatarPremium, usuario, adicionarDesafio } = useFinance();
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [novoDesafio, setNovoDesafio] = useState({ titulo: '', descricao: '', recompensa: 100, meta: 1, icone: '🎯' });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    adicionarDesafio(novoDesafio);
    setShowAddModal(false);
    setNovoDesafio({ titulo: '', descricao: '', recompensa: 100, meta: 1, icone: '🎯' });
  };

  // Calcula o progresso para o próximo nível (Fictício para demonstração)
  const proximoNivelPontos = 2000;
  const progressoNivel = Math.min((yetoPoints / proximoNivelPontos) * 100, 100);

  if (!usuario?.isPremium) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎮</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Desafios Familiares (Premium)</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', marginBottom: '2rem' }}>
          O seu período de teste terminou. A secção de Gamificação, missões em equipa e o programa de recompensas 
          são exclusivos do Plano Premium. Renove para voltar a jogar e ganhar YetoPoints!
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="page-title">🎮 Desafios Familiares</h1>
        <p className="text-secondary">Poupe em equipa, ganhe pontos e desbloqueie recompensas reais!</p>
      </div>

      {/* Hero Section: Nível e Pontos */}
      <div className="dash-card" style={{ 
        background: 'linear-gradient(135deg, #373392 0%, #1a1850 100%)', 
        color: 'white', 
        marginBottom: '2rem',
        border: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Efeito de brilho no fundo */}
        <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(255,179,0,0.2) 0%, transparent 70%)', borderRadius: '50%' }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div>
            <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              Nível Atual
            </p>
            <h2 style={{ fontSize: '2.5rem', margin: '0 0 1rem 0' }}>{nivelAtual} 👑</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '400px' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${progressoNivel}%`, height: '100%', background: 'var(--accent-color)', borderRadius: '5px', transition: 'width 1s ease-in-out' }}></div>
              </div>
              <span style={{ fontSize: '0.9rem', color: '#ccc' }}>{proximoNivelPontos} pts</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '0.5rem' }}>Faltam {proximoNivelPontos - yetoPoints} pontos para "Reis do Kwanza"!</p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.2rem', color: '#ccc', marginBottom: '0.2rem' }}>Saldo de Pontos</div>
            <div style={{ fontSize: '4rem', fontWeight: '900', color: 'var(--accent-color)', lineHeight: '1', filter: 'drop-shadow(0 0 15px rgba(255,179,0,0.4))' }}>
              {yetoPoints}
            </div>
            <div style={{ fontSize: '1rem', color: 'white', marginTop: '0.5rem' }}>YetoPoints ✨</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* Lado Esquerdo: Missões Ativas */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Missões Ativas</h3>
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '10px' }}>
              + Criar Desafio
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {desafiosAtivos.length === 0 ? (
              <div className="dash-card" style={{ textAlign: 'center', padding: '3rem' }}>
                <span style={{ fontSize: '3rem' }}>🎉</span>
                <h4 style={{ margin: '1rem 0 0.5rem 0', color: 'var(--text-primary)' }}>Todas as missões concluídas!</h4>
                <p style={{ color: 'var(--text-secondary)' }}>Novos desafios serão desbloqueados na próxima semana.</p>
              </div>
            ) : (
              desafiosAtivos.map(desafio => {
                const progresso = (desafio.progresso / desafio.meta) * 100;
                const isCompleto = progresso >= 100;
                
                return (
                  <div key={desafio.id} className="dash-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ fontSize: '3rem', background: '#f2f3f9', width: '80px', height: '80px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {desafio.icone}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{desafio.titulo}</h4>
                        <span style={{ background: 'rgba(255,179,0,0.1)', color: 'var(--accent-color)', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                          +{desafio.recompensa} pts
                        </span>
                      </div>
                      <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{desafio.descricao}</p>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ flex: 1, background: '#eee', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(progresso, 100)}%`, height: '100%', background: isCompleto ? 'var(--success-color)' : 'var(--accent-color)', borderRadius: '4px' }}></div>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                          {desafio.progresso} / {desafio.meta}
                        </span>
                      </div>
                    </div>
                    {isCompleto && (
                      <button 
                        onClick={() => completarDesafio(desafio.id)}
                        className="btn btn-primary"
                        style={{ padding: '0.8rem 1.5rem', borderRadius: '15px', animation: 'pulse 2s infinite' }}
                      >
                        Resgatar
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Lado Direito: Mural e Recompensas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Recompensas / Loja */}
          <div className="dash-card" style={{ background: 'linear-gradient(135deg, #fff 0%, #fff9eb 100%)', border: '1px solid rgba(255,179,0,0.2)' }}>
            <h3 className="section-title" style={{ color: '#d97706' }}>🎁 Loja de Recompensas</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Troque os seus YetoPoints por vantagens exclusivas.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'white', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
              <div>
                <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--text-primary)' }}>1 Mês Premium</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Acesso total ao sistema</p>
              </div>
              <button 
                className="btn" 
                disabled={yetoPoints < 2000 || isRedeeming || usuario?.plan_type === 'premium'}
                onClick={async () => {
                  setIsRedeeming(true);
                  await resgatarPremium();
                  setIsRedeeming(false);
                }}
                style={{ 
                  background: yetoPoints >= 2000 && usuario?.plan_type !== 'premium' ? 'var(--accent-gradient)' : '#f2f3f9', 
                  color: yetoPoints >= 2000 && usuario?.plan_type !== 'premium' ? 'white' : '#ccc', 
                  border: 'none', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '10px', 
                  fontWeight: 'bold', 
                  cursor: yetoPoints >= 2000 && usuario?.plan_type !== 'premium' ? 'pointer' : 'not-allowed' 
                }}
              >
                {isRedeeming ? '...' : (usuario?.plan_type === 'premium' ? 'Já Ativo' : '2.000 pts')}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 'bold' }}>
                {usuario?.plan_type === 'premium' ? 'Conta já é Premium!' : (yetoPoints < 2000 ? `Faltam ${2000 - yetoPoints} pontos` : 'Pode resgatar!')}
              </span>
            </div>
          </div>

          {/* Mural de Conquistas */}
          <div className="dash-card">
            <h3 className="section-title">Mural de Conquistas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {conquistas.map(conquista => (
                <div 
                  key={conquista.id} 
                  style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                    padding: '1rem', borderRadius: '15px',
                    background: conquista.desbloqueada ? '#f8f9fc' : '#fff',
                    border: conquista.desbloqueada ? '1px solid var(--glass-border)' : '1px dashed #e2e8f0',
                    opacity: conquista.desbloqueada ? 1 : 0.5,
                    filter: conquista.desbloqueada ? 'none' : 'grayscale(100%)'
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', filter: conquista.desbloqueada ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none' }}>
                    {conquista.icone}
                  </div>
                  <h5 style={{ margin: '0 0 0.2rem 0', color: 'var(--text-primary)', fontSize: '0.85rem' }}>{conquista.titulo}</h5>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.2' }}>{conquista.descricao}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {showAddModal && (
        <div className="sobre-modal-overlay">
          <div className="sobre-modal-container" style={{ maxWidth: '400px', padding: '2rem' }}>
            <button className="sobre-modal-close" onClick={() => setShowAddModal(false)}>×</button>
            <h2 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Novo Desafio</h2>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Título</label>
                <input type="text" required className="search-bar" value={novoDesafio.titulo} onChange={e => setNovoDesafio({...novoDesafio, titulo: e.target.value})} placeholder="Ex: Fim de Semana sem Fast Food" style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Descrição</label>
                <input type="text" required className="search-bar" value={novoDesafio.descricao} onChange={e => setNovoDesafio({...novoDesafio, descricao: e.target.value})} placeholder="Ex: Não comer fora durante o fim de semana" style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Recompensa (Pts)</label>
                  <input type="number" required min="10" className="search-bar" value={novoDesafio.recompensa} onChange={e => setNovoDesafio({...novoDesafio, recompensa: Number(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Meta</label>
                  <input type="number" required min="1" className="search-bar" value={novoDesafio.meta} onChange={e => setNovoDesafio({...novoDesafio, meta: Number(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Ícone (Emoji)</label>
                <input type="text" className="search-bar" value={novoDesafio.icone} onChange={e => setNovoDesafio({...novoDesafio, icone: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', borderRadius: '10px', marginTop: '1rem' }}>Adicionar Desafio</button>
            </form>
          </div>
        </div>
      )}
      
      {/* CSS extra para animação do botão */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 179, 0, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 179, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 179, 0, 0); }
        }
      `}</style>
    </div>
  );
}
