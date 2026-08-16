import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import Modal from '../../components/Modal';

function formatDate(value) {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function daysUntil(value) {
  if (!value) return null;
  const expiry = new Date(value).getTime();
  if (Number.isNaN(expiry)) return null;
  return Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function AdminUsers() {
  const { users, toggleUserStatus, changeUserPlan, deleteUser } = useAdmin();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter(user => (
      user.nome?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.plano?.toLowerCase().includes(query) ||
      user.status?.toLowerCase().includes(query)
    ));
  }, [search, users]);

  const profileDaysLeft = selectedUser ? daysUntil(selectedUser.dataExpiracao) : null;
  const actionUser = pendingAction?.user || null;
  const actionTitle = pendingAction?.type === 'delete' ? 'Eliminar Utilizador' : 'Confirmar Premium';
  const actionText = pendingAction?.type === 'delete'
    ? `Eliminar definitivamente ${actionUser?.nome}? Esta ação remove a conta e os dados associados.`
    : `Dar Premium grátis a ${actionUser?.nome}?`;

  const confirmAction = async () => {
    if (!pendingAction?.user) return;

    if (pendingAction.type === 'delete') {
      await deleteUser(pendingAction.user.id);
      if (selectedUser?.id === pendingAction.user.id) setSelectedUser(null);
    }

    if (pendingAction.type === 'premium') {
      const updated = await changeUserPlan(pendingAction.user.id, 'Premium');
      if (updated && selectedUser?.id === pendingAction.user.id) setSelectedUser(updated);
    }

    setPendingAction(null);
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Gestão de Utilizadores</h1>
          <p className="text-secondary" style={{ margin: 0 }}>Controlo das contas ativas, planos e risco operacional.</p>
        </div>
        <input
          className="qt-input"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Pesquisar por nome, email, plano ou estado..."
          style={{ maxWidth: '360px', padding: '0.72rem 0.9rem' }}
        />
      </div>

      <div className="dash-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '920px' }}>
            <thead>
              <tr style={{ background: '#f8f9fc', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Utilizador</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Plano</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Email</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Estado</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Validade</th>
                <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Nenhum utilizador encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const remaining = daysUntil(user.dataExpiracao);
                  const isExpiring = remaining !== null && remaining >= 0 && remaining <= 7;
                  const isExpired = remaining !== null && remaining < 0;
                  const isAdminUser = user.plano === 'Admin';

                  return (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '1rem' }}>
                        <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{user.nome}</strong>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{user.email}</span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          background: user.plano === 'Premium' ? 'rgba(255, 179, 0, 0.12)' : 'rgba(55, 51, 146, 0.08)',
                          color: user.plano === 'Premium' ? '#d97706' : 'var(--accent-color)',
                          padding: '0.3rem 0.8rem',
                          borderRadius: '999px',
                          fontSize: '0.82rem',
                          fontWeight: 800
                        }}>
                          {user.plano}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ color: user.emailVerificado ? 'var(--success-color)' : '#d97706', fontWeight: 800 }}>
                          {user.emailVerificado ? 'Verificado' : 'Não verificado'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ color: user.status === 'Ativo' ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 800 }}>
                          {user.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: isExpired ? 'var(--danger-color)' : isExpiring ? '#d97706' : 'var(--text-secondary)', fontWeight: isExpired || isExpiring ? 800 : 500 }}>
                        {isAdminUser ? 'Admin' : remaining === null ? 'Sem data' : isExpired ? 'Expirado' : `${remaining} dia(s)`}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setSelectedUser(user)} className="btn btn-glass" style={{ padding: '0.5rem 0.9rem', borderRadius: '10px', fontSize: '0.82rem' }}>
                            Perfil 360
                          </button>
                          {user.plano !== 'Premium' && !isAdminUser && (
                            <button type="button" onClick={() => setPendingAction({ type: 'premium', user })} className="btn btn-primary" style={{ padding: '0.5rem 0.9rem', borderRadius: '10px', fontSize: '0.82rem' }}>
                              Dar Premium
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleUserStatus(user.id)}
                            disabled={isAdminUser}
                            className="btn"
                            style={{
                              background: user.status === 'Ativo' ? 'rgba(244, 91, 91, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: isAdminUser ? 'var(--text-secondary)' : user.status === 'Ativo' ? 'var(--danger-color)' : 'var(--success-color)',
                              padding: '0.5rem 0.9rem',
                              borderRadius: '10px',
                              fontSize: '0.82rem',
                              border: 'none',
                              opacity: isAdminUser ? 0.45 : 1,
                              cursor: isAdminUser ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {user.status === 'Ativo' ? 'Bloquear' : 'Ativar'}
                          </button>
                          {!isAdminUser && (
                            <button type="button" onClick={() => setPendingAction({ type: 'delete', user })} className="btn" style={{ background: 'rgba(244, 91, 91, 0.14)', color: 'var(--danger-color)', padding: '0.5rem 0.9rem', borderRadius: '10px', fontSize: '0.82rem', border: '1px solid rgba(244, 91, 91, 0.18)' }}>
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} title="Perfil 360">
        {selectedUser && (
          <div className="admin-profile360">
            <div className="admin-profile360-header">
              <div>
                <strong>{selectedUser.nome}</strong>
                <span>{selectedUser.email}</span>
              </div>
              <em>{selectedUser.status}</em>
            </div>

            <div className="admin-profile360-grid">
              <div><span>Plano</span><strong>{selectedUser.plano}</strong></div>
              <div><span>Email</span><strong>{selectedUser.emailVerificado ? 'Verificado' : 'Não verificado'}</strong></div>
              <div><span>Validade</span><strong>{selectedUser.plano === 'Admin' ? 'Admin' : profileDaysLeft === null ? 'Sem data' : `${profileDaysLeft} dia(s)`}</strong></div>
              <div><span>Registo</span><strong>{formatDate(selectedUser.dataRegisto)}</strong></div>
              <div><span>Profissão</span><strong>{selectedUser.ocupacao || 'Não informada'}</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              {selectedUser.plano !== 'Premium' && selectedUser.plano !== 'Admin' && (
                <button type="button" className="btn btn-primary btn-pill" onClick={() => setPendingAction({ type: 'premium', user: selectedUser })}>
                  Dar Premium
                </button>
              )}
              {selectedUser.plano !== 'Admin' && (
                <button type="button" className="btn btn-glass btn-pill" onClick={() => toggleUserStatus(selectedUser.id)} style={{ color: selectedUser.status === 'Ativo' ? 'var(--danger-color)' : 'var(--success-color)' }}>
                  {selectedUser.status === 'Ativo' ? 'Bloquear conta' : 'Ativar conta'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(pendingAction)} onClose={() => setPendingAction(null)} title={actionTitle}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
            {actionText}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-glass btn-pill" onClick={() => setPendingAction(null)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary btn-pill" onClick={confirmAction}>
              Confirmar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
