import React, { useState } from 'react';
import Modal from './Modal';
import { useFinance } from '../contexts/FinanceContext';
import { apiFetch } from '../utils/api';

/**
 * Extrai texto de um ficheiro PDF usando pdfjs-dist (Mozilla).
 * Funciona 100% no browser, sem API externa.
 */
async function extractTextFromPdf(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Analisa o texto extraído de documentos financeiros angolanos.
 * Suporta:
 * - Comprovativos bancários (BAI, BFA, BIC, BPC)
 * - Extratos de conta com múltiplas transações
 * - Faturas de supermercado / recibos com vários itens
 */
function parseAngolanBankStatement(text) {
  // Normalizar o texto: remover espaços múltiplos e quebras de linha excessivas
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Detectar o tipo de documento e delegar ao parser correto
  const lowerText = normalizedText.toLowerCase();

  const isBankReceipt = lowerText.includes('dados do ordenante') ||
    lowerText.includes('dados do beneficiário') ||
    lowerText.includes('dados do beneficiario') ||
    lowerText.includes('tipo de movimento') ||
    lowerText.includes('comprovativo');

  const isBankStatement = lowerText.includes('extrato') ||
    lowerText.includes('saldo anterior') ||
    lowerText.includes('saldo inicial') ||
    lowerText.includes('saldo final');

  const isReceipt = lowerText.includes('fatura') ||
    lowerText.includes('factura') ||
    lowerText.includes('recibo') ||
    lowerText.includes('subtotal') ||
    lowerText.includes('total a pagar') ||
    lowerText.includes('iva') ||
    lowerText.includes('nif');

  let transactions = [];

  if (isBankReceipt) {
    transactions = parseBankReceipt(normalizedText);
  }

  if (isBankStatement) {
    transactions = [...transactions, ...parseBankStatement(normalizedText)];
  }

  if (isReceipt) {
    transactions = [...transactions, ...parseStoreReceipt(normalizedText)];
  }

  // Se nenhum parser específico encontrou dados, tentar o parser genérico
  if (transactions.length === 0) {
    transactions = parseGeneric(normalizedText);
  }

  return transactions;
}

/* ── Parser 1: Comprovativo bancário (uma transferência) ── */
function parseBankReceipt(text) {
  const transactions = [];

  // Extrair data
  let extractedDate = new Date().toISOString().slice(0, 10);
  const dateMatch = text.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i) ||
    text.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/);
  if (dateMatch) {
    const parts = dateMatch[1].split('/');
    extractedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // Extrair montante
  let extractedAmount = 0;
  const amountMatch = text.match(/Montante:\s*Kz\s*([\d\s.,]+)/i) ||
    text.match(/Valor:\s*Kz\s*([\d\s.,]+)/i) ||
    text.match(/Montante:\s*([\d\s.,]+)/i);
  if (amountMatch) {
    extractedAmount = parseAmount(amountMatch[1]);
  }

  // Extrair beneficiário
  const benefMatch = text.match(/BENEFICI[AÁ]RIO\s+Nome:\s*(.+?)(?:\s+Conta|\s+IBAN|\n)/is);
  const benefName = benefMatch ? benefMatch[1].trim() : '';

  // Extrair tipo de movimento
  const tipoMatch = text.match(/Tipo\s*de\s*Movimento:\s*(.+?)(?:\n|$)/i);
  const tipoDesc = tipoMatch ? tipoMatch[1].trim() : '';

  // Construir descrição
  let desc = benefName ? `Transferência para ${benefName}` : (tipoDesc || 'Transferência Bancária');

  if (extractedAmount > 0) {
    transactions.push({
      id: Math.random().toString(),
      data: extractedDate,
      descricao: desc,
      valor: extractedAmount,
      tipo: 'saida',
      categoria: '',
      contaId: '',
    });
  }

  return transactions;
}

