import React, { useMemo, useState } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import Modal from '../../components/Modal';
import PeriodFilter from '../../components/PeriodFilter';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../../utils/periodFilters';

function statusLabel(status) {
  if (status === 'approved') return 'Aprovado';
  if (status === 'rejected') return 'Rejeitado';
  return 'Pendente';
}

function statusClass(status) {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  return 'warning';
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadPaymentsCsv(payments) {
  const headers = [
    'Utilizador',
    'Email',
    'Plano',
    'Valor estimado',
    'Estado',
    'Submetido em',
    'Aprovado em',
    'Rejeitado em',
    'Motivo da rejeicao'
  ];
  const rows = payments.map(payment => [
    payment.nome,
    payment.email,
    payment.plano,
    payment.valor,
    statusLabel(payment.status),
    payment.dataSubmissao,
    payment.dataAprovacao,
    payment.dataRejeicao,
    payment.motivoRejeicao
  ]);

  const csv = [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-pagamentos-yeto-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminPayments() {
  const { payments = [], approvePayment, rejectPayment } = useAdmin();
  const [selectedProof, setSelectedProof] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));
  const [planFilter, setPlanFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  const filteredPayments = useMemo(() => (
    filterByPeriod(payments, periodFilter, item => item.dataSubmissaoRaw)
      .filter(item => planFilter === 'todos' || item.plano === planFilter)
      .filter(item => statusFilter === 'todos' || item.status === statusFilter)
  ), [payments, periodFilter, planFilter, statusFilter]);

  const paymentStats = useMemo(() => {
    const approved = payments.filter(item => item.status === 'approved');
    const rejected = payments.filter(item => item.status === 'rejected');
    const pending = payments.filter(item => item.status === 'pending');

    return {
      total: payments.length,
      pending: pending.length,
      approved: approved.length,
      rejected: rejected.length,
      billed: approved.reduce((sum, item) => sum + Number(item.valor || 0), 0),
      lost: rejected.reduce((sum, item) => sum + Number(item.valor || 0), 0),
      pendingValue: pending.reduce((sum, item) => sum + Number(item.valor || 0), 0)
    };
  }, [payments]);

  const handleApprove = async (payment) => {
    await approvePayment(payment.id);
    setFeedback({ type: 'success', text: 'Pagamento aprovado e plano atualizado.' });
  };

  const openRejectModal = (payment) => {
    setRejectTarget(payment);
    setRejectReason('');
    setFeedback(null);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (reason.length < 8) {
      setFeedback({ type: 'danger', text: 'Informe um motivo claro para o utilizador.' });
      return;
    }

    setIsRejecting(true);
    const ok = await rejectPayment(rejectTarget.id, reason);
    setIsRejecting(false);

    if (ok) {
      setRejectTarget(null);
      setFeedback({ type: 'success', text: 'Pagamento rejeitado e utilizador notificado por email.' });
    } else {
      setFeedback({ type: 'danger', text: 'Não foi possível rejeitar este comprovativo.' });
    }
  };

  return (
    <div>
      <div className="admin-payments-header">
        <div>
          <h1 className="page-title">Aprovação de Pagamentos</h1>
          <p className="text-secondary">Validação de comprovativos, faturação e controlo de perdas.</p>
        </div>
        <button type="button" className="btn btn-glass btn-pill" onClick={() => downloadPaymentsCsv(filteredPayments)}>
          Baixar relatório
        </button>
      </div>

      {feedback && (
        <div className={`admin-inline-feedback ${feedback.type}`}>
          {feedback.text}
        </div>
      )}

      <div className="admin-payment-metrics">
        <div className="admin-payment-metric">
          <span>Total de comprovativos</span>
          <strong>{paymentStats.total}</strong>
          <small>Histórico geral recebido</small>
        </div>
        <div className="admin-payment-metric warning">
          <span>Pendentes</span>
          <strong>{paymentStats.pending}</strong>
          <small>Kz {paymentStats.pendingValue.toLocaleString('pt-AO')} em análise</small>
        </div>
        <div className="admin-payment-metric success">
          <span>Aprovados</span>
          <strong>{paymentStats.approved}</strong>
          <small>Kz {paymentStats.billed.toLocaleString('pt-AO')} faturados</small>
        </div>
        <div className="admin-payment-metric danger">
          <span>Rejeitados</span>
          <strong>{paymentStats.rejected}</strong>
          <small>Kz {paymentStats.lost.toLocaleString('pt-AO')} pedidos perdidos</small>
        </div>
      </div>

      <div className="dash-card page-filter-bar">
        <span className="filter-result-note">
          {filteredPayments.length} comprovativo(s) em {getPeriodLabel(periodFilter)}
        </span>
        <PeriodFilter value={periodFilter} onChange={setPeriodFilter} compact />
        <div className="filter-field">
          <label>Plano</label>
          <select className="qt-input" value={planFilter} onChange={event => setPlanFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
        </div>
        <div className="filter-field">
          <label>Estado</label>
          <select className="qt-input" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Rejeitados</option>
          </select>
        </div>
      </div>

      {filteredPayments.length === 0 ? (
        <div className="dash-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3.2rem', marginBottom: '1rem' }}>OK</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Nenhum pagamento encontrado</h2>
          <p className="text-secondary">Ajuste os filtros para consultar outros períodos ou estados.</p>
        </div>
      ) : (
        <div className="admin-payment-grid">
          {filteredPayments.map(payment => (
            <div key={payment.id} className="dash-card admin-payment-card">
              <div className="admin-payment-card-head">
                <div>
                  <h3>{payment.nome}</h3>
                  <p>{payment.email}</p>
                </div>
                <span className={`admin-payment-status ${statusClass(payment.status)}`}>
                  {statusLabel(payment.status)}
                </span>
              </div>

              <div className="admin-payment-details">
                <div>
                  <span>Plano</span>
                  <strong>{payment.plano === 'semestral' ? 'Semestral' : 'Anual'}</strong>
                </div>
                <div>
                  <span>Valor</span>
                  <strong>Kz {Number(payment.valor || 0).toLocaleString('pt-AO')}</strong>
                </div>
                <div>
                  <span>Submetido</span>
                  <strong>{payment.dataSubmissao || 'Sem data'}</strong>
                </div>
                {payment.status === 'approved' && (
                  <div>
                    <span>Aprovado</span>
                    <strong>{payment.dataAprovacao || 'Sem data'}</strong>
                  </div>
                )}
                {payment.status === 'rejected' && (
                  <div>
                    <span>Motivo</span>
                    <strong>{payment.motivoRejeicao || 'Sem motivo registado'}</strong>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedProof(payment.comprovativoUrl)}
                className="btn btn-glass btn-pill"
              >
                Ver comprovativo
              </button>

              {payment.status === 'pending' && (
                <div className="admin-payment-actions">
                  <button type="button" onClick={() => openRejectModal(payment)} className="btn danger-soft">
                    Rejeitar
                  </button>
                  <button type="button" onClick={() => handleApprove(payment)} className="btn success-soft">
                    Aprovar plano
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!selectedProof} onClose={() => setSelectedProof(null)} title="Visualizar Comprovativo" maxWidth="620px">
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <img src={selectedProof} alt="Comprovativo de pagamento" style={{ maxWidth: '100%', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' }} />
          <p className="text-secondary" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
            Verifique se os dados da transferência correspondem ao plano escolhido e se a conta de destino é a do Yeto Finanças.
          </p>
        </div>
      </Modal>

      <Modal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Rejeitar comprovativo" maxWidth="520px">
        {rejectTarget && (
          <div className="admin-reject-modal">
            <p>
              Explique ao utilizador porque este comprovativo não foi aprovado. O motivo será enviado por email.
            </p>
            <div className="admin-payment-reject-user">
              <strong>{rejectTarget.nome}</strong>
              <span>{rejectTarget.email}</span>
            </div>
            <textarea
              className="qt-input"
              value={rejectReason}
              onChange={event => setRejectReason(event.target.value)}
              rows="4"
              placeholder="Ex: O valor transferido não corresponde ao plano escolhido, ou o comprovativo está ilegível."
            />
            <div className="admin-payment-actions">
              <button type="button" className="btn btn-glass btn-pill" onClick={() => setRejectTarget(null)}>
                Cancelar
              </button>
              <button type="button" className="btn danger-soft btn-pill" onClick={confirmReject} disabled={isRejecting}>
                {isRejecting ? 'A rejeitar...' : 'Rejeitar e notificar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
