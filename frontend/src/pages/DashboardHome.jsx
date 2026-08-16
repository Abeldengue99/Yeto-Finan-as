import React, { useState, useEffect } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAdmin } from '../contexts/AdminContext';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { generateProfessionalReport } from '../utils/pdfGenerator';

export default function DashboardHome({ isAdmin }) {
  const { usuario, saldoTotal, despesas, dividas, projetos, movimentos, pagamentosFixos, receitas, kixikilas } = useFinance();
  const adminData = useAdmin(); // Access admin context data if needed
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  
  // 1. Pegar os 4 movimentos mais recentes
  const movimentosRecentes = movimentos.slice(0, 4);
  
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
  const despesasPorCategoria = despesas.reduce((acc, current) => {
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
  const totalAReceber = dividas.filter(d => !d.paga && d.tipo === 'a_receber').reduce((acc, d) => acc + d.valor, 0);
  const totalAPagar = dividas.filter(d => !d.paga && d.tipo === 'a_pagar').reduce((acc, d) => acc + d.valor, 0);
  
  // 4. Receitas e Despesas do Mês Atual (Usadas na IA e no PDF)
  const mesAnoStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const despesasMes = despesas.filter(d => d.data && d.data.startsWith(mesAnoStr)).reduce((a, b) => a + b.valor, 0);
  const receitasMes = receitas.filter(r => r.data && r.data.startsWith(mesAnoStr)).reduce((a, b) => a + b.valor, 0);

  const handleGeneratePDF = () => {
    if (!usuario?.isPremium && !isAdmin) {
      alert("⚠️ Funcionalidade Premium!\n\nEste recurso é exclusivo para assinantes Premium. Aceda ao Menu > Fazer Upgrade para obter relatórios profissionais.");
      return;
    }
    generateProfessionalReport({
      usuario,
      saldoTotal,
      receitasMes,
      despesasMes,
      movimentos: movimentosRecentes,
      dividas,
      projetos
    });
  };

  const generateAIAdvice = () => {
    const insights = [];

    if (isAdmin && adminData) {
      // 👑 Insights Específicos para Administradores
      const stats = adminData.getStats();
      const numUsers = stats.totalUsers || 0;
      const numPremium = stats.premiumUsers || 0;
      const pendingApprovals = stats.pendingApprovals || 0;
      const mrr = stats.mrr || 0;
      
      if (numUsers === 0) {
        insights.push("🚀 Lançamento: O sistema está em pleno funcionamento e pronto para receber utilizadores. Inicie as campanhas de marketing para atrair os primeiros registos!");
        insights.push("🛡️ Monitorização: As métricas de desempenho estão excelentes. A plataforma aguarda os primeiros passos operacionais.");
      } else {
        if (pendingApprovals > 0) {
          insights.push(`🚨 Urgente: Existem ${pendingApprovals} comprovativos de pagamento aguardando aprovação na "Sala de Máquinas". Agilize isto para garantir a satisfação dos clientes e libertar a sua receita!`);
        }
        
        insights.push(`📈 Desempenho Global: O sistema regista ${numUsers} utilizador(es), com ${numPremium} assinante(s) do plano Premium.`);
        
        const conversionRate = numPremium > 0 ? ((numPremium / numUsers) * 100).toFixed(1) : 0;
        
        if (numPremium === 0) {
          insights.push("💡 Sugestão Comercial: Tem utilizadores na plataforma mas nenhum aderiu ao Premium. Considere disparar uma notificação global a oferecer descontos nas funcionalidades IA e Divisas.");
        } else if (conversionRate < 10) {
          insights.push(`📊 Taxa de Conversão: Apenas ${conversionRate}% dos utilizadores pagam. Aumente o foco nas vantagens do plano Premium para subir a Receita Mensal Recorrente (MRR), que atualmente está em Kz ${mrr.toLocaleString()}.`);
        } else {
          insights.push(`🔥 Excelente conversão: ${conversionRate}% dos utilizadores pagam pelo serviço, gerando uma MRR de Kz ${mrr.toLocaleString()}. Foco agora é reduzir o 'churn' (cancelamentos).`);
        }

        const blockedUsers = adminData.users ? adminData.users.filter(u => u.status === 'Bloqueado') : [];
        if (blockedUsers.length > 0) {
          insights.push(`⚠️ Segurança: ${blockedUsers.length} conta(s) encontram-se bloqueadas. Verifique regularmente os logs de sistema para prevenir atividades maliciosas na plataforma.`);
        }
        
        const dangerLogs = adminData.logs ? adminData.logs.slice(0, 10).filter(l => l.tipo === 'danger' || l.tipo === 'error') : [];
        if (dangerLogs.length >= 2) {
           insights.push("🛑 Alerta de Risco: Ocorreram múltiplas ações suspeitas ou erros críticos registados nos logs recentemente. Vigie a atividade de perto.");
        }
      }

      // Adicionar mais conselhos gerais de gestão para garantir que o Admin tem acesso a um fluxo constante de dicas ricas (Mínimo 10 Conselhos disponíveis)
      insights.push("🌐 Expansão Estratégica: Avalie as províncias mais ativas na plataforma para focar os seus futuros investimentos em publicidade local (ex: Luanda, Benguela, Huíla).");
      insights.push("💬 Feedback Constante: A melhor forma de reduzir o churn (cancelamentos) é ligar ou enviar email a 5 clientes Premium por semana a pedir opiniões sinceras sobre o Yeto.");
      insights.push("🔋 Auditoria de Servidor: Mantenha sempre um olho no consumo de recursos (RAM e CPU) do servidor Node/Express à medida que a base de dados Postgres cresce.");
      insights.push("📆 Fecho do Mês: Entre os dias 28 e 31, envie notificações gerais para lembrar as famílias de reconciliarem as suas contas e avaliarem o Orçamento Mensal.");
      insights.push("🤝 Parcerias Institucionais: Com o aumento do volume de dados, comece a mapear potenciais parcerias com bancos angolanos (ex: BAI, BFA) para futuras integrações API.");
      insights.push("📊 Relatórios Financeiros: A funcionalidade de PDF está agora disponível. Incentive os utilizadores através do canal de comunicação a imprimirem relatórios antes das suas reuniões de família.");
      insights.push("🤖 Treino do Conselheiro IA: O algoritmo de Inteligência Artificial está a alimentar-se de dados reais de consumo. Lembre os utilizadores que quanto mais transações registarem, mais precisos serão os conselhos.");
      insights.push("🔒 Segurança Contínua: Certifique-se periodicamente de que a equipa de administração atualiza as suas senhas e evite acessos a partir de redes Wi-Fi públicas sem VPN.");
      insights.push("🎯 Gamificação da Plataforma: Avalie quais são os Desafios Familiares mais concluídos pelos utilizadores para criar Campanhas de Marketing baseadas nos hábitos de poupança reais dos angolanos.");
    } else {
      // 👨‍👩‍👧‍👦 Conselheiro Yeto AI Analítico (Análise de Dados Reais)
      const diaHoje = new Date().getDate();
      
      if (receitasMes > 0) {
        const taxaGasto = (despesasMes / receitasMes) * 100;
        if (taxaGasto > 80) {
          insights.push(`📉 Alerta Crítico de Gastos: Já comprometeu ${taxaGasto.toFixed(1)}% dos seus rendimentos deste mês. Se continuar assim, arrisca-se a contrair dívidas. Congele compras não essenciais imediatamente.`);
        } else if (taxaGasto > 50 && taxaGasto <= 80) {
          insights.push(`⚠️ Atenção: Os seus gastos representam ${taxaGasto.toFixed(1)}% das suas entradas. Tente não ultrapassar a regra dos 50/30/20 (50% essenciais, 30% desejos, 20% poupança).`);
        } else if (taxaGasto < 40 && despesasMes > 0) {
          insights.push(`🌟 Genial! Consumiu apenas ${taxaGasto.toFixed(1)}% do seu orçamento mensal. Utilize este saldo remanescente para acelerar um Projeto ou investir num depósito a prazo.`);
        }
      }

      // Análise de Pagamentos Fixos
      const pagamentosAtrasados = pagamentosFixos.filter(p => !p.pagoEsteMes && diaHoje > p.diaVencimento);
      const pagamentosCriticos = pagamentosFixos.filter(p => !p.pagoEsteMes && (p.diaVencimento - diaHoje <= 3) && (p.diaVencimento - diaHoje >= 0));

      if (pagamentosAtrasados.length > 0) {
        insights.push(`🚨 URGÊNCIA: Tem ${pagamentosAtrasados.length} pagamento(s) fixo(s) em atraso (ex: "${pagamentosAtrasados[0].nome}"). Regularize isto hoje mesmo para não acumular juros de mora!`);
      }
      if (pagamentosCriticos.length > 0) {
        insights.push(`⏳ Provisão Necessária: Prepare Kz ${pagamentosCriticos[0].valor.toLocaleString()} porque o pagamento de "${pagamentosCriticos[0].nome}" vence em breve (dia ${pagamentosCriticos[0].diaVencimento}).`);
      }

      // Análise Profunda de Dívidas vs Poupanças
      if (totalAPagar > saldoTotal && saldoTotal >= 0) {
        insights.push(`💳 Alerta Vermelho (Risco de Falência): O seu total de dívidas (Kz ${totalAPagar.toLocaleString()}) supera completamente o dinheiro que tem no banco (Kz ${saldoTotal.toLocaleString()}). Priorize pagar as dívidas menores rapidamente usando o Método Bola de Neve para libertar fluxo de caixa.`);
      } else if (totalAPagar > 0 && (totalAPagar / saldoTotal) > 0.4) {
        insights.push(`📊 Cuidado: 40% do seu capital disponível seria engolido pelas dívidas. Tente renegociar prazos com os seus credores antes de ficar descapitalizado.`);
      }

      if (totalAReceber > 0) {
        const maiorDevedor = dividas.filter(d => !d.paga && d.tipo === 'a_receber').sort((a,b) => b.valor - a.valor)[0];
        insights.push(`💰 Património na Rua: Tem Kz ${totalAReceber.toLocaleString()} a receber. O seu maior devedor é ${maiorDevedor.pessoa} (Kz ${maiorDevedor.valor.toLocaleString()}). Aja de forma proativa enviando um lembrete educado esta semana.`);
      }

      // Análise de Kixikilas
      const kixikilasAtivas = kixikilas.filter(k => k.status === 'ativo' || k.status === 'em_andamento' || k.id); // Considerando todas por agora
      if (kixikilasAtivas.length > 0) {
         insights.push(`🤝 Disciplina de Kixikila: Não se esqueça de reservar o valor das quotas das suas ${kixikilasAtivas.length} Kixikila(s) ativas assim que o salário cair na conta.`);
      }

      // Análise de Projetos
      const projetosEmAndamento = projetos.filter(p => p.valorGuardado < p.objetivo);
      if (projetosEmAndamento.length > 0) {
        const projetoMaisProximo = projetosEmAndamento.sort((a, b) => (b.valorGuardado/b.objetivo) - (a.valorGuardado/a.objetivo))[0];
        const percentagem = ((projetoMaisProximo.valorGuardado / projetoMaisProximo.objetivo) * 100).toFixed(1);
        
        if (percentagem > 80) {
          insights.push(`🎯 Retalia Final! O projeto "${projetoMaisProximo.nome}" está a ${percentagem}%! Faltam só Kz ${(projetoMaisProximo.objetivo - projetoMaisProximo.valorGuardado).toLocaleString()} para atingir o objetivo!`);
        } else if (saldoTotal > 100000 && receitasMes > despesasMes && pagamentosAtrasados.length === 0) {
          insights.push(`💡 Aceleração: Com o saldo positivo que tem na conta, se depositar hoje um extra no projeto "${projetoMaisProximo.nome}", atingirá a sua meta muito mais rápido e evitará gastos desnecessários.`);
        }
      }

      // Elogio condicional rigoroso
      if (insights.length <= 2 && saldoTotal > 0 && pagamentosAtrasados.length === 0 && totalAPagar === 0) {
        insights.push("✨ Perfeição Financeira: Não tem pagamentos atrasados, zero dívidas e o saldo é positivo. Continue com esta forte disciplina! A inteligência de um bom investidor está em não perder dinheiro.");
      }
      
      if (saldoTotal === 0 && receitasMes === 0 && despesasMes === 0) {
         insights.push("👋 Olá! Comece por registar as suas contas, receitas ou despesas no menu Transações para que eu possa iniciar as análises financeiras e ajudar-te a crescer o teu património.");
      }
    }

    return insights;
  };
  
  const dataDividas = [
    { name: 'A Receber', valor: totalAReceber, fill: '#10b981' },
    { name: 'A Pagar', valor: totalAPagar, fill: '#f45b5b' }
  ];

  // 4. Mapear Projetos do Estado Global
  const dataProjetos = projetos.map(p => ({
    name: p.nome,
    guardado: p.valorGuardado,
    objetivo: p.objetivo - p.valorGuardado > 0 ? p.objetivo - p.valorGuardado : 0
  }));
  
  const aiInsights = generateAIAdvice();

  useEffect(() => {
    if (aiInsights.length <= 1) return;
    
    // Rotacionar as dicas a cada 5 segundos para ser mais dinâmico
    const interval = setInterval(() => {
      setCurrentInsightIndex((prevIndex) => (prevIndex + 1) % aiInsights.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [aiInsights.length]);

  // Se o índice atual for maior que o número de insights (por exemplo, ao resolver uma dívida), volta ao 0
  const activeInsight = aiInsights[currentInsightIndex] || aiInsights[0];

  return (
    <>
      {/* Yeto AI Smart Card */}
      <div style={{
        background: 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)',
        borderRadius: '20px',
        padding: '1.5rem 2rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        boxShadow: '0 15px 30px rgba(0,0,0,0.15)',
        border: '1px solid rgba(255, 179, 0, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {!usuario?.isPremium && (
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
        <div>
          <h3 style={{ color: '#ffb300', margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Yeto AI <span style={{ fontSize: '0.7rem', background: 'rgba(255,179,0,0.2)', padding: '2px 8px', borderRadius: '10px', color: '#ffb300' }}>BETA</span>
            {aiInsights.length > 1 && (
              <span style={{ fontSize: '0.75rem', color: '#8a8ca3', fontWeight: 'normal', marginLeft: 'auto' }}>
                Dica {currentInsightIndex + 1} de {aiInsights.length}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minHeight: '45px' }}>
            <p key={currentInsightIndex} style={{ color: '#fff', margin: 0, fontSize: '1.05rem', lineHeight: '1.4', animation: 'fadeIn 0.5s ease-in' }}>
              {activeInsight}
            </p>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
        <button 
          onClick={handleGeneratePDF}
          className="btn btn-pill" 
          style={{ 
            display: 'flex', alignItems: 'center', gap: '0.8rem', 
            background: usuario?.isPremium || isAdmin ? 'var(--accent-color)' : '#e0e0e0', 
            color: usuario?.isPremium || isAdmin ? '#fff' : '#888', 
            border: 'none',
            boxShadow: usuario?.isPremium || isAdmin ? '0 10px 20px rgba(55,51,146,0.3)' : 'none',
            padding: '0.8rem 1.5rem',
            fontWeight: 'bold',
            transition: 'all 0.3s'
          }}
        >
          <span>📄</span> 
          {usuario?.isPremium || isAdmin ? 'Baixar Relatório Financeiro (PDF)' : 'Relatório PDF (Apenas Premium)'}
          {!(usuario?.isPremium || isAdmin) && <span>🔒</span>}
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
          <p className="card-label">Dinheiro na Rua (A Receber)</p>
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
