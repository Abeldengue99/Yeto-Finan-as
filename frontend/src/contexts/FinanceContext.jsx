import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { apiFetch } from '../utils/api';
import {
  enqueueOfflineOperation,
  getBrowserOnlineStatus,
  getOfflineQueue,
  getOfflineQueueCount,
  isOfflineError,
  loadFinanceSnapshot,
  makeOfflineId,
  removeOfflineOperations,
  replaceOfflineQueue,
  saveFinanceSnapshot
} from '../utils/offlineSync';

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

function replaceOfflineRefs(value, idMap) {
  if (!value || Object.keys(idMap).length === 0) return value;

  if (typeof value === 'string') {
    return idMap[value] ?? value;
  }

  if (Array.isArray(value)) {
    return value.map(item => replaceOfflineRefs(item, idMap));
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceOfflineRefs(item, idMap)])
    );
  }

  return value;
}

function resolveOfflinePath(path, idMap) {
  return Object.entries(idMap).reduce(
    (resolvedPath, [temporaryId, realId]) => resolvedPath.replaceAll(temporaryId, String(realId)),
    path
  );
}

function resolveQueuedOperation(operation, idMap) {
  return {
    ...operation,
    path: resolveOfflinePath(operation.path, idMap),
    body: replaceOfflineRefs(operation.body || {}, idMap)
  };
}

function isSameMonthKey(dateValue, monthKey) {
  return String(dateValue || '').slice(0, 7) === monthKey;
}

function normalizeShoppingLists(lists = []) {
  return lists.map(list => {
    const itens = (list.itens || []).map(item => {
      const quantidade = Number(item.quantidade || 1);
      const precoEstimado = Number(item.precoEstimado || 0);
      const total = quantidade * precoEstimado;

      return {
        ...item,
        quantidade,
        precoEstimado,
        total
      };
    });

    return {
      ...list,
      itens,
      totalEstimado: itens.reduce((sum, item) => sum + Number(item.total || 0), 0)
    };
  });
}

