import React, { useMemo, useState, useEffect } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAdmin } from '../contexts/AdminContext';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { generateProfessionalReport } from '../utils/pdfGenerator';
import PeriodFilter from '../components/PeriodFilter';
import { createDefaultPeriodFilter, filterByPeriod, getPeriodLabel } from '../utils/periodFilters';

export default function DashboardHome({ isAdmin, setActiveTab }) {
  const { 
    usuario,
    movimentos, 
    saldoTotal, 
    dividas,
    despesas,
    receitas,
    kixikilas,
    projetos,
    pagamentosFixos,
    mostrarAlerta,
    assistantUnreadCount,
    assistantLatestPreview
  } = useFinance();
  const adminData = useAdmin(); // Access admin context data if needed
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const [showAIModal, setShowAIModal] = useState(false);
  const [periodFilter, setPeriodFilter] = useState(() => createDefaultPeriodFilter('month'));

  const movimentosPeriodo = useMemo(
    () => filterByPeriod(movimentos, periodFilter, item => item.data),
    [movimentos, periodFilter]
  );
  const despesasPeriodo = useMemo(
    () => filterByPeriod(despesas, periodFilter, item => item.data),
    [despesas, periodFilter]
  );
  const receitasPeriodo = useMemo(
    () => filterByPeriod(receitas, periodFilter, item => item.data),
    [receitas, periodFilter]
  );
  const dividasPeriodo = useMemo(
    () => filterByPeriod(dividas, periodFilter, item => item.dataVencimento),
    [dividas, periodFilter]
  );
  const projetosPeriodo = useMemo(
    () => filterByPeriod(projetos, periodFilter, item => item.prazo),
    [projetos, periodFilter]
  );
  const periodLabel = getPeriodLabel(periodFilter);
  const totalEntradasPeriodo = receitasPeriodo.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const totalSaidasPeriodo = despesasPeriodo.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  
  // 1. Pegar os 4 movimentos mais recentes
  const movimentosRecentes = movimentosPeriodo.slice(0, 4);
  
  // Helper para ícone
  const getIcon = (categoria) => {
    switch(categoria?.toLowerCase()) {
      case 'alimentacao': return '🛒';
      case 'educacao': return '📚';
      case 'transporte': return '🚗';
      case 'saude': return '💊';
      case 'salario': return '💰';
      default: return '💸';
    }
  };

  // 2. Preparar dados para o Gráfico de Despesas (Pie Chart)
  const despesasPorCategoria = despesasPeriodo.reduce((acc, current) => {
    const cat = current.categoria || 'Outros';
    if (!acc[cat]) acc[cat] = 0;
    acc[cat] += current.valor;
    return acc;
  }, {});

  const dataDespesas = Object.keys(despesasPorCategoria).map(key => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: despesasPorCategoria[key]
  }));
  
  const COLORS = ['#373392', '#f45b5b', '#10b981', '#fca834', '#8a8ca3'];

  // 3. Preparar dados para o Gráfico de Dívidas (Bar Chart)
  const totalAReceber = dividasPeriodo.filter(d => !d.paga && d.tipo === 'a_receber').reduce((acc, d) => acc + d.valor, 0);
  const totalAPagar = dividasPeriodo.filter(d => !d.paga && d.tipo === 'a_pagar').reduce((acc, d) => acc + d.valor, 0);
  
  // 4. Receitas e Despesas do Mês Atual (Usadas na IA e no PDF)
  const mesAnoStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const despesasMes = despesas.filter(d => d.data && d.data.startsWith(mesAnoStr)).reduce((a, b) => a + b.valor, 0);
  const receitasMes = receitas.filter(r => r.data && r.data.startsWith(mesAnoStr)).reduce((a, b) => a + b.valor, 0);

  const hasPdfAccess = usuario?.isPremium || isAdmin || usuario?.featureAccess?.includes('relatorios_pdf');
  const hasAiAccess = usuario?.isPremium || isAdmin || usuario?.featureAccess?.includes('yeto_ai');

  const handleGeneratePDF = () => {
    if (!hasPdfAccess) {
      mostrarAlerta(
        'Funcionalidade Premium',
        'Este recurso é exclusivo para assinantes Premium ou planos com Relatórios PDF. Aceda ao menu Planos para obter relatórios profissionais.',
        'aviso',
        false
      );
      return;
    }
    try {
      generateProfessionalReport({
        usuario: usuario || { nome: 'Admin', email: 'admin@yeto.ao' },
        saldoTotal,
        receitasMes,
        despesasMes,
        movimentos: movimentosRecentes,
        dividas: dividasPeriodo,
        projetos: projetosPeriodo
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      mostrarAlerta(
        'Erro ao gerar PDF',
        `Não foi possível gerar o PDF: ${error.message}`,
        'erro',
        false
      );
    }
  };

  const generateAIAdvice = () => {
    let rotativos = [];
    let bons = [];
    let maus = [];
    let conselhos = [];

    // --- Análise de Admin (Apenas se for Admin) ---
    if (isAdmin && adminData && typeof adminData.getStats === 'function') {
      const stats = adminData.getStats();
      const numUsers = stats.totalUsers || 0;
      const numPremium = stats.premiumUsers || 0;
      const pendingApprovals = stats.pendingApprovals || 0;
      
      if (numUsers === 0) {
        rotativos.push("🚀 Lançamento: O sistema está pronto para receber utilizadores. Inicie as campanhas!");
        conselhos.push("Inicie campanhas de marketing para atrair os primeiros registos na plataforma.");
      } else {
        if (pendingApprovals > 0) {
          rotativos.push(`🚨 Urgente: ${pendingApprovals} pagamento(s) aguardando aprovação na Sala de Máquinas.`);
          maus.push(`Existem pagamentos pendentes de aprovação que afetam a satisfação dos clientes.`);
        }
        
        const conversionRate = numPremium > 0 ? ((numPremium / numUsers) * 100).toFixed(1) : 0;
        if (numPremium === 0) {
          rotativos.push("💡 Sugestão Comercial: Nenhum utilizador aderiu ao Premium. Considere disparar uma oferta.");
          maus.push("A taxa de conversão para Premium está em 0%. Nenhuma receita direta neste momento.");
        } else if (conversionRate < 10) {
          rotativos.push(`📊 Taxa de Conversão: Apenas ${conversionRate}% pagam. Aumente o foco no Premium.`);
          maus.push(`Taxa de conversão (${conversionRate}%) abaixo do ideal (10%+).`);
        } else {
          rotativos.push(`🔥 Excelente conversão: ${conversionRate}% pagam. Foco na retenção.`);
          bons.push(`Alta taxa de conversão Premium (${conversionRate}%). O negócio está escalável.`);
        }

        const blockedUsers = adminData.users ? adminData.users.filter(u => u.status === 'Bloqueado') : [];
        if (blockedUsers.length > 0) {
          rotativos.push(`⚠️ Segurança: ${blockedUsers.length} conta(s) bloqueadas. Vigie os logs.`);
        }
      }

      rotativos.push("🔋 Auditoria de Servidor: Mantenha sempre um olho no consumo de RAM/CPU.");
      rotativos.push("📆 Fecho do Mês: Envie notificações entre os dias 28 e 31 para reconciliação.");
    }

    // --- Análise Financeira Pessoal (Para TODOS, incluindo Admin) ---
    const diaHoje = new Date().getDate();
    
    if (receitasMes > 0) {
      const taxaGasto = (despesasMes / receitasMes) * 100;
      if (taxaGasto > 80) {
        rotativos.push(`📉 Alerta Crítico: Gastou ${taxaGasto.toFixed(1)}% das receitas. Congele compras.`);
        maus.push(`Taxa de queima de capital altíssima (${taxaGasto.toFixed(1)}%). O risco de endividamento é extremo.`);
        conselhos.push("Congele imediatamente compras não essenciais e adote um modo de sobrevivência até ao final do mês.");
      } else if (taxaGasto > 50 && taxaGasto <= 80) {
        rotativos.push(`⚠️ Atenção: Os gastos estão nos ${taxaGasto.toFixed(1)}%. Lembre-se da regra 50/30/20.`);
        maus.push(`Gastos operacionais consumiram ${taxaGasto.toFixed(1)}% do orçamento.`);
        conselhos.push("Tente alinhar o seu orçamento à regra dos 50/30/20. Evite desejos impulsivos.");
      } else if (taxaGasto < 40 && despesasMes > 0) {
        rotativos.push(`🌟 Genial! Consumiu apenas ${taxaGasto.toFixed(1)}%. Utilize este saldo para investir.`);
        bons.push(`Controlo financeiro exemplar. Apenas ${taxaGasto.toFixed(1)}% do orçamento foi gasto.`);
        conselhos.push("Aproveite a folga de capital para reforçar o Fundo de Emergência ou investir num Projeto.");
      }
    }

    const pagamentosAtrasados = pagamentosFixos.filter(p => !p.pagoEsteMes && diaHoje > p.diaVencimento);
    const pagamentosCriticos = pagamentosFixos.filter(p => !p.pagoEsteMes && (p.diaVencimento - diaHoje <= 3) && (p.diaVencimento - diaHoje >= 0));

    if (pagamentosAtrasados.length > 0) {
      rotativos.push(`🚨 URGÊNCIA: Tem ${pagamentosAtrasados.length} pagamento(s) fixo(s) em atraso!`);
      maus.push(`${pagamentosAtrasados.length} compromisso(s) fixo(s) em atraso. Juros de mora podem acumular.`);
      conselhos.push(`Pague "${pagamentosAtrasados[0].nome}" com urgência para manter o seu bom nome no mercado.`);
    }
    if (pagamentosCriticos.length > 0) {
      rotativos.push(`⏳ Prepare Kz ${pagamentosCriticos[0].valor.toLocaleString()} para o pagamento de "${pagamentosCriticos[0].nome}" em breve.`);
      conselhos.push(`Crie uma provisão de Kz ${pagamentosCriticos[0].valor.toLocaleString()} hoje para honrar o próximo pagamento.`);
    }

    if (totalAPagar > saldoTotal && saldoTotal >= 0) {
      rotativos.push(`💳 Alerta Vermelho: Dívidas superam o dinheiro disponível. Priorize o pagamento.`);
      maus.push(`Passivo superior ao Ativo: As dívidas (Kz ${totalAPagar.toLocaleString()}) engoliram a sua liquidez.`);
      conselhos.push("Priorize renegociar as dívidas mais tóxicas. Use o Método Bola de Neve para motivação rápida.");
    } else if (totalAPagar > 0 && saldoTotal > 0 && (totalAPagar / saldoTotal) > 0.4) {
      rotativos.push(`📊 Cuidado: 40% do capital disponível seria engolido pelas dívidas.`);
      maus.push(`Endividamento desconfortável: mais de 40% da liquidez está comprometida.`);
    }

    if (totalAReceber > 0) {
      const maiorDevedor = dividas.filter(d => !d.paga && d.tipo === 'a_receber').sort((a,b) => b.valor - a.valor)[0];
      if (maiorDevedor) {
        rotativos.push(`💰 Tem Kz ${totalAReceber.toLocaleString()} a receber na rua.`);
        bons.push(`Património não cobrado de Kz ${totalAReceber.toLocaleString()} na posse de terceiros.`);
        conselhos.push(`Aja de forma proativa. Envie um lembrete educado ao seu maior devedor (${maiorDevedor.pessoa}).`);
      }
    }

    const kixikilasAtivas = kixikilas.filter(k => k.status === 'ativo' || k.status === 'em_andamento' || k.id);
    if (kixikilasAtivas.length > 0) {
       rotativos.push(`🤝 Não se esqueça de reservar o valor das quotas das suas Kixikilas.`);
       conselhos.push(`Mantenha a reputação honrando a sua quota nas ${kixikilasAtivas.length} Kixikila(s) ativas.`);
    }

    const projetosEmAndamento = projetos.filter(p => p.valorGuardado < p.objetivo);
    if (projetosEmAndamento.length > 0) {
      const projetoMaisProximo = projetosEmAndamento.sort((a, b) => (b.valorGuardado/(b.objetivo||1)) - (a.valorGuardado/(a.objetivo||1)))[0];
      const percentagem = ((projetoMaisProximo.valorGuardado / (projetoMaisProximo.objetivo||1)) * 100).toFixed(1);
      
      if (percentagem > 80) {
        rotativos.push(`🎯 O projeto "${projetoMaisProximo.nome}" está a ${percentagem}%! Falta pouco.`);
        bons.push(`Projeto "${projetoMaisProximo.nome}" quase concluído (${percentagem}%).`);
        conselhos.push(`Faltam só Kz ${(projetoMaisProximo.objetivo - projetoMaisProximo.valorGuardado).toLocaleString()}! Esforço final para fechar o projeto e celebrar.`);
      } else if (saldoTotal > 100000 && receitasMes > despesasMes && pagamentosAtrasados.length === 0) {
        rotativos.push(`💡 Tem saldo positivo. Deposite um extra no projeto "${projetoMaisProximo.nome}".`);
        bons.push("Excesso de liquidez na conta. Ambiente propício ao crescimento de projetos.");
      }
    }

    if (bons.length === 0 && maus.length === 0 && conselhos.length === 0) {
       rotativos.push("👋 Olá! Registe despesas ou receitas para eu analisar o seu perfil.");
       conselhos.push("Comece por registar o seu salário e despesas no separador Transações. O motor analítico precisa de dados.");
    }

    if (bons.length > 0 && maus.length === 0 && pagamentosAtrasados.length === 0 && totalAPagar === 0) {
       rotativos.push("✨ Perfeição Financeira: Sem dívidas e saldo positivo. Continue assim!");
       bons.push("Perfil Classe A: Nenhuma dívida tóxica, saldo robusto e controlo de despesas exemplar.");
    }

    return { rotativos, profundos: { bons, maus, conselhos } };
  };
  
  const dataDividas = [
    { name: 'A Receber', valor: totalAReceber, fill: '#10b981' },
    { name: 'A Pagar', valor: totalAPagar, fill: '#f45b5b' }
  ];

  // 4. Mapear Projetos do Estado Global
  const dataProjetos = projetosPeriodo.map(p => ({
    name: p.nome,
    guardado: p.valorGuardado,
    objetivo: p.objetivo - p.valorGuardado > 0 ? p.objetivo - p.valorGuardado : 0
  }));
  
  const aiInsights = generateAIAdvice();

  useEffect(() => {
    if (aiInsights.rotativos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentInsightIndex((prevIndex) => (prevIndex + 1) % aiInsights.rotativos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [aiInsights.rotativos.length]);

  const activeInsight = aiInsights.rotativos[currentInsightIndex] || aiInsights.rotativos[0];
  const hasAssistantUnread = Number(assistantUnreadCount || 0) > 0;

  return (
    <>
      {/* Yeto AI Smart Card */}
      <div className="yeto-ai-card">
        {!hasAiAccess && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(28, 28, 30, 0.9)', zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
            <p style={{ color: '#ffb300', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>Funcionalidade Premium</p>
            <span style={{ color: '#ccc', fontSize: '0.85rem' }}>O seu mês grátis terminou. Renove para desbloquear o Conselheiro IA.</span>
          </div>
        )}
        <div style={{ fontSize: '3rem', filter: 'drop-shadow(0 0 10px rgba(255,179,0,0.5))' }}>🤖</div>
        <div className="yeto-ai-card-content">
          <h3 style={{ color: '#ffb300', margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Yeto AI <span style={{ fontSize: '0.7rem', background: 'rgba(255,179,0,0.2)', padding: '2px 8px', borderRadius: '10px', color: '#ffb300' }}>BETA</span>
            {aiInsights.rotativos.length > 1 && (
              <span style={{ fontSize: '0.75rem', color: '#8a8ca3', fontWeight: 'normal', marginLeft: 'auto' }}>
                Dica {currentInsightIndex + 1} de {aiInsights.rotativos.length}
              </span>
            )}
          </h3>
          {hasAssistantUnread && (
            <button
              type="button"
              className="assistant-ai-alert"
              onClick={() => setActiveTab?.('assistente')}
            >
              <span className="assistant-ai-alert-icon">!</span>
              <span>
                <strong>{assistantUnreadCount} nova{assistantUnreadCount > 1 ? 's' : ''} no Assistente</strong>
                <small>{assistantLatestPreview?.subject || 'Abra para responder/ver a conversa'}</small>
              </span>
            </button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minHeight: '45px' }}>
            <p key={currentInsightIndex} style={{ color: '#fff', margin: 0, fontSize: '1.05rem', lineHeight: '1.4', animation: 'fadeIn 0.5s ease-in' }}>
              {activeInsight}
            </p>
          </div>
        </div>
        <div className="yeto-ai-action">
          <button 
            className="btn btn-glass" 
            onClick={() => setShowAIModal(true)}
            style={{ padding: '0.8rem 1.5rem', fontWeight: 'bold', border: '1px solid #ffb300', color: '#ffb300' }}
            disabled={!hasAiAccess}
          >
            Ver Análise Profunda
          </button>
        </div>
      </div>

      {showAIModal && (
        <div className="sobre-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="sobre-modal-container" style={{ maxWidth: '700px', width: '90%', padding: '2.5rem', background: '#fff', borderRadius: '24px', maxHeight: '85vh', overflowY: 'auto' }}>
            <button className="sobre-modal-close" onClick={() => setShowAIModal(false)}>×</button>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem', display: 'inline-block', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>🧠</div>
              <h2 style={{ color: '#373392', fontSize: '2rem', margin: '0 0 0.5rem 0' }}>Análise Profunda do Yeto AI</h2>
              <p style={{ color: '#555' }}>Auditoria completa ao seu perfil financeiro.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* O que está bom */}
              <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1.5rem', borderRadius: '16px' }}>
                <h3 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 1rem 0' }}>
                  <span>🟢</span> Pontos Fortes (O que está bem)
                </h3>
                {aiInsights.profundos.bons.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#333', lineHeight: '1.6' }}>
                    {aiInsights.profundos.bons.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                ) : (
                  <p style={{ color: '#666', margin: 0, fontStyle: 'italic' }}>Não identificámos grandes pontos fortes de momento. Organize as suas receitas!</p>
                )}
              </div>

              {/* O que está mal */}
              <div style={{ background: 'rgba(244, 91, 91, 0.05)', border: '1px solid rgba(244, 91, 91, 0.2)', padding: '1.5rem', borderRadius: '16px' }}>
                <h3 style={{ color: '#f45b5b', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 1rem 0' }}>
                  <span>🔴</span> Pontos de Atenção (O que está mal)
                </h3>
                {aiInsights.profundos.maus.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#333', lineHeight: '1.6' }}>
                    {aiInsights.profundos.maus.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                ) : (
                  <p style={{ color: '#666', margin: 0, fontStyle: 'italic' }}>Excelente! Não tem fatores críticos negativos atualmente.</p>
                )}
              </div>

              {/* Conselhos Estratégicos */}
              <div style={{ background: 'rgba(255, 179, 0, 0.05)', border: '1px solid rgba(255, 179, 0, 0.3)', padding: '1.5rem', borderRadius: '16px' }}>
                <h3 style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 1rem 0' }}>
                  <span>💡</span> Conselho Estratégico Yeto AI
                </h3>
                {aiInsights.profundos.conselhos.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#333', lineHeight: '1.6' }}>
                    {aiInsights.profundos.conselhos.map((item, i) => <li key={i} style={{ marginBottom: '0.5rem' }}>{item}</li>)}
                  </ul>
                ) : (
                  <p style={{ color: '#666', margin: 0, fontStyle: 'italic' }}>Continue a gerir as suas finanças de forma estável. Sem conselhos urgentes de momento.</p>
                )}
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
               <button className="btn btn-primary btn-pill" onClick={() => setShowAIModal(false)} style={{ padding: '0.8rem 3rem' }}>
                 Entendido
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="dashboard-filter-bar">
        <div>
          <PeriodFilter value={periodFilter} onChange={setPeriodFilter} compact />
          <span className="filter-result-note">
            {movimentosPeriodo.length} movimento(s) em {periodLabel} · Entradas Kz {totalEntradasPeriodo.toLocaleString()} · Saídas Kz {totalSaidasPeriodo.toLocaleString()}
          </span>
        </div>
        <button 
          onClick={handleGeneratePDF}
          className="btn btn-pill" 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.8rem', 
            background: hasPdfAccess ? 'var(--accent-color)' : '#e0e0e0', 
            color: hasPdfAccess ? '#fff' : '#888', 
            border: 'none',
            boxShadow: hasPdfAccess ? '0 10px 20px rgba(55,51,146,0.3)' : 'none',
            padding: '0.8rem 1.5rem',
            fontWeight: 'bold',
            transition: 'all 0.3s'
          }}
        >
          <span>📄</span> 
          {hasPdfAccess ? 'Baixar Relatório Financeiro (PDF)' : 'Relatório PDF (Apenas Premium)'}
          {!hasPdfAccess && <span>🔒</span>}
        </button>
      </div>

      {/* Top Cards Row */}
      <div className="dashboard-grid-top" style={{ marginBottom: '2rem' }}>
        <div className="dash-card primary-card">
          <p className="card-label">Saldo Família (Todas as contas)</p>
          <h2 className="card-value">Kz {saldoTotal.toLocaleString()}</h2>
          <div className="card-trend positive">Atualizado em tempo real</div>
        </div>
        <div className="dash-card">
          <p className="card-label">Total em Dívidas (A Pagar)</p>
          <h2 className="card-value danger">Kz {totalAPagar.toLocaleString()}</h2>
          <div className="card-trend warning">Mantenha debaixo de olho</div>
        </div>
        <div className="dash-card">
          <p className="card-label">Dinheiro a Receber</p>
          <h2 className="card-value positive" style={{ color: '#10b981' }}>Kz {totalAReceber.toLocaleString()}</h2>
          <div className="card-trend positive">Cobre os seus devedores</div>
        </div>
      </div>

      {/* Charts Grid Row */}
      <div className="dashboard-grid-bottom" style={{ marginBottom: '2rem' }}>
        
        {/* Gráfico de Despesas */}
        <div className="dash-card">
          <h3 className="section-title">Distribuição de Despesas</h3>
          <div style={{ width: '100%', height: 250 }}>
            {dataDespesas.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie 
                    data={dataDespesas} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60}
                    outerRadius={80} 
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {dataDespesas.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `Kz ${value.toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-secondary" style={{ textAlign: 'center', marginTop: '4rem' }}>Sem despesas registadas.</p>
            )}
          </div>
        </div>

        {/* Gráfico de Dívidas */}
        <div className="dash-card">
          <h3 className="section-title">Balanço de Dívidas</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={dataDividas} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(value) => `Kz ${value.toLocaleString()}`} cursor={{fill: 'transparent'}} />
                <Bar dataKey="valor" radius={[10, 10, 10, 10]} barSize={50}>
                  {dataDividas.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid Row */}
      <div className="dashboard-grid-bottom">
        
        {/* Gráfico de Projetos */}
        <div className="dash-card">
          <h3 className="section-title">Progresso dos Projetos de Vida</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={dataProjetos} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} />
                <Tooltip formatter={(value) => `Kz ${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="guardado" name="Valor Guardado" stackId="a" fill="var(--accent-color)" radius={[10, 0, 0, 10]} />
                <Bar dataKey="objetivo" name="O que falta" stackId="a" fill="#e5e7eb" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dash-card">
          <h3 className="section-title">Últimos Movimentos</h3>
          <ul className="expense-list">
            {movimentosRecentes.map(m => {
              const isEntrada = m.tipo_movimento === 'entrada';
              return (
                <li key={m.id} className="expense-item">
                  <div className={`expense-icon ${isEntrada ? 'bg-success' : 'bg-warning'}`} style={{ borderRadius: '50%', background: isEntrada ? 'rgba(16, 185, 129, 0.1)' : '' }}>
                    {getIcon(m.categoria || m.tipo)}
                  </div>
                  <div className="expense-details">
                    <h4>{m.descricao}</h4>
                    <span className="text-secondary text-sm">{m.categoria || m.tipo} • {m.data}</span>
                  </div>
                  <div className={`expense-amount ${isEntrada ? 'positive' : 'danger'}`} style={{ fontWeight: '600', color: isEntrada ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {isEntrada ? '+' : '-'} Kz {m.valor.toLocaleString()}
                  </div>
                </li>
              );
            })}
            {movimentosRecentes.length === 0 && (
              <p className="text-secondary text-sm">Nenhum movimento recente.</p>
            )}
          </ul>
        </div>

      </div>
    </>
  );
}
