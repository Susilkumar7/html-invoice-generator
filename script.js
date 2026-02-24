// Data is now loaded from .sampleInvoiceData.js and optionally .sampleInvoiceData_local.js
// If for some reason they didn't load, initialize empty/defaults to prevent errors
if (typeof window.invoiceData === 'undefined') {
  console.warn('Invoice data not loaded from external files. Initializing default empty structure.');
  window.invoiceData = {
    companyAddress: {},
    customerAddress: {},
    items: []
  };
}

if (typeof window.fuelData === 'undefined') {
  console.warn('Fuel data not loaded from external files. Initializing default empty structure.');
  window.fuelData = {
    stationAddress: {}
  };
}

const invoiceData = window.invoiceData;
const fuelData = window.fuelData;

let currentMode = 'telecom'; // 'telecom' or 'fuel'

// Utility: set text or HTML into element by id
function setText(id, text, html = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (html) el.innerHTML = text;
  else el.textContent = text;
}

function formatCurrency(value) {
  return Number(value).toFixed(2);
}

function roundTo(value, decimals = 2) {
  return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}

// Convert number to words (supports rupees and paise)
function numberToWords(amount) {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(num) {
    if ((num = num.toString()).length > 9) return 'Amount too large';
    const n = ('000000000' + num).substr(-9).match(/(\d{2})(\d{2})(\d{2})(\d{3})/);
    if (!n) return '';
    let str = '';
    const crore = Number(n[1]);
    const lakh = Number(n[2]);
    const thousand = Number(n[3]);
    const hundreds = Number(n[4]);

    if (crore) {
      str += (crore < 20 ? a[crore] : b[Math.floor(crore / 10)] + (crore % 10 ? ' ' + a[crore % 10] : '')) + ' Crore ';
    }
    if (lakh) {
      str += (lakh < 20 ? a[lakh] : b[Math.floor(lakh / 10)] + (lakh % 10 ? ' ' + a[lakh % 10] : '')) + ' Lakh ';
    }
    if (thousand) {
      str += (thousand < 20 ? a[thousand] : b[Math.floor(thousand / 10)] + (thousand % 10 ? ' ' + a[thousand % 10] : '')) + ' Thousand ';
    }
    if (hundreds) {
      const h = hundreds.toString();
      if (h.length === 3) {
        const hh = Number(h.substr(0, 1));
        const rest = Number(h.substr(1));
        if (hh) str += a[hh] + ' Hundred ';
        if (rest) str += (rest < 20 ? a[rest] : b[Math.floor(rest / 10)] + (rest % 10 ? ' ' + a[rest % 10] : '')) + ' ';
      } else {
        str += (hundreds < 20 ? a[hundreds] : b[Math.floor(hundreds / 10)] + (hundreds % 10 ? ' ' + a[hundreds % 10] : '')) + ' ';
      }
    }
    return str.trim();
  }

  const [rupeePart, paisePart] = Number(amount || 0).toFixed(2).split('.');
  const rupees = Number(rupeePart);
  const paise = Number(paisePart);
  let words = '';
  if (rupees === 0) words = 'Zero Rupees';
  else words = inWords(rupees) + ' Rupees';
  if (paise > 0) words += ' and ' + inWords(paise) + ' Paise';
  words += ' Only';
  return words.replace(/\s+/g, ' ').trim();
}

