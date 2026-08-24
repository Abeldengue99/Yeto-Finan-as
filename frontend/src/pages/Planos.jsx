import React, { useState, useEffect } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAdmin } from '../contexts/AdminContext';
import { apiFetch } from '../utils/api';

const CUSTOM_PLAN_FEATURES = [
  { key: 'orcamento', label: 'Orçamento Mensal', price: 900, description: 'Limites por categoria e leitura rápida do mês.' },
  { key: 'calendario', label: 'Calendário Financeiro', price: 1000, description: 'Salários, contas fixas, dívidas, kixikila e metas.' },
  { key: 'lista_compras', label: 'Lista de Compras', price: 900, description: 'Planeamento de mercado ligado ao orçamento.' },
  { key: 'previsao', label: 'Previsão do Fim do Mês', price: 1500, description: 'Saldo previsto e modo emergência.' },
  { key: 'projetos', label: 'Projetos e Metas', price: 800, description: 'Poupança para objetivos financeiros.' },
  { key: 'divisas', label: 'Câmbio e Divisas', price: 800, description: 'Controlo de moeda estrangeira.' },
  { key: 'kixikila', label: 'Kixikila', price: 900, description: 'Gestão de contribuições e mãos.' },
  { key: 'gamificacao', label: 'Desafios & Metas', price: 700, description: 'YetoPoints, metas e recompensas.' },
  { key: 'yeto_ai', label: 'Yeto AI', price: 1200, description: 'Conselheiro financeiro e análise profunda.' },
  { key: 'relatorios_pdf', label: 'Relatórios PDF', price: 1000, description: 'Documentos profissionais para análise.' }
];

const CUSTOM_PLAN_DISCOUNTS = { 1: 0, 6: 0.1, 12: 0.2 };

function calculateCustomPlanAmount(featureKeys, durationMonths) {
  const monthlyTotal = CUSTOM_PLAN_FEATURES
    .filter(feature => featureKeys.includes(feature.key))
    .reduce((sum, feature) => sum + feature.price, 0);
  const discount = CUSTOM_PLAN_DISCOUNTS[durationMonths] || 0;
  return Math.round(monthlyTotal * durationMonths * (1 - discount));
}

