/**
 * Seed script — populates the DB with the same data from src/data/index.js
 * Usage: npm run seed
 *
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ─── Raw seed data (mirrors src/data/index.js) ────────────────────────────────

const USERS = [
  { id:1, name:'John Kamau',    role:'admin',       pin:'0000', avatar:'JK', permissions:['dashboard','pos','shift','inventory','reports','expiry','variance','settings','wastage','items'] },
  { id:2, name:'Peter Otieno',  role:'cashier',     pin:'1111', avatar:'PO', permissions:['dashboard','pos','shift'] },
  { id:3, name:'Alice Wangari', role:'waiter',      pin:'2222', avatar:'AW', permissions:['pos','inventory_readonly'] },
  { id:4, name:'Brian Omondi',  role:'waiter',      pin:'3333', avatar:'BO', permissions:['pos','inventory_readonly'] },
  { id:5, name:'Chef Kamau',    role:'kitchen',     pin:'4444', avatar:'CK', permissions:['kds'] },
];

const SUPPLIERS = [
  { id:'S1', name:'Highlands Dairy',    contact:'+254 722 111 001' },
  { id:'S2', name:'Nakumatt Wholesale', contact:'+254 733 222 002' },
  { id:'S3', name:'Kenya Breweries',    contact:'+254 711 333 003' },
  { id:'S4', name:'Fresh Farm Produce', contact:'+254 700 444 004' },
];

const INGREDIENTS = [
  { id:'I01', name:'Whole Milk',           unit:'ml',     category:'dairy',     reorder_level:5000,  cost_per_unit:0.12  },
  { id:'I02', name:'Tea Leaves (Ketepa)',  unit:'g',      category:'dry-goods', reorder_level:500,   cost_per_unit:0.08  },
  { id:'I03', name:'White Sugar',          unit:'g',      category:'dry-goods', reorder_level:2000,  cost_per_unit:0.05  },
  { id:'I04', name:'Bread (Sliced)',       unit:'slice',  category:'bakery',    reorder_level:20,    cost_per_unit:12    },
  { id:'I05', name:'Eggs (Large)',         unit:'pcs',    category:'produce',   reorder_level:30,    cost_per_unit:18    },
  { id:'I06', name:'Beef Fillet',          unit:'g',      category:'meat',      reorder_level:2000,  cost_per_unit:1.20  },
  { id:'I07', name:'Romaine Lettuce',      unit:'g',      category:'produce',   reorder_level:500,   cost_per_unit:0.15  },
  { id:'I08', name:'Parmesan Cheese',      unit:'g',      category:'dairy',     reorder_level:300,   cost_per_unit:0.90  },
  { id:'I09', name:'Caesar Dressing',      unit:'ml',     category:'sauces',    reorder_level:500,   cost_per_unit:0.45  },
  { id:'I10', name:'Pizza Dough',          unit:'g',      category:'bakery',    reorder_level:1000,  cost_per_unit:0.10  },
  { id:'I11', name:'Tomato Sauce',         unit:'ml',     category:'sauces',    reorder_level:1000,  cost_per_unit:0.20  },
  { id:'I12', name:'Mozzarella Cheese',    unit:'g',      category:'dairy',     reorder_level:500,   cost_per_unit:0.75  },
  { id:'I13', name:'Pasta (Tagliatelle)',  unit:'g',      category:'dry-goods', reorder_level:1000,  cost_per_unit:0.12  },
  { id:'I14', name:'Truffle Oil',          unit:'ml',     category:'oils-fats', reorder_level:200,   cost_per_unit:2.50  },
  { id:'I15', name:'Cream',               unit:'ml',     category:'dairy',     reorder_level:1000,  cost_per_unit:0.35  },
  { id:'I16', name:'Cooking Oil',         unit:'ml',     category:'oils-fats', reorder_level:2000,  cost_per_unit:0.08  },
  { id:'I17', name:'Salt',               unit:'g',      category:'dry-goods', reorder_level:500,   cost_per_unit:0.01  },
  { id:'I18', name:'Black Pepper',        unit:'g',      category:'dry-goods', reorder_level:100,   cost_per_unit:0.30  },
  { id:'I19', name:'Garlic',             unit:'g',      category:'produce',   reorder_level:200,   cost_per_unit:0.12  },
  { id:'I20', name:'Coca Cola 500ml',    unit:'bottle', category:'beverages', reorder_level:24,    cost_per_unit:55    },
  { id:'I21', name:'Tusker Lager 500ml', unit:'bottle', category:'beverages', reorder_level:24,    cost_per_unit:120   },
  { id:'I22', name:'Red Bull 250ml',     unit:'can',    category:'beverages', reorder_level:12,    cost_per_unit:180   },
  { id:'I23', name:'Mineral Water 500ml',unit:'bottle', category:'beverages', reorder_level:24,    cost_per_unit:40    },
  { id:'I24', name:'Chocolate (Dark)',   unit:'g',      category:'dry-goods', reorder_level:200,   cost_per_unit:0.80  },
  { id:'I25', name:'Mascarpone',         unit:'g',      category:'dairy',     reorder_level:300,   cost_per_unit:1.10  },
];

const MENU_ITEMS = [
  { id:'M01', name:'Cup of Tea',         category:'beverages', price:150,  cost:18,  emoji:'☕', description:'Freshly brewed Kenyan tea',        bestseller:true,  on_sale:false },
  { id:'M02', name:'Caesar Salad',       category:'starters',  price:850,  cost:180, emoji:'🥗', description:'Romaine, parmesan & dressing',     bestseller:true,  on_sale:true, original_price:1000 },
  { id:'M03', name:'Margherita Pizza',   category:'mains',     price:1450, cost:320, emoji:'🍕', description:'Buffalo mozzarella & basil',        bestseller:true,  on_sale:false },
  { id:'M04', name:'Grilled Ribeye',     category:'mains',     price:3200, cost:850, emoji:'🥩', description:'300g prime cut, rosemary jus',      bestseller:false, on_sale:false },
  { id:'M05', name:'Truffle Pasta',      category:'pasta',     price:1800, cost:280, emoji:'🍝', description:'Tagliatelle, truffle & cream',      bestseller:true,  on_sale:false },
  { id:'M06', name:'Tiramisu',           category:'desserts',  price:650,  cost:120, emoji:'🍰', description:'Mascarpone, espresso & ladyfingers',bestseller:false, on_sale:false },
  { id:'M07', name:'Beef Burger',        category:'mains',     price:850,  cost:220, emoji:'🍔', description:'Double patty, cheddar, brioche bun',bestseller:true,  on_sale:false },
  { id:'M08', name:'Chocolate Fondant',  category:'desserts',  price:750,  cost:150, emoji:'🍫', description:'Warm dark chocolate, vanilla ice cream',bestseller:false,on_sale:false },
  { id:'M09', name:'Fresh Orange Juice', category:'beverages', price:200,  cost:40,  emoji:'🍊', description:'Freshly squeezed',                  bestseller:false, on_sale:false },
  { id:'M10', name:'Tusker Lager',       category:'beverages', price:350,  cost:120, emoji:'🍺', description:'500ml cold Tusker',                 bestseller:true,  on_sale:false },
  { id:'M11', name:'Mineral Water',      category:'beverages', price:100,  cost:40,  emoji:'💧', description:'500ml still water',                 bestseller:false, on_sale:false },
  { id:'M12', name:'Chicken Wings',      category:'starters',  price:750,  cost:180, emoji:'🍗', description:'Crispy wings, peri-peri sauce',    bestseller:true,  on_sale:false },
];

const RECIPES = {
  M01:[{menu_item_id:'M01',ingredient_id:'I01',qty:200},{menu_item_id:'M01',ingredient_id:'I02',qty:5},{menu_item_id:'M01',ingredient_id:'I03',qty:15}],
  M02:[{menu_item_id:'M02',ingredient_id:'I07',qty:120},{menu_item_id:'M02',ingredient_id:'I08',qty:30},{menu_item_id:'M02',ingredient_id:'I09',qty:40}],
  M03:[{menu_item_id:'M03',ingredient_id:'I10',qty:250},{menu_item_id:'M03',ingredient_id:'I11',qty:80},{menu_item_id:'M03',ingredient_id:'I12',qty:120},{menu_item_id:'M03',ingredient_id:'I17',qty:3}],
  M04:[{menu_item_id:'M04',ingredient_id:'I06',qty:350},{menu_item_id:'M04',ingredient_id:'I16',qty:20},{menu_item_id:'M04',ingredient_id:'I19',qty:5},{menu_item_id:'M04',ingredient_id:'I17',qty:3},{menu_item_id:'M04',ingredient_id:'I18',qty:2}],
  M05:[{menu_item_id:'M05',ingredient_id:'I13',qty:200},{menu_item_id:'M05',ingredient_id:'I14',qty:15},{menu_item_id:'M05',ingredient_id:'I15',qty:80},{menu_item_id:'M05',ingredient_id:'I08',qty:20}],
  M06:[{menu_item_id:'M06',ingredient_id:'I25',qty:100},{menu_item_id:'M06',ingredient_id:'I24',qty:30}],
  M10:[{menu_item_id:'M10',ingredient_id:'I21',qty:1}],
  M11:[{menu_item_id:'M11',ingredient_id:'I23',qty:1}],
};

// Helper: relative date
function d(offset) {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split('T')[0];
}

// ─── Seed runner ──────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Reset sequence to match seeded IDs
    await client.query(`SELECT setval('users_id_seq', 10, false)`);

    console.log('🌱  Seeding users...');
    for (const u of USERS) {
      const pin_hash = await bcrypt.hash(u.pin, 10);
      await client.query(
        `INSERT INTO users (id, name, role, pin_hash, avatar, permissions, active)
         VALUES ($1,$2,$3,$4,$5,$6,true)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.role, pin_hash, u.avatar, u.permissions]
      );
    }
    await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);

    console.log('🌱  Seeding suppliers...');
    for (const s of SUPPLIERS) {
      await client.query(
        `INSERT INTO suppliers (id, name, contact) VALUES ($1,$2,$3)
         ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.contact]
      );
    }

    console.log('🌱  Seeding ingredients...');
    for (const i of INGREDIENTS) {
      await client.query(
        `INSERT INTO ingredients (id, name, unit, category, reorder_level, cost_per_unit)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [i.id, i.name, i.unit, i.category, i.reorder_level, i.cost_per_unit]
      );
    }

    console.log('🌱  Seeding menu items...');
    for (const m of MENU_ITEMS) {
      await client.query(
        `INSERT INTO menu_items (id, name, category, price, cost, emoji, description, bestseller, on_sale, original_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.name, m.category, m.price, m.cost, m.emoji, m.description,
         m.bestseller, m.on_sale, m.original_price || null]
      );
    }

    console.log('🌱  Seeding recipes...');
    for (const [, steps] of Object.entries(RECIPES)) {
      for (const step of steps) {
        await client.query(
          `INSERT INTO recipes (menu_item_id, ingredient_id, qty)
           VALUES ($1,$2,$3) ON CONFLICT (menu_item_id, ingredient_id) DO NOTHING`,
          [step.menu_item_id, step.ingredient_id, step.qty]
        );
      }
    }

    console.log('🌱  Seeding sample batches...');
    const BATCHES = [
      { id:'B001', ingredient_id:'I01', batch_no:'MLK-051', qty:8000,  remaining:6200,  expiry:d(1),   supplier_id:'S1', location:'Cold Room',  received_date:d(-4), cost_per_unit:0.12, status:'active'  },
      { id:'B002', ingredient_id:'I01', batch_no:'MLK-052', qty:10000, remaining:10000, expiry:d(3),   supplier_id:'S1', location:'Cold Room',  received_date:d(-1), cost_per_unit:0.12, status:'active'  },
      { id:'B004', ingredient_id:'I02', batch_no:'TEA-021', qty:2000,  remaining:1450,  expiry:d(60),  supplier_id:'S2', location:'Dry Store',  received_date:d(-10),cost_per_unit:0.08, status:'active'  },
      { id:'B005', ingredient_id:'I03', batch_no:'SUG-031', qty:5000,  remaining:3800,  expiry:d(90),  supplier_id:'S2', location:'Dry Store',  received_date:d(-5), cost_per_unit:0.05, status:'active'  },
      { id:'B008', ingredient_id:'I05', batch_no:'EGG-071', qty:120,   remaining:87,    expiry:d(7),   supplier_id:'S4', location:'Cold Room',  received_date:d(-3), cost_per_unit:18,   status:'active'  },
      { id:'B009', ingredient_id:'I06', batch_no:'BEF-081', qty:5000,  remaining:3200,  expiry:d(2),   supplier_id:'S4', location:'Cold Room',  received_date:d(-2), cost_per_unit:1.20, status:'active'  },
      { id:'B012', ingredient_id:'I07', batch_no:'LET-092', qty:2000,  remaining:1800,  expiry:d(3),   supplier_id:'S4', location:'Cold Room',  received_date:d(-1), cost_per_unit:0.15, status:'active'  },
      { id:'B021', ingredient_id:'I20', batch_no:'CCL-181', qty:120,   remaining:88,    expiry:d(180), supplier_id:'S3', location:'Dry Store',  received_date:d(-7), cost_per_unit:55,   status:'active'  },
      { id:'B022', ingredient_id:'I21', batch_no:'TUK-191', qty:96,    remaining:61,    expiry:d(90),  supplier_id:'S3', location:'Dry Store',  received_date:d(-7), cost_per_unit:120,  status:'active'  },
    ];
    for (const b of BATCHES) {
      await client.query(
        `INSERT INTO batches (id, ingredient_id, batch_no, qty, remaining, expiry, supplier_id, location, received_date, cost_per_unit, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [b.id, b.ingredient_id, b.batch_no, b.qty, b.remaining, b.expiry,
         b.supplier_id, b.location, b.received_date, b.cost_per_unit, b.status]
      );
    }

    await client.query('COMMIT');
    console.log('\n✅  Seed complete!\n');
    console.log('   Login credentials:');
    console.log('   Admin:    user_id=1  pin=0000');
    console.log('   Cashier:  user_id=2  pin=1111');
    console.log('   Waiter:   user_id=3  pin=2222\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
