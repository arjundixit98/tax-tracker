import * as xlsx from 'xlsx';

export const parseExcel = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = xlsx.read(data, { type: 'array' });
      resolve(workbook);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const extractAllTablesFromSheet = (workbook, sheetNameQuery) => {
  const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes(sheetNameQuery.toLowerCase()));
  if (!sheetName) return [];
  
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  const rows = [];
  let currentHeaders = null;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || !row[0]) continue;
    
    // Check if this row is a header row
    if (String(row[0]).trim() === 'Symbol') {
      currentHeaders = row;
      continue;
    }

    if (currentHeaders && String(row[0]).trim() !== '') {
      const rowData = {};
      currentHeaders.forEach((header, index) => {
        rowData[header] = row[index];
      });
      rows.push(rowData);
    }
  }
  return rows;
};
