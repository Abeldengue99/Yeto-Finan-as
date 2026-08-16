const fs = require('fs');
let content = fs.readFileSync('frontend/src/contexts/FinanceContext.jsx', 'utf8');

content = content.replace(/adicionarNotificacao\(([^,]+),\s*([^)]+)\)/g, (match, p1, p2) => {
  if (match.includes('titulo, mensagem')) return match; // ignora a assinatura e a chamada recursiva
  let tipo = p1.includes('Erro') ? "'erro'" : "'sucesso'";
  return `mostrarAlerta(${p1}, ${p2}, ${tipo})`;
});

fs.writeFileSync('frontend/src/contexts/FinanceContext.jsx', content);
console.log('Done!');
