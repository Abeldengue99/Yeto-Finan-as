import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateProfessionalReport = (data) => {
  const { usuario, saldoTotal, receitasMes, despesasMes, movimentos, dividas, projetos } = data;
  
  // Criar um novo documento PDF em formato A4
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Cores do tema Yeto
  const primaryColor = [55, 51, 146]; // #373392
  const accentColor = [255, 179, 0];  // #ffb300
  const successColor = [16, 185, 129]; // #10b981
  const dangerColor = [244, 91, 91];   // #f45b5b
  
  // 1. Cabeçalho (Header)
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Yeto Finanças", 14, 25);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório Financeiro Confidencial", pageWidth - 14, 25, { align: 'right' });
  
  // 2. Informações Gerais do Relatório
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Proprietário(a): ${usuario.nome}`, 14, 55);
  
  const dataAtual = new Date().toLocaleDateString('pt-AO', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' 
  });
  doc.setFont("helvetica", "normal");
  doc.text(`Data de Emissão: ${dataAtual}`, 14, 62);
  doc.text(`E-mail: ${usuario.email}`, 14, 69);
  
  // 3. Resumo Financeiro (Caixas de Destaque)
  doc.setFillColor(245, 246, 250);
  doc.rect(14, 80, 55, 25, 'F');
  doc.rect(77, 80, 55, 25, 'F');
  doc.rect(140, 80, 55, 25, 'F');
  
  // Saldo
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SALDO ATUAL", 41.5, 90, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Kz ${saldoTotal.toLocaleString()}`, 41.5, 98, { align: 'center' });
  
  // Entradas
  doc.setTextColor(successColor[0], successColor[1], successColor[2]);
  doc.setFontSize(10);
  doc.text("ENTRADAS (MÊS)", 104.5, 90, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Kz ${receitasMes.toLocaleString()}`, 104.5, 98, { align: 'center' });
  
  // Saídas
  doc.setTextColor(dangerColor[0], dangerColor[1], dangerColor[2]);
  doc.setFontSize(10);
  doc.text("SAÍDAS (MÊS)", 167.5, 90, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Kz ${despesasMes.toLocaleString()}`, 167.5, 98, { align: 'center' });
  
  // 4. Últimos Movimentos (Tabela)
  let yPos = 120;
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Últimos Movimentos", 14, yPos);
  
  const movimentosTabelaData = movimentos.slice(0, 15).map(m => [
    m.data,
    m.descricao,
    m.categoria || m.tipo,
    m.tipo_movimento === 'entrada' ? 'Entrada' : 'Saída',
    `Kz ${m.valor.toLocaleString()}`
  ]);

  doc.autoTable({
    startY: yPos + 5,
    head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
    body: movimentosTabelaData.length > 0 ? movimentosTabelaData : [['Nenhum movimento registado.', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    styles: { font: 'helvetica', fontSize: 9 },
    alternateRowStyles: { fillColor: [249, 250, 253] },
    columnStyles: {
      3: { fontStyle: 'bold', textColor: [100, 100, 100] }, // Tipo
      4: { halign: 'right', fontStyle: 'bold' } // Valor
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'Entrada') {
          data.cell.styles.textColor = successColor;
        } else if (data.cell.raw === 'Saída') {
          data.cell.styles.textColor = dangerColor;
        }
      }
      if (data.section === 'body' && data.column.index === 4 && movimentosTabelaData.length > 0) {
        const isEntrada = data.row.raw[3] === 'Entrada';
        data.cell.styles.textColor = isEntrada ? successColor : dangerColor;
      }
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;
  
  // Verificar se há espaço para a próxima seção, se não, nova página
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }
  
  // 5. Resumo de Dívidas
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo de Dívidas e Empréstimos", 14, yPos);
  
  const dividasTabelaData = dividas.map(d => [
    d.nome,
    d.tipo === 'a_pagar' ? 'A Pagar (Eu devo)' : 'A Receber (Devem-me)',
    d.data_vencimento,
    `Kz ${d.valor.toLocaleString()}`
  ]);

  doc.autoTable({
    startY: yPos + 5,
    head: [['Entidade / Pessoa', 'Situação', 'Vencimento', 'Valor']],
    body: dividasTabelaData.length > 0 ? dividasTabelaData : [['Nenhuma dívida registada.', '', '', '']],
    theme: 'plain',
    headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50] },
    styles: { font: 'helvetica', fontSize: 9 },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' } // Valor
    },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw.includes('Pagar')) {
          data.cell.styles.textColor = dangerColor;
        } else if (data.cell.raw.includes('Receber')) {
          data.cell.styles.textColor = successColor;
        }
      }
    }
  });

  yPos = doc.lastAutoTable.finalY + 15;
  
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // 6. Projetos (Progresso)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Projetos de Vida (Progresso)", 14, yPos);
  
  const projetosTabelaData = projetos.map(p => {
    const percentagem = ((p.valorGuardado / p.objetivo) * 100).toFixed(1);
    return [
      p.nome,
      `Kz ${p.objetivo.toLocaleString()}`,
      `Kz ${p.valorGuardado.toLocaleString()}`,
      `${percentagem}% Concluído`
    ];
  });

  doc.autoTable({
    startY: yPos + 5,
    head: [['Projeto', 'Objetivo Total', 'Valor Guardado', 'Progresso']],
    body: projetosTabelaData.length > 0 ? projetosTabelaData : [['Nenhum projeto registado.', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: accentColor, textColor: 0 },
    styles: { font: 'helvetica', fontSize: 9 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { fontStyle: 'bold', halign: 'center' } 
    }
  });

  // Rodapé do Documento em todas as páginas
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Documento gerado automaticamente pelo sistema Yeto Finanças - Yeto.ao`, pageWidth / 2, 285, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, 285, { align: 'right' });
  }

  // Salvar o PDF
  doc.save(`Relatorio_Yeto_${usuario.nome.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
};
