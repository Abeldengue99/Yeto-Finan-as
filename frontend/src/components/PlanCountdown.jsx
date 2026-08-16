import React, { useEffect, useMemo, useState } from 'react';

const PLAN_LABELS = {
  free: 'Plano Gratis',
  premium: 'Plano Premium',
  admin: 'Plano Admin'
};

function getRemaining(expiresAt) {
  if (!expiresAt) return null;

  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return null;

  const totalMs = Math.max(0, expiry - Date.now());
  const totalMinutes = Math.floor(totalMs / 60000);

  return {
    totalMs,
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60
  };
}

function formatDate(expiresAt) {
  if (!expiresAt) return 'Sem data definida';

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return 'Data invalida';

  return expiry.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function PlanCountdown({ expiresAt, planType, onRenew }) {
  const [remaining, setRemaining] = useState(() => getRemaining(expiresAt));

  useEffect(() => {
    setRemaining(getRemaining(expiresAt));
    const intervalId = setInterval(() => {
      setRemaining(getRemaining(expiresAt));
    }, 60000);

    return () => clearInterval(intervalId);
  }, [expiresAt]);

  const isAdmin = planType === 'admin';
  const isExpired = !isAdmin && remaining !== null && remaining.totalMs <= 0;
  const isWarning = !isAdmin && remaining !== null && remaining.totalMs > 0 && remaining.days <= 3;
  const label = PLAN_LABELS[planType] || 'Plano';

  const status = useMemo(() => {
    if (isAdmin) return 'Acesso administrativo ativo';
    if (!expiresAt) return 'Expiracao por configurar';
    if (isExpired) return 'Plano expirado';
    if (isWarning) return 'A terminar em breve';
    return 'Acesso ativo';
  }, [expiresAt, isAdmin, isExpired, isWarning]);

  const accentColor = isExpired
    ? 'var(--danger-color)'
    : isWarning
      ? 'var(--warning-color)'
      : 'var(--success-color)';
  const statusBgColor = isExpired
    ? 'rgba(244, 91, 91, 0.12)'
    : isWarning
      ? 'rgba(252, 168, 52, 0.14)'
      : 'rgba(16, 185, 129, 0.12)';

  return (
    <div style={{
      margin: '0.75rem 0 1rem 0',
      padding: '1rem',
      borderRadius: '16px',
      background: '#f8f9fc',
      border: `1px solid ${isExpired ? 'rgba(244, 91, 91, 0.28)' : 'rgba(55, 51, 146, 0.08)'}`,
      boxShadow: '0 8px 22px rgba(55, 51, 146, 0.06)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.8rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Validade do plano
          </p>
          <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
            {label}
          </h3>
        </div>
        <span style={{
          background: statusBgColor,
          color: accentColor,
          padding: '0.35rem 0.65rem',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontWeight: 800,
          whiteSpace: 'nowrap'
        }}>
          {status}
        </span>
      </div>

      {isAdmin ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Esta conta nao fica limitada por expiracao.
        </div>
      ) : remaining === null ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Execute a migracao de expiracao para definir a validade deste plano.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {[
            ['Dias', remaining.days],
            ['Horas', remaining.hours],
            ['Min', remaining.minutes]
          ].map(([unit, value]) => (
            <div key={unit} style={{
              background: 'white',
              border: '1px solid rgba(55, 51, 146, 0.06)',
              borderRadius: '12px',
              padding: '0.65rem 0.4rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.45rem', lineHeight: 1, fontWeight: 900, color: accentColor }}>
                {String(value).padStart(2, '0')}
              </div>
              <div style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                {unit}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: '0.8rem',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '0.75rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
          Expira em: {formatDate(expiresAt)}
        </span>
        {!isAdmin && (isExpired || isWarning) && (
          <button
            type="button"
            className="btn btn-primary btn-pill"
            onClick={onRenew}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
          >
            Renovar
          </button>
        )}
      </div>
    </div>
  );
}
