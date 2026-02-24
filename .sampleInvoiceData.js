// Centralized invoice data - Sample version for repo
// Use .sampleInvoiceData_local.js for local overrides (not committed)

window.invoiceData = {
  // Company info
  companyName: 'Recharge Retail Limited',
  companyAddress: {
    line1: 'line 1',
    line2: 'line 2'
  },
  // Invoice details
  invoiceNo: '33R26I005938434',
  panNo: 'ABCDEG1718H',
  orderRef: 'BR000CDPYYTL',
  modeOfPayment: 'UPI',
  invoiceDateTime: '01 Oct,2025 21:22:38',
  gstNo: '33ABCDEG1718H1ZW',
  paymentRef: 'A251001OBCDEF',
  // Customer info
  customerName: 'Lorum ipsum',
  jioNumber: '12345678901',
  placeOfSupply: '33 Tamil Nadu',
  customerAddress: {
    line1: 'line 1',
    line2: 'line 2'
  },
  items: [
    {
      srNo: 1,
      planDetails: 'MRP 3999',
      sac: '998422',
      qty: 1,
      mrp: 3999.0,
      discount: 0.0
    }
  ]
};

// Fuel Bill Data - Sample
window.fuelData = {
  stationName: "WAHAB FILLING STATION",
  stationAddress: {
    line1: "PALAKKAD ROAD, KUNIYMUTHUR,",
    line2: "COIMBATORE - 641008.",
  },
  telNo: "9344203354",
  invNo: "234603424L318053",
  localId: "00116121",
  fipNo: "01",
  nozzleNo: "03",
  product: "Petrol",
  density: "744.0Kg/Cu.mtr",
  rate: 101.23,
  amount: 4000.0,
  volume: 39.51, // calculated
  vehicleNo: "Not Entered",
  mobileNo: "Not Entered",
  date: "21/12/24",
  time: "18:28",
  cstNo: "33ADDPG5144K2ZQ",
  lstNo: "",
  vatNo: "",
};