export default function Planos({ user }) {
  const [showModal, setShowModal] = useState(false);
  const [proofImage, setProofImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('anual');
  const [customFeatures, setCustomFeatures] = useState([]);
  const [customDurationMonths, setCustomDurationMonths] = useState(1);
  const [customPlanError, setCustomPlanError] = useState('');
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialForm, setTestimonialForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    message: ''
  });
  const [testimonialStatus, setTestimonialStatus] = useState('');
  const [isSubmittingTestimonial, setIsSubmittingTestimonial] = useState(false);
  const financeContext = useFinance();
  const adicionarNotificacao = financeContext?.adicionarNotificacao || (() => {});
  const adminContext = useAdmin();

  const precoSemestral = adminContext?.planPrices?.semestral || 4999;
  const precoAnual = adminContext?.planPrices?.anual || 7999;
  const mensalEquivSemestral = Math.round(precoSemestral / 6);
  const mensalEquivAnual = Math.round(precoAnual / 12);
  const customPlanAmount = calculateCustomPlanAmount(customFeatures, customDurationMonths);
  const customPlanMonthlyBase = CUSTOM_PLAN_FEATURES
    .filter(feature => customFeatures.includes(feature.key))
    .reduce((sum, feature) => sum + feature.price, 0);
  const faqs = [
    {
      pergunta: 'O que é o Yeto Finanças?',
      resposta: 'É uma plataforma de gestão financeira pessoal criada para ajudar a organizar receitas, despesas, dívidas, metas, kixikila, compras e compromissos mensais num só lugar.'
    },
    {
      pergunta: 'Ao criar conta tenho acesso grátis?',
      resposta: 'Sim. Cada novo utilizador recebe 1 mês grátis com acesso às funcionalidades principais para testar a plataforma com calma antes de decidir continuar num plano pago.'
    },
    {
      pergunta: 'O que acontece quando termina o mês grátis?',
      resposta: 'A conta continua ativa, mas algumas funcionalidades avançadas ficam bloqueadas. O utilizador pode continuar com recursos básicos ou fazer upgrade para recuperar o acesso completo.'
    },
    {
      pergunta: 'O Yeto foi pensado para Angola?',
      resposta: 'Sim. A plataforma considera hábitos financeiros comuns no contexto angolano, como salários mensais, compras de casa, dívidas informais, apoio familiar, prestações, kixikila e pagamentos em Kz.'
    },
    {
      pergunta: 'Posso controlar bancos, carteiras e dinheiro em mãos?',
      resposta: 'Sim. Pode registar contas bancárias, carteiras, saldo pessoal, dinheiro a receber, dívidas a pagar e acompanhar como cada movimento afeta a sua vida financeira.'
    },
    {
      pergunta: 'Como funciona o Orçamento Mensal?',
      resposta: 'O utilizador define limites por categoria e acompanha quanto já gastou no mês. Isso ajuda a perceber se ainda está dentro do plano ou se precisa ajustar gastos.'
    },
    {
      pergunta: 'Para que serve o Calendário Financeiro?',
      resposta: 'Serve para visualizar salários, contas fixas, dívidas, prestações, kixikila e metas por mês, reduzindo esquecimentos e ajudando a planear melhor cada compromisso.'
    },
    {
      pergunta: 'O que faz a Previsão do Fim do Mês?',
      resposta: 'O sistema analisa entradas, saídas e compromissos para estimar se o mês termina com saldo positivo ou se existe risco de faltar dinheiro antes do fim do mês.'
    },
    {
      pergunta: 'O que é o Modo Emergência?',
      resposta: 'É uma funcionalidade que ajuda em momentos apertados, sugerindo prioridades, cortes temporários e categorias que podem ser congeladas para proteger o essencial.'
    },
    {
      pergunta: 'Como funciona a Lista de Compras com Orçamento?',
      resposta: 'A família cria uma lista de mercado com preços estimados e o Yeto compara o total com o orçamento disponível antes da compra acontecer.'
    },
    {
      pergunta: 'Os meus dados ficam protegidos?',
      resposta: 'A plataforma usa autenticação, controlo de sessão, permissões por utilizador, proteção contra acessos indevidos, validação de dados e registo de ações críticas para reforçar a segurança.'
    },
    {
      pergunta: 'Como é feita a ativação do Premium?',
      resposta: 'Depois do pagamento, o utilizador envia o comprovativo pela plataforma. A equipa administrativa valida o comprovativo e ativa o plano correspondente.'
    },
    {
      pergunta: 'Posso usar no telemóvel?',
      resposta: 'Sim. A interface foi preparada para funcionar em computador e telemóvel, incluindo instalação como aplicativo quando o navegador permitir.'
    },
    {
      pergunta: 'A plataforma já está disponível para todos?',
      resposta: 'Neste momento o Yeto Finanças está em fase de testes, com foco em estabilidade, segurança e melhoria da experiência antes da abertura ao público geral.'
    }
  ];

  useEffect(() => {
    setTestimonialForm(prev => ({
      ...prev,
      name: prev.name || user?.name || '',
      email: prev.email || user?.email || ''
    }));
  }, [user]);

  useEffect(() => {
    let ignore = false;

    const loadTestimonials = async () => {
      try {
        const response = await apiFetch('/api/testimonials');
        const data = await response.json();
        if (!ignore && response.ok) {
          setTestimonials(Array.isArray(data.testimonials) ? data.testimonials : []);
        }
      } catch (error) {
        if (!ignore) setTestimonials([]);
      }
    };

    loadTestimonials();
    return () => {
      ignore = true;
    };
  }, []);

  // Polling: verifica o estado dos comprovativos pendentes a cada 30s
  useEffect(() => {
    if (!user) return;

    const checkPaymentStatus = async () => {
      try {
        const res = await apiFetch(`/api/finances/payment-status/${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.notifications && data.notifications.length > 0) {
          data.notifications.forEach(notif => {
            if (notif.status === 'approved') {
              adicionarNotificacao(
                'Pagamento Aprovado',
                notif.plan_requested === 'personalizado'
                  ? 'O seu plano personalizado foi aprovado. As funcionalidades escolhidas já estão ativas.'
                  : 'O seu pagamento foi aprovado! Já tem acesso às funcionalidades do plano escolhido. Obrigado pela confiança!'
              );
            } else if (notif.status === 'rejected') {
              if (notif.rejection_reason) {
                adicionarNotificacao('Pagamento Rejeitado', notif.rejection_reason);
                return;
              }
              adicionarNotificacao('Pagamento Rejeitado', 'O seu comprovativo foi rejeitado. Por favor, verifique os dados e tente novamente ou contacte o suporte.');
            }
          });
        }
      } catch (err) {
        // Silenciosamente ignora erros de polling
      }
    };

    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProofImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [showAuthModal, setShowAuthModal] = useState(false);

  const toggleCustomFeature = (featureKey) => {
    setCustomPlanError('');
    setCustomFeatures(prev => (
      prev.includes(featureKey)
        ? prev.filter(key => key !== featureKey)
        : [...prev, featureKey]
    ));
  };

  const handleUpgradeClick = (plan = 'anual') => {
    setSelectedPlan(plan);
    setMessage('');
    setCustomPlanError('');

    if (plan === 'personalizado' && customFeatures.length === 0) {
      setCustomPlanError('Escolha pelo menos uma funcionalidade para montar o seu plano personalizado.');
      return;
    }

    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!proofImage) {
      setMessage('Por favor, anexe o comprovativo.');
      return;
    }
    setIsSubmitting(true);
    setMessage('');
    try {
      const res = await apiFetch('/api/finances/payment-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          proofImage,
          planRequested: selectedPlan,
          selectedFeatures: selectedPlan === 'personalizado' ? customFeatures : [],
          customDurationMonths: selectedPlan === 'personalizado' ? customDurationMonths : 0
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Comprovativo enviado! Aguarde aprovação.');
        adicionarNotificacao(
          'Comprovativo Enviado',
          selectedPlan === 'personalizado'
            ? 'O comprovativo do seu plano personalizado foi enviado. Aguarde a validação do administrador.'
            : 'O seu comprovativo de pagamento foi enviado com sucesso. Aguarde a aprovação do administrador.'
        );
        setTimeout(() => { setShowModal(false); setMessage(''); setProofImage(null); }, 3000);
      } else {
        setMessage('❌ ' + (data.error || 'Erro ao enviar.'));
      }
    } catch (err) {
      setMessage('❌ Erro de conexão.');
    }
    setIsSubmitting(false);
  };

  const handleTestimonialSubmit = async (event) => {
    event.preventDefault();
    setTestimonialStatus('');

    if (testimonialForm.name.trim().length < 2) {
      setTestimonialStatus('Informe o seu nome para enviar o depoimento.');
      return;
    }

    if (testimonialForm.message.trim().length < 20) {
      setTestimonialStatus('Escreva pelo menos 20 caracteres para o depoimento ficar claro.');
      return;
    }

    setIsSubmittingTestimonial(true);
    try {
      const response = await apiFetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testimonialForm)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível enviar o depoimento.');
      }

      setTestimonialStatus(data.message || 'Depoimento enviado com sucesso. Obrigado por partilhar a sua experiência.');
      setTestimonialForm({ name: '', email: '', message: '' });
    } catch (error) {
      setTestimonialStatus(error.message || 'Erro ao enviar depoimento.');
    } finally {
      setIsSubmittingTestimonial(false);
    }
  };

  const selectedPlanLabel = selectedPlan === 'personalizado'
    ? `Personalizado (${customFeatures.length} funcionalidade(s), ${customDurationMonths} mês(es))`
    : selectedPlan === 'semestral'
      ? 'Semestral'
      : 'Anual';
  const selectedPlanAmount = selectedPlan === 'personalizado'
    ? customPlanAmount
    : selectedPlan === 'semestral'
      ? precoSemestral
      : precoAnual;

  return (
    <div style={{ paddingBottom: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '1rem' }}>
        <h2 style={{ fontSize: '2.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Escolha o Plano Ideal para a sua Família 💎
        </h2>
        <p className="text-secondary" style={{ fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto' }}>
          Todos os utilizadores recebem <strong>1 mês totalmente grátis</strong> de acesso ilimitado a todas as funcionalidades ao criar conta. Após esse período, pode continuar no plano grátis (restrito) ou avançar para o Premium.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'stretch' }}>
        
        {/* Plano Gratuito */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--glass-border)', 
          borderRadius: '24px', padding: '2.5rem 2rem', width: '300px', display: 'flex', flexDirection: 'column'
        }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Essencial</h3>
          <p className="text-secondary" style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem' }}>Perfeito para começar a organizar a casa.</p>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '2rem' }}>
            Grátis
          </div>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem' }}>
            <li style={{ display: 'flex', gap: '10px', color: 'var(--text-secondary)' }}><span>✅</span> Registo de Despesas/Receitas</li>
            <li style={{ display: 'flex', gap: '10px', color: 'var(--text-secondary)' }}><span>✅</span> Controlo de Dívidas Básico</li>
            <li style={{ display: 'flex', gap: '10px', color: 'var(--text-secondary)' }}><span>✅</span> 1 Mês de Premium Grátis</li>
            <li style={{ display: 'flex', gap: '10px', color: '#555' }}><span>❌</span> Conselheiro IA Avançado</li>
            <li style={{ display: 'flex', gap: '10px', color: '#555' }}><span>❌</span> Relatórios e Kixikila</li>
          </ul>
          
          <button className="btn btn-glass btn-pill" style={{ width: '100%', padding: '1rem', fontWeight: 'bold' }} disabled>
            O Seu Plano Atual
          </button>
        </div>

        {/* Plano Semestral */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 179, 0, 0.3)', 
          borderRadius: '24px', padding: '2.5rem 2rem', width: '300px', display: 'flex', flexDirection: 'column', position: 'relative'
        }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Semestral</h3>
          <p className="text-secondary" style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem' }}>Acesso Premium durante 6 meses completos.</p>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {precoSemestral.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>Kz</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--accent-color)', marginBottom: '2rem', fontWeight: '600' }}>
            Equivale a ~{mensalEquivSemestral} Kz / mês
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem' }}>
            <li style={{ display: 'flex', gap: '10px', color: 'var(--text-primary)' }}><span>✅</span> <strong>Tudo do Essencial +</strong></li>
            <li style={{ display: 'flex', gap: '10px', color: 'var(--text-primary)' }}><span>🤖</span> <strong style={{ color: '#ffb300' }}>Conselheiro IA Inteligente</strong></li>
            <li style={{ display: 'flex', gap: '10px', color: 'var(--text-primary)' }}><span>🌍</span> Gestão de Divisas e Kixikila</li>
            <li style={{ display: 'flex', gap: '10px', color: 'var(--text-primary)' }}><span>🛒</span> Lista de Compras com Orçamento</li>
            <li style={{ display: 'flex', gap: '10px', color: 'var(--text-primary)' }}><span>📊</span> Relatórios PDF Profissionais</li>
          </ul>
          
          <button className="btn btn-primary btn-pill" style={{ width: '100%', padding: '1rem', fontWeight: 'bold', background: 'transparent', border: '1px solid #ffb300', color: '#ffb300' }} onClick={() => handleUpgradeClick('semestral')}>
            Escolher Semestral
          </button>
        </div>

        {/* Plano Anual (O Foco) */}
        <div style={{ 
          background: 'var(--accent-gradient)', borderRadius: '24px', padding: '2px', width: '320px',
          boxShadow: '0 20px 40px rgba(55, 51, 146, 0.3)', transform: 'scale(1.05)', position: 'relative', zIndex: 10
        }}>
          <div style={{
            position: 'absolute', top: '-15px', left: '50%', transform: 'translateX(-50%)',
            background: '#ffb300', color: '#000', padding: '5px 15px', borderRadius: '20px',
            fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 5px 10px rgba(0,0,0,0.2)'
          }}>
            MAIS POPULAR ⭐
          </div>
          <div style={{ background: '#1c1c1e', borderRadius: '22px', padding: '2.5rem 2rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '1.5rem', color: 'white', margin: '0 0 0.5rem 0' }}>Anual (Premium)</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#aaa', fontSize: '0.9rem' }}>A melhor escolha para paz de espírito financeira.</p>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>
              {precoAnual.toLocaleString()} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: '#aaa' }}>Kz</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#ffb300', marginBottom: '2rem', fontWeight: '600' }}>
              Equivale a ~{mensalEquivAnual} Kz / mês (Poupas 37%!)
            </p>
            
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.9rem' }}>
              <li style={{ display: 'flex', gap: '10px', color: '#ddd' }}><span>✅</span> <strong style={{ color: 'white' }}>Tudo do Essencial +</strong></li>
              <li style={{ display: 'flex', gap: '10px', color: '#ddd' }}><span>🤖</span> <strong style={{ color: '#ffb300' }}>Conselheiro IA Inteligente</strong></li>
              <li style={{ display: 'flex', gap: '10px', color: '#ddd' }}><span>🌍</span> Gestão de Divisas e Kixikila</li>
              <li style={{ display: 'flex', gap: '10px', color: '#ddd' }}><span>🛒</span> Lista de Compras com Orçamento</li>
              <li style={{ display: 'flex', gap: '10px', color: '#ddd' }}><span>🎮</span> Gamificação do Casal</li>
              <li style={{ display: 'flex', gap: '10px', color: '#ddd' }}><span>🧭</span> Previsão do Fim do Mês + Modo Emergência</li>
              <li style={{ display: 'flex', gap: '10px', color: '#ddd' }}><span>📊</span> Relatórios PDF Profissionais</li>
            </ul>
            
            <button className="btn btn-primary btn-pill" style={{ width: '100%', padding: '1rem', fontWeight: 'bold', background: '#ffb300', color: '#000', border: 'none' }} onClick={() => handleUpgradeClick('anual')}>
              Fazer Upgrade Agora
            </button>
            <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: '#777' }}>
              Pagamento seguro via Referência Multicaixa ou Unitel Money.
            </p>
          </div>
        </div>

      </div>

      <section className="dash-card" style={{ margin: '3rem auto 2rem', maxWidth: '1100px', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          <div style={{ maxWidth: '660px' }}>
            <span style={{ color: '#373392', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.82rem' }}>
              Plano personalizado
            </span>
            <h3 style={{ margin: '0.35rem 0', fontSize: '2rem', color: 'var(--text-primary)' }}>
              Pague só pelas funcionalidades que realmente precisa
            </h3>
            <p className="text-secondary" style={{ margin: 0, lineHeight: 1.6 }}>
              Escolha os módulos que fazem sentido para a sua família. As funcionalidades compradas continuam a ler os dados básicos já registados, como bancos, receitas, despesas, dívidas e pagamentos fixos.
            </p>
          </div>
          <div style={{ minWidth: '220px', textAlign: 'right' }}>
            <span className="text-secondary" style={{ display: 'block', fontWeight: 700 }}>Total estimado</span>
            <strong style={{ display: 'block', fontSize: '2rem', color: '#373392' }}>
              Kz {customPlanAmount.toLocaleString('pt-AO')}
            </strong>
            <small className="text-secondary">
              Base: Kz {customPlanMonthlyBase.toLocaleString('pt-AO')} / mês
            </small>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.9rem', marginBottom: '1.4rem' }}>
          {CUSTOM_PLAN_FEATURES.map(feature => {
            const checked = customFeatures.includes(feature.key);
            return (
              <label
                key={feature.key}
                style={{
                  display: 'flex',
                  gap: '0.8rem',
                  padding: '1rem',
                  borderRadius: '16px',
                  border: checked ? '1px solid #373392' : '1px solid var(--glass-border)',
                  background: checked ? 'rgba(55, 51, 146, 0.08)' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCustomFeature(feature.key)}
                  style={{ width: '18px', height: '18px', marginTop: '0.2rem' }}
                />
                <span>
                  <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{feature.label}</strong>
                  <small className="text-secondary" style={{ display: 'block', lineHeight: 1.45 }}>{feature.description}</small>
                  <small style={{ display: 'block', marginTop: '0.35rem', color: '#10b981', fontWeight: 800 }}>
                    Kz {feature.price.toLocaleString('pt-AO')} / mês
                  </small>
                </span>
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ minWidth: '220px', flex: '1 1 220px' }}>
            <span className="text-secondary" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 700 }}>Duração</span>
            <select
              className="qt-input"
              value={customDurationMonths}
              onChange={event => setCustomDurationMonths(Number(event.target.value))}
            >
              <option value={1}>1 mês</option>
              <option value={6}>6 meses - 10% de desconto</option>
              <option value={12}>12 meses - 20% de desconto</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-pill"
            style={{ minWidth: '240px', padding: '1rem 1.3rem', fontWeight: 800 }}
            onClick={() => handleUpgradeClick('personalizado')}
          >
            Solicitar plano personalizado
          </button>
        </div>
        {customPlanError && (
          <p style={{ margin: '1rem 0 0', color: '#ef4444', fontWeight: 700 }}>{customPlanError}</p>
        )}
      </section>

      <section className="planos-testimonial-section">
        <div className="planos-testimonial-header">
          <span>Experiências reais</span>
          <h3>Deixe o seu depoimento sobre o Yeto</h3>
          <p>
            Conte como a plataforma está a ajudar na organização financeira da sua família.
          </p>
        </div>

        <div className="planos-testimonial-layout">
          <div className="planos-testimonial-carousel" aria-label="Depoimentos dos utilizadores">
            {testimonials.length > 0 ? testimonials.map(item => (
              <article className="planos-testimonial-card" key={item.id}>
                <p>"{item.message}"</p>
                <strong>{item.name}</strong>
              </article>
            )) : (
              <article className="planos-testimonial-card planos-testimonial-empty">
                <p>Os primeiros depoimentos vão aparecer aqui.</p>
                <strong>Equipa Yeto</strong>
              </article>
            )}
          </div>

          <form className="planos-testimonial-form" onSubmit={handleTestimonialSubmit}>
            <div className="testimonial-form-grid">
              <label>
                Nome
                <input
                  type="text"
                  value={testimonialForm.name}
                  onChange={(event) => setTestimonialForm(prev => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Abel Dengue"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={testimonialForm.email}
                  onChange={(event) => setTestimonialForm(prev => ({ ...prev, email: event.target.value }))}
                  placeholder="Opcional"
                />
              </label>
            </div>
            <label>
              Depoimento
              <textarea
                value={testimonialForm.message}
                onChange={(event) => setTestimonialForm(prev => ({ ...prev, message: event.target.value }))}
                placeholder="Escreva aqui a sua experiência com o Yeto Finanças..."
                rows="5"
                required
              />
            </label>
            {testimonialStatus && <p className="testimonial-status">{testimonialStatus}</p>}
            <button type="submit" className="btn btn-primary btn-pill" disabled={isSubmittingTestimonial}>
              {isSubmittingTestimonial ? 'A enviar...' : 'Enviar depoimento'}
            </button>
          </form>
        </div>
      </section>

      <section className="planos-faq-section">
        <div className="planos-faq-header">
          <span>Perguntas Frequentes</span>
          <h3>Tire dúvidas antes de começar</h3>
          <p>
            Respostas rápidas sobre funcionamento, segurança, período grátis, pagamentos e funcionalidades principais do Yeto Finanças.
          </p>
        </div>

        <div className="planos-faq-grid">
          {faqs.map((faq, index) => (
            <details className="planos-faq-item" key={faq.pergunta} open={index < 2}>
              <summary>{faq.pergunta}</summary>
              <p>{faq.resposta}</p>
            </details>
          ))}
        </div>
      </section>

      {showModal && (
        <div className="sobre-modal-overlay">
          <div className="sobre-modal-container" style={{ maxWidth: '520px', padding: '2rem' }}>
            <button className="sobre-modal-close" onClick={() => setShowModal(false)}>×</button>
            <h2 style={{ textAlign: 'center', marginBottom: '1rem', color: '#373392' }}>
              {selectedPlan === 'personalizado' ? 'Solicitar Plano Personalizado' : 'Renovar para Premium'}
            </h2>
            <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#555' }}>
              Plano escolhido: <strong>{selectedPlanLabel}</strong> no valor de <strong>Kz {selectedPlanAmount.toLocaleString('pt-AO')}</strong>. Faça a transferência ou depósito usando um dos métodos abaixo. De seguida, anexe o comprovativo.
            </p>
            {selectedPlan === 'personalizado' && (
              <div style={{ background: '#f4f3ff', border: '1px solid #dedcff', borderRadius: '14px', padding: '1rem', marginBottom: '1rem' }}>
                <strong style={{ color: '#373392' }}>Funcionalidades selecionadas</strong>
                <p style={{ margin: '0.5rem 0 0', color: '#555', lineHeight: 1.5 }}>
                  {CUSTOM_PLAN_FEATURES
                    .filter(feature => customFeatures.includes(feature.key))
                    .map(feature => feature.label)
                    .join(', ')}
                </p>
              </div>
            )}
            
            <div style={{ background: '#f8f9fc', padding: '1.5rem', borderRadius: '15px', marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 10px 0' }}><strong>🏦 IBAN do BFA:</strong><br/>AO06000600000201476030139<br/><small>(ALEXANDRINA DA ROSA PEDRO DE OLIVEIRA)</small></p>
              <p style={{ margin: '0 0 10px 0' }}><strong>📱 PayPay:</strong> 925109868</p>
              <p style={{ margin: '0 0 10px 0' }}><strong>📱 Unitel Money:</strong> 925109868</p>
              <p style={{ margin: '0' }}><strong>📱 Express:</strong> 925109868</p>
            </div>

            {/* Observação sobre tempos de reflexão bancária */}
            <div style={{ 
              background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '12px', 
              padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#5d4037' 
            }}>
              <strong>⚠️ Observação Importante:</strong>
              <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, lineHeight: '1.6' }}>
                <li><strong>Mesmo banco (BFA → BFA)</strong> ou via <strong>PayPay / Unitel Money / Express</strong>: o valor reflete na hora e o acesso Premium é ativado imediatamente após aprovação.</li>
                <li><strong>Transferências interbancárias</strong> (outros bancos → BFA): podem demorar <strong>24 a 72 horas</strong> a refletir. O pagamento só será aprovado após confirmação do valor na conta.</li>
              </ul>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Anexar Comprovativo (Imagem):</label>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ width: '100%' }} />
            </div>

            {message && <p style={{ textAlign: 'center', fontWeight: 'bold', color: message.includes('✅') ? 'green' : 'red' }}>{message}</p>}

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontWeight: 'bold' }} 
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'A ENVIAR...' : 'ENVIAR COMPROVATIVO'}
            </button>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="sobre-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="sobre-modal-container" style={{ maxWidth: '400px', padding: '2.5rem', textAlign: 'center', background: '#fff', borderRadius: '24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Sessão Necessária</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Para fazer upgrade e submeter o comprovativo de pagamento, precisa de iniciar sessão na sua conta primeiro.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn" 
                style={{ padding: '0.8rem 1.5rem', background: '#e0e0e0', color: '#333', borderRadius: '12px', fontWeight: 'bold' }}
                onClick={() => setShowAuthModal(false)}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
