"use client";

import { useState } from 'react';
import { UploadCloud, CheckCircle, TrendingUp, Printer, Download, FileSpreadsheet } from 'lucide-react';
import * as xlsx from 'xlsx';
import { parseExcel, extractAllTablesFromSheet } from '@/utils/dataParser';
import { processCombinedTaxData, computeTax } from '@/utils/dataProcessor';

export default function Home() {
  const [file, setFile] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  const [activeTab, setActiveTab] = useState('consolidated');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      alert("Please upload the Combined Tax P&L Excel file.");
      return;
    }
    
    setLoading(true);
    try {
      const wb = await parseExcel(file);
      
      const tradewiseData = extractAllTablesFromSheet(wb, 'Tradewise Exits');
      const eqData = extractAllTablesFromSheet(wb, 'Equity and Non Equity');
      const mfData = extractAllTablesFromSheet(wb, 'Mutual Funds');
      const divData = extractAllTablesFromSheet(wb, 'Equity Dividends');

      if (tradewiseData.length === 0) {
        alert("Could not find 'Tradewise Exits' sheet in the uploaded file.");
        setLoading(false);
        return;
      }

      const eqSymbols = new Set(eqData.map(r => r['Symbol']));
      const mfSymbols = new Set(mfData.map(r => r['Symbol']));

      const results = processCombinedTaxData(tradewiseData, eqSymbols, mfSymbols);
      
      const consolidated = {
        overallRealized: results.eq.overallRealized + results.mf.overallRealized,
        stcg: results.eq.stcg + results.mf.stcg,
        ltcg: results.eq.ltcg + results.mf.ltcg,
      };
      
      const tax = computeTax(consolidated.stcg, consolidated.ltcg);

      const totalDividend = divData.reduce((acc, row) => acc + (Number(row['Net Dividend Amount']) || 0), 0);
      const dividends = {
        total: totalDividend,
        list: divData
      };

      setProcessedData({ eq: results.eq, mf: results.mf, pm: results.pm, dividends, consolidated, tax });
    } catch (err) {
      console.error(err);
      alert("Error processing file. Ensure it is the correct Zerodha Combined Tax P&L Excel file.");
    }
    setLoading(false);
  };

  const handleExportHtml = () => {
    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules).map(rule => rule.cssText).join('');
        } catch (e) {
          return '';
        }
      })
      .join('\n');

    const content = document.getElementById('report-content').innerHTML;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Zerodha Tax Tracker Report FY25-26</title>
          <style>
            ${styles}
            .no-print { display: none !important; }
            .hidden.print-show { display: block !important; margin-bottom: 4rem; }
            body { background-color: white; color: black; padding: 2rem; font-family: 'Inter', sans-serif; }
            .metric-card, .metric-card-complex, .tax-card, .tax-total-card, .data-table { border: 1px solid #ccc; background-color: white; }
            h1, h2, h3, p, span { color: black !important; }
            .tax-total-card { background-color: #f1f5f9; }
            .value.positive { color: #059669; }
            .value.negative { color: #dc2626; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="background: none; color: black; -webkit-text-fill-color: black;">Zerodha Tax Tracker</h1>
            <p>FY 2025-2026 Consolidated Reporting</p>
          </div>
          ${content}
        </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Tax_Report_2025_2026.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (!processedData) return;

    const wb = xlsx.utils.book_new();

    // 1. Consolidated Sheet
    const consRows = [
      { Metric: 'Total Realized P&L', Value: processedData.consolidated.overallRealized },
      { Metric: 'Total STCG', Value: processedData.consolidated.stcg },
      { Metric: 'Total LTCG', Value: processedData.consolidated.ltcg },
      { Metric: '', Value: '' },
      { Metric: 'Estimated STCG Tax (20%)', Value: processedData.tax.stcgTax },
      { Metric: 'Estimated LTCG Tax (12.5% above 1.25L)', Value: processedData.tax.ltcgTax },
      { Metric: 'Total Estimated Tax', Value: processedData.tax.totalTax },
    ];
    const wsCons = xlsx.utils.json_to_sheet(consRows);
    xlsx.utils.book_append_sheet(wb, wsCons, 'Consolidated Tax');

    // Helper to flatten trades
    const flattenTrades = (categoryData) => {
      if (!categoryData || !categoryData.quarterly) return [];
      const rows = [];
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
        const trades = categoryData.quarterly[q]?.trades || [];
        trades.forEach(t => {
          rows.push({
            Quarter: q,
            Symbol: t.symbol,
            Quantity: t.qty,
            'Buy Value': t.buyValue,
            'Sell Value': t.sellValue,
            Profit: t.profit,
            'Holding Period (Days)': t.holdingDays,
            'Entry Date': t.entryDate,
            'Exit Date': t.exitDate
          });
        });
      });
      return rows;
    };

    // 2. Stocks Sheet
    const wsEq = xlsx.utils.json_to_sheet(flattenTrades(processedData.eq));
    xlsx.utils.book_append_sheet(wb, wsEq, 'Stocks (EQ)');

    // 3. Mutual Funds Sheet
    const wsMf = xlsx.utils.json_to_sheet(flattenTrades(processedData.mf));
    xlsx.utils.book_append_sheet(wb, wsMf, 'Mutual Funds (MF)');

    // 4. Precious Metals Sheet
    const wsPm = xlsx.utils.json_to_sheet(flattenTrades(processedData.pm));
    xlsx.utils.book_append_sheet(wb, wsPm, 'Precious Metals');

    // 5. Dividends Sheet
    const divRows = processedData.dividends.list.map(d => ({
      Symbol: d['Symbol'],
      'Ex-Date': d['Ex-date'],
      Quantity: d['Quantity'],
      'Dividend Per Share': d['Dividend Per Share'],
      'Net Dividend Amount': d['Net Dividend Amount']
    }));
    divRows.push({ Symbol: 'TOTAL', 'Ex-Date': '', Quantity: '', 'Dividend Per Share': '', 'Net Dividend Amount': processedData.dividends.total });
    const wsDiv = xlsx.utils.json_to_sheet(divRows);
    xlsx.utils.book_append_sheet(wb, wsDiv, 'Dividends');

    // Generate and download
    xlsx.writeFile(wb, 'Processed_Tax_Report_2025_2026.xlsx');
  };

  const formatCurrency = (val) => {
    if (!val && val !== 0) return "₹0.00";
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const renderConsolidated = () => {
    const { eq, mf, consolidated, tax } = processedData;

    return (
      <div>
        <h2>Consolidated Overview</h2>
        <div className="dashboard-grid">
          <div className="metric-card-complex">
            <div className="header-row">
              <span>Total P&L</span>
              <TrendingUp size={20} color="var(--success)" />
            </div>
            <div className="value">{formatCurrency(consolidated.overallRealized)}</div>
            <div className="footer-row">
              <span>Short: {formatCurrency(consolidated.stcg)}</span>
              <span>Long: {formatCurrency(consolidated.ltcg)}</span>
            </div>
          </div>

          <div className="metric-card-complex">
            <div className="header-row">
              <span>Equity P&L</span>
              <TrendingUp size={20} color="var(--success)" />
            </div>
            <div className="value">{formatCurrency(eq.overallRealized)}</div>
            <div className="footer-row">
              <span>Short: {formatCurrency(eq.stcg)}</span>
              <span>Long: {formatCurrency(eq.ltcg)}</span>
            </div>
          </div>

          <div className="metric-card-complex">
            <div className="header-row">
              <span>Mutual Funds P&L</span>
              <TrendingUp size={20} color="var(--success)" />
            </div>
            <div className="value">{formatCurrency(mf.overallRealized)}</div>
            <div className="footer-row">
              <span>Short: {formatCurrency(mf.stcg)}</span>
              <span>Long: {formatCurrency(mf.ltcg)}</span>
            </div>
          </div>
        </div>

        <h2 style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>Tax Liability Report</h2>
        
        <div className="tax-report-grid">
          <div className="tax-card">
            <h3>Short-Term Capital Gains (STCG)</h3>
            <div className="tax-row">
              <span>Total STCG</span>
              <span style={{ color: consolidated.stcg < 0 ? 'var(--danger)' : '' }}>
                {formatCurrency(consolidated.stcg)}
              </span>
            </div>
            <div className="tax-row">
              <span>Tax Rate</span>
              <span style={{ color: 'var(--text-main)' }}>20%</span>
            </div>
            <div className="tax-divider"></div>
            <div className="tax-row" style={{ alignItems: 'center' }}>
              <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Estimated STCG Tax</strong>
              <strong style={{ color: 'var(--accent)', fontSize: '1.25rem' }}>{formatCurrency(tax.stcgTax)}</strong>
            </div>
          </div>

          <div className="tax-card">
            <h3>Long-Term Capital Gains (LTCG)</h3>
            <div className="tax-row">
              <span>Total LTCG</span>
              <span>{formatCurrency(consolidated.ltcg)}</span>
            </div>
            <div className="tax-row">
              <span>Exemption</span>
              <span>-₹1,25,000.00</span>
            </div>
            <div className="tax-row">
              <span>Taxable LTCG</span>
              <span>{formatCurrency(Math.max(0, consolidated.ltcg - 125000))}</span>
            </div>
            <div className="tax-row">
              <span>Tax Rate</span>
              <span style={{ color: 'var(--text-main)' }}>12.5%</span>
            </div>
            <div className="tax-divider"></div>
            <div className="tax-row" style={{ alignItems: 'center' }}>
              <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Estimated LTCG Tax</strong>
              <strong style={{ color: 'var(--accent)', fontSize: '1.25rem' }}>{formatCurrency(tax.ltcgTax)}</strong>
            </div>
          </div>
        </div>

        <div className="tax-total-card">
          <h3>Total Estimated Tax Liability</h3>
          <div className="value">{formatCurrency(tax.totalTax)}</div>
          <p>(Excluding Cess and Surcharges)</p>
        </div>
      </div>
    );
  };

  const renderMetrics = (data) => {
    if (!data) return null;
    return (
      <div className="dashboard-grid">
        <div className="metric-card">
          <h3>Overall Realized P&L</h3>
          <div className={`value ${data.overallRealized >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(data.overallRealized)}
          </div>
        </div>
        <div className="metric-card">
          <h3>Short Term Capital Gains (STCG)</h3>
          <div className={`value ${data.stcg >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(data.stcg)}
          </div>
        </div>
        <div className="metric-card">
          <h3>Long Term Capital Gains (LTCG)</h3>
          <div className={`value ${data.ltcg >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(data.ltcg)}
          </div>
        </div>
      </div>
    );
  };

  const renderDetailedQuarterly = (quarterlyData) => {
    if (!quarterlyData) return <p>No data available.</p>;

    const quarters = [
      { id: 'Q1', title: 'Q1 (Apr - Jun)' },
      { id: 'Q2', title: 'Q2 (Jul - Sep)' },
      { id: 'Q3', title: 'Q3 (Oct - Dec)' },
      { id: 'Q4', title: 'Q4 (Jan - Mar)' },
    ];

    return (
      <div>
        {quarters.map(q => {
          const trades = quarterlyData[q.id]?.trades || [];
          if (trades.length === 0) return null;

          return (
            <div key={q.id} style={{ marginBottom: '3rem' }}>
              <h3 style={{ borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--accent)' }}>
                {q.title}
              </h3>
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Quantity</th>
                      <th>Buy Value</th>
                      <th>Sell Value</th>
                      <th>Profit</th>
                      <th>Holding Period (Days)</th>
                      <th>Entry Date</th>
                      <th>Exit Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, idx) => (
                      <tr key={idx}>
                        <td><strong>{t.symbol}</strong></td>
                        <td>{t.qty}</td>
                        <td>{formatCurrency(t.buyValue)}</td>
                        <td>{formatCurrency(t.sellValue)}</td>
                        <td className={t.profit >= 0 ? 'positive' : 'negative'}>{formatCurrency(t.profit)}</td>
                        <td>{t.holdingDays}</td>
                        <td>{t.entryDate}</td>
                        <td>{t.exitDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container">
      <div className="header no-print">
        <h1>Zerodha Tax Tracker</h1>
        <p style={{ color: 'var(--text-muted)' }}>FY 2025-2026 Consolidated Reporting</p>
      </div>

      {!processedData && (
        <div className="no-print">
          <div className="upload-section" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="upload-card" style={{ maxWidth: '400px', width: '100%' }}>
              {file ? <CheckCircle size={48} color="var(--success)" /> : <UploadCloud size={48} color="var(--accent)" />}
              <h3>Combined Tax P&L (Excel)</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {file ? file.name : 'Upload the single Zerodha Tax P&L file'}
              </p>
              <label>
                Choose File
                <input type="file" accept=".xlsx,.csv" onChange={handleFileChange} />
              </label>
            </div>
          </div>
          
          <button className="process-btn" onClick={handleProcess} disabled={loading || !file}>
            {loading ? 'Processing...' : 'Generate Tax Report'}
          </button>
        </div>
      )}

      {processedData && (
        <>
          <div className="tabs no-print">
            <button className={`tab-btn ${activeTab === 'consolidated' ? 'active' : ''}`} onClick={() => setActiveTab('consolidated')}>
              Consolidated
            </button>
            <button className={`tab-btn ${activeTab === 'stocks' ? 'active' : ''}`} onClick={() => setActiveTab('stocks')}>
              Stocks (EQ)
            </button>
            {processedData.mf.stocksQuarterly.length > 0 && (
              <button className={`tab-btn ${activeTab === 'mfs' ? 'active' : ''}`} onClick={() => setActiveTab('mfs')}>
                Mutual Funds (MF)
              </button>
            )}
            {processedData.pm.stocksQuarterly.length > 0 && (
              <button className={`tab-btn ${activeTab === 'pm' ? 'active' : ''}`} onClick={() => setActiveTab('pm')}>
                Precious Metals
              </button>
            )}
            <button className={`tab-btn ${activeTab === 'dividends' ? 'active' : ''}`} onClick={() => setActiveTab('dividends')}>
              Dividends
            </button>
            
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="action-btn" onClick={() => window.print()}>
                <Printer size={18} /> PDF
              </button>
              <button className="action-btn" onClick={handleExportHtml}>
                <Download size={18} /> HTML
              </button>
              <button className="action-btn" style={{ backgroundColor: '#10b981' }} onClick={handleExportExcel}>
                <FileSpreadsheet size={18} /> Excel
              </button>
              <button className="tab-btn" onClick={() => setProcessedData(null)} style={{ color: 'var(--danger)' }}>
                Reset
              </button>
            </div>
          </div>

          {/* Report Content Container */}
          <div id="report-content">
            <div className={activeTab === 'consolidated' ? 'print-show' : 'hidden print-show'}>
              {renderConsolidated()}
            </div>

            <div className={activeTab === 'stocks' ? 'print-show' : 'hidden print-show'}>
              <h2>Stocks Performance</h2>
              {renderMetrics(processedData.eq)}
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Quarterly Detailed Trades</h3>
              {renderDetailedQuarterly(processedData.eq?.quarterly)}
            </div>

            {processedData.mf.stocksQuarterly.length > 0 && (
              <div className={activeTab === 'mfs' ? 'print-show' : 'hidden print-show'}>
                <h2>Mutual Funds Performance</h2>
                {renderMetrics(processedData.mf)}
                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Quarterly Detailed Trades</h3>
                {renderDetailedQuarterly(processedData.mf?.quarterly)}
              </div>
            )}

            {processedData.pm.stocksQuarterly.length > 0 && (
              <div className={activeTab === 'pm' ? 'print-show' : 'hidden print-show'}>
                <h2>Precious Metals Performance</h2>
                {renderMetrics(processedData.pm)}
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                  Note: Precious metals are taxed as per your applicable income tax slab rate, not under standard STCG/LTCG equity rates.
                </p>
                <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Quarterly Detailed Trades</h3>
                {renderDetailedQuarterly(processedData.pm?.quarterly)}
              </div>
            )}

            <div className={activeTab === 'dividends' ? 'print-show' : 'hidden print-show'}>
              <h2>Dividend Income</h2>
              <div className="dashboard-grid">
                <div className="metric-card">
                  <h3>Total Dividends Received</h3>
                  <div className="value positive">{formatCurrency(processedData.dividends.total)}</div>
                </div>
              </div>
              
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Detailed Dividends</h3>
              {processedData.dividends.list.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Ex-Date</th>
                        <th>Quantity</th>
                        <th>Dividend Per Share</th>
                        <th>Net Dividend Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedData.dividends.list.map((d, idx) => (
                        <tr key={idx}>
                          <td><strong>{d['Symbol']}</strong></td>
                          <td>{d['Ex-date']}</td>
                          <td>{d['Quantity']}</td>
                          <td>{formatCurrency(Number(d['Dividend Per Share']))}</td>
                          <td className="positive">{formatCurrency(Number(d['Net Dividend Amount']))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No dividend data found.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
