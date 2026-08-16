import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const primaryColor = [55, 51, 146]; // #373392
const accentColor = [255, 179, 0];  // #ffb300
const successColor = [16, 185, 129]; // #10b981
const dangerColor = [244, 91, 91];   // #f45b5b

export const generateTransactionsReport = (usuario, movimentos) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Yeto Finanças", 14, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Transações", pageWidth - 14, 25, { align: 'right' });

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Proprietário(a): ${usuario?.nome || 'Admin'}`, 14, 55);
  
  const dataAtual = new Date().toLocaleDateString('pt-AO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' });
  doc.setFont("helvetica", "normal");
  doc.text(`Data de Emissão: ${dataAtual}`, 14, 62);

  const movimentosTabelaData = movimentos.map(m => [
    m.data, m.descricao, m.categoria || m.tipo, m.tipo_movimento === 'entrada' ? 'Entrada' : 'Saída', `Kz ${m.valor.toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: 75,
    head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
    body: movimentosTabelaData.length > 0 ? movimentosTabelaData : [['Nenhum movimento registado.', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    styles: { font: 'helvetica', fontSize: 9 },
    alternateRowStyles: { fillColor: [249, 250, 253] },
    columnStyles: { 3: { fontStyle: 'bold' }, 4: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'Entrada') data.cell.styles.textColor = successColor;
        else if (data.cell.raw === 'Saída') data.cell.styles.textColor = dangerColor;
      }
      if (data.section === 'body' && data.column.index === 4 && movimentosTabelaData.length > 0) {
        data.cell.styles.textColor = data.row.raw[3] === 'Entrada' ? successColor : dangerColor;
      }
    }
  });

  doc.save(`Relatorio_Transacoes_${new Date().getTime()}.pdf`);
};

export const generateDebtsReport = (usuario, dividas) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Yeto Finanças", 14, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Dívidas", pageWidth - 14, 25, { align: 'right' });

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Proprietário(a): ${usuario?.nome || 'Admin'}`, 14, 55);
  
  const dataAtual = new Date().toLocaleDateString('pt-AO', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFont("helvetica", "normal");
  doc.text(`Data de Emissão: ${dataAtual}`, 14, 62);

  const dividasTabelaData = dividas.map(d => [
    d.nome, d.tipo === 'a_pagar' ? 'A Pagar (Eu devo)' : 'A Receber (Devem-me)', d.data_vencimento, `Kz ${d.valor.toLocaleString()}`, d.paga ? 'Liquidada' : 'Pendente'
  ]);

  autoTable(doc, {
    startY: 75,
    head: [['Entidade / Pessoa', 'Situação', 'Vencimento', 'Valor', 'Status']],
    body: dividasTabelaData.length > 0 ? dividasTabelaData : [['Nenhuma dívida registada.', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    styles: { font: 'helvetica', fontSize: 9 },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' }, 4: { fontStyle: 'bold' } },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 1 && dividasTabelaData.length > 0) {
        if (data.cell.raw.includes('Pagar')) data.cell.styles.textColor = dangerColor;
        else if (data.cell.raw.includes('Receber')) data.cell.styles.textColor = successColor;
      }
      if (data.section === 'body' && data.column.index === 4 && dividasTabelaData.length > 0) {
        if (data.cell.raw === 'Liquidada') data.cell.styles.textColor = successColor;
        else data.cell.styles.textColor = dangerColor;
      }
    }
  });

  doc.save(`Relatorio_Dividas_${new Date().getTime()}.pdf`);
};
