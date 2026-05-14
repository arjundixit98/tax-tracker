export const processCombinedTaxData = (tradewiseData, eqSymbols, mfSymbols) => {
  // tradewiseData schema: Symbol, ISIN, Entry Date, Exit Date, Quantity, Buy Value, Sell Value, Profit, Period of Holding, Taxable Profit

  const createEmptyStats = () => ({
    overallRealized: 0,
    stcg: 0,
    ltcg: 0,
    quarterly: {
      Q1: { stcg: 0, ltcg: 0, trades: [] },
      Q2: { stcg: 0, ltcg: 0, trades: [] },
      Q3: { stcg: 0, ltcg: 0, trades: [] },
      Q4: { stcg: 0, ltcg: 0, trades: [] },
    },
    stocksQuarterly: {}
  });

  const eq = createEmptyStats();
  const mf = createEmptyStats();
  const pm = createEmptyStats(); // Precious Metals

  tradewiseData.forEach(trade => {
    const sym = trade['Symbol'];
    if (!sym || typeof sym !== 'string') return;

    let isPm = sym.includes('GOLD') || sym.includes('SILVER');
    let isEq = false;
    let isMf = false;

    if (!isPm) {
      isEq = eqSymbols.has(sym);
      isMf = mfSymbols.has(sym);
      if (!isEq && !isMf) isEq = true; // default
    }

    const stats = isPm ? pm : (isMf ? mf : eq);
    
    const exitDate = new Date(trade['Exit Date']);
    if (isNaN(exitDate.getTime())) return; 

    const holdingDays = Number(trade['Period of Holding']) || 0;
    const profit = Number(trade['Taxable Profit'] || trade['Profit']) || 0;
    const qty = Number(trade['Quantity']) || 0;
    const buyValue = Number(trade['Buy Value']) || 0;
    const sellValue = Number(trade['Sell Value']) || 0;

    const isLtcg = holdingDays > 365;

    const month = exitDate.getMonth(); 
    let q = 'Q4'; 
    if (month >= 3 && month <= 5) q = 'Q1'; 
    else if (month >= 6 && month <= 8) q = 'Q2'; 
    else if (month >= 9 && month <= 11) q = 'Q3'; 

    stats.overallRealized += profit;

    if (isLtcg) {
      stats.ltcg += profit;
      stats.quarterly[q].ltcg += profit;
    } else {
      stats.stcg += profit;
      stats.quarterly[q].stcg += profit;
    }

    // Add trade to the quarterly list
    stats.quarterly[q].trades.push({
      symbol: sym,
      qty: qty,
      buyValue: buyValue,
      sellValue: sellValue,
      profit: profit,
      holdingDays: holdingDays,
      entryDate: trade['Entry Date'],
      exitDate: trade['Exit Date']
    });

    if (!stats.stocksQuarterly[sym]) {
      stats.stocksQuarterly[sym] = {
        symbol: sym,
        overall: 0,
        Q1: { stcg: 0, ltcg: 0, buyTotal: 0, sellTotal: 0, qty: 0 },
        Q2: { stcg: 0, ltcg: 0, buyTotal: 0, sellTotal: 0, qty: 0 },
        Q3: { stcg: 0, ltcg: 0, buyTotal: 0, sellTotal: 0, qty: 0 },
        Q4: { stcg: 0, ltcg: 0, buyTotal: 0, sellTotal: 0, qty: 0 },
      };
    }

    const sq = stats.stocksQuarterly[sym];
    sq.overall += profit;
    
    if (isLtcg) sq[q].ltcg += profit;
    else sq[q].stcg += profit;

    sq[q].buyTotal += buyValue;
    sq[q].sellTotal += sellValue;
    sq[q].qty += qty;
  });

  return {
    eq: { ...eq, stocksQuarterly: Object.values(eq.stocksQuarterly) },
    mf: { ...mf, stocksQuarterly: Object.values(mf.stocksQuarterly) },
    pm: { ...pm, stocksQuarterly: Object.values(pm.stocksQuarterly) }
  };
};

export const computeTax = (stcg, ltcg) => {
  const stcgTax = Math.max(0, stcg) * 0.20;
  const taxableLtcg = Math.max(0, ltcg - 125000);
  const ltcgTax = taxableLtcg * 0.125;
  return {
    stcgTax,
    ltcgTax,
    totalTax: stcgTax + ltcgTax
  };
};
