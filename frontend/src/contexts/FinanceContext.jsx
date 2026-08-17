import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';

const FinanceContext = createContext();
const FREE_TRIAL_DAYS = 30;

function getEffectivePlanExpiry(user) {
  if (!user || user.plan_type === 'admin') return null;

  const explicitExpiry = user.plan_expires_at ? new Date(user.plan_expires_at) : null;
  if (explicitExpiry && !Number.isNaN(explicitExpiry.getTime())) {
    return explicitExpiry;
  }

  if (user.plan_type === 'free' && user.created_at) {
    const createdAt = new Date(user.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      return new Date(createdAt.getTime() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000);
    }
  }

  return null;
}

function getPlanAccess(user) {
  const subscriptionPlan = user?.subscription_plan || (user?.plan_type === 'admin' ? 'admin' : user?.plan_type === 'premium' ? 'anual' : 'free');

  if (!user) {
    return {
      isPremium: false,
      trialDaysLeft: 0,
      planExpired: false,
      planExpiresAt: null,
      subscription_plan: 'free',
      isTrialActive: false,
      hasAnnualAccess: false
    };
  }

  if (user.plan_type === 'admin') {
    return {
      isPremium: true,
      trialDaysLeft: null,
      planExpired: false,
      planExpiresAt: null,
      subscription_plan: 'admin',
      isTrialActive: false,
      hasAnnualAccess: true
    };
  }

  const expiresAt = getEffectivePlanExpiry(user);
  const hasValidExpiry = Boolean(expiresAt);
  const isActive = hasValidExpiry && expiresAt > new Date();
  const isTrialActive = user.plan_type === 'free' && isActive;
  const trialDaysLeft = hasValidExpiry
    ? Math.max(0, Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    isPremium: isActive,
    trialDaysLeft,
    planExpired: hasValidExpiry && !isActive,
    planExpiresAt: hasValidExpiry ? expiresAt.toISOString() : null,
    subscription_plan: subscriptionPlan,
    isTrialActive,
    hasAnnualAccess: isTrialActive || (isActive && subscriptionPlan === 'anual')
  };
}

function buildInitialUsuario(user) {
  const planAccess = getPlanAccess(user);
  const nome = user?.name || user?.nome || (user?.email ? user.email.split('@')[0] : 'Utilizador');

  return {
    nome,
    email: user?.email || '',
    profissao: user?.occupation || user?.profissao || '',
    avatar: nome ? nome.charAt(0).toUpperCase() : 'U',
    foto: user?.avatar_url || user?.foto || null,
    plan_type: user?.plan_type || 'free',
    subscription_plan: planAccess.subscription_plan,
    created_at: user?.created_at || null,
    plan_expires_at: planAccess.planExpiresAt,
    trialDaysLeft: planAccess.trialDaysLeft,
    isPremium: planAccess.isPremium,
    planExpired: planAccess.planExpired,
    isTrialActive: planAccess.isTrialActive,
    hasAnnualAccess: planAccess.hasAnnualAccess
  };
}

