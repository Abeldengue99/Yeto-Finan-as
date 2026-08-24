import React, { useEffect, useMemo, useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';

export default function Gamificacao() {
  const {
    yetoPoints,
    nivelAtual,
    nextLevelPoints,
    desafiosAtivos,
    conquistas,
    gamificationRewards,
    gamificationHistory,
    isGamificationLoading,
    carregarGamificacao,
    completarDesafio,
    resgatarPremium,
    usuario
  } = useFinance();

  const [claimingId, setClaimingId] = useState(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const hasGamificacaoAccess = usuario?.isPremium || usuario?.featureAccess?.includes('gamificacao');

  useEffect(() => {
    if (hasGamificacaoAccess) {
      void carregarGamificacao?.();
    }
  }, [hasGamificacaoAccess]);

  const reward = gamificationRewards?.[0] || {
    title: '1 mês Premium',
    description: 'Acesso total ao sistema por 30 dias.',
    cost: 2000,
    canRedeem: yetoPoints >= 2000
  };

  const progressInfo = useMemo(() => {
    if (!nextLevelPoints) {
      return { percent: 100, remaining: 0, label: 'Nível máximo alcançado' };
    }

    const percent = Math.min((Number(yetoPoints || 0) / Number(nextLevelPoints || 1)) * 100, 100);
    const remaining = Math.max(0, Number(nextLevelPoints || 0) - Number(yetoPoints || 0));

    return {
      percent,
      remaining,
      label: remaining > 0 ? `Faltam ${remaining} pontos para o próximo nível.` : 'Próximo nível desbloqueado.'
    };
  }, [nextLevelPoints, yetoPoints]);

  const handleClaim = async (challengeId) => {
    setClaimingId(challengeId);
    await completarDesafio(challengeId);
    setClaimingId(null);
  };

  const handleRedeem = async () => {
    setIsRedeeming(true);
    await resgatarPremium();
    setIsRedeeming(false);
  };

  if (!hasGamificacaoAccess) {
    return (
      <div className="dash-card" style={{ minHeight: '55vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎮</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Desafios & Metas</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            A gamificação fica disponível durante o mês grátis e nos planos Premium. Complete missões financeiras,
            ganhe YetoPoints e troque por recompensas dentro da plataforma.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div className="transactions-page-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">🎮 Desafios & Metas</h1>
          <p className="text-secondary">Ganhe pontos por organizar melhor o seu dinheiro.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => carregarGamificacao?.()}
          disabled={isGamificationLoading}
        >
          {isGamificationLoading ? 'A atualizar...' : 'Atualizar'}
        </button>
      </div>

      <div className="dash-card" style={{
        background: 'linear-gradient(135deg, #373392 0%, #171544 100%)',
        color: 'white',
        marginBottom: '2rem',
        border: '1px solid rgba(255,255,255,0.12)',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--accent-color)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Nível atual
            </p>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', margin: '0 0 1rem' }}>{nivelAtual}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: 480 }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', height: 10, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${progressInfo.percent}%`, height: '100%', background: 'var(--accent-color)', borderRadius: 999 }} />
              </div>
              <span style={{ color: '#e4e3ff', fontWeight: 700 }}>{nextLevelPoints || yetoPoints} pts</span>
            </div>
            <p style={{ color: '#d6d5ef', margin: '0.7rem 0 0' }}>{progressInfo.label}</p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#d6d5ef', fontWeight: 700 }}>Saldo de Pontos</div>
            <div style={{ fontSize: 'clamp(2.6rem, 7vw, 4.5rem)', fontWeight: 900, color: 'var(--accent-color)', lineHeight: 1 }}>
              {Number(yetoPoints || 0).toLocaleString('pt-AO')}
            </div>
            <div style={{ color: 'white', marginTop: '0.4rem' }}>YetoPoints</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '2rem' }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Missões disponíveis</h3>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{desafiosAtivos.length} missão(ões)</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {desafiosAtivos.length === 0 && (
              <div className="dash-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Sem missões para apresentar</h4>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
                  Registe contas, receitas, despesas, orçamentos e listas para desbloquear missões.
                </p>
              </div>
            )}

            {desafiosAtivos.map(desafio => {
              const progress = Math.min((Number(desafio.progresso || 0) / Math.max(1, Number(desafio.meta || 1))) * 100, 100);
              const isComplete = Boolean(desafio.completed) || progress >= 100;
              const isClaimed = Boolean(desafio.claimed);
              const canClaim = Boolean(desafio.canClaim) && !isClaimed;

              return (
                <article key={desafio.id} className="dash-card" style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) auto', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ fontSize: '2.4rem', background: '#f2f3f9', width: 72, height: 72, borderRadius: 18, display: 'grid', placeItems: 'center' }}>
                    {desafio.icone || '🎯'}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.4rem' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{desafio.titulo}</h4>
                      <span style={{ color: 'var(--accent-color)', fontWeight: 900 }}>+{desafio.recompensa} pts</span>
                    </div>
                    <p style={{ margin: '0 0 0.9rem', color: 'var(--text-secondary)' }}>{desafio.descricao}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ flex: 1, background: '#eef0f7', height: 8, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: isComplete ? 'var(--success-color)' : 'var(--accent-color)', borderRadius: 999 }} />
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        {desafio.progresso} / {desafio.meta}
                      </span>
                    </div>
                  </div>

                  {isClaimed ? (
                    <span style={{ color: 'var(--success-color)', fontWeight: 900 }}>Resgatado</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canClaim || claimingId === desafio.id}
                      onClick={() => handleClaim(desafio.id)}
                      style={{ padding: '0.75rem 1.1rem', borderRadius: 14, opacity: canClaim ? 1 : 0.55 }}
                    >
                      {claimingId === desafio.id ? '...' : canClaim ? 'Resgatar' : 'Em curso'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="dash-card" style={{ background: 'linear-gradient(135deg, #fff 0%, #fff8e5 100%)', border: '1px solid rgba(255,179,0,0.25)' }}>
            <h3 className="section-title" style={{ color: '#d97706' }}>Loja de Recompensas</h3>
            <p style={{ color: 'var(--text-secondary)' }}>{reward.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'white', borderRadius: 16 }}>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{reward.title}</strong>
                <span style={{ color: 'var(--text-secondary)' }}>{Number(reward.cost || 2000).toLocaleString('pt-AO')} pts</span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isRedeeming || usuario?.plan_type === 'admin' || Number(yetoPoints || 0) < Number(reward.cost || 2000)}
                onClick={handleRedeem}
              >
                {isRedeeming ? '...' : 'Trocar'}
              </button>
            </div>
            <p style={{ color: '#d97706', fontWeight: 800, margin: '1rem 0 0' }}>
              {Number(yetoPoints || 0) < Number(reward.cost || 2000)
                ? `Faltam ${Number(reward.cost || 2000) - Number(yetoPoints || 0)} pontos.`
                : usuario?.plan_type === 'admin'
                  ? 'Conta administrativa não precisa resgatar.'
                  : 'Já pode trocar por Premium.'}
            </p>
          </div>

          <div className="dash-card">
            <h3 className="section-title">Conquistas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              {conquistas.map(conquista => (
                <div
                  key={conquista.id}
                  style={{
                    padding: '1rem',
                    borderRadius: 14,
                    background: conquista.desbloqueada ? '#f8f9fc' : '#fff',
                    border: conquista.desbloqueada ? '1px solid var(--glass-border)' : '1px dashed #dbe0ef',
                    opacity: conquista.desbloqueada ? 1 : 0.55
                  }}
                >
                  <div style={{ fontSize: '2rem' }}>{conquista.icone}</div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginTop: '0.5rem' }}>{conquista.titulo}</strong>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{conquista.descricao}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-card">
            <h3 className="section-title">Histórico de Pontos</h3>
            {gamificationHistory.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Ainda não existem movimentos de pontos.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {gamificationHistory.slice(0, 6).map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid #eef0f7', paddingBottom: '0.8rem' }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>{item.title}</strong>
                      <p style={{ color: 'var(--text-secondary)', margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                        {new Date(item.createdAt).toLocaleDateString('pt-AO')}
                      </p>
                    </div>
                    <span style={{ color: Number(item.points) >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 900 }}>
                      {Number(item.points) >= 0 ? '+' : ''}{item.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