function renderItems(items) {
  const tbody = document.getElementById('itemsBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  items.forEach(item => {
    // ensure taxableAmount exists (may already be computed by renderInvoice)
    if (item.taxableAmount == null) {
      // compute taxableAmount from MRP (MRP assumed GST-inclusive)
      const lineTotal = (Number(item.mrp) * Number(item.qty)) - Number(item.discount || 0);
      item.taxableAmount = roundTo(lineTotal / 1.18, 2);
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.srNo}</td>
      <td>${item.planDetails}</td>
      <td>${item.sac}</td>
      <td>${item.qty}</td>
      <td>${formatCurrency(item.mrp)}</td>
      <td>${formatCurrency(item.discount)}</td>
      <td>${formatCurrency(item.taxableAmount)}</td>
    `;
    tr.addEventListener('mouseenter', () => tr.style.backgroundColor = '#f0f0f0');
    tr.addEventListener('mouseleave', () => tr.style.backgroundColor = '');
    tbody.appendChild(tr);
  });
}

function appendTotalsToTbody(totals, amountWords) {
  const tbody = document.getElementById('itemsBody');
  if (!tbody) return;
  const tot_tax_amt = document.createElement('tr');
  tot_tax_amt.innerHTML = `
    <td colspan="6" class="total-label">Total Taxable Amount</td>
    <td class="total-value">${formatCurrency(totals.totalTaxable)}</td>
  `;
  tbody.appendChild(tot_tax_amt);

  const cgst = document.createElement('tr');
  cgst.innerHTML = `
    <td colspan="6" class="total-label">CGST (9%)</td>
    <td class="total-value">${formatCurrency(totals.cgst)}</td>
  `;
  tbody.appendChild(cgst);

  const sgst = document.createElement('tr');
  sgst.innerHTML = `
    <td colspan="6" class="total-label">SGST (9%)</td>
    <td class="total-value">${formatCurrency(totals.sgst)}</td>
  `;
  tbody.appendChild(sgst);

  const tot_amt = document.createElement('tr');
  tot_amt.innerHTML = `
    <td colspan="6" class="total-label">Total Amount</td>
    <td class="total-value">${formatCurrency(totals.totalAmount)}</td>
  `;
  tbody.appendChild(tot_amt);

  const amt_words = document.createElement('tr');
  amt_words.innerHTML = `
    <td colspan="2" class="words-label">Total Amount (in words)</td>
    <td colspan="5" class="words-value">${amountWords}</td>
  `;
  tbody.appendChild(amt_words);
}

function renderInvoice(data) {
  // First: compute per-item taxableAmount from item MRP (MRP assumed GST-inclusive)
  data.items.forEach(item => {
    const lineTotal = (Number(item.mrp) * Number(item.qty)) - Number(item.discount || 0);
    item.taxableAmount = roundTo(lineTotal / 1.18, 2);
  });

  // Compute aggregated totals from computed taxable amounts
  const totalTaxable = roundTo(data.items.reduce((s, it) => s + Number(it.taxableAmount || 0), 0), 2);
  const cgst = roundTo(totalTaxable * 0.09, 2);
  const sgst = roundTo(totalTaxable * 0.09, 2);
  const totalAmount = roundTo(totalTaxable + cgst + sgst, 2);
  const totals = { totalTaxable, cgst, sgst, totalAmount };
  data.totals = totals;
  const words = numberToWords(totals.totalAmount || 0);
  data.amountWords = words;
  // Header / company
  setText('companyName', data.companyName);
  setText('companyAddress', `${data.companyAddress.line1},<br>${data.companyAddress.line2}`, true);

  setText('invoiceNo', data.invoiceNo);
  setText('panNo', data.panNo);
  setText('orderRef', data.orderRef);
  setText('modeOfPayment', data.modeOfPayment);
  setText('invoiceDateTime', data.invoiceDateTime);
  setText('gstNo', data.gstNo);
  setText('paymentRef', data.paymentRef);
  setText('customerName', data.customerName);
  setText('jioNumber', data.jioNumber);
  setText('placeOfSupply', data.placeOfSupply);
  setText('address', `${data.customerAddress.line1},<br>${data.customerAddress.line2}`, true);

  renderItems(data.items);
  // update totals section (if present) and append totals rows inside the items tbody
  setText('totalTaxable', formatCurrency(totals.totalTaxable));
  setText('cgst', formatCurrency(totals.cgst));
  setText('sgst', formatCurrency(totals.sgst));
  setText('totalAmount', formatCurrency(totals.totalAmount));
  setText('amountWords', words);
  appendTotalsToTbody(totals, words);
}

function renderFuelInvoice(data) {
  setText('dispFuelStationName', data.stationName);
  setText('dispFuelStationAddr', `${data.stationAddress.line1}<br>${data.stationAddress.line2}`, true);
  setText('dispFuelTel', data.telNo);
  
  setText('dispFuelInvNo', data.invNo);
  setText('dispFuelLocalId', data.localId);
  setText('dispFuelFipNo', data.fipNo);
  setText('dispFuelNozzleNo', data.nozzleNo);
  setText('dispFuelProduct', data.product);
  setText('dispFuelDensity', data.density);
  setText('dispFuelRate', formatCurrency(data.rate));
  setText('dispFuelAmount', formatCurrency(data.amount));
  setText('dispFuelVolume', Number(data.volume).toFixed(2));
  
  setText('dispFuelVehicleNo', data.vehicleNo);
  setText('dispFuelMobileNo', data.mobileNo);
  setText('dispFuelDate', data.date);
  setText('dispFuelTime', data.time);
  
  setText('dispFuelCst', data.cstNo);
  setText('dispFuelLst', data.lstNo);
  setText('dispFuelVat', data.vatNo);
  
  // Footer time same as transaction time or current? Usually print time.
  // Using fixed date/time for consistency with image sample logic, or allow override.
  // We'll just reuse the date/time fields + current year?
  // Let's just use the entered Date/Time for "Printed on" to avoid ticking clock issues in PDF
  setText('dispFuelPrintTime', `${data.date} ${data.time}`);
}

function validateInvoiceData(data) {
  const itemsSum = data.items.reduce((s, it) => s + Number(it.taxableAmount || 0), 0);
  const { totalTaxable, cgst, sgst, totalAmount } = data.totals;
  const totalsSum = Number(totalTaxable) + Number(cgst) + Number(sgst);
  if (Math.abs(itemsSum - Number(totalTaxable)) > 0.01) {
    console.warn('Taxable amount mismatch: items sum', itemsSum, 'vs totals.totalTaxable', totalTaxable);
  }
  if (Math.abs(totalsSum - Number(totalAmount)) > 0.01) {
    console.warn('Total amount mismatch: expected', totalAmount, 'calculated', totalsSum);
  }
}

function setupPrintButton() {
  const btn = document.getElementById('printButton');
  if (!btn) return;
  btn.addEventListener('click', () => window.print());
}

// Populate form fields from invoiceData
function populateConfigForm(data) {
  // Company info
  document.getElementById('configCompanyName').value = data.companyName;
  document.getElementById('configCompanyAddr1').value = data.companyAddress.line1;
  document.getElementById('configCompanyAddr2').value = data.companyAddress.line2;

  // Invoice details
  document.getElementById('configInvoiceNo').value = data.invoiceNo;
  document.getElementById('configPanNo').value = data.panNo;
  document.getElementById('configOrderRef').value = data.orderRef;
  document.getElementById('configModeOfPayment').value = data.modeOfPayment;
  document.getElementById('configDateTime').value = data.invoiceDateTime;
  document.getElementById('configGstNo').value = data.gstNo;
  document.getElementById('configPaymentRef').value = data.paymentRef;

  // Customer info
  document.getElementById('configCustomerName').value = data.customerName;
  document.getElementById('configJioNumber').value = data.jioNumber;
  document.getElementById('configPlaceOfSupply').value = data.placeOfSupply;
  document.getElementById('configCustomerAddr1').value = data.customerAddress.line1;
  document.getElementById('configCustomerAddr2').value = data.customerAddress.line2;

  // Items
  renderItemsEditor(data.items);
}

// Populate fuel form fields
function populateFuelForm(data) {
  document.getElementById('fuelStationName').value = data.stationName;
  document.getElementById('fuelStationAddr1').value = data.stationAddress.line1;
  document.getElementById('fuelStationAddr2').value = data.stationAddress.line2;
  document.getElementById('fuelTelNo').value = data.telNo;
  
  document.getElementById('fuelInvNo').value = data.invNo;
  document.getElementById('fuelDate').value = data.date;
  document.getElementById('fuelTime').value = data.time;
  document.getElementById('fuelLocalId').value = data.localId;
  document.getElementById('fuelFipNo').value = data.fipNo;
  document.getElementById('fuelNozzleNo').value = data.nozzleNo;
  document.getElementById('fuelProduct').value = data.product;
  document.getElementById('fuelDensity').value = data.density;
  document.getElementById('fuelRate').value = data.rate;
  document.getElementById('fuelAmount').value = data.amount;
  document.getElementById('fuelVolume').value = data.volume;
  
  document.getElementById('fuelVehicleNo').value = data.vehicleNo;
  document.getElementById('fuelMobileNo').value = data.mobileNo;
  document.getElementById('fuelCstNo').value = data.cstNo;
  document.getElementById('fuelLstNo').value = data.lstNo;
  document.getElementById('fuelVatNo').value = data.vatNo;
}

// Create or update item editor rows
function renderItemsEditor(items) {
  const container = document.getElementById('itemsEditor');
  container.innerHTML = '';
  
  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <label>Plan Details</label>
      <input type="text" class="item-plan" value="${item.planDetails}">
      <label>SAC</label>
      <input type="text" class="item-sac" value="${item.sac}">
      <label>Quantity</label>
      <input type="number" class="item-qty" value="${item.qty}" min="1">
      <label>MRP/Unit</label>
      <input type="number" class="item-mrp" value="${item.mrp}" step="0.01">
      <label>Discount</label>
      <input type="number" class="item-discount" value="${item.discount}" step="0.01">
      <button class="remove-item" data-index="${index}">Remove</button>
    `;
    
    // Wire up change handlers for this row's inputs
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => updateItemFromEditor(index, row));
    });
    
    // Wire up remove button
    row.querySelector('.remove-item').addEventListener('click', () => {
      invoiceData.items.splice(index, 1);
      renderItemsEditor(invoiceData.items);
      renderInvoice(invoiceData);
    });
    
    container.appendChild(row);
  });
}

