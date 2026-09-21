// Raw material purchasing rules.
//
// These live in the database and are edited from the Reorder Rules screen.
// The values below are only the fallback used when the tables have not been
// created yet — they match what migration 002 seeds, so the app behaves
// identically either way.

export const DEFAULT_RULE = {
  id: 'steel_plate',
  label: 'Steel Plate — Grouped Reorder Rule',
  skuPrefix: 'S15',
  machinesWorth: 5,
  supplierId: null,
  // Only used as a fallback before the rule is stored in the database.
  supplierMatch: 'russel',
  enabled: true,
};

export const DEFAULT_PLATE_ORDER = [
  { id:'d0', description:"14ga. (0.0747\") Mild Steel, 4' x 8'", qty:2,  sortOrder:0 },
  { id:'d1', description:"1/8\" Mild Steel, 5' x 10'",           qty:11, sortOrder:1 },
  { id:'d2', description:"3/16\" Mild Steel, 4' x 8'",           qty:1,  sortOrder:2 },
  { id:'d3', description:"1/4\" Mild Steel, 4' x 8'",            qty:9,  sortOrder:3 },
  { id:'d4', description:"3/8\" Mild Steel, 4' x 8'",            qty:4,  sortOrder:4 },
  { id:'d5', description:"1/2\" Mild Steel, 4' x 8'",            qty:1,  sortOrder:5 },
];

// stdLength = standard purchased length in ft. null = round up to nearest foot.
export const DEFAULT_CATEGORIES = [
  { id:'HSS',        label:'HSS Structural',       stdLength:24,   color:'#2B3FE0', sortOrder:0 },
  { id:'CRS_ROUND',  label:'CRS Round Bar',        stdLength:20,   color:'#FF9500', sortOrder:1 },
  { id:'SS_ROUND',   label:'304 SS Round Bar',     stdLength:12,   color:'#30D158', sortOrder:2 },
  { id:'SQUARE_BAR', label:'Square Bar',           stdLength:12,   color:'#FF9500', sortOrder:3 },
  { id:'FLAT_BAR',   label:'Flat Bar',             stdLength:12,   color:'#FF9500', sortOrder:4 },
  { id:'TUBE_HR',    label:'Hot-Rolled Tube',      stdLength:24,   color:'#FF6B6B', sortOrder:5 },
  { id:'DOM',        label:'DOM Tube',             stdLength:null, color:'#AF85E0', sortOrder:6 },
  { id:'KEYSTOCK',   label:'Keystock',             stdLength:3,    color:'#FFD60A', sortOrder:7 },
  { id:'ALUMINUM',   label:'Aluminum',             stdLength:null, color:'#A0C4FF', sortOrder:8 },
  { id:'NYLATRON',   label:'Nylatron / Nylon Rod', stdLength:10,   color:'#80FFDB', sortOrder:9 },
];

export const DEFAULT_RUN_SIZE = 20;