/* ── Parser 2: Extrato bancário mensal (várias transações) ── */
function parseBankStatement(text) {
  const transactions = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Padrão: DD/MM/AAAA  Descrição  Valor  D/C
    const match = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d.,]+(?:\s[\d.,]+)?)\s*(D|C|Débito|Crédito|débito|crédito)/i);
    if (match) {
      const parts = match[1].split('/');
      const transDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      const desc = match[2].trim();
      const amount = parseAmount(match[3]);
      const tipo = (match[4].startsWith('D') || match[4].startsWith('d')) ? 'saida' : 'entrada';

      if (amount > 0 && desc.length > 1) {
        transactions.push({
          id: Math.random().toString(),
          data: transDate,
          descricao: desc,
          valor: amount,
          tipo: tipo,
          categoria: '',
          contaId: '',
        });
      }
    }
  }

  return transactions;
}

/* ── Parser 3: Fatura / Recibo de loja / Supermercado ── */
function parseStoreReceipt(text) {
  const transactions = [];

  // Extrair data da fatura
  let receiptDate = new Date().toISOString().slice(0, 10);
  const dateMatch = text.match(/Data:\s*(\d{2}[\/-]\d{2}[\/-]\d{4})/i) ||
    text.match(/(\d{2}\/\d{2}\/\d{4})/) ||
    text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const raw = dateMatch[1];
    const parts = raw.split(/[\/\-]/);
    if (parts[0].length === 4) {
      receiptDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
    } else {
      receiptDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  // Extrair nome da loja
  let storeName = '';
  const storePatterns = [
    /(?:Raz[ãa]o Social|Loja|Empresa|Estabelecimento):\s*(.+)/i,
    /^([A-Z][A-Z\s&.,]{3,40})$/m,
  ];
  for (const pat of storePatterns) {
    const m = text.match(pat);
    if (m) { storeName = m[1].trim(); break; }
  }

  const lines = text.split('\n');

  for (const line of lines) {
    // Ignorar linhas de total, subtotal, IVA, etc.
    if (/^(total|subtotal|sub-total|iva|imposto|desconto|troco|pago|pagamento|recebido)/i.test(line.trim())) continue;

    // Padrão 1: "Qty x Descrição ... Valor" ou "Descrição ... Valor"
    // Ex: "2 x Arroz Tio Patinhas 1kg     3.500,00"
    // Ex: "Leite Mimosa 1L                 1.200,00"
    const itemMatch = line.match(/^(?:(\d+)\s*[xX]\s+)?(.{3,50}?)\s{2,}([\d.,]+(?:\s[\d.,]+)?)\s*$/);
    if (itemMatch) {
      const qty = itemMatch[1] ? parseInt(itemMatch[1]) : 1;
      const desc = itemMatch[2].trim();
      const rawAmount = parseAmount(itemMatch[3]);

      // Filtrar linhas que não são itens (cabeçalhos, rodapés)
      if (rawAmount > 0 && desc.length > 2 && !/^(artigo|descri|quant|pre[çc]o|un\b|ref)/i.test(desc)) {
        const prefix = storeName ? `${storeName} - ` : '';
        transactions.push({
          id: Math.random().toString(),
          data: receiptDate,
          descricao: `${prefix}${desc}`,
          valor: rawAmount,
          tipo: 'saida',
          categoria: '',
          contaId: '',
        });
      }
    }

    // Padrão 2: Tabelas com separadores "|" ou tabs
    // Ex: "| Arroz | 2 | 1750.00 | 3500.00 |"
    const tableMatch = line.match(/\|?\s*(.{3,40}?)\s*\|\s*(\d+)\s*\|\s*([\d.,]+)\s*\|\s*([\d.,]+)\s*\|?/);
    if (tableMatch) {
      const desc = tableMatch[1].trim();
      const totalVal = parseAmount(tableMatch[4]);
      if (totalVal > 0 && !/^(artigo|descri|produto|item|nome)/i.test(desc)) {
        const prefix = storeName ? `${storeName} - ` : '';
        transactions.push({
          id: Math.random().toString(),
          data: receiptDate,
          descricao: `${prefix}${desc}`,
          valor: totalVal,
          tipo: 'saida',
          categoria: '',
          contaId: '',
        });
      }
    }
  }

  // Se não encontrou itens individuais mas tem um total, adicionar como transação única
  if (transactions.length === 0) {
    const totalMatch = text.match(/Total\s*(?:a\s*Pagar)?:?\s*(?:Kz)?\s*([\d\s.,]+)/i);
    if (totalMatch) {
      const totalAmount = parseAmount(totalMatch[1]);
      if (totalAmount > 0) {
        transactions.push({
          id: Math.random().toString(),
          data: receiptDate,
          descricao: storeName ? `Compra em ${storeName}` : 'Compra em Loja',
          valor: totalAmount,
          tipo: 'saida',
          categoria: '',
          contaId: '',
        });
      }
    }
  }

  return transactions;
}

/* ── Parser 4: Genérico (fallback) ── */
function parseGeneric(text) {
  const transactions = [];

  // Extrair data
  let date = new Date().toISOString().slice(0, 10);
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/) || text.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const parts = dateMatch[1].split(/[\/\-]/);
    if (parts[0].length === 4) {
      date = `${parts[0]}-${parts[1]}-${parts[2]}`;
    } else {
      date = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  // Encontrar todos os valores monetários no texto
  const amountRegex = /(?:Kz|AOA|Montante|Valor|Total)[:\s]*([\d\s.,]+)/gi;
  let match;
  const amounts = [];
  while ((match = amountRegex.exec(text)) !== null) {
    const val = parseAmount(match[1]);
    if (val > 0) amounts.push(val);
  }

  // Usar o maior valor encontrado como a transação principal
  if (amounts.length > 0) {
    const mainAmount = Math.max(...amounts);
    transactions.push({
      id: Math.random().toString(),
      data: date,
      descricao: 'Transação extraída do documento',
      valor: mainAmount,
      tipo: 'saida',
      categoria: '',
      contaId: '',
    });
  }

  return transactions;
}

/* ── Utilitário: Converter texto em número ── */
function parseAmount(str) {
  if (!str) return 0;
  // Remover espaços, remover pontos de milhar, trocar vírgula por ponto decimal
  const cleaned = str.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

export default function ImportadorExtrato({ isOpen, onClose }) {
  const { registrarDespesa, adicionarReceita, contas, categoriasSaidas, categoriasEntradas, mostrarAlerta, usuario } = useFinance();
  const [step, setStep] = useState(1); // 1: Upload, 2: Processing, 3: Review
  const [extractedData, setExtractedData] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [rawText, setRawText] = useState('');

  const hasAiAccess = usuario?.isPremium || usuario?.featureAccess?.includes('yeto_ai');

  const handleFileUpload = async (e) => {
    if (!hasAiAccess) {
      mostrarAlerta(
        'Funcionalidade Premium',
        'A leitura de extratos requer a funcionalidade Yeto AI. Aceda aos Planos para atualizar.',
        'aviso',
        false
      );
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    setStep(2);

    try {
      let text = '';

      if (file.type === 'application/pdf') {
        text = await extractTextFromPdf(file);
      } else {
        // Para imagens, não temos OCR local - avisar o utilizador
        mostrarAlerta(
          'Formato não suportado',
          'De momento, apenas ficheiros PDF são suportados para leitura automática. Para imagens, utilize o registo manual.',
          'aviso'
        );
        setStep(1);
        return;
      }

      setRawText(text);
      const parsed = parseAngolanBankStatement(text);

      if (parsed.length === 0) {
        mostrarAlerta(
          'Sem dados encontrados',
          'Não foi possível extrair transações deste documento. Verifique se é um comprovativo ou extrato bancário válido.',
          'aviso'
        );
        setStep(1);
        return;
      }

      // Preencher categoria e conta padrão
      const withDefaults = parsed.map(item => ({
        ...item,
        categoria: item.categoria || (item.tipo === 'saida' ? (categoriasSaidas[0] || 'Outros') : (categoriasEntradas[0] || 'Salário')),
        contaId: item.contaId || (contas[0]?.id || ''),
      }));

      setExtractedData(withDefaults);
      setStep(3);
    } catch (err) {
      console.error('Erro ao processar ficheiro:', err);
      mostrarAlerta('Erro', 'Não foi possível ler este ficheiro. Tente outro documento.', 'erro');
      setStep(1);
    }
  };

  const handleFieldChange = (id, field, value) => {
    setExtractedData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveItem = (id) => {
    setExtractedData(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveAll = async () => {
    if (extractedData.length === 0) return;

    setIsSaving(true);
    let successCount = 0;

    try {
      for (const item of extractedData) {
        // Limpar e truncar descrição para respeitar o limite do BD (255 chars)
        const rawDesc = (item.descricao || 'Transação Importada').trim();
        const cleanDesc = rawDesc.length > 250 ? rawDesc.substring(0, 247) + '...' : rawDesc;
        
        // Limpar e truncar categoria (100 chars)
        const rawCat = (item.categoria || 'Geral').trim();
        const cleanCat = rawCat.length > 100 ? rawCat.substring(0, 97) + '...' : rawCat;

        const transacao = {
          userId: usuario?.id,
          accountId: item.contaId || (contas.length > 0 ? contas[0].id : ''),
          type: item.tipo === 'saida' ? 'expense' : 'income',
          category: cleanCat,
          description: cleanDesc,
          amount: Number(item.valor) || 0,
          transaction_date: item.data || new Date().toISOString().split('T')[0]
        };

        const res = await apiFetch('/api/finances/transaction', {
          method: 'POST',
          body: JSON.stringify(transacao)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
          throw new Error(errData.error || `Servidor retornou ${res.status}`);
        }
        
        successCount++;
      }

      mostrarAlerta('Sucesso', `${successCount} transação(ões) importada(s) com sucesso!`, 'sucesso');
      setStep(1);
      setExtractedData([]);
      setRawText('');
      setIsSaving(false);
      onClose();
      
      // Forçar atualização da página para carregar novos dados
      setTimeout(() => window.location.reload(), 1500);

    } catch (err) {
      console.error('Erro ao guardar extrato:', err);
      mostrarAlerta('Erro de Gravação', err.message, 'erro');
      setIsSaving(false);
    }
  };

  const resetState = () => {
    if (!isSaving) {
      setStep(1);
      setExtractedData([]);
      setRawText('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={resetState} title="Leitor de Extratos (Yeto AI)" maxWidth={step === 3 ? '850px' : '450px'}>
      {step === 1 && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄✨</div>
          <h3 style={{ marginBottom: '1rem' }}>Importe o seu comprovativo</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            O Yeto AI vai ler o seu PDF e extrair os dados reais da transação automaticamente.
          </p>

          <label className="btn btn-primary btn-pill" style={{ cursor: 'pointer', display: 'inline-block' }}>
            Selecionar Ficheiro PDF
            <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {step === 2 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div style={{
            width: '60px', height: '60px',
            border: '4px solid rgba(55, 51, 146, 0.1)',
            borderTopColor: 'var(--accent-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1.5rem auto'
          }}></div>
          <h3>A ler o documento...</h3>
          <p style={{ color: 'var(--text-secondary)' }}>O Yeto AI está a extrair os dados do seu comprovativo.</p>
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 'bold' }}>
            ✅ {extractedData.length} transação(ões) encontrada(s)! Reveja os dados e confirme.
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Data</th>
                  <th style={{ padding: '0.5rem' }}>Descrição</th>
                  <th style={{ padding: '0.5rem' }}>Tipo</th>
                  <th style={{ padding: '0.5rem' }}>Categoria</th>
                  <th style={{ padding: '0.5rem' }}>Valor</th>
                  <th style={{ padding: '0.5rem' }}>Conta</th>
                  <th style={{ padding: '0.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {extractedData.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <input type="date" value={item.data} onChange={e => handleFieldChange(item.id, 'data', e.target.value)} className="qt-input" style={{ width: '120px', padding: '0.4rem', fontSize: '0.85rem' }} />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <input type="text" value={item.descricao} onChange={e => handleFieldChange(item.id, 'descricao', e.target.value)} className="qt-input" style={{ width: '150px', padding: '0.4rem', fontSize: '0.85rem' }} />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <select value={item.tipo} onChange={e => handleFieldChange(item.id, 'tipo', e.target.value)} className="qt-input" style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                        <option value="saida">Saída</option>
                        <option value="entrada">Entrada</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <select value={item.categoria} onChange={e => handleFieldChange(item.id, 'categoria', e.target.value)} className="qt-input" style={{ padding: '0.4rem', width: '110px', fontSize: '0.85rem' }}>
                        {(item.tipo === 'saida' ? categoriasSaidas : categoriasEntradas).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <input type="number" value={item.valor} onChange={e => handleFieldChange(item.id, 'valor', e.target.value)} className="qt-input" style={{ width: '100px', padding: '0.4rem', fontSize: '0.85rem' }} />
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <select value={item.contaId} onChange={e => handleFieldChange(item.id, 'contaId', e.target.value)} className="qt-input" style={{ padding: '0.4rem', width: '110px', fontSize: '0.85rem' }}>
                        {contas.map(conta => (
                          <option key={conta.id} value={conta.id}>{conta.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem' }}>
                      <button type="button" onClick={() => handleRemoveItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rawText && (
            <details style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>🔍 Ver resumo do documento</summary>
              <div style={{ background: '#f5f5f5', padding: '0.8rem', borderRadius: '8px', fontSize: '0.8rem', lineHeight: '1.6' }}>
                {(() => {
                  const t = rawText;
                  const fields = [];
                  
                  const ordenanteMatch = t.match(/(?:ORDENANTE|DE:?)\s+(?:Nome:?\s*)?([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]{3,40})/i);
                  if (ordenanteMatch) fields.push({ label: 'De', value: ordenanteMatch[1].trim() });
                  
                  const benefMatch = t.match(/(?:BENEFICI[AÁ]RIO|PARA:?)\s+(?:Nome:?\s*)?([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s]{3,40})/i);
                  if (benefMatch) fields.push({ label: 'Para', value: benefMatch[1].trim() });
                  
                  const dateMatch = t.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i) || t.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/);
                  if (dateMatch) fields.push({ label: 'Data', value: dateMatch[1] });
                  
                  const amountMatch = t.match(/Montante:\s*Kz\s*([\d\s.,]+)/i) || t.match(/Valor:\s*Kz\s*([\d\s.,]+)/i) || t.match(/Total.*?Kz\s*([\d\s.,]+)/i);
                  if (amountMatch) fields.push({ label: 'Montante', value: `Kz ${amountMatch[1].trim()}` });
                  
                  const tipoMatch = t.match(/Tipo\s*de\s*Movimento:\s*(.+?)(?:\n|$)/i);
                  if (tipoMatch) fields.push({ label: 'Tipo', value: tipoMatch[1].trim() });
                  
                  const bancoMatch = t.match(/Banco:\s*(.+?)(?:\s{2,}|\n|$)/i);
                  if (bancoMatch) fields.push({ label: 'Banco', value: bancoMatch[1].trim() });
                  
                  const nopMatch = t.match(/N[úu]mero\s*de\s*Opera[çc][aã]o:\s*(\d+)/i);
                  if (nopMatch) fields.push({ label: 'Nº Operação', value: nopMatch[1] });

                  if (fields.length === 0) {
                    return <span style={{ fontStyle: 'italic' }}>Dados estruturados não identificados neste documento.</span>;
                  }

                  return fields.map((f, i) => (
                    <div key={i}><strong>{f.label}:</strong> {f.value}</div>
                  ));
                })()}
              </div>
            </details>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button className="btn btn-secondary btn-pill" onClick={resetState} disabled={isSaving}>Cancelar</button>
            <button className="btn btn-primary btn-pill" onClick={handleSaveAll} disabled={isSaving || extractedData.length === 0}>
              {isSaving ? 'A guardar...' : `Guardar ${extractedData.length} transação(ões)`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