// Update invoiceData from form fields
function updateFromConfig() {
  // Company info
  invoiceData.companyName = document.getElementById('configCompanyName').value;
  invoiceData.companyAddress.line1 = document.getElementById('configCompanyAddr1').value;
  invoiceData.companyAddress.line2 = document.getElementById('configCompanyAddr2').value;

  // Invoice details
  invoiceData.invoiceNo = document.getElementById('configInvoiceNo').value;
  invoiceData.panNo = document.getElementById('configPanNo').value;
  invoiceData.orderRef = document.getElementById('configOrderRef').value;
  invoiceData.modeOfPayment = document.getElementById('configModeOfPayment').value;
  invoiceData.invoiceDateTime = document.getElementById('configDateTime').value;
  invoiceData.gstNo = document.getElementById('configGstNo').value;
  invoiceData.paymentRef = document.getElementById('configPaymentRef').value;

  // Customer info
  invoiceData.customerName = document.getElementById('configCustomerName').value;
  invoiceData.jioNumber = document.getElementById('configJioNumber').value;
  invoiceData.placeOfSupply = document.getElementById('configPlaceOfSupply').value;
  invoiceData.customerAddress.line1 = document.getElementById('configCustomerAddr1').value;
  invoiceData.customerAddress.line2 = document.getElementById('configCustomerAddr2').value;

  renderInvoice(invoiceData);
}

