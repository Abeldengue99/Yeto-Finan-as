# 👑 Yeto Finanças - Gestão Financeira Familiar Inteligente

Bem-vindo ao **Yeto Finanças**, a plataforma angolana de gestão financeira pessoal e familiar desenhada com um design premium (Apple Glassmorphism), focada na organização das contas de casa e orientada pela Inteligência Artificial.

## 🌟 Funcionalidades Principais

- **Dashboard Integrado:** Visão geral rápida do Saldo Familiar, Dívidas a Pagar e Dinheiro a Receber.
- **Yeto AI (BETA):** O seu Conselheiro Financeiro alimentado por IA. Oferece conselhos dinâmicos e em tempo real baseados nos seus hábitos de consumo (ex: alertas de gastos excessivos, incentivos à poupança).
- **Gestão de Transações:** Registo de Despesas e Receitas com categorização rápida e intuitiva.
- **Controlo de Dívidas:** Mantenha um controlo rigoroso de quem lhe deve dinheiro e a quem deve pagar.
- **Gestão de Câmbio & Divisas:** Acompanhe os seus investimentos em Dólares e Euros e faça o câmbio fictício instantâneo.
- **Pagamentos Fixos:** Nunca mais se esqueça de pagar a prestação do colégio ou a conta de luz.
- **Projetos de Vida (Sonhos):** Defina objetivos (comprar carro, poupança para reforma) e acompanhe o progresso.
- **Kixikila Digital:** Organização de ciclos de Kixikila (poupança rotativa em grupo).
- **Gamificação & Desafios Familiares:** Transforme a poupança num jogo em equipa! Conclua missões (ex: "Semana sem fast food"), ganhe *YetoPoints* e resgate recompensas. **Inclui Criação de Desafios Personalizados**.
- **Relatórios Profissionais PDF:** Geração de relatórios de saúde financeira completos num clique (exclusivo Premium).
- **Modo Administrador (Sala de Máquinas):** Um painel exclusivo para gerir utilizadores, métricas de crescimento (MRR, conversões), aprovar pagamentos manuais via comprovativo, aceder a logs de sistema e ajustar definições globais.

## 🎨 Design System

O projeto foi construído seguindo o estilo visual **Apple Glassmorphism**:
- Blur e transparências elegantes (`backdrop-filter`).
- Paleta de cores forte e credível (Indigo `#373392` e Amarelo Dourado `#ffb300`).
- Micro-interações, hover effects suaves e responsividade total (*Mobile First* com Bottom Dock nativo).

## 🛠️ Arquitetura e Tecnologias

### Frontend
- **React (Vite):** Rápido, moderno e escalável.
- **Context API:** Gestão de estados globais de finanças (`FinanceContext`) e administração (`AdminContext`) sem dependência pesada de bibliotecas externas (como Redux).
- **Recharts:** Gráficos interativos de Despesas (PieChart) e Dívidas (BarChart).
- **jsPDF & jsPDF-AutoTable:** Geração profissional de documentos PDF no lado do cliente.

### Backend (Preparado para Integração)
- **Node.js + Express:** API REST para lidar com lógica de negócios, gestão de subscrições e autenticação.
- **Base de Dados:** Configuração estruturada para **PostgreSQL** com gestão rigorosa de utilizadores e transações financeiras.

## 🚀 Como Iniciar Localmente

### Pré-requisitos
- Node.js (v18+)
- PostgresSQL (se o backend estiver configurado localmente)

### Passos de Instalação

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/Abeldengue99/Yeto-Finan-as.git
   cd Yeto-Finan-as
   ```

2. **Iniciar o Backend:**
   ```bash
   cd backend
   npm install
   # Configure o seu .env com a string de conexão do Postgres e Porta (default: 3000)
   node index.js
   ```

3. **Iniciar o Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Aceda no navegador ao endereço fornecido pelo Vite (geralmente `http://localhost:5173`).

## 💎 Planos de Subscrição

O sistema já está preparado para a monetização com três planos:
1. **Essencial (Grátis):** 1 Mês Premium gratuito ao registar. Após isso, acesso restrito (sem relatórios PDF, Conselheiro IA e Gamificação).
2. **Semestral:** Acesso total por 4.999 Kz / 6 meses.
3. **Anual (Mais Popular):** Acesso total e ilimitado por 7.999 Kz / ano.

> As aprovações de pagamentos por transferência são validadas manualmente pelo painel do Administrador.

---
Desenvolvido com excelência técnica e foco na Integridade do Código.
