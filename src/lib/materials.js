// Raw material purchasing rules.
//
// These are the built-in defaults. Stage 3 moves them into the database so
// they can be edited in the app; until then they are the fallback used when
// nothing is stored.

// ── Steel plate: fixed quantities ordered together ───────────────────────────
export const STEEL_PLATE_ORDER = [
  { qty:2,  desc:"14ga. (0.0747\") Mild Steel, 4' x 8'"  },
  { qty:11, desc:"1/8\" Mild Steel, 5' x 10'"            },
  { qty:1,  desc:"3/16\" Mild Steel, 4' x 8'"            },
  { qty:9,  desc:"1/4\" Mild Steel, 4' x 8'"             },
  { qty:4,  desc:"3/8\" Mild Steel, 4' x 8'"             },
  { qty:1,  desc:"1/2\" Mild Steel, 4' x 8'"             },
];

// The rule that decides when a plate order goes out.
export const STEEL_PLATE_RULE = {
  skuPrefix: 'S15',
  // Trigger when stock drops to this many machines' worth or less.
  machinesWorth: 5,
  supplierMatch: 'russel',
  supplierLabel: 'Russell Metals',
};

// ── Bar & tube ───────────────────────────────────────────────────────────────
// stdLength = standard purchased length in ft. null = round up to nearest foot.
export const BAR_TUBE_CATEGORIES = {
  HSS:        { label:'HSS Structural',        stdLength:24,   color:'#2B3FE0' },
  CRS_ROUND:  { label:'CRS Round Bar',         stdLength:20,   color:'#FF9500' },
  SS_ROUND:   { label:'304 SS Round Bar',      stdLength:12,   color:'#30D158' },
  SQUARE_BAR: { label:'Square Bar',            stdLength:12,   color:'#FF9500' },
  FLAT_BAR:   { label:'Flat Bar',              stdLength:12,   color:'#FF9500' },
  TUBE_HR:    { label:'Hot-Rolled Tube',       stdLength:24,   color:'#FF6B6B' },
  DOM:        { label:'DOM Tube',              stdLength:null, color:'#AF85E0' },
  KEYSTOCK:   { label:'Keystock',              stdLength:3,    color:'#FFD60A' },
  ALUMINUM:   { label:'Aluminum',              stdLength:null, color:'#A0C4FF' },
  NYLATRON:   { label:'Nylatron / Nylon Rod',  stdLength:10,   color:'#80FFDB' },
};

// The run size the footages below are calculated for.
export const BAR_TUBE_RUN_SIZE = 20;

// Total footage required for a full run (from the SW150 material
// requirements document).
export const BAR_TUBE_MATERIALS = [
  { name:'HSS 2" x 2" x 1/8"',              totalFt:83.33, category:'HSS'        },
  { name:'HSS 2" x 3" x 3/16"',             totalFt:80.00, category:'HSS'        },
  { name:'Round Bar Ø1/2" CRS',             totalFt:63.33, category:'CRS_ROUND'  },
  { name:'Round Bar Ø3/4" CRS',             totalFt:26.67, category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.00" CRS',            totalFt:24.33, category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.25" 1018 CRS',       totalFt:45.90, category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.25" CRS',            totalFt:2.50,  category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.75" CRS',            totalFt:18.75, category:'CRS_ROUND'  },
  { name:'Round Bar Ø2.00" CRS',            totalFt:9.19,  category:'CRS_ROUND'  },
  { name:'Round Bar Ø7/8" CRS',             totalFt:0.92,  category:'CRS_ROUND'  },
  { name:'Round Bar Ø1.00" 304 SS',         totalFt:22.92, category:'SS_ROUND'   },
  { name:'Bar Square 1.50" 1018 CRS',       totalFt:18.75, category:'SQUARE_BAR' },
  { name:'Bar Flat 1/8" x 1/2" Steel',      totalFt:19.42, category:'FLAT_BAR'   },
  { name:'DOM Tube Ø1.50" x 0.120" CRS',    totalFt:15.00, category:'DOM'        },
  { name:'DOM Tube Ø2.375" x 0.310" Wall',  totalFt:22.08, category:'DOM'        },
  { name:'DOM Tube Ø3.50"/2.75" CRS',       totalFt:5.10,  category:'DOM'        },
  { name:'DOM Tube 2.00" x 0.25" CRS',      totalFt:22.08, category:'DOM'        },
  { name:'Tube 2.50" OD Hot-Rolled',        totalFt:63.33, category:'TUBE_HR'    },
  { name:'Tube 2.00" OD x 0.120"',          totalFt:3.33,  category:'TUBE_HR'    },
  { name:'Keystock 1/2" x 7/16"',           totalFt:5.52,  category:'KEYSTOCK'   },
  { name:'Keystock 3/8" x 3/8"',            totalFt:2.50,  category:'KEYSTOCK'   },
  { name:'Alu 1" x 2"',                     totalFt:2.50,  category:'ALUMINUM'   },
  { name:'SM Nylon Ø1.50" x 1.00"',         totalFt:41.25, category:'NYLATRON'   },
  { name:'Nylatron Ø1.75" x 2.125"',        totalFt:14.16, category:'NYLATRON'   },
  { name:'Nylatron Ø2.25" x 2.00"',         totalFt:6.66,  category:'NYLATRON'   },
  { name:'Nylatron Ø2.00" x 2.00"',         totalFt:6.66,  category:'NYLATRON'   },
];

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