// Update fuelData from form fields
function updateFuelFromConfig() {
  fuelData.stationName = document.getElementById('fuelStationName').value;
  fuelData.stationAddress.line1 = document.getElementById('fuelStationAddr1').value;
  fuelData.stationAddress.line2 = document.getElementById('fuelStationAddr2').value;
  fuelData.telNo = document.getElementById('fuelTelNo').value;
  
  fuelData.invNo = document.getElementById('fuelInvNo').value;
  fuelData.date = document.getElementById('fuelDate').value;
  fuelData.time = document.getElementById('fuelTime').value;
  fuelData.localId = document.getElementById('fuelLocalId').value;
  fuelData.fipNo = document.getElementById('fuelFipNo').value;
  fuelData.nozzleNo = document.getElementById('fuelNozzleNo').value;
  fuelData.product = document.getElementById('fuelProduct').value;
  fuelData.density = document.getElementById('fuelDensity').value;
  // Note: Rate/Amount/Volume handled by specialized handlers but we read them here just in case text changed manually
  fuelData.rate = Number(document.getElementById('fuelRate').value);
  fuelData.amount = Number(document.getElementById('fuelAmount').value);
  // Volume is derived, but if we want to allow manual adjustment we could, 
  // but let's stick to calculation priority.
  
  fuelData.vehicleNo = document.getElementById('fuelVehicleNo').value;
  fuelData.mobileNo = document.getElementById('fuelMobileNo').value;
  fuelData.cstNo = document.getElementById('fuelCstNo').value;
  fuelData.lstNo = document.getElementById('fuelLstNo').value;
  fuelData.vatNo = document.getElementById('fuelVatNo').value;

  renderFuelInvoice(fuelData);
}