export const DEFAULT_MATERIALS = [
  { name:'HSS 2" x 2" x 1/8"',              totalFt:83.33, categoryId:'HSS'        },
  { name:'HSS 2" x 3" x 3/16"',             totalFt:80.00, categoryId:'HSS'        },
  { name:'Round Bar Ø1/2" CRS',             totalFt:63.33, categoryId:'CRS_ROUND'  },
  { name:'Round Bar Ø3/4" CRS',             totalFt:26.67, categoryId:'CRS_ROUND'  },
  { name:'Round Bar Ø1.00" CRS',            totalFt:24.33, categoryId:'CRS_ROUND'  },
  { name:'Round Bar Ø1.25" 1018 CRS',       totalFt:45.90, categoryId:'CRS_ROUND'  },
  { name:'Round Bar Ø1.25" CRS',            totalFt:2.50,  categoryId:'CRS_ROUND'  },
  { name:'Round Bar Ø1.75" CRS',            totalFt:18.75, categoryId:'CRS_ROUND'  },
  { name:'Round Bar Ø2.00" CRS',            totalFt:9.19,  categoryId:'CRS_ROUND'  },
  { name:'Round Bar Ø7/8" CRS',             totalFt:0.92,  categoryId:'CRS_ROUND'  },
  { name:'Round Bar Ø1.00" 304 SS',         totalFt:22.92, categoryId:'SS_ROUND'   },
  { name:'Bar Square 1.50" 1018 CRS',       totalFt:18.75, categoryId:'SQUARE_BAR' },
  { name:'Bar Flat 1/8" x 1/2" Steel',      totalFt:19.42, categoryId:'FLAT_BAR'   },
  { name:'DOM Tube Ø1.50" x 0.120" CRS',    totalFt:15.00, categoryId:'DOM'        },
  { name:'DOM Tube Ø2.375" x 0.310" Wall',  totalFt:22.08, categoryId:'DOM'        },
  { name:'DOM Tube Ø3.50"/2.75" CRS',       totalFt:5.10,  categoryId:'DOM'        },
  { name:'DOM Tube 2.00" x 0.25" CRS',      totalFt:22.08, categoryId:'DOM'        },
  { name:'Tube 2.50" OD Hot-Rolled',        totalFt:63.33, categoryId:'TUBE_HR'    },
  { name:'Tube 2.00" OD x 0.120"',          totalFt:3.33,  categoryId:'TUBE_HR'    },
  { name:'Keystock 1/2" x 7/16"',           totalFt:5.52,  categoryId:'KEYSTOCK'   },
  { name:'Keystock 3/8" x 3/8"',            totalFt:2.50,  categoryId:'KEYSTOCK'   },
  { name:'Alu 1" x 2"',                     totalFt:2.50,  categoryId:'ALUMINUM'   },
  { name:'SM Nylon Ø1.50" x 1.00"',         totalFt:41.25, categoryId:'NYLATRON'   },
  { name:'Nylatron Ø1.75" x 2.125"',        totalFt:14.16, categoryId:'NYLATRON'   },
  { name:'Nylatron Ø2.25" x 2.00"',         totalFt:6.66,  categoryId:'NYLATRON'   },
  { name:'Nylatron Ø2.00" x 2.00"',         totalFt:6.66,  categoryId:'NYLATRON'   },
].map((m, i) => ({ ...m, id:`d${i}`, sortOrder:i }));

// The whole purchasing configuration as the app uses it, before anything is
// loaded from the database.
export const DEFAULT_PURCHASING = {
  rule:       DEFAULT_RULE,
  plateOrder: DEFAULT_PLATE_ORDER,
  categories: DEFAULT_CATEGORIES,
  materials:  DEFAULT_MATERIALS,
  runSize:    DEFAULT_RUN_SIZE,
  fromDatabase: false,
};

// ── Calculations ─────────────────────────────────────────────────────────────
// Rule: if totalFt < half a standard length → round up to nearest foot.
//       if totalFt >= half a standard length → round up to nearest full length multiple.
//       if no standard length (DOM / Aluminum) → always round up to nearest foot.
export function calcReorderQty(totalFt, stdLength) {
  if (!stdLength) return Math.ceil(totalFt);
  if (totalFt < stdLength / 2) return Math.ceil(totalFt);
  return Math.ceil(totalFt / stdLength) * stdLength;
}

export function calcLengths(orderQty, stdLength) {
  if (!stdLength) return null;
  return Math.ceil(orderQty / stdLength);
}

// One row of the bar & tube table, worked out once so the table and any future
// order email agree.
export function barTubeRow(item, category) {
  const orderQty = calcReorderQty(item.totalFt, category.stdLength);
  return {
    ...item,
    orderQty,
    lengths: calcLengths(orderQty, category.stdLength),
    roundedUp: orderQty > Math.ceil(item.totalFt),
  };
}
