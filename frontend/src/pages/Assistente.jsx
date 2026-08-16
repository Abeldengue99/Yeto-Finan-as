import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, readJsonResponse } from '../utils/api';
import { useFinance } from '../contexts/FinanceContext';

const statusLabels = {
  open: 'Aberta',
  resolved: 'Resolvida'
};

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function Assistente({ isAdmin = false }) {
  const { usuario, mostrarAlerta, refreshAssistantSummary } = useFinance();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [subject, setSubject] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const hasConversations = conversations.length > 0;
  const openCount = useMemo(() => conversations.filter(c => c.status === 'open').length, [conversations]);

  const loadConversations = async () => {
    try {
      const response = await apiFetch('/api/assistant/conversations');
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar assistente.');

      setConversations(data.conversations || []);
      if (!selectedId && data.conversations?.length) {
        setSelectedId(data.conversations[0].id);
      }
    } catch (error) {
      console.error(error);
      mostrarAlerta('Assistente', error.message, 'erro', false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (conversationId) => {
    if (!conversationId) return;

    try {
      const response = await apiFetch(`/api/assistant/conversations/${conversationId}`);
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || 'Erro ao abrir conversa.');

      setSelectedConversation(data.conversation);
      setMessages(data.messages || []);
      setConversations(prev => prev.map(item => (
        item.id === conversationId ? { ...item, unread_count: 0 } : item
      )));
      refreshAssistantSummary?.({ notify: false });
    } catch (error) {
      console.error(error);
      mostrarAlerta('Assistente', error.message, 'erro', false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    loadConversation(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (selectedId) loadConversation(selectedId);
    }, 20000);

    return () => clearInterval(interval);
  }, [selectedId]);

  const handleCreateConversation = async (event) => {
    event.preventDefault();
    if (!firstMessage.trim()) return;

    setIsSending(true);
    try {
      const response = await apiFetch('/api/assistant/conversations', {
        method: 'POST',
        body: JSON.stringify({
          subject: subject || 'Pedido de apoio',
          message: firstMessage
        })
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || 'Erro ao iniciar conversa.');

      setSubject('');
      setFirstMessage('');
      await loadConversations();
      setSelectedId(data.conversation.id);
      mostrarAlerta('Assistente', 'Conversa enviada para a equipa administrativa.', 'sucesso', false);
    } catch (error) {
      mostrarAlerta('Assistente', error.message, 'erro', false);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!draft.trim() || !selectedId) return;

    setIsSending(true);
    try {
      const response = await apiFetch(`/api/assistant/conversations/${selectedId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: draft })
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || 'Erro ao enviar mensagem.');

      setDraft('');
      setMessages(prev => [...prev, data.message]);
      await loadConversations();
      await loadConversation(selectedId);
    } catch (error) {
      mostrarAlerta('Assistente', error.message, 'erro', false);
    } finally {
      setIsSending(false);
    }
  };

  const updateStatus = async (status) => {
    if (!selectedId) return;

    try {
      const response = await apiFetch(`/api/assistant/conversations/${selectedId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar conversa.');

      setSelectedConversation(data.conversation);
      await loadConversations();
    } catch (error) {
      mostrarAlerta('Assistente', error.message, 'erro', false);
    }
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.3rem' }}>Assistente Yeto</h1>
          <p className="text-secondary" style={{ margin: 0 }}>
            {isAdmin
              ? 'Central simples para acompanhar e responder pedidos dos utilizadores.'
              : 'Fale com a equipa Yeto dentro da plataforma, sem sair do seu painel.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isAdmin && (
            <button
              type="button"
              className="btn btn-primary btn-pill"
              onClick={() => {
                setSelectedId('');
                setSelectedConversation(null);
                setMessages([]);
              }}
              style={{ padding: '0.65rem 0.95rem' }}
            >
              Novo Pedido
            </button>
          )}
          <div style={{
            padding: '0.75rem 1rem',
            border: '1px solid var(--glass-border)',
            borderRadius: '12px',
            background: 'white',
            minWidth: '150px'
          }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Conversas abertas</p>
            <strong style={{ color: 'var(--accent-color)', fontSize: '1.35rem' }}>{openCount}</strong>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: '1rem',
        alignItems: 'stretch'
      }}>
        <aside style={{
          background: 'white',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          minHeight: '540px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>
              {isAdmin ? 'Pedidos recebidos' : 'As minhas conversas'}
            </h3>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {isLoading ? (
              <p className="text-secondary" style={{ padding: '1rem' }}>A carregar...</p>
            ) : !hasConversations ? (
              <p className="text-secondary" style={{ padding: '1rem', lineHeight: 1.5 }}>
                {isAdmin ? 'Ainda não existem pedidos.' : 'Ainda não iniciou nenhuma conversa.'}
              </p>
            ) : (
              conversations.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1px solid #f0f1f6',
                    background: selectedId === item.id ? 'rgba(55, 51, 146, 0.08)' : 'white',
                    padding: '0.9rem 1rem',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{item.subject}</strong>
                    {item.unread_count > 0 && (
                      <span style={{ background: 'var(--danger-color)', color: 'white', borderRadius: '999px', padding: '0.15rem 0.45rem', fontSize: '0.7rem', fontWeight: 800 }}>
                        {item.unread_count}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      {item.user_name} - {item.user_email}
                    </p>
                  )}
                  <p style={{ margin: '0.35rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {item.last_message || 'Sem mensagens'}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                    <span>{statusLabels[item.status] || item.status}</span>
                    <span>{formatDate(item.last_message_at)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section style={{
          background: 'white',
          border: '1px solid var(--glass-border)',
          borderRadius: '16px',
          minHeight: '540px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {selectedConversation ? (
            <>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{selectedConversation.subject}</h3>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {isAdmin ? `${selectedConversation.user_name} - ${selectedConversation.user_email}` : `Conta: ${usuario?.email || ''}`}
                  </p>
                </div>
                <button
                  type="button"
                  className={selectedConversation.status === 'resolved' ? 'btn btn-glass btn-pill' : 'btn btn-primary btn-pill'}
                  onClick={() => updateStatus(selectedConversation.status === 'resolved' ? 'open' : 'resolved')}
                  style={{ padding: '0.55rem 0.85rem', whiteSpace: 'nowrap' }}
                >
                  {selectedConversation.status === 'resolved' ? 'Reabrir' : 'Resolver'}
                </button>
              </div>

              <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', background: '#f8f9fc' }}>
                {messages.map(message => {
                  const mine = isAdmin ? message.sender_role === 'admin' : message.sender_role === 'user';
                  return (
                    <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{
                        maxWidth: '75%',
                        background: mine ? 'var(--accent-color)' : 'white',
                        color: mine ? 'white' : 'var(--text-primary)',
                        padding: '0.75rem 0.9rem',
                        borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        border: mine ? 'none' : '1px solid var(--glass-border)',
                        boxShadow: '0 6px 16px rgba(55, 51, 146, 0.06)'
                      }}>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{message.message}</p>
                        <p style={{ margin: '0.4rem 0 0 0', opacity: 0.72, fontSize: '0.7rem', textAlign: 'right' }}>
                          {message.sender_role === 'admin' ? 'Admin' : 'Utilizador'} - {formatDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSendMessage} style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '0.75rem' }}>
                <textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder={selectedConversation.status === 'resolved' ? 'Reabra a conversa para continuar...' : 'Escreva a sua mensagem...'}
                  disabled={selectedConversation.status === 'resolved'}
                  maxLength={2000}
                  className="qt-input"
                  style={{ minHeight: '52px', resize: 'vertical', flex: 1, padding: '0.75rem' }}
                />
                <button className="btn btn-primary btn-pill" disabled={isSending || !draft.trim() || selectedConversation.status === 'resolved'} style={{ padding: '0.75rem 1.15rem', alignSelf: 'flex-end' }}>
                  Enviar
                </button>
              </form>
            </>
          ) : (
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '540px' }}>
              {isAdmin ? (
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ color: 'var(--text-primary)' }}>Nenhuma conversa selecionada</h3>
                  <p className="text-secondary">Escolha um pedido na lista para responder.</p>
                </div>
              ) : (
                <form onSubmit={handleCreateConversation} style={{ maxWidth: '620px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.4rem' }}>Como podemos ajudar?</h3>
                    <p className="text-secondary" style={{ margin: 0 }}>Envie uma dúvida, problema ou pedido. A área admin responde aqui.</p>
                  </div>
                  <input
                    className="qt-input"
                    value={subject}
                    onChange={event => setSubject(event.target.value)}
                    placeholder="Assunto"
                    maxLength={140}
                    style={{ padding: '0.75rem' }}
                  />
                  <textarea
                    className="qt-input"
                    value={firstMessage}
                    onChange={event => setFirstMessage(event.target.value)}
                    placeholder="Descreva o que precisa..."
                    maxLength={2000}
                    style={{ minHeight: '140px', resize: 'vertical', padding: '0.85rem' }}
                  />
                  <button className="btn btn-primary btn-pill" disabled={isSending || !firstMessage.trim()} style={{ padding: '0.85rem' }}>
                    Enviar Pedido
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