// Update a specific item from its editor row
function updateItemFromEditor(index, row) {
  const item = invoiceData.items[index];
  item.planDetails = row.querySelector('.item-plan').value;
  item.sac = row.querySelector('.item-sac').value;
  item.qty = Number(row.querySelector('.item-qty').value);
  item.mrp = Number(row.querySelector('.item-mrp').value);
  item.discount = Number(row.querySelector('.item-discount').value);
  
  renderInvoice(invoiceData);
}

// Wire up form change handlers
function setupConfigHandlers() {
  // Wire up all config inputs except items (they're handled separately)
  const configInputs = [
    'configCompanyName', 'configCompanyAddr1', 'configCompanyAddr2',
    'configInvoiceNo', 'configPanNo', 'configOrderRef', 'configModeOfPayment',
    'configDateTime', 'configGstNo', 'configPaymentRef', 'configCustomerName',
    'configJioNumber', 'configPlaceOfSupply', 'configCustomerAddr1', 'configCustomerAddr2'
  ];
  
  configInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateFromConfig);
    }
  });

  // Wire up add item button
  document.getElementById('addItemButton').addEventListener('click', () => {
    const newItem = {
      srNo: invoiceData.items.length + 1,
      planDetails: 'New Plan',
      sac: '998422',
      qty: 1,
      mrp: 0,
      discount: 0
    };
    invoiceData.items.push(newItem);
    renderItemsEditor(invoiceData.items);
    renderInvoice(invoiceData);
  });
}

function setBatchDefaults() {
  const batchTo = document.getElementById('batchToDate');
  const batchFrom = document.getElementById('batchFromDate');
  if (batchTo && batchFrom) {
    const toDate = new Date();
    batchTo.value = toDate.toISOString().split('T')[0];
    
    // Set from date to exactly 3 months ago
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 3);
    batchFrom.value = fromDate.toISOString().split('T')[0];
  }
}

function setupFuelHandlers() {
  setBatchDefaults();
  const fuelInputs = [
    'fuelStationName', 'fuelStationAddr1', 'fuelStationAddr2', 'fuelTelNo',
    'fuelInvNo', 'fuelDate', 'fuelTime', 'fuelLocalId', 'fuelFipNo', 'fuelNozzleNo',
    'fuelProduct', 'fuelDensity', 'fuelVehicleNo', 'fuelMobileNo',
    'fuelCstNo', 'fuelLstNo', 'fuelVatNo'
  ];
  
  fuelInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateFuelFromConfig);
    }
  });

  const btnAutoGenFuelInvNo = document.getElementById('btnAutoGenFuelInvNo');
  if (btnAutoGenFuelInvNo) {
    btnAutoGenFuelInvNo.addEventListener('click', () => {
      // Generate format like 234603424L318053 (9 digits + 'L' + 6 digits)
      const p1 = Math.floor(100000000 + Math.random() * 900000000);
      const p2 = Math.floor(100000 + Math.random() * 900000);
      document.getElementById('fuelInvNo').value = `${p1}L${p2}`;
      updateFuelFromConfig();
    });
  }
  
  // Math for Rate * Volume = Amount
  // If Rate or Amount changes, update Volume. 
  const rateInput = document.getElementById('fuelRate');
  const amountInput = document.getElementById('fuelAmount');
  const volumeInput = document.getElementById('fuelVolume');
  
  function updateFuelCalc() {
    const rate = Number(rateInput.value) || 0;
    const amount = Number(amountInput.value) || 0;
    if (rate > 0) {
      const vol = amount / rate;
      fuelData.volume = vol;
      volumeInput.value = vol.toFixed(2);
    } else {
      fuelData.volume = 0;
      volumeInput.value = '0.00';
    }
    // Update model
    fuelData.rate = rate;
    fuelData.amount = amount;
    renderFuelInvoice(fuelData);
  }
  
  if (rateInput) rateInput.addEventListener('input', updateFuelCalc);
  if (amountInput) amountInput.addEventListener('input', updateFuelCalc);

  const btnBatchGenerate = document.getElementById('btnBatchGenerate');
  if (btnBatchGenerate) {
    btnBatchGenerate.addEventListener('click', batchGenerateAndSave);
  }
}

