const fs = require('fs');
let content = fs.readFileSync('frontend/src/contexts/FinanceContext.jsx', 'utf8');

const functions = `
  // --- EDIÇÃO E ELIMINAÇÃO ---
  const handleBackendOp = async (opName, fetchCall, successMsg) => {
    try {
      const res = await fetchCall();
      if (!res.ok) throw new Error(\`Erro na operação: \${res.statusText}\`);
      await fetchUserData(userId); // Recarrega tudo
      if (successMsg) mostrarAlerta('Sucesso', successMsg, 'sucesso');
    } catch (err) {
      console.error(err);
      mostrarAlerta('Erro', \`Não foi possível \${opName}.\`, 'erro');
    }
  };

  const editarTransacao = (id, dados) => handleBackendOp('editar transação', () => fetch(\`/api/finances/transaction/\${id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }), 'Transação atualizada!');
  const eliminarTransacao = (id) => handleBackendOp('eliminar transação', () => fetch(\`/api/finances/transaction/\${id}\`, { method: 'DELETE' }), 'Transação eliminada!');

  const editarConta = (id, dados) => handleBackendOp('editar conta', () => fetch(\`/api/finances/account/\${id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }), 'Conta atualizada!');
  const eliminarConta = (id) => handleBackendOp('eliminar conta', () => fetch(\`/api/finances/account/\${id}\`, { method: 'DELETE' }), 'Conta eliminada!');

  const editarDivida = (id, dados) => handleBackendOp('editar dívida', () => fetch(\`/api/finances/debt/\${id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }), 'Dívida atualizada!');
  const eliminarDivida = (id) => handleBackendOp('eliminar dívida', () => fetch(\`/api/finances/debt/\${id}\`, { method: 'DELETE' }), 'Dívida eliminada!');

  const editarPagamentoFixo = (id, dados) => handleBackendOp('editar pagamento fixo', () => fetch(\`/api/finances/fixed-payment/\${id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }), 'Pagamento fixo atualizado!');
  const eliminarPagamentoFixo = (id) => handleBackendOp('eliminar pagamento fixo', () => fetch(\`/api/finances/fixed-payment/\${id}\`, { method: 'DELETE' }), 'Pagamento fixo eliminado!');

  const editarProjeto = (id, dados) => handleBackendOp('editar projeto', () => fetch(\`/api/finances/project/\${id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }), 'Projeto atualizado!');
  const eliminarProjeto = (id) => handleBackendOp('eliminar projeto', () => fetch(\`/api/finances/project/\${id}\`, { method: 'DELETE' }), 'Projeto eliminado!');

  const editarKixikila = (id, dados) => handleBackendOp('editar kixikila', () => fetch(\`/api/finances/kixikila/\${id}\`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }), 'Kixikila atualizada!');
  const eliminarKixikila = (id) => handleBackendOp('eliminar kixikila', () => fetch(\`/api/finances/kixikila/\${id}\`, { method: 'DELETE' }), 'Kixikila eliminada!');

`;

const returnIndex = content.lastIndexOf('return (');
content = content.slice(0, returnIndex) + functions + content.slice(returnIndex);

// Export no value do provider
const exportsString = `
      editarTransacao, eliminarTransacao,
      editarConta, eliminarConta,
      editarDivida, eliminarDivida,
      editarPagamentoFixo, eliminarPagamentoFixo,
      editarProjeto, eliminarProjeto,
      editarKixikila, eliminarKixikila,`;

content = content.replace(/value=\{\{/g, \`value={{\${exportsString}\`);

fs.writeFileSync('frontend/src/contexts/FinanceContext.jsx', content);