export function FinanceProvider({ children, userId, initialUser }) {
  // Estado do Usuário
  const [usuario, setUsuario] = useState(() => buildInitialUsuario(initialUser)); /*
    nome: 'Usuário',
    email: '',
    profissao: '',
    avatar: 'U',
    foto: null,
    plan_type: 'free',
    subscription_plan: 'free',
    plan_expires_at: null,
    trialDaysLeft: 0,
    isPremium: false,
    planExpired: false,
    isTrialActive: false,
    hasAnnualAccess: false
  }); */

  // Estado das Notificações
  const [notificacoes, setNotificacoes] = useState([
    { id: 1, titulo: 'Bem-vindo ao Yeto', mensagem: 'O seu centro de controlo financeiro está a ligar-se à base de dados.', lida: false, data: new Date().toISOString() }
  ]);

  const [assistantUnreadCount, setAssistantUnreadCount] = useState(0);
  const [assistantLatestPreview, setAssistantLatestPreview] = useState(null);
  const assistantUnreadRef = useRef(0);
  const assistantInitialLoadRef = useRef(true);

  // Estados Globais
  const [contas, setContas] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [receitas, setReceitas] = useState([]);
  const [dividas, setDividas] = useState([]);
  const [kixikilas, setKixikilas] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [divisas, setDivisas] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [calendarioFinanceiro, setCalendarioFinanceiro] = useState({ month: '', events: [], summary: null });
  const [previsaoEmergencia, setPrevisaoEmergencia] = useState({ month: '', forecast: null, emergency: null, access: null });
  const [listaCompras, setListaCompras] = useState({ month: '', lists: [], summary: null });
  const [pagamentosFixos, setPagamentosFixos] = useState([]);
  const [saldoTotal, setSaldoTotal] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Função reutilizável para carregar dados do servidor
  const fetchUserData = async (uid) => {
    if (!uid) return;
    try {
      const res = await apiFetch(`/api/finances/${uid}`);
      const data = await res.json();
      
      setContas(data.accounts || []);
      setSaldoTotal(data.saldoTotal || 0);
      setDespesas(data.despesas || []);
      setDividas(data.dividas || []);
      setPagamentosFixos(data.pagamentosFixos || []);
      setProjetos(data.projetos || []);
      setKixikilas(data.kixikilas || []);
      setOrcamentos(data.orcamentos || []);

      // Hydrate user info from DB
      if (data.user) {
        const planAccess = getPlanAccess(data.user);
        const { isPremium, trialDaysLeft, planExpired, isTrialActive, hasAnnualAccess } = planAccess;

        if (data.user.plan_type !== 'admin' && trialDaysLeft <= 3 && trialDaysLeft > 0) {
          mostrarAlerta(
            'Aviso: Plano a Terminar',
            `O seu acesso termina em ${trialDaysLeft} dias. Renove agora para não perder as funcionalidades Premium.`,
            'aviso',
            false
          );
        }

        if (planExpired) {
          mostrarAlerta(
            'Plano Expirado',
            'O seu período de acesso terminou. Renove o plano para desbloquear novamente as funcionalidades Premium.',
            'erro',
            false
          );
        }

        /*
        if (data.user.created_at) {
          const createdAt = new Date(data.user.created_at);
          const now = new Date();
          const diffTime = Math.abs(now - createdAt);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          trialDaysLeft = Math.max(0, 30 - diffDays);
          
          if (data.user.plan_type === 'free' && trialDaysLeft > 0) {
            isPremium = true; // Still in trial
          }
          
          // Notificação no 27º dia (3 dias restantes)
          if (data.user.plan_type === 'free' && trialDaysLeft <= 3 && trialDaysLeft > 0) {
            mostrarAlerta(
              'Aviso: Mês Gratuito a Terminar', `O seu acesso gratuito termina em ${trialDaysLeft} dias. Renove agora para não perder o acesso às funcionalidades Premium (Projetos, Conselheiro IA e Divisas, 'sucesso').`
            );
          }
        }
        */

        setUsuario(prev => ({
          ...prev,
          nome: data.user.name,
          email: data.user.email,
          profissao: data.user.occupation || '',
          foto: data.user.avatar_url || null,
          avatar: data.user.name ? data.user.name.charAt(0).toUpperCase() : prev.avatar,
          plan_type: data.user.plan_type,
          subscription_plan: planAccess.subscription_plan,
          created_at: data.user.created_at,
          plan_expires_at: planAccess.planExpiresAt,
          trialDaysLeft,
          isPremium,
          planExpired,
          isTrialActive,
          hasAnnualAccess
        }));
        if (data.user.yeto_points !== undefined) {
          setYetoPoints(data.user.yeto_points);
        }
      }

      // Entradas podem ser mapeadas dos movimentos da API
      const entradas = data.movimentos ? data.movimentos.filter(m => m.tipo_movimento === 'entrada') : [];
      setReceitas(entradas);

    } catch (err) {
      console.error('Erro ao buscar finanças:', err);
      mostrarAlerta('Erro', 'Não foi possível carregar os dados. Verifique a conexão.', 'erro');
    }
  };

  // Carregar dados reais do servidor
  useEffect(() => {
    if (userId) {
      setIsLoadingData(true);
      fetchUserData(userId)
        .then(() => {
          mostrarAlerta('Dados Sincronizados', 'Dados sincronizados com sucesso.', 'sucesso', false);
        })
        .finally(() => {
          setIsLoadingData(false);
        });
    }
  }, [userId]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setUsuario(prev => {
        const planAccess = getPlanAccess(prev);
        if (
          prev.isPremium === planAccess.isPremium &&
          prev.planExpired === planAccess.planExpired &&
          prev.trialDaysLeft === planAccess.trialDaysLeft &&
          prev.plan_expires_at === planAccess.planExpiresAt &&
          prev.subscription_plan === planAccess.subscription_plan &&
          prev.isTrialActive === planAccess.isTrialActive &&
          prev.hasAnnualAccess === planAccess.hasAnnualAccess
        ) {
          return prev;
        }

        return {
          ...prev,
          ...planAccess,
          plan_expires_at: planAccess.planExpiresAt,
          subscription_plan: planAccess.subscription_plan
        };
      });
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // Estado de Gamificação (Desafios do Casal)
  const [yetoPoints, setYetoPoints] = useState(1250);
  const [nivelAtual, setNivelAtual] = useState('Mestres da Poupança');

  const [desafiosAtivos, setDesafiosAtivos] = useState([
    { id: 1, titulo: 'Semana Caseira', descricao: 'Não gastar em Fast Food durante 7 dias.', recompensa: 100, progresso: 4, meta: 7, icone: '🍔' },
    { id: 2, titulo: 'Reforço de Segurança', descricao: 'Guardar 10.000 Kz no Cofre de Desrascanço.', recompensa: 250, progresso: 5000, meta: 10000, icone: '🛡️' },
    { id: 3, titulo: 'Contas em Dia', descricao: 'Pagar todos os Pagamentos Fixos até ao dia 10.', recompensa: 150, progresso: 1, meta: 2, icone: '📅' }
  ]);

  const [conquistas, setConquistas] = useState([
    { id: 101, titulo: 'Primeiro Passo', descricao: 'Criou a primeira conta no Yeto.', desbloqueada: true, icone: '🌱' },
    { id: 102, titulo: 'Reis da Kixikila', descricao: 'Completou um ciclo de Kixikila sem falhas.', desbloqueada: true, icone: '🤝' },
    { id: 103, titulo: 'Zero Dívidas', descricao: 'Terminou o mês sem nenhuma dívida a pagar.', desbloqueada: false, icone: '🏆' },
    { id: 104, titulo: 'Investidor Nato', descricao: 'Comprou divisas pela primeira vez.', desbloqueada: false, icone: '🌍' }
  ]);

  const completarDesafio = (id) => {
    const desafio = desafiosAtivos.find(d => d.id === id);
    if (!desafio) return;

    setYetoPoints(prev => prev + desafio.recompensa);
    mostrarAlerta('Desafio Concluído! 🎉', `Parabéns! Ganhou ${desafio.recompensa} YetoPoints por concluir: ${desafio.titulo}.`, 'sucesso');

    // Remove o desafio concluído
    setDesafiosAtivos(prev => prev.filter(d => d.id !== id));
  };

  const adicionarDesafio = (novoDesafio) => {
    const desafio = {
      ...novoDesafio,
      id: Date.now(),
      progresso: 0
    };
    setDesafiosAtivos(prev => [...prev, desafio]);
    mostrarAlerta('Desafio Criado!', 'O seu novo desafio familiar foi adicionado com sucesso.', 'sucesso');
  };

  // Estado Global de Categorias
  const [categoriasEntradas, setCategoriasEntradas] = useState(['Salário', 'Bónus', 'Rendas', 'Venda', 'Outros']);
  const [categoriasSaidas, setCategoriasSaidas] = useState(['Alimentação / Casa', 'Transporte / Combustível', 'Educação / Propinas', 'Saúde', 'Lazer', 'Outros']);

  const adicionarCategoria = (tipo, nome) => {
    if (tipo === 'entrada') setCategoriasEntradas([...categoriasEntradas, nome]);
    else setCategoriasSaidas([...categoriasSaidas, nome]);
    mostrarAlerta('Categoria Adicionada', `A categoria "${nome}" foi criada com sucesso.`, 'sucesso');
  };

  const removerCategoria = (tipo, nome) => {
    if (tipo === 'entrada') setCategoriasEntradas(categoriasEntradas.filter(c => c !== nome));
    else setCategoriasSaidas(categoriasSaidas.filter(c => c !== nome));
  };

  // Funções de Usuário e Notificações
  const atualizarUsuario = async (dados) => {
    if (!userId) return;
    try {
      const response = await apiFetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: dados.nome !== undefined ? dados.nome : usuario.nome,
          occupation: dados.profissao !== undefined ? dados.profissao : usuario.profissao,
          avatar_url: dados.foto !== undefined ? dados.foto : usuario.foto,
          newPassword: dados.novaSenha || ''
        })
      });

      if (!response.ok) throw new Error('Falha ao atualizar perfil');
      const data = await response.json();

      setUsuario(prev => ({
        ...prev,
        nome: data.user.name,
        profissao: data.user.occupation || '',
        foto: data.user.avatar_url || null,
        avatar: data.user.name ? data.user.name.charAt(0).toUpperCase() : prev.avatar,
        plan_type: data.user.plan_type,
        subscription_plan: data.user.subscription_plan || prev.subscription_plan,
        plan_expires_at: data.user.plan_expires_at || prev.plan_expires_at
      }));

      mostrarAlerta('Perfil Atualizado', 'As suas informações foram guardadas na base de dados com sucesso!', 'sucesso');
      if (dados.novaSenha) {
        mostrarAlerta('Segurança', 'A sua senha foi alterada.', 'sucesso');
      }
      return true;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível atualizar o perfil.', 'erro');
      return false;
    }
  };

  const adicionarNotificacao = (titulo, mensagem, tab = null) => {
    setNotificacoes(prev => [
      { id: Date.now(), titulo, mensagem, tab, lida: false, data: new Date().toISOString() },
      ...prev
    ]);
  };

  const upsertAssistantNotification = (unreadTotal, latestUnread) => {
    const subject = latestUnread?.subject ? `: ${latestUnread.subject}` : '';
    const mensagem = unreadTotal === 1
      ? `Tem 1 mensagem nova no Assistente${subject}.`
      : `Tem ${unreadTotal} mensagens novas no Assistente.`;

    setNotificacoes(prev => [
      {
        id: 'assistant-unread',
        titulo: 'Nova mensagem no Assistente',
        mensagem,
        tab: 'assistente',
        lida: false,
        data: new Date().toISOString()
      },
      ...prev.filter(notificacao => notificacao.id !== 'assistant-unread')
    ]);
  };

  const markAssistantNotificationRead = () => {
    setNotificacoes(prev => prev.map(notificacao => (
      notificacao.id === 'assistant-unread'
        ? { ...notificacao, lida: true }
        : notificacao
    )));
  };

  const [alertaGlobal, setAlertaGlobal] = useState(null);

  const mostrarAlerta = (titulo, mensagem, tipo = 'sucesso', registrarNotificacao = true) => {
    setAlertaGlobal({ titulo, mensagem, tipo });
    if (registrarNotificacao) {
      adicionarNotificacao(titulo, mensagem);
    }
  };

  const refreshAssistantSummary = async ({ notify = false } = {}) => {
    try {
      const response = await apiFetch('/api/assistant/conversations');
      if (response.status === 401 || response.status === 404) return;

      const data = await response.json();
      if (!response.ok) return;

      const conversations = data.conversations || [];
      const unreadTotal = conversations.reduce((total, item) => total + Number(item.unread_count || 0), 0);
      const latestUnread = conversations.find(item => Number(item.unread_count || 0) > 0) || null;

      setAssistantUnreadCount(unreadTotal);
      setAssistantLatestPreview(latestUnread ? {
        id: latestUnread.id,
        subject: latestUnread.subject,
        message: latestUnread.last_message || '',
        userName: latestUnread.user_name || ''
      } : null);

      if (
        unreadTotal > 0 &&
        (assistantInitialLoadRef.current || (notify && unreadTotal > assistantUnreadRef.current))
      ) {
        upsertAssistantNotification(unreadTotal, latestUnread);
      }

      if (unreadTotal === 0 && assistantUnreadRef.current > 0) {
        markAssistantNotificationRead();
      }

      assistantUnreadRef.current = unreadTotal;
      assistantInitialLoadRef.current = false;
    } catch (error) {
      console.warn('Erro ao verificar mensagens do assistente:', error);
    }
  };

  useEffect(() => {
    if (!userId) {
      setAssistantUnreadCount(0);
      setAssistantLatestPreview(null);
      assistantUnreadRef.current = 0;
      assistantInitialLoadRef.current = true;
      return undefined;
    }

    refreshAssistantSummary({ notify: false });
    const intervalId = setInterval(() => {
      refreshAssistantSummary({ notify: true });
    }, 20000);

    return () => clearInterval(intervalId);
  }, [userId]);

  const marcarNotificacaoLida = (id) => {
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const marcarTodasLidas = () => {
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  // Função para adicionar nova despesa E descontar do saldo
  const registrarDespesa = async (novaDespesa) => {
    if (!userId) return;

    try {
      const response = await apiFetch('/api/finances/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          accountId: novaDespesa.contaId,
          type: 'expense',
          category: novaDespesa.categoria,
          description: novaDespesa.descricao,
          amount: Number(novaDespesa.valor),
          transaction_date: novaDespesa.data || new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) throw new Error('Falha ao registar despesa');

      const despesaGravada = await response.json();

      const despesaFormatada = {
        id: despesaGravada.id,
        descricao: despesaGravada.description,
        valor: Number(despesaGravada.amount),
        contaId: despesaGravada.account_id,
        data: despesaGravada.transaction_date,
        categoria: despesaGravada.category,
        tipo_movimento: 'saida'
      };

      setDespesas([despesaFormatada, ...despesas]);

      setContas(contasAtuais =>
        contasAtuais.map(conta => {
          if (conta.id === novaDespesa.contaId) {
            return { ...conta, saldo: Number(conta.saldo) - Number(novaDespesa.valor) };
          }
          return conta;
        })
      );

      // Atualizar saldo total
      setSaldoTotal(prev => prev - Number(novaDespesa.valor));

      // Alerta de saldo baixo na conta após despesa
      const conta = contas.find(c => c.id === novaDespesa.contaId);
      if (conta && (Number(conta.saldo) - Number(novaDespesa.valor)) < 10000) {
        mostrarAlerta('Atenção ao Saldo!', `O saldo da conta ${conta.nome} está abaixo de 10.000 Kz após o pagamento de "${novaDespesa.descricao}".`, 'sucesso');
      }
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível registar a despesa na base de dados.', 'erro');
    }
  };

  // Função para adicionar receita
  const adicionarReceita = async (novaReceita) => {
    if (!userId) return;

    // Cálculo do Fundo de Desrascanço (5%)
    const valorOriginal = Number(novaReceita.valor);
    const valorCofre = valorOriginal * 0.05;
    const valorLiquido = valorOriginal - valorCofre;

    try {
      const response = await apiFetch('/api/finances/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          accountId: novaReceita.contaId,
          type: 'income',
          category: novaReceita.categoria || 'geral',
          description: novaReceita.descricao,
          amount: valorLiquido,
          transaction_date: novaReceita.data || new Date().toISOString().split('T')[0]
        })
      });

      if (!response.ok) throw new Error('Falha ao registar receita');

      const receitaGravada = await response.json();

      const receitaFormatada = {
        id: receitaGravada.id,
        descricao: receitaGravada.description,
        valor: Number(receitaGravada.amount),
        tipo_movimento: 'entrada',
        data: receitaGravada.transaction_date,
        categoria: receitaGravada.category
      };

      setReceitas([receitaFormatada, ...receitas]);

      // Atualizar saldo da conta com o valor líquido
      setContas(contasAtuais =>
        contasAtuais.map(conta => {
          if (conta.id === novaReceita.contaId) {
            return { ...conta, saldo: Number(conta.saldo) + valorLiquido };
          }
          return conta;
        })
      );

      setSaldoTotal(prev => prev + valorLiquido);

      // Injetar os 5% no Cofre de Emergência (Requereria API para Projetos, vamos manter local para o mock visual)
      setProjetos(projetosAtuais =>
        projetosAtuais.map(proj => {
          if (proj.id === 999) {
            return { ...proj, valorGuardado: Number(proj.valorGuardado) + valorCofre };
          }
          return proj;
        })
      );

      mostrarAlerta(
        'Receita Registada', `Foram recebidos ${valorLiquido} Kz. O sistema guardou automaticamente ${valorCofre} Kz (5%) no Cofre de Desrascanço.`
      );
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível registar a receita.', 'erro');
    }
  };

  // Automação: Verificar e depositar o Salário de 181.000 todo dia 6 (Apenas para Admin)
  useEffect(() => {
    // Apenas para administradores
    if (usuario?.plan_type !== 'admin') return;

    // Aguardar o carregamento das contas antes de tentar a automação
    if (isLoadingData || contas.length === 0) return;

    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const mesAnoStr = `${anoAtual}-${String(mesAtual).padStart(2, '0')}`;

    // Apenas deposita no dia exato (dia 6)
    if (diaAtual === 6) {
      const storageKey = `salario_depositado_${mesAnoStr}`;
      const jaDepositadoHoje = localStorage.getItem(storageKey);

      // Também verificamos no estado para segurança extra
      const salarioJaPago = receitas.some(r => r.categoria === 'salario' && r.data.startsWith(mesAnoStr));

      if (!salarioJaPago && !jaDepositadoHoje) {
        // Procurar a conta BAI pelo nome (case-insensitive)
        const contaBai = contas.find(c => c.nome.toLowerCase().includes('bai'));

        if (!contaBai) {
          // Conta BAI não encontrada — não é possível depositar automaticamente
          return;
        }

        // Marca logo no localStorage para evitar loop infinito de renderizações
        localStorage.setItem(storageKey, 'true');

        adicionarReceita({
          descricao: 'Salário Mensal',
          valor: 181000,
          contaId: contaBai.id,
          categoria: 'salario',
          data: `${mesAnoStr}-06`
        });
        mostrarAlerta('Salário Depositado! 💰', 'O seu salário de 181.000 Kz foi depositado automaticamente na sua conta Banco BAI.', 'sucesso');
      }
    }
  }, [receitas, contas, isLoadingData, usuario]);

  // Função para adicionar nova conta bancária
  const adicionarConta = async (novaConta) => {
    if (!userId) return;

    try {
      const response = await apiFetch('/api/finances/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: novaConta.nome,
          type: novaConta.tipo || 'bank',
          balance: Number(novaConta.saldo),
          currency: 'AOA',
          color_code: novaConta.cor || '#373392',
          iban: novaConta.iban || ''
        })
      });

      if (!response.ok) throw new Error('Falha ao criar conta');

      const contaGravada = await response.json();

      const contaFormatada = {
        id: contaGravada.id,
        nome: contaGravada.name,
        tipo: contaGravada.type,
        saldo: Number(contaGravada.balance),
        cor: contaGravada.color_code,
        iban: contaGravada.iban || ''
      };

      setContas([...contas, contaFormatada]);
      setSaldoTotal(prev => prev + contaFormatada.saldo);
      mostrarAlerta('Conta Adicionada', `A conta ${contaFormatada.nome} foi registada com sucesso.`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível criar a conta na base de dados.', 'erro');
    }
  };

  // Funções para Dívidas
  const adicionarDivida = async (novaDivida) => {
    if (!userId) return;
    try {
      const res = await apiFetch('/api/finances/debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          person_name: novaDivida.pessoa,
          type: novaDivida.tipo === 'a_receber' ? 'to_receive' : 'to_pay',
          amount: Number(novaDivida.valor),
          due_date: novaDivida.dataVencimento,
          purpose: novaDivida.finalidade
        })
      });
      if (!res.ok) throw new Error('Falha ao registar dívida');
      const data = await res.json();

      const dividaFormatada = {
        id: data.id,
        pessoa: data.person_name,
        tipo: data.type === 'to_receive' ? 'a_receber' : 'a_pagar',
        valor: Number(data.amount),
        finalidade: data.purpose || '',
        dataVencimento: data.due_date ? new Date(data.due_date).toISOString().split('T')[0] : '',
        paga: data.is_paid
      };

      setDividas([dividaFormatada, ...dividas]);
      mostrarAlerta('Nova Dívida Registada', `A dívida com ${dividaFormatada.pessoa} foi registada com sucesso.`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível criar a dívida.', 'erro');
    }
  };

  const liquidarDivida = async (dividaId, contaId) => {
    try {
      const res = await apiFetch(`/api/finances/debt/${dividaId}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: contaId })
      });
      if (!res.ok) throw new Error('Falha ao liquidar dívida');

      const divida = dividas.find(d => d.id === dividaId);

      setContas(contasAtuais =>
        contasAtuais.map(conta => {
          if (conta.id === contaId) {
            const valor = Number(divida.valor);
            const novoSaldo = divida.tipo === 'a_receber' ? Number(conta.saldo) + valor : Number(conta.saldo) - valor;
            return { ...conta, saldo: novoSaldo };
          }
          return conta;
        })
      );

      setDividas(dividasAtuais => dividasAtuais.map(d => d.id === dividaId ? { ...d, paga: true } : d));

      // Ajustar saldo total
      const ajusteSaldoTotal = divida.tipo === 'a_receber' ? Number(divida.valor) : -Number(divida.valor);
      setSaldoTotal(prev => prev + ajusteSaldoTotal);

      mostrarAlerta('Dívida Liquidada', `A dívida de Kz ${divida.valor.toLocaleString()} com ${divida.pessoa} foi liquidada!`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível liquidar a dívida.', 'erro');
    }
  };

  // Funções para Kixikila
  const adicionarKixikila = async (novaKixikila) => {
    if (!userId) return;
    try {
      const res = await apiFetch('/api/finances/kixikila', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: novaKixikila.nome,
          hand_value: Number(novaKixikila.valorQuota) * 5, // Mock: assumimos 5 membros
          quota_value: Number(novaKixikila.valorQuota),
          periodicity: novaKixikila.periodicidade,
          start_date: new Date().toISOString().split('T')[0]
        })
      });
      if (!res.ok) throw new Error('Falha ao registar kixikila');
      const data = await res.json();

      const kixiFormatada = {
        id: data.id,
        nome: data.name,
        membros: [],
        periodicidade: data.periodicity,
        minhaPosicao: 1,
        valorQuota: Number(data.quota_value),
        valorMao: Number(data.hand_value),
        proximaData: data.start_date
      };

      setKixikilas([kixiFormatada, ...kixikilas]);
      mostrarAlerta('Kixikila Criada', `O grupo "${kixiFormatada.nome}" foi criado com sucesso.`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível criar a kixikila.', 'erro');
    }
  };

  const receberMaoKixikila = async (kixikilaId, contaId) => {
    try {
      const res = await apiFetch(`/api/finances/kixikila/${kixikilaId}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: contaId })
      });
      if (!res.ok) throw new Error('Falha ao receber kixikila');

      const kixikila = kixikilas.find(k => k.id === kixikilaId);
      if (!kixikila) return;

      setContas(contasAtuais =>
        contasAtuais.map(conta => {
          if (conta.id === contaId) {
            return { ...conta, saldo: Number(conta.saldo) + Number(kixikila.valorMao) };
          }
          return conta;
        })
      );

      setSaldoTotal(prev => prev + Number(kixikila.valorMao));
      mostrarAlerta('Mão da Kixikila Recebida', `Recebeu a sua mão de Kz ${kixikila.valorMao.toLocaleString()} do grupo ${kixikila.nome}.`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível receber a mão.', 'erro');
    }
  };

  // Funções para Projetos
  const adicionarProjeto = async (novoProjeto) => {
    if (!userId) return;
    try {
      const res = await apiFetch('/api/finances/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: novoProjeto.nome,
          category: novoProjeto.categoria,
          target_amount: Number(novoProjeto.objetivo),
          saved_amount: Number(novoProjeto.valorGuardado),
          deadline: novoProjeto.prazo
        })
      });
      if (!res.ok) throw new Error('Falha ao registar projeto');
      const data = await res.json();

      const projetoFormatado = {
        id: data.id,
        nome: data.name,
        categoria: data.category,
        objetivo: Number(data.target_amount),
        valorGuardado: Number(data.saved_amount),
        prazo: data.deadline ? new Date(data.deadline).toISOString().split('T')[0] : ''
      };

      setProjetos([...projetos, projetoFormatado]);
      mostrarAlerta('Novo Projeto de Vida', `O projeto "${projetoFormatado.nome}" foi criado com sucesso. Foco no objetivo!`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível criar o projeto.', 'erro');
    }
  };

  const depositarProjeto = async (projetoId, contaId, montante) => {
    try {
      const res = await apiFetch(`/api/finances/project/${projetoId}/fund`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: contaId, amount: montante })
      });
      if (!res.ok) throw new Error('Falha ao financiar projeto');

      const projeto = projetos.find(p => p.id === projetoId);
      if (!projeto) return;

      // Atualiza o projeto
      setProjetos(projetosAtuais =>
        projetosAtuais.map(proj => {
          if (proj.id === projetoId) {
            return { ...proj, valorGuardado: Number(proj.valorGuardado) + Number(montante) };
          }
          return proj;
        })
      );

      // Deduz da conta bancária
      setContas(contasAtuais =>
        contasAtuais.map(conta => {
          if (conta.id === contaId) {
            return { ...conta, saldo: Number(conta.saldo) - Number(montante) };
          }
          return conta;
        })
      );

      setSaldoTotal(prev => prev - Number(montante));
      mostrarAlerta('Depósito Efetuado', `Kz ${montante.toLocaleString()} foram adicionados ao projeto "${projeto.nome}".`);
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível depositar no projeto.', 'erro');
    }
  };

  // Funções para Divisas
  const adicionarDivisa = async (novaDivisa) => {
    if (!userId) return;
    try {
      const res = await apiFetch('/api/finances/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          accountId: novaDivisa.contaId,
          currency: novaDivisa.moeda,
          amount_bought: Number(novaDivisa.montante),
          exchange_rate: Number(novaDivisa.taxaCompra)
        })
      });
      if (!res.ok) throw new Error('Falha ao comprar divisas');
      const data = await res.json();

      const divisaFormatada = {
        id: data.id,
        moeda: data.currency,
        montante: Number(data.amount_bought),
        taxaCompra: Number(data.exchange_rate),
        data: data.purchase_date
      };

      setDivisas([divisaFormatada, ...divisas]);

      setContas(contasAtuais =>
        contasAtuais.map(conta => {
          if (conta.id === novaDivisa.contaId) {
            return { ...conta, saldo: Number(conta.saldo) - Number(data.total_spent_aoa) };
          }
          return conta;
        })
      );

      setSaldoTotal(prev => prev - Number(data.total_spent_aoa));
      mostrarAlerta('Divisas Compradas', `Comprou ${divisaFormatada.montante} ${divisaFormatada.moeda} com sucesso.`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível comprar divisas.', 'erro');
    }
  };

  // Funções para Pagamentos Fixos
  const adicionarPagamentoFixo = async (novo) => {
    if (!userId) return;
    try {
      const res = await apiFetch('/api/finances/fixed-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: novo.nome,
          category: novo.categoria,
          amount: Number(novo.valor),
          due_day: Number(novo.diaVencimento)
        })
      });
      if (!res.ok) throw new Error('Falha ao registar pagamento fixo');
      const data = await res.json();

      const fixoFormatado = {
        id: data.id,
        nome: data.name,
        categoria: data.category,
        valor: Number(data.amount),
        diaVencimento: data.due_day,
        pagoEsteMes: data.is_paid_this_month
      };

      setPagamentosFixos([fixoFormatado, ...pagamentosFixos]);
      mostrarAlerta('Pagamento Agendado', `Lembrete criado para "${fixoFormatado.nome}" dia ${fixoFormatado.diaVencimento}.`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível registar o pagamento fixo.', 'erro');
    }
  };

  const marcarPagamentoFixoComoPago = async (id, contaId) => {
    // Usamos a primeira conta por defeito no UI, caso não seja passada a contaId explicitamente no contexto desta chamada
    const targetAccountId = contaId || contas[0]?.id;
    if (!targetAccountId) {
      mostrarAlerta('Atenção', 'Nenhuma conta bancária disponível para pagamento.', 'sucesso');
      return;
    }

    try {
      const res = await apiFetch(`/api/finances/fixed-payment/${id}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: targetAccountId })
      });
      if (!res.ok) throw new Error('Falha ao pagar pagamento fixo');

      const fixo = pagamentosFixos.find(p => p.id === id);

      // Marca como pago no state
      setPagamentosFixos(atuais => atuais.map(p => p.id === id ? { ...p, pagoEsteMes: true } : p));

      // Subtrai da conta
      setContas(contasAtuais =>
        contasAtuais.map(conta => {
          if (conta.id === targetAccountId) {
            return { ...conta, saldo: Number(conta.saldo) - Number(fixo.valor) };
          }
          return conta;
        })
      );

      setSaldoTotal(prev => prev - Number(fixo.valor));
      mostrarAlerta('Pagamento Realizado', `O pagamento fixo de ${fixo.nome} foi liquidado.`, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', 'Não foi possível efetuar o pagamento.', 'erro');
    }
  };

  // Funções para Orçamento Familiar
  const carregarOrcamentos = async (mes) => {
    if (!userId) return [];

    try {
      const query = mes ? `?month=${encodeURIComponent(mes)}` : '';
      const res = await apiFetch(`/api/finances/${userId}/budgets${query}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao carregar orçamentos');
      }

      const lista = data.budgets || [];
      setOrcamentos(lista);
      return lista;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível carregar os orçamentos.', 'erro');
      return [];
    }
  };

  const guardarOrcamento = async ({ categoria, limite, mes }) => {
    if (!userId) return null;

    try {
      const res = await apiFetch('/api/finances/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          category: categoria,
          month: mes,
          monthlyLimit: Number(limite)
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao guardar orçamento');
      }

      setOrcamentos(atuais => {
        const existe = atuais.some(item => item.id === data.id);
        if (existe) {
          return atuais.map(item => item.id === data.id ? data : item);
        }

        return [...atuais.filter(item => !(item.categoria === data.categoria && item.mes === data.mes)), data]
          .sort((a, b) => a.categoria.localeCompare(b.categoria));
      });
      mostrarAlerta('Orçamento Guardado', `Limite de ${data.categoria} atualizado com sucesso.`, 'sucesso');
      return data;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível guardar o orçamento.', 'erro');
      return null;
    }
  };

  const eliminarOrcamento = async (id) => {
    try {
      const res = await apiFetch(`/api/finances/budget/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao eliminar orçamento');
      }

      setOrcamentos(atuais => atuais.filter(item => item.id !== id));
      mostrarAlerta('Orçamento Eliminado', 'O limite da categoria foi removido.', 'sucesso');
      return true;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível eliminar o orçamento.', 'erro');
      return false;
    }
  };

  const carregarCalendarioFinanceiro = async (mes) => {
    if (!userId) return { month: mes || '', events: [], summary: null };

    try {
      const query = mes ? `?month=${encodeURIComponent(mes)}` : '';
      const res = await apiFetch(`/api/finances/${userId}/calendar${query}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao carregar calendário financeiro');
      }

      const payload = {
        month: data.month || mes || '',
        events: data.events || [],
        summary: data.summary || null
      };

      setCalendarioFinanceiro(payload);
      return payload;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível carregar o calendário financeiro.', 'erro');
      return { month: mes || '', events: [], summary: null };
    }
  };

  const carregarPrevisaoEmergencia = async (mes) => {
    if (!userId) return { month: mes || '', forecast: null, emergency: null, access: null };

    try {
      const query = mes ? `?month=${encodeURIComponent(mes)}` : '';
      const res = await apiFetch(`/api/finances/${userId}/forecast${query}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao calcular previsão financeira');
      }

      const payload = {
        month: data.month || mes || '',
        forecast: data.forecast || null,
        emergency: data.emergency || null,
        access: data.access || null
      };

      setPrevisaoEmergencia(payload);
      return payload;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível calcular a previsão financeira.', 'erro');
      return { month: mes || '', forecast: null, emergency: null, access: null };
    }
  };

  // Funções de Gamificação

  const carregarListaCompras = async (mes) => {
    if (!userId) return { month: mes || '', lists: [], summary: null };

    try {
      const query = mes ? `?month=${encodeURIComponent(mes)}` : '';
      const res = await apiFetch(`/api/finances/${userId}/shopping-lists${query}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao carregar lista de compras');
      }

      const payload = {
        month: data.month || mes || '',
        lists: data.lists || [],
        summary: data.summary || null
      };

      setListaCompras(payload);
      return payload;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível carregar a lista de compras.', 'erro');
      return { month: mes || '', lists: [], summary: null };
    }
  };

  const criarListaCompras = async ({ nome, mes }) => {
    if (!userId) return null;

    try {
      const res = await apiFetch('/api/finances/shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: nome, month: mes })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao criar lista de compras');
      }

      await carregarListaCompras(mes);
      mostrarAlerta('Lista Criada', 'A lista de compras foi criada com sucesso.', 'sucesso');
      return data;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível criar a lista de compras.', 'erro');
      return null;
    }
  };

  const adicionarItemListaCompras = async (listaId, item, mes) => {
    try {
      const res = await apiFetch(`/api/finances/shopping-list/${listaId}/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.nome,
          category: item.categoria,
          quantity: Number(item.quantidade || 1),
          estimatedPrice: Number(item.precoEstimado || 0)
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao adicionar item');
      }

      await carregarListaCompras(mes);
      return data;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível adicionar o item.', 'erro');
      return null;
    }
  };

  const atualizarItemListaCompras = async (itemId, item, mes) => {
    try {
      const res = await apiFetch(`/api/finances/shopping-list-item/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.nome,
          category: item.categoria,
          quantity: Number(item.quantidade || 1),
          estimatedPrice: Number(item.precoEstimado || 0),
          isChecked: Boolean(item.comprado)
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao atualizar item');
      }

      await carregarListaCompras(mes);
      return data;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível atualizar o item.', 'erro');
      return null;
    }
  };

  const eliminarItemListaCompras = async (itemId, mes) => {
    try {
      const res = await apiFetch(`/api/finances/shopping-list-item/${itemId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao remover item');
      }

      await carregarListaCompras(mes);
      return true;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível remover o item.', 'erro');
      return false;
    }
  };

  const eliminarListaCompras = async (listaId, mes) => {
    try {
      const res = await apiFetch(`/api/finances/shopping-list/${listaId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao eliminar lista');
      }

      await carregarListaCompras(mes);
      mostrarAlerta('Lista Eliminada', 'A lista de compras foi removida.', 'sucesso');
      return true;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || 'Não foi possível eliminar a lista.', 'erro');
      return false;
    }
  };

  const resgatarPremium = async () => {
    if (!userId) return;
    try {
      const res = await apiFetch('/api/gamification/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Falha ao resgatar premium');
      }

      const data = await res.json();

      // Atualizar no contexto
      setUsuario(prev => ({ ...prev, plan_type: data.user.plan_type }));
      setYetoPoints(data.user.yeto_points);

      mostrarAlerta('Parabéns! 🎉', data.message, 'sucesso');
      return true;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Atenção', err.message, 'sucesso');
      return false;
    }
  };

  // --- EDIÇÃO E ELIMINAÇÃO ---
  const handleBackendOp = async (opName, fetchCall, successMsg) => {
    try {
      const res = await fetchCall();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Erro na operação: ${res.statusText}`);
      }
      await fetchUserData(userId); // Recarrega tudo
      if (successMsg) mostrarAlerta('Sucesso', successMsg, 'sucesso');
      return true;
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', err.message || `Não foi possível ${opName}.`, 'erro');
      return false;
    }
  };

  const editarTransacao = (id, dados) => handleBackendOp('editar transação', () => apiFetch(`/api/finances/transaction/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: dados.descricao,
      amount: Number(dados.valor),
      category: dados.categoria,
      transaction_date: dados.data,
      accountId: dados.contaId,
      type: dados.type || (dados.tipo_movimento === 'entrada' ? 'income' : 'expense')
    })
  }), 'Transação atualizada!');

  const eliminarTransacao = (id) => handleBackendOp('eliminar transação', () => apiFetch(`/api/finances/transaction/${id}`, { method: 'DELETE' }), 'Transação eliminada!');

  const editarConta = (id, dados) => handleBackendOp('editar conta', () => apiFetch(`/api/finances/account/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.nome,
      type: dados.tipo || 'bank',
      balance: Number(dados.saldo),
      iban: dados.iban || '',
      color_code: dados.cor || '#373392'
    })
  }), 'Conta atualizada!');

  const eliminarConta = (id) => handleBackendOp('eliminar conta', () => apiFetch(`/api/finances/account/${id}`, { method: 'DELETE' }), 'Conta eliminada!');

  const editarDivida = (id, dados) => handleBackendOp('editar dívida', () => apiFetch(`/api/finances/debt/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person_name: dados.pessoa,
      type: dados.tipo === 'a_receber' ? 'to_receive' : 'to_pay',
      amount: Number(dados.valor),
      due_date: dados.dataVencimento,
      purpose: dados.finalidade
    })
  }), 'Dívida atualizada!');

  const eliminarDivida = (id) => handleBackendOp('eliminar dívida', () => apiFetch(`/api/finances/debt/${id}`, { method: 'DELETE' }), 'Dívida eliminada!');

  const editarPagamentoFixo = (id, dados) => handleBackendOp('editar pagamento fixo', () => apiFetch(`/api/finances/fixed-payment/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.nome,
      amount: Number(dados.valor),
      due_day: Number(dados.diaVencimento),
      category: dados.categoria
    })
  }), 'Pagamento fixo atualizado!');

  const eliminarPagamentoFixo = (id) => handleBackendOp('eliminar pagamento fixo', () => apiFetch(`/api/finances/fixed-payment/${id}`, { method: 'DELETE' }), 'Pagamento fixo eliminado!');

  const editarProjeto = (id, dados) => handleBackendOp('editar projeto', () => apiFetch(`/api/finances/project/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.nome,
      category: dados.categoria,
      target_amount: Number(dados.objetivo),
      saved_amount: Number(dados.valorGuardado || 0),
      deadline: dados.prazo
    })
  }), 'Projeto atualizado!');

  const eliminarProjeto = (id) => handleBackendOp('eliminar projeto', () => apiFetch(`/api/finances/project/${id}`, { method: 'DELETE' }), 'Projeto eliminado!');

  const editarKixikila = (id, dados) => handleBackendOp('editar kixikila', () => apiFetch(`/api/finances/kixikila/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.nome,
      periodicity: dados.periodicidade,
      quota_value: Number(dados.valorQuota),
      hand_value: Number(dados.valorQuota) * 5
    })
  }), 'Kixikila atualizada!');

  const eliminarKixikila = (id) => handleBackendOp('eliminar kixikila', () => apiFetch(`/api/finances/kixikila/${id}`, { method: 'DELETE' }), 'Kixikila eliminada!');

  // Mesclar despesas e receitas para o histórico geral ordenado por data
  const movimentos = [...despesas, ...receitas].sort((a, b) => new Date(b.data) - new Date(a.data));

  return (
    <FinanceContext.Provider value={{
      usuario, atualizarUsuario,
      notificacoes, adicionarNotificacao, marcarNotificacaoLida, marcarTodasLidas,
      assistantUnreadCount, assistantLatestPreview, refreshAssistantSummary,
      alertaGlobal, setAlertaGlobal, mostrarAlerta,
      editarTransacao, eliminarTransacao,
      editarConta, eliminarConta,
      editarDivida, eliminarDivida,
      editarPagamentoFixo, eliminarPagamentoFixo,
      editarProjeto, eliminarProjeto,
      editarKixikila, eliminarKixikila,
      contas, despesas, dividas, kixikilas, projetos, receitas, movimentos, divisas, orcamentos, calendarioFinanceiro, previsaoEmergencia, listaCompras, pagamentosFixos,
      categoriasEntradas, categoriasSaidas, adicionarCategoria, removerCategoria,
      registrarDespesa, adicionarReceita, adicionarConta,
      adicionarDivida, liquidarDivida,
      adicionarKixikila, receberMaoKixikila,
      adicionarProjeto, depositarProjeto, adicionarDivisa,
      carregarOrcamentos, guardarOrcamento, eliminarOrcamento,
      carregarCalendarioFinanceiro, carregarPrevisaoEmergencia,
      carregarListaCompras, criarListaCompras, adicionarItemListaCompras,
      atualizarItemListaCompras, eliminarItemListaCompras, eliminarListaCompras,
      adicionarPagamentoFixo, marcarPagamentoFixoComoPago,
      saldoTotal,
      yetoPoints, nivelAtual, desafiosAtivos, conquistas, completarDesafio, resgatarPremium, adicionarDesafio,
      isLoadingData
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  return useContext(FinanceContext);
}