async function batchGenerateAndSave() {
  const count = parseInt(document.getElementById('batchCount').value, 10);
  if (isNaN(count) || count < 1) return;

  const btn = document.getElementById('btnBatchGenerate');
  const orgText = btn.textContent;
  btn.disabled = true;

  try {
    for (let i = 0; i < count; i++) {
      btn.textContent = `Generating ${i + 1} of ${count}...`;
      
      const fromMs = new Date(document.getElementById('batchFromDate').value).getTime();
      const toMs = new Date(document.getElementById('batchToDate').value).getTime();
      const randomMs = fromMs + Math.random() * (toMs - fromMs);
      const randomDateObj = new Date(randomMs);
      
      const day = String(randomDateObj.getDate()).padStart(2, '0');
      const month = String(randomDateObj.getMonth() + 1).padStart(2, '0');
      const year = randomDateObj.getFullYear();
      fuelData.date = `${day}/${month}/${year}`;
      
      const hour = Math.floor(6 + Math.random() * 16);
      const min = Math.floor(Math.random() * 60);
      fuelData.time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      
      const p1 = Math.floor(100000000 + Math.random() * 900000000);
      const p2 = Math.floor(100000 + Math.random() * 900000);
      fuelData.invNo = `${p1}L${p2}`;
      
      fuelData.nozzleNo = String(Math.floor(1 + Math.random() * 8)).padStart(2, '0');
      fuelData.density = String(Math.floor(700 + Math.random() * 61));
      
      const rateMin = Number(document.getElementById('batchRateMin').value);
      const rateMax = Number(document.getElementById('batchRateMax').value);
      const wholeRate = Math.floor(rateMin + Math.random() * (Math.max(rateMin + 1, rateMax) - rateMin));
      const fractions = [0.25, 0.50, 0.75];
      const fraction = fractions[Math.floor(Math.random() * fractions.length)];
      let newRate = wholeRate + fraction;
      
      // Ensure it's within bounds just in case
      if (newRate < rateMin) newRate = rateMin + fraction;
      if (newRate > rateMax) newRate = wholeRate - 1 + fraction;
      
      fuelData.rate = newRate;
      
      const amtMin = Number(document.getElementById('batchAmountMin').value);
      const amtMax = Number(document.getElementById('batchAmountMax').value);
      fuelData.amount = Number((amtMin + Math.random() * (amtMax - amtMin)).toFixed(2));
      
      fuelData.volume = Number((fuelData.amount / fuelData.rate).toFixed(2));
      
      populateFuelForm(fuelData);
      renderFuelInvoice(fuelData);
      
      await new Promise(r => setTimeout(r, 200)); // allow DOM refresh
      
      await saveInvoiceAsImage();
      
      await new Promise(r => setTimeout(r, 800)); // delay between downloads
    }
  } catch (error) {
    console.error('Batch error:', error);
    alert('An error occurred during batch generation: ' + error.message);
  } finally {
    btn.textContent = orgText;
    btn.disabled = false;
  }
}