function buildShoppingSummary(lists, monthKey, budgets, expenses) {
  const normalizedLists = normalizeShoppingLists(lists);
  const items = normalizedLists.flatMap(list => list.itens || []);
  const plannedByCategory = items.reduce((acc, item) => {
    const category = item.categoria || 'Sem categoria';
    acc[category] = (acc[category] || 0) + Number(item.total || 0);
    return acc;
  }, {});
  const monthExpenses = expenses.filter(item => isSameMonthKey(item.data, monthKey));
  const spentByCategory = monthExpenses.reduce((acc, item) => {
    const category = item.categoria || 'Sem categoria';
    acc[category] = (acc[category] || 0) + Number(item.valor || 0);
    return acc;
  }, {});
  const monthBudgets = budgets.filter(item => !item.mes || item.mes === monthKey);
  const budgetByCategory = monthBudgets.reduce((acc, item) => {
    acc[item.categoria] = Number(item.limite || 0);
    return acc;
  }, {});
  const categories = [...new Set([
    ...Object.keys(plannedByCategory),
    ...Object.keys(spentByCategory),
    ...Object.keys(budgetByCategory)
  ])].filter(Boolean);
  const categoryAnalysis = categories.map(category => {
    const budget = budgetByCategory[category] || 0;
    const spent = spentByCategory[category] || 0;
    const planned = plannedByCategory[category] || 0;
    const afterShopping = budget - spent - planned;
    const status = budget <= 0
      ? 'sem_orcamento'
      : afterShopping < 0
        ? 'excede'
        : afterShopping <= budget * 0.15
          ? 'apertado'
          : 'ok';

    return {
      categoria: category,
      orcamento: budget,
      jaGasto: spent,
      previstoLista: planned,
      saldoDepoisCompra: afterShopping,
      status
    };
  });
  const totalEstimated = normalizedLists.reduce((sum, list) => sum + Number(list.totalEstimado || 0), 0);
  const totalBudget = monthBudgets.reduce((sum, item) => sum + Number(item.limite || 0), 0);
  const totalSpent = monthExpenses.reduce((sum, item) => sum + Number(item.valor || 0), 0);

  return {
    lists: normalizedLists,
    summary: {
      totalEstimated,
      totalBudget,
      totalSpent,
      totalAvailable: totalBudget - totalSpent,
      afterShoppingBalance: totalBudget - totalSpent - totalEstimated,
      categoryAnalysis
    }
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
  const [isOnline, setIsOnline] = useState(() => getBrowserOnlineStatus());
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [offlineQueueItems, setOfflineQueueItems] = useState([]);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const offlineSyncingRef = useRef(false);

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
      setIsOnline(true);

      await saveFinanceSnapshot(uid, {
        accounts: data.accounts || [],
        saldoTotal: data.saldoTotal || 0,
        despesas: data.despesas || [],
        dividas: data.dividas || [],
        pagamentosFixos: data.pagamentosFixos || [],
        projetos: data.projetos || [],
        kixikilas: data.kixikilas || [],
        orcamentos: data.orcamentos || [],
        receitas: entradas,
        user: data.user || null
      });
      return { fromCache: false };

    } catch (err) {
      console.error('Erro ao buscar finanças:', err);
      const cached = await loadFinanceSnapshot(uid);

      if (cached) {
        setContas(cached.accounts || []);
        setSaldoTotal(cached.saldoTotal || 0);
        setDespesas(cached.despesas || []);
        setDividas(cached.dividas || []);
        setPagamentosFixos(cached.pagamentosFixos || []);
        setProjetos(cached.projetos || []);
        setKixikilas(cached.kixikilas || []);
        setOrcamentos(cached.orcamentos || []);
        setReceitas(cached.receitas || []);
        setIsOnline(false);

        if (cached.user) {
          const planAccess = getPlanAccess(cached.user);
          setUsuario(prev => ({
            ...prev,
            nome: cached.user.name || prev.nome,
            email: cached.user.email || prev.email,
            profissao: cached.user.occupation || prev.profissao,
            foto: cached.user.avatar_url || prev.foto,
            avatar: cached.user.name ? cached.user.name.charAt(0).toUpperCase() : prev.avatar,
            plan_type: cached.user.plan_type || prev.plan_type,
            subscription_plan: planAccess.subscription_plan,
            created_at: cached.user.created_at || prev.created_at,
            plan_expires_at: planAccess.planExpiresAt || prev.plan_expires_at,
            trialDaysLeft: planAccess.trialDaysLeft,
            isPremium: planAccess.isPremium,
            planExpired: planAccess.planExpired,
            isTrialActive: planAccess.isTrialActive,
            hasAnnualAccess: planAccess.hasAnnualAccess
          }));
        }

        mostrarAlerta('Modo offline', 'A mostrar os últimos dados guardados neste dispositivo.', 'aviso', false);
        return { fromCache: true };
      }

      mostrarAlerta('Erro', 'Não foi possível carregar os dados. Verifique a conexão.', 'erro');
      return { failed: true };
    }
  };

  const refreshOfflineQueueCount = async () => {
    if (!userId) {
      setOfflineQueueCount(0);
      return 0;
    }

    const queue = await getOfflineQueue(userId);
    setOfflineQueueItems(queue);
    setOfflineQueueCount(queue.length);
    return queue.length;
  };

  const syncOfflineQueue = async () => {
    if (!userId || offlineSyncingRef.current || !getBrowserOnlineStatus()) return;

    const queue = await getOfflineQueue(userId);
    setOfflineQueueItems(queue);
    setOfflineQueueCount(queue.length);
    if (queue.length === 0) return;

    offlineSyncingRef.current = true;
    setIsSyncingOffline(true);

    const remaining = [];
    const idMap = {};
    let syncedCount = 0;

    for (let index = 0; index < queue.length; index += 1) {
      const operation = queue[index];
      const resolvedOperation = resolveQueuedOperation(operation, idMap);

      try {
        const response = await apiFetch(resolvedOperation.path, {
          method: resolvedOperation.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resolvedOperation.body || {})
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          remaining.push(
            resolvedOperation,
            ...queue.slice(index + 1).map(item => resolveQueuedOperation(item, idMap))
          );
          break;
        }

        if (operation.localId && data?.id) {
          idMap[operation.localId] = data.id;
        }

        syncedCount += 1;
      } catch (error) {
        remaining.push(
          resolvedOperation,
          ...queue.slice(index + 1).map(item => resolveQueuedOperation(item, idMap))
        );
        break;
      }
    }

    await replaceOfflineQueue(userId, remaining);
    setOfflineQueueItems(remaining);
    setOfflineQueueCount(remaining.length);
    offlineSyncingRef.current = false;
    setIsSyncingOffline(false);

    if (syncedCount > 0) {
      const result = await fetchUserData(userId);
      if (!result?.fromCache && !result?.failed) {
        mostrarAlerta('Dados sincronizados', 'As alterações feitas offline foram enviadas com sucesso.', 'sucesso', false);
      }
    }
  };

  const queueOfflineOperation = async (operation) => {
    await enqueueOfflineOperation(userId, operation);
    await refreshOfflineQueueCount();
  };

  const showOfflineSaved = (message) => {
    mostrarAlerta('Guardado offline', message, 'aviso', false);
  };

  const updateShoppingListsLocal = (month, updater) => {
    setListaCompras(prev => {
      const monthKey = month || prev.month || new Date().toISOString().slice(0, 7);
      const currentLists = prev.lists || [];
      const nextLists = typeof updater === 'function' ? updater(currentLists) : currentLists;
      const built = buildShoppingSummary(nextLists, monthKey, orcamentos, despesas);

      return {
        month: monthKey,
        lists: built.lists,
        summary: built.summary
      };
    });
  };

  useEffect(() => {
    const updateNetworkStatus = () => {
      setIsOnline(getBrowserOnlineStatus());
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    refreshOfflineQueueCount();
  }, [userId]);

  useEffect(() => {
    if (isOnline) {
      syncOfflineQueue();
    }
  }, [isOnline, userId]);

  useEffect(() => {
    if (!userId || isLoadingData) return;

    saveFinanceSnapshot(userId, {
      accounts: contas,
      saldoTotal,
      despesas,
      dividas,
      pagamentosFixos,
      projetos,
      kixikilas,
      orcamentos,
      receitas,
      user: {
        name: usuario.nome,
        email: usuario.email,
        occupation: usuario.profissao,
        avatar_url: usuario.foto,
        plan_type: usuario.plan_type,
        subscription_plan: usuario.subscription_plan,
        created_at: usuario.created_at,
        plan_expires_at: usuario.plan_expires_at
      }
    }).catch(error => {
      console.warn('Nao foi possivel guardar o retrato offline.', error);
    });
  }, [
    userId,
    isLoadingData,
    contas,
    saldoTotal,
    despesas,
    dividas,
    pagamentosFixos,
    projetos,
    kixikilas,
    orcamentos,
    receitas,
    usuario
  ]);

  // Carregar dados reais do servidor
  useEffect(() => {
    if (userId) {
      setIsLoadingData(true);
      fetchUserData(userId)
        .then((result) => {
          if (!result?.fromCache && !result?.failed) {
            mostrarAlerta('Dados Sincronizados', 'Dados sincronizados com sucesso.', 'sucesso', false);
          }
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
      if (isOfflineError(err)) {
        const amount = Number(novaDespesa.valor || 0);
        const transactionDate = novaDespesa.data || new Date().toISOString().split('T')[0];
        const despesaOffline = {
          id: makeOfflineId('despesa'),
          descricao: novaDespesa.descricao,
          valor: amount,
          contaId: novaDespesa.contaId,
          data: transactionDate,
          categoria: novaDespesa.categoria,
          tipo_movimento: 'saida',
          offline: true,
          syncStatus: 'pending'
        };

        setDespesas(atuais => [despesaOffline, ...atuais]);
        setContas(contasAtuais =>
          contasAtuais.map(conta => (
            conta.id === novaDespesa.contaId
              ? { ...conta, saldo: Number(conta.saldo) - amount }
              : conta
          ))
        );
        setSaldoTotal(prev => prev - amount);

        await enqueueOfflineOperation(userId, {
          label: 'Despesa offline',
          path: '/api/finances/transaction',
          method: 'POST',
          body: {
            userId,
            accountId: novaDespesa.contaId,
            type: 'expense',
            category: novaDespesa.categoria,
            description: novaDespesa.descricao,
            amount,
            transaction_date: transactionDate
          }
        });
        await refreshOfflineQueueCount();
        mostrarAlerta('Guardado offline', 'A despesa foi guardada neste dispositivo e será sincronizada quando houver internet.', 'aviso', false);
        return;
      }

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
      if (isOfflineError(err)) {
        const transactionDate = novaReceita.data || new Date().toISOString().split('T')[0];
        const receitaOffline = {
          id: makeOfflineId('receita'),
          descricao: novaReceita.descricao,
          valor: valorLiquido,
          tipo_movimento: 'entrada',
          data: transactionDate,
          categoria: novaReceita.categoria || 'geral',
          offline: true,
          syncStatus: 'pending'
        };

        setReceitas(atuais => [receitaOffline, ...atuais]);
        setContas(contasAtuais =>
          contasAtuais.map(conta => (
            conta.id === novaReceita.contaId
              ? { ...conta, saldo: Number(conta.saldo) + valorLiquido }
              : conta
          ))
        );
        setSaldoTotal(prev => prev + valorLiquido);

        setProjetos(projetosAtuais =>
          projetosAtuais.map(proj => (
            proj.id === 999
              ? { ...proj, valorGuardado: Number(proj.valorGuardado) + valorCofre }
              : proj
          ))
        );

        await enqueueOfflineOperation(userId, {
          label: 'Receita offline',
          path: '/api/finances/transaction',
          method: 'POST',
          body: {
            userId,
            accountId: novaReceita.contaId,
            type: 'income',
            category: novaReceita.categoria || 'geral',
            description: novaReceita.descricao,
            amount: valorLiquido,
            transaction_date: transactionDate
          }
        });
        await refreshOfflineQueueCount();
        mostrarAlerta('Guardado offline', 'A receita foi guardada neste dispositivo e será sincronizada quando houver internet.', 'aviso', false);
        return;
      }

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
      if (isOfflineError(err)) {
        const localId = makeOfflineId('conta');
        const contaFormatada = {
          id: localId,
          nome: novaConta.nome,
          tipo: novaConta.tipo || 'bank',
          saldo: Number(novaConta.saldo || 0),
          cor: novaConta.cor || '#373392',
          iban: novaConta.iban || '',
          offline: true,
          syncStatus: 'pending'
        };

        setContas(atuais => [...atuais, contaFormatada]);
        setSaldoTotal(prev => prev + contaFormatada.saldo);
        await queueOfflineOperation({
          label: 'Conta offline',
          localId,
          resource: 'account',
          path: '/api/finances/account',
          method: 'POST',
          body: {
            userId,
            name: novaConta.nome,
            type: novaConta.tipo || 'bank',
            balance: Number(novaConta.saldo || 0),
            currency: 'AOA',
            color_code: novaConta.cor || '#373392',
            iban: novaConta.iban || ''
          }
        });
        showOfflineSaved('A conta foi guardada neste dispositivo e será sincronizada quando houver internet.');
        return contaFormatada;
      }

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
      if (isOfflineError(err)) {
        const localId = makeOfflineId('divida');
        const dividaFormatada = {
          id: localId,
          pessoa: novaDivida.pessoa,
          tipo: novaDivida.tipo === 'a_receber' ? 'a_receber' : 'a_pagar',
          valor: Number(novaDivida.valor || 0),
          finalidade: novaDivida.finalidade || '',
          dataVencimento: novaDivida.dataVencimento || '',
          paga: false,
          offline: true,
          syncStatus: 'pending'
        };

        setDividas(atuais => [dividaFormatada, ...atuais]);
        await queueOfflineOperation({
          label: 'Divida offline',
          localId,
          resource: 'debt',
          path: '/api/finances/debt',
          method: 'POST',
          body: {
            userId,
            person_name: novaDivida.pessoa,
            type: novaDivida.tipo === 'a_receber' ? 'to_receive' : 'to_pay',
            amount: Number(novaDivida.valor || 0),
            due_date: novaDivida.dataVencimento || null,
            purpose: novaDivida.finalidade || ''
          }
        });
        showOfflineSaved('A dívida foi guardada neste dispositivo e será sincronizada quando houver internet.');
        return dividaFormatada;
      }

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
      if (isOfflineError(err)) {
        const divida = dividas.find(d => d.id === dividaId);
        if (!divida) {
          mostrarAlerta('Erro', 'Dívida não encontrada para liquidar offline.', 'erro');
          return false;
        }

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
        setDividas(dividasAtuais => dividasAtuais.map(d => d.id === dividaId ? { ...d, paga: true, syncStatus: 'pending' } : d));
        setSaldoTotal(prev => prev + (divida.tipo === 'a_receber' ? Number(divida.valor) : -Number(divida.valor)));

        await queueOfflineOperation({
          label: 'Liquidacao de divida offline',
          resource: 'debt-payment',
          path: `/api/finances/debt/${dividaId}/pay`,
          method: 'PUT',
          body: { accountId: contaId }
        });
        showOfflineSaved('A liquidação da dívida foi guardada e será sincronizada quando houver internet.');
        return true;
      }

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
      if (isOfflineError(err)) {
        const localId = makeOfflineId('pagamento_fixo');
        const fixoFormatado = {
          id: localId,
          nome: novo.nome,
          categoria: novo.categoria,
          valor: Number(novo.valor || 0),
          diaVencimento: Number(novo.diaVencimento || 1),
          pagoEsteMes: false,
          offline: true,
          syncStatus: 'pending'
        };

        setPagamentosFixos(atuais => [fixoFormatado, ...atuais]);
        await queueOfflineOperation({
          label: 'Pagamento fixo offline',
          localId,
          resource: 'fixed-payment',
          path: '/api/finances/fixed-payment',
          method: 'POST',
          body: {
            userId,
            name: novo.nome,
            category: novo.categoria,
            amount: Number(novo.valor || 0),
            due_day: Number(novo.diaVencimento || 1)
          }
        });
        showOfflineSaved('O pagamento fixo foi guardado neste dispositivo e será sincronizado quando houver internet.');
        return fixoFormatado;
      }

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
      if (isOfflineError(err)) {
        const fixo = pagamentosFixos.find(p => p.id === id);
        if (!fixo) {
          mostrarAlerta('Erro', 'Pagamento fixo não encontrado para pagar offline.', 'erro');
          return false;
        }

        setPagamentosFixos(atuais => atuais.map(p => p.id === id ? { ...p, pagoEsteMes: true, syncStatus: 'pending' } : p));
        setContas(contasAtuais =>
          contasAtuais.map(conta => (
            conta.id === targetAccountId
              ? { ...conta, saldo: Number(conta.saldo) - Number(fixo.valor) }
              : conta
          ))
        );
        setSaldoTotal(prev => prev - Number(fixo.valor));

        await queueOfflineOperation({
          label: 'Pagamento fixo pago offline',
          resource: 'fixed-payment-pay',
          path: `/api/finances/fixed-payment/${id}/pay`,
          method: 'PUT',
          body: { accountId: targetAccountId }
        });
        showOfflineSaved('O pagamento fixo foi marcado como pago e será sincronizado quando houver internet.');
        return true;
      }

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
      if (isOfflineError(err)) {
        const fallback = mes ? orcamentos.filter(item => item.mes === mes) : orcamentos;
        setIsOnline(false);
        return fallback;
      }

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
      if (isOfflineError(err)) {
        const existing = orcamentos.find(item => item.categoria === categoria && item.mes === mes);
        const localBudget = {
          id: existing?.id || makeOfflineId('orcamento'),
          categoria,
          mes,
          limite: Number(limite || 0),
          offline: true,
          syncStatus: 'pending'
        };

        setOrcamentos(atuais => [
          ...atuais.filter(item => !(item.categoria === categoria && item.mes === mes)),
          localBudget
        ].sort((a, b) => a.categoria.localeCompare(b.categoria)));
        await queueOfflineOperation({
          label: 'Orcamento offline',
          localId: String(localBudget.id).startsWith('offline_') ? localBudget.id : undefined,
          resource: 'budget',
          path: '/api/finances/budget',
          method: 'POST',
          body: {
            userId,
            category: categoria,
            month: mes,
            monthlyLimit: Number(limite || 0)
          }
        });
        showOfflineSaved('O orçamento foi guardado neste dispositivo e será sincronizado quando houver internet.');
        return localBudget;
      }

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
      if (isOfflineError(err)) {
        setOrcamentos(atuais => atuais.filter(item => item.id !== id));

        if (String(id).startsWith('offline_')) {
          await removeOfflineOperations(userId, operation => operation.localId === id);
        } else {
          await queueOfflineOperation({
            label: 'Eliminar orcamento offline',
            resource: 'budget-delete',
            path: `/api/finances/budget/${id}`,
            method: 'DELETE',
            body: {}
          });
        }

        await refreshOfflineQueueCount();
        showOfflineSaved('A eliminação do orçamento será sincronizada quando houver internet.');
        return true;
      }

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
      if (isOfflineError(err)) {
        setIsOnline(false);
        if (!mes || listaCompras.month === mes) {
          return listaCompras;
        }

        return {
          month: mes || '',
          lists: [],
          summary: buildShoppingSummary([], mes || '', orcamentos, despesas).summary
        };
      }

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
      if (isOfflineError(err)) {
        const localId = makeOfflineId('lista');
        const localList = {
          id: localId,
          nome,
          mes,
          totalEstimado: 0,
          itens: [],
          offline: true,
          syncStatus: 'pending'
        };

        updateShoppingListsLocal(mes, lists => [localList, ...lists]);
        await queueOfflineOperation({
          label: 'Lista de compras offline',
          localId,
          resource: 'shopping-list',
          path: '/api/finances/shopping-list',
          method: 'POST',
          body: { userId, name: nome, month: mes }
        });
        showOfflineSaved('A lista de compras foi guardada e será sincronizada quando houver internet.');
        return localList;
      }

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
      if (isOfflineError(err)) {
        const localId = makeOfflineId('item_lista');
        const itemFormatado = {
          id: localId,
          nome: item.nome,
          categoria: item.categoria,
          quantidade: Number(item.quantidade || 1),
          precoEstimado: Number(item.precoEstimado || 0),
          total: Number(item.quantidade || 1) * Number(item.precoEstimado || 0),
          comprado: false,
          offline: true,
          syncStatus: 'pending'
        };

        updateShoppingListsLocal(mes, lists => lists.map(list => (
          list.id === listaId
            ? { ...list, itens: [...(list.itens || []), itemFormatado] }
            : list
        )));
        await queueOfflineOperation({
          label: 'Item de lista offline',
          localId,
          resource: 'shopping-list-item',
          path: `/api/finances/shopping-list/${listaId}/item`,
          method: 'POST',
          body: {
            name: item.nome,
            category: item.categoria,
            quantity: Number(item.quantidade || 1),
            estimatedPrice: Number(item.precoEstimado || 0)
          }
        });
        showOfflineSaved('O item foi guardado e será sincronizado quando houver internet.');
        return itemFormatado;
      }

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
      if (isOfflineError(err)) {
        const itemAtualizado = {
          id: itemId,
          nome: item.nome,
          categoria: item.categoria,
          quantidade: Number(item.quantidade || 1),
          precoEstimado: Number(item.precoEstimado || 0),
          total: Number(item.quantidade || 1) * Number(item.precoEstimado || 0),
          comprado: Boolean(item.comprado),
          offline: true,
          syncStatus: 'pending'
        };

        updateShoppingListsLocal(mes, lists => lists.map(list => ({
          ...list,
          itens: (list.itens || []).map(currentItem => (
            currentItem.id === itemId ? { ...currentItem, ...itemAtualizado } : currentItem
          ))
        })));
        await queueOfflineOperation({
          label: 'Atualizar item de lista offline',
          resource: 'shopping-list-item-update',
          path: `/api/finances/shopping-list-item/${itemId}`,
          method: 'PUT',
          body: {
            name: item.nome,
            category: item.categoria,
            quantity: Number(item.quantidade || 1),
            estimatedPrice: Number(item.precoEstimado || 0),
            isChecked: Boolean(item.comprado)
          }
        });
        return itemAtualizado;
      }

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
      if (isOfflineError(err)) {
        updateShoppingListsLocal(mes, lists => lists.map(list => ({
          ...list,
          itens: (list.itens || []).filter(item => item.id !== itemId)
        })));

        if (String(itemId).startsWith('offline_')) {
          await removeOfflineOperations(userId, operation => operation.localId === itemId || operation.path?.includes(String(itemId)));
        } else {
          await queueOfflineOperation({
            label: 'Eliminar item de lista offline',
            resource: 'shopping-list-item-delete',
            path: `/api/finances/shopping-list-item/${itemId}`,
            method: 'DELETE',
            body: {}
          });
        }

        await refreshOfflineQueueCount();
        showOfflineSaved('A remoção do item será sincronizada quando houver internet.');
        return true;
      }

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
      if (isOfflineError(err)) {
        updateShoppingListsLocal(mes, lists => lists.filter(list => list.id !== listaId));

        if (String(listaId).startsWith('offline_')) {
          await removeOfflineOperations(userId, operation => operation.localId === listaId || operation.path?.includes(String(listaId)));
        } else {
          await queueOfflineOperation({
            label: 'Eliminar lista de compras offline',
            resource: 'shopping-list-delete',
            path: `/api/finances/shopping-list/${listaId}`,
            method: 'DELETE',
            body: {}
          });
        }

        await refreshOfflineQueueCount();
        showOfflineSaved('A eliminação da lista será sincronizada quando houver internet.');
        return true;
      }

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
  const handleBackendOp = async (opName, fetchCall, successMsg, offlineFallback) => {
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
      if (offlineFallback && isOfflineError(err)) {
        return offlineFallback();
      }

      mostrarAlerta('Erro', err.message || `Não foi possível ${opName}.`, 'erro');
      return false;
    }
  };

  const removeLocalPending = async (id) => {
    await removeOfflineOperations(userId, operation => (
      operation.localId === id ||
      operation.path?.includes(String(id)) ||
      JSON.stringify(operation.body || {}).includes(String(id))
    ));
    await refreshOfflineQueueCount();
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
  }), 'Transação atualizada!', async () => {
    const original = [...despesas, ...receitas].find(item => item.id === id);
    if (!original) return false;

    const originalAccountId = original.contaId || original.account_id || dados.contaId;
    const oldImpact = original.tipo_movimento === 'entrada' ? Number(original.valor || 0) : -Number(original.valor || 0);
    const nextType = dados.type || (dados.tipo_movimento === 'entrada' ? 'income' : 'expense');
    const nextTipoMovimento = nextType === 'income' ? 'entrada' : 'saida';
    const nextImpact = nextTipoMovimento === 'entrada' ? Number(dados.valor || 0) : -Number(dados.valor || 0);
    const updated = {
      ...original,
      descricao: dados.descricao,
      valor: Number(dados.valor || 0),
      categoria: dados.categoria,
      data: dados.data,
      contaId: dados.contaId,
      tipo_movimento: nextTipoMovimento,
      offline: true,
      syncStatus: 'pending'
    };

    setDespesas(atuais => nextTipoMovimento === 'saida'
      ? [updated, ...atuais.filter(item => item.id !== id)]
      : atuais.filter(item => item.id !== id));
    setReceitas(atuais => nextTipoMovimento === 'entrada'
      ? [updated, ...atuais.filter(item => item.id !== id)]
      : atuais.filter(item => item.id !== id));
    setContas(atuais => atuais.map(conta => {
      let saldo = Number(conta.saldo || 0);
      if (conta.id === originalAccountId) saldo -= oldImpact;
      if (conta.id === dados.contaId) saldo += nextImpact;
      return { ...conta, saldo };
    }));
    setSaldoTotal(prev => prev - oldImpact + nextImpact);

    await queueOfflineOperation({
      label: 'Editar transação offline',
      resource: 'transaction-update',
      path: `/api/finances/transaction/${id}`,
      method: 'PUT',
      body: {
        description: dados.descricao,
        amount: Number(dados.valor || 0),
        category: dados.categoria,
        transaction_date: dados.data,
        accountId: dados.contaId,
        type: nextType
      }
    });
    showOfflineSaved('A alteração da transação será sincronizada quando houver internet.');
    return true;
  });

  const eliminarTransacao = (id) => handleBackendOp('eliminar transação', () => apiFetch(`/api/finances/transaction/${id}`, { method: 'DELETE' }), 'Transação eliminada!', async () => {
    const original = [...despesas, ...receitas].find(item => item.id === id);
    if (!original) return false;

    const originalAccountId = original.contaId || original.account_id;
    const impact = original.tipo_movimento === 'entrada' ? Number(original.valor || 0) : -Number(original.valor || 0);
    setDespesas(atuais => atuais.filter(item => item.id !== id));
    setReceitas(atuais => atuais.filter(item => item.id !== id));
    setContas(atuais => atuais.map(conta => (
      conta.id === originalAccountId ? { ...conta, saldo: Number(conta.saldo || 0) - impact } : conta
    )));
    setSaldoTotal(prev => prev - impact);

    if (String(id).startsWith('offline_')) {
      await removeLocalPending(id);
    } else {
      await queueOfflineOperation({
        label: 'Eliminar transação offline',
        resource: 'transaction-delete',
        path: `/api/finances/transaction/${id}`,
        method: 'DELETE',
        body: {}
      });
    }
    showOfflineSaved('A eliminação da transação será sincronizada quando houver internet.');
    return true;
  });

  const editarConta = (id, dados) => handleBackendOp('editar conta', () => apiFetch(`/api/finances/account/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.nome,
      type: dados.tipo || 'bank',
      balance: Number(dados.saldo),
      iban: dados.iban || '',
      color_code: dados.cor || '#373392'
    })
  }), 'Conta atualizada!', async () => {
    const conta = contas.find(item => item.id === id);
    const oldBalance = Number(conta?.saldo || 0);
    const nextBalance = Number(dados.saldo || 0);

    setContas(atuais => atuais.map(item => item.id === id ? {
      ...item,
      nome: dados.nome,
      tipo: dados.tipo || item.tipo || 'bank',
      saldo: nextBalance,
      iban: dados.iban || '',
      cor: dados.cor || item.cor || '#373392',
      offline: true,
      syncStatus: 'pending'
    } : item));
    setSaldoTotal(prev => prev - oldBalance + nextBalance);

    await queueOfflineOperation({
      label: 'Editar conta offline',
      resource: 'account-update',
      path: `/api/finances/account/${id}`,
      method: 'PUT',
      body: {
        name: dados.nome,
        type: dados.tipo || 'bank',
        balance: nextBalance,
        iban: dados.iban || '',
        color_code: dados.cor || '#373392'
      }
    });
    showOfflineSaved('A alteração da conta será sincronizada quando houver internet.');
    return true;
  });

  const eliminarConta = (id) => handleBackendOp('eliminar conta', () => apiFetch(`/api/finances/account/${id}`, { method: 'DELETE' }), 'Conta eliminada!', async () => {
    const conta = contas.find(item => item.id === id);
    setContas(atuais => atuais.filter(item => item.id !== id));
    setSaldoTotal(prev => prev - Number(conta?.saldo || 0));

    if (String(id).startsWith('offline_')) {
      await removeLocalPending(id);
    } else {
      await queueOfflineOperation({
        label: 'Eliminar conta offline',
        resource: 'account-delete',
        path: `/api/finances/account/${id}`,
        method: 'DELETE',
        body: {}
      });
    }
    showOfflineSaved('A eliminação da conta será sincronizada quando houver internet.');
    return true;
  });

  const editarDivida = (id, dados) => handleBackendOp('editar dívida', () => apiFetch(`/api/finances/debt/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      person_name: dados.pessoa,
      type: dados.tipo === 'a_receber' ? 'to_receive' : 'to_pay',
      amount: Number(dados.valor),
      due_date: dados.dataVencimento,
      purpose: dados.finalidade
    })
  }), 'Dívida atualizada!', async () => {
    setDividas(atuais => atuais.map(item => item.id === id ? {
      ...item,
      pessoa: dados.pessoa,
      tipo: dados.tipo,
      valor: Number(dados.valor || 0),
      dataVencimento: dados.dataVencimento,
      finalidade: dados.finalidade,
      offline: true,
      syncStatus: 'pending'
    } : item));
    await queueOfflineOperation({
      label: 'Editar dívida offline',
      resource: 'debt-update',
      path: `/api/finances/debt/${id}`,
      method: 'PUT',
      body: {
        person_name: dados.pessoa,
        type: dados.tipo === 'a_receber' ? 'to_receive' : 'to_pay',
        amount: Number(dados.valor || 0),
        due_date: dados.dataVencimento,
        purpose: dados.finalidade
      }
    });
    showOfflineSaved('A alteração da dívida será sincronizada quando houver internet.');
    return true;
  });

  const eliminarDivida = (id) => handleBackendOp('eliminar dívida', () => apiFetch(`/api/finances/debt/${id}`, { method: 'DELETE' }), 'Dívida eliminada!', async () => {
    setDividas(atuais => atuais.filter(item => item.id !== id));
    if (String(id).startsWith('offline_')) {
      await removeLocalPending(id);
    } else {
      await queueOfflineOperation({
        label: 'Eliminar dívida offline',
        resource: 'debt-delete',
        path: `/api/finances/debt/${id}`,
        method: 'DELETE',
        body: {}
      });
    }
    showOfflineSaved('A eliminação da dívida será sincronizada quando houver internet.');
    return true;
  });

  const editarPagamentoFixo = (id, dados) => handleBackendOp('editar pagamento fixo', () => apiFetch(`/api/finances/fixed-payment/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.nome,
      amount: Number(dados.valor),
      due_day: Number(dados.diaVencimento),
      category: dados.categoria
    })
  }), 'Pagamento fixo atualizado!', async () => {
    setPagamentosFixos(atuais => atuais.map(item => item.id === id ? {
      ...item,
      nome: dados.nome,
      categoria: dados.categoria,
      valor: Number(dados.valor || 0),
      diaVencimento: Number(dados.diaVencimento || item.diaVencimento || 1),
      offline: true,
      syncStatus: 'pending'
    } : item));
    await queueOfflineOperation({
      label: 'Editar pagamento fixo offline',
      resource: 'fixed-payment-update',
      path: `/api/finances/fixed-payment/${id}`,
      method: 'PUT',
      body: {
        name: dados.nome,
        amount: Number(dados.valor || 0),
        due_day: Number(dados.diaVencimento || 1),
        category: dados.categoria
      }
    });
    showOfflineSaved('A alteração do pagamento fixo será sincronizada quando houver internet.');
    return true;
  });

  const eliminarPagamentoFixo = (id) => handleBackendOp('eliminar pagamento fixo', () => apiFetch(`/api/finances/fixed-payment/${id}`, { method: 'DELETE' }), 'Pagamento fixo eliminado!', async () => {
    setPagamentosFixos(atuais => atuais.filter(item => item.id !== id));
    if (String(id).startsWith('offline_')) {
      await removeLocalPending(id);
    } else {
      await queueOfflineOperation({
        label: 'Eliminar pagamento fixo offline',
        resource: 'fixed-payment-delete',
        path: `/api/finances/fixed-payment/${id}`,
        method: 'DELETE',
        body: {}
      });
    }
    showOfflineSaved('A eliminação do pagamento fixo será sincronizada quando houver internet.');
    return true;
  });

  const editarProjeto = (id, dados) => handleBackendOp('editar projeto', () => apiFetch(`/api/finances/project/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.nome,
      category: dados.categoria,
      target_amount: Number(dados.objetivo),
      saved_amount: Number(dados.valorGuardado || 0),
      deadline: dados.prazo
    })
  }), 'Projeto atualizado!', async () => {
    setProjetos(atuais => atuais.map(item => item.id === id ? {
      ...item,
      nome: dados.nome,
      categoria: dados.categoria,
      objetivo: Number(dados.objetivo || 0),
      valorGuardado: Number(dados.valorGuardado || 0),
      prazo: dados.prazo,
      offline: true,
      syncStatus: 'pending'
    } : item));
    await queueOfflineOperation({
      label: 'Editar projeto offline',
      resource: 'project-update',
      path: `/api/finances/project/${id}`,
      method: 'PUT',
      body: {
        name: dados.nome,
        category: dados.categoria,
        target_amount: Number(dados.objetivo || 0),
        saved_amount: Number(dados.valorGuardado || 0),
        deadline: dados.prazo
      }
    });
    showOfflineSaved('A alteração do projeto será sincronizada quando houver internet.');
    return true;
  });

  const eliminarProjeto = (id) => handleBackendOp('eliminar projeto', () => apiFetch(`/api/finances/project/${id}`, { method: 'DELETE' }), 'Projeto eliminado!', async () => {
    setProjetos(atuais => atuais.filter(item => item.id !== id));
    if (String(id).startsWith('offline_')) {
      await removeLocalPending(id);
    } else {
      await queueOfflineOperation({
        label: 'Eliminar projeto offline',
        resource: 'project-delete',
        path: `/api/finances/project/${id}`,
        method: 'DELETE',
        body: {}
      });
    }
    showOfflineSaved('A eliminação do projeto será sincronizada quando houver internet.');
    return true;
  });

  const editarKixikila = (id, dados) => handleBackendOp('editar kixikila', () => apiFetch(`/api/finances/kixikila/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: dados.nome,
      periodicity: dados.periodicidade,
      quota_value: Number(dados.valorQuota),
      hand_value: Number(dados.valorQuota) * 5
    })
  }), 'Kixikila atualizada!', async () => {
    setKixikilas(atuais => atuais.map(item => item.id === id ? {
      ...item,
      nome: dados.nome,
      periodicidade: dados.periodicidade,
      valorQuota: Number(dados.valorQuota || 0),
      valorMao: Number(dados.valorQuota || 0) * 5,
      offline: true,
      syncStatus: 'pending'
    } : item));
    await queueOfflineOperation({
      label: 'Editar kixikila offline',
      resource: 'kixikila-update',
      path: `/api/finances/kixikila/${id}`,
      method: 'PUT',
      body: {
        name: dados.nome,
        periodicity: dados.periodicidade,
        quota_value: Number(dados.valorQuota || 0),
        hand_value: Number(dados.valorQuota || 0) * 5
      }
    });
    showOfflineSaved('A alteração da kixikila será sincronizada quando houver internet.');
    return true;
  });

  const eliminarKixikila = (id) => handleBackendOp('eliminar kixikila', () => apiFetch(`/api/finances/kixikila/${id}`, { method: 'DELETE' }), 'Kixikila eliminada!', async () => {
    setKixikilas(atuais => atuais.filter(item => item.id !== id));
    if (String(id).startsWith('offline_')) {
      await removeLocalPending(id);
    } else {
      await queueOfflineOperation({
        label: 'Eliminar kixikila offline',
        resource: 'kixikila-delete',
        path: `/api/finances/kixikila/${id}`,
        method: 'DELETE',
        body: {}
      });
    }
    showOfflineSaved('A eliminação da kixikila será sincronizada quando houver internet.');
    return true;
  });

  // Mesclar despesas e receitas para o histórico geral ordenado por data
  const movimentos = [...despesas, ...receitas].sort((a, b) => new Date(b.data) - new Date(a.data));

  return (
    <FinanceContext.Provider value={{
      usuario, atualizarUsuario,
      notificacoes, adicionarNotificacao, marcarNotificacaoLida, marcarTodasLidas,
      assistantUnreadCount, assistantLatestPreview, refreshAssistantSummary,
      alertaGlobal, setAlertaGlobal, mostrarAlerta,
      isOnline, offlineQueueCount, offlineQueueItems, isSyncingOffline, syncOfflineData: syncOfflineQueue,
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
