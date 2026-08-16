import React, { useEffect, useMemo, useState } from 'react';

const PLAN_LABELS = {
  free: 'Plano Grátis',
  premium: 'Plano Premium',
  admin: 'Plano Admin'
};
const FREE_TRIAL_DAYS = 30;

function resolveExpiry(expiresAt, createdAt, planType) {
  if (planType === 'admin') return null;

  const explicitExpiry = expiresAt ? new Date(expiresAt) : null;
  if (explicitExpiry && !Number.isNaN(explicitExpiry.getTime())) {
    return explicitExpiry;
  }

  if (planType === 'free' && createdAt) {
    const created = new Date(createdAt);
    if (!Number.isNaN(created.getTime())) {
      return new Date(created.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
    }
  }

  return null;
}

function getRemaining(expiresAt) {
  if (!expiresAt) return null;

  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return null;

  const totalMs = Math.max(0, expiry - Date.now());
  const totalSeconds = Math.floor(totalMs / 1000);

  return {
    totalMs,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
}

function formatDate(expiresAt) {
  if (!expiresAt) return 'Sem data definida';

  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return 'Data inválida';

  return expiry.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCountdown(remaining) {
  if (!remaining) return '00d 00h 00m 00s';

  return `${String(remaining.days).padStart(2, '0')}d ${String(remaining.hours).padStart(2, '0')}h ${String(remaining.minutes).padStart(2, '0')}m ${String(remaining.seconds).padStart(2, '0')}s`;
}

export default function PlanCountdown({ expiresAt, createdAt, planType, onRenew }) {
  const effectiveExpiresAt = useMemo(
    () => resolveExpiry(expiresAt, createdAt, planType),
    [expiresAt, createdAt, planType]
  );
  const [remaining, setRemaining] = useState(() => getRemaining(effectiveExpiresAt));

  useEffect(() => {
    setRemaining(getRemaining(effectiveExpiresAt));
    const intervalId = setInterval(() => {
      setRemaining(getRemaining(effectiveExpiresAt));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [effectiveExpiresAt]);

  const isAdmin = planType === 'admin';
  const isExpired = !isAdmin && remaining !== null && remaining.totalMs <= 0;
  const isWarning = !isAdmin && remaining !== null && remaining.totalMs > 0 && remaining.days <= 3;
  const label = PLAN_LABELS[planType] || 'Plano';

  const status = useMemo(() => {
    if (isAdmin) return 'Acesso administrativo ativo';
    if (!effectiveExpiresAt) return 'Expiração por configurar';
    if (isExpired) return 'Plano expirado';
    if (isWarning) return 'A terminar em breve';
    if (planType === 'free') return 'Mês grátis ativo';
    return 'Acesso ativo';
  }, [effectiveExpiresAt, isAdmin, isExpired, isWarning, planType]);

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
      margin: '0.5rem 0 0.75rem 0',
      padding: '0.75rem 0.85rem',
      borderRadius: '14px',
      background: '#f8f9fc',
      border: `1px solid ${isExpired ? 'rgba(244, 91, 91, 0.28)' : 'rgba(55, 51, 146, 0.08)'}`,
      boxShadow: '0 6px 16px rgba(55, 51, 146, 0.05)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.55rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Validade do plano
          </p>
          <h3 style={{ margin: '0.08rem 0 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {label}
          </h3>
        </div>
        <span style={{
          background: statusBgColor,
          color: accentColor,
          padding: '0.3rem 0.55rem',
          borderRadius: '999px',
          fontSize: '0.7rem',
          fontWeight: 800,
          whiteSpace: 'nowrap'
        }}>
          {status}
        </span>
      </div>

      {isAdmin ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          Esta conta não fica limitada por expiração.
        </div>
      ) : remaining === null ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
          O mês grátis é de 30 dias após o cadastro.
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          background: 'white',
          border: '1px solid rgba(55, 51, 146, 0.06)',
          borderRadius: '12px',
          padding: '0.55rem 0.65rem'
        }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700 }}>
            Contagem
          </span>
          <strong style={{ color: accentColor, fontSize: '1rem', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
            {formatCountdown(remaining)}
          </strong>
        </div>
      )}

      <div style={{
        marginTop: '0.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '0.5rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
          {remaining ? `Data limite: ${formatDate(effectiveExpiresAt)}` : 'Acesso gratuito: 30 dias completos'}
        </span>
        {!isAdmin && (isExpired || isWarning) && (
          <button
            type="button"
            className="btn btn-primary btn-pill"
            onClick={onRenew}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
          >
            Renovar
          </button>
        )}
      </div>
    </div>
  );
}