function toggleMode(mode) {
  currentMode = mode;
  const telecomConfig = document.getElementById('telecomConfig');
  const fuelConfig = document.getElementById('fuelConfig');
  const telecomInvoice = document.getElementById('telecomInvoice');
  const fuelInvoice = document.getElementById('fuelInvoice');
  
  if (telecomConfig) telecomConfig.classList.toggle('hidden', mode !== 'telecom');
  if (fuelConfig) fuelConfig.classList.toggle('hidden', mode !== 'fuel');
  if (telecomInvoice) telecomInvoice.classList.toggle('hidden', mode !== 'telecom');
  if (fuelInvoice) fuelInvoice.classList.toggle('hidden', mode !== 'fuel');
}

function setupModeSwitcher() {
  const radios = document.getElementsByName('invoiceType');
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        toggleMode(e.target.value);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  populateConfigForm(invoiceData);
  populateFuelForm(fuelData);
  
  setupConfigHandlers();
  setupFuelHandlers();
  setupModeSwitcher();
  
  renderInvoice(invoiceData);
  renderFuelInvoice(fuelData);
  
  validateInvoiceData(invoiceData);
  setupPrintButton();
  setupSaveImageButton(); // Ensure this is called

  // Set initial mode based on currentMode variable (default 'telecom')
  toggleMode(currentMode);
  // Also ensure the correct radio button is checked
  const initialRadio = document.querySelector(`input[name="invoiceType"][value="${currentMode}"]`);
  if (initialRadio) {
    initialRadio.checked = true;
  }
});

// Save invoice as image using html2canvas
async function saveInvoiceAsImage() {
  try {
    // Select the currently visible invoice container
    const invoice = document.querySelector('.invoice-container:not(.hidden)');
    if (!invoice) throw new Error('Invoice container not found');

    // Create a temporary wrapper with padding so the captured image has space on all sides
    const wrapper = document.createElement('div');
    wrapper.style.background = '#ffffff';
    wrapper.style.padding = '12px'; // space on four sides
    wrapper.style.display = 'inline-block';
    wrapper.style.boxSizing = 'content-box';
    
    // Different box sizing or width handling depending on mode?
    // The cloned node will inherit width styles
    
    // Clone the invoice (we keep visual styling such as borders) and hide action buttons in the clone
    const clone = invoice.cloneNode(true);
    // Make sure action buttons are hidden in the cloned copy if any exist inside
    const actionBtns = clone.querySelectorAll('.action-buttons');
    actionBtns.forEach(n => n && (n.style.display = 'none'));

    wrapper.appendChild(clone);

    // Place wrapper off-screen so it inherits page styles but doesn't affect layout
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    // Ensure body has white background for capture
    const oldBodyBg = document.body.style.background;
    document.body.appendChild(wrapper);

    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Clean up the wrapper
    document.body.removeChild(wrapper);

    // Convert to image and trigger download
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const filename = currentMode === 'telecom' ? `invoice-${invoiceData.invoiceNo}.png` : `fuel-bill-${fuelData.invNo}.png`;
    link.download = filename;
    link.href = image;
    link.click();
  } catch (error) {
    console.error('Error saving invoice as image:', error);
    alert('Failed to save image. See console for details.');
  }
}

// Add save image button to the page
function setupSaveImageButton() {
  const saveBtn = document.getElementById('saveImageButton');
  // Remove old listeners to avoid duplicates if called multiple times?
  // Easier to just replace the node or assume called once. 
  // It is called once in DOMContentLoaded
  if (saveBtn) {
    // We overwrite onclick to be safe or just use addEventListener
    saveBtn.onclick = saveInvoiceAsImage; 
  }
}

// Add the html2canvas script to the page
const script = document.createElement('script');
script.src = 'node_modules/html2canvas/dist/html2canvas.min.js';
document.head.appendChild(script);

// Initialize the save image button after html2canvas loads
script.onload = () => {
  setupSaveImageButton();
};
