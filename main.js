const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db;

async function initDb() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'pbilling.sqlite');
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Create table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      purchase_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL,
      low_stock_threshold INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed demo data if empty
  const row = await db.get('SELECT COUNT(*) AS count FROM products');
  if (row.count === 0) {
    const demoProducts = [
      ['SKU-DEMO-01', 'Premium Wireless Mouse', 'Electronics', 15.0, 29.99, 50, 10],
      ['SKU-DEMO-02', 'Mechanical Keyboard', 'Electronics', 40.0, 89.99, 15, 20],
      ['SKU-DEMO-03', 'USB-C Charging Cable', 'Accessories', 2.0, 9.99, 5, 10],
      ['SKU-DEMO-04', 'Ergonomic Desk Chair', 'Furniture', 80.0, 150.0, 0, 5]
    ];

    for (const p of demoProducts) {
      await db.run(`
        INSERT INTO products (sku, name, category, purchase_price, selling_price, stock_quantity, low_stock_threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, p);
    }
  }
}

// IPC Handlers for Database Access
ipcMain.handle('get-products', async (event, search = '', category = '') => {
  let query = 'SELECT * FROM products';
  const params = [];

  if (search || category) {
    query += ' WHERE 1=1';
    if (search) {
      query += ' AND (name LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
  }

  query += ' ORDER BY name ASC';
  return await db.all(query, params);
});

ipcMain.handle('add-product', async (event, product) => {
  try {
    if (!product.sku || !product.name || product.purchase_price < 0 || product.selling_price < 0 || product.stock_quantity < 0) {
      return { success: false, error: 'Invalid product data' };
    }

    const result = await db.run(`
      INSERT INTO products (sku, name, category, purchase_price, selling_price, stock_quantity, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      product.sku, product.name, product.category || 'General', 
      parseFloat(product.purchase_price), parseFloat(product.selling_price), 
      parseInt(product.stock_quantity), parseInt(product.low_stock_threshold)
    ]);
    return { success: true, id: result.lastID };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: products.sku')) {
      return { success: false, error: 'SKU must be unique' };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-product', async (event, id, product) => {
  try {
    if (product.purchase_price < 0 || product.selling_price < 0 || product.stock_quantity < 0) {
      return { success: false, error: 'Invalid product data' };
    }

    const result = await db.run(`
      UPDATE products 
      SET sku = ?, name = ?, category = ?, purchase_price = ?, selling_price = ?, stock_quantity = ?, low_stock_threshold = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      product.sku, product.name, product.category || 'General', 
      parseFloat(product.purchase_price), parseFloat(product.selling_price), 
      parseInt(product.stock_quantity), parseInt(product.low_stock_threshold),
      id
    ]);

    if (result.changes === 0) return { success: false, error: 'Product not found' };
    return { success: true };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed: products.sku')) {
      return { success: false, error: 'SKU must be unique' };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-stock', async (event, id, quantityChange) => {
    try {
        const row = await db.get('SELECT stock_quantity FROM products WHERE id = ?', id);
        if (!row) return { success: false, error: 'Product not found' };

        const newStock = row.stock_quantity + parseInt(quantityChange);
        if (newStock < 0) return { success: false, error: 'Stock cannot be negative' };

        await db.run('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStock, id]);
        return { success: true, newStock };
    } catch(err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-dashboard-stats', async () => {
    const stats = {};
    const stockRow = await db.get('SELECT SUM(stock_quantity) as total_stock FROM products');
    stats.totalStock = stockRow.total_stock || 0;

    const lowStockRow = await db.get('SELECT COUNT(*) as low_stock_count FROM products WHERE stock_quantity <= low_stock_threshold');
    stats.lowStock = lowStockRow.low_stock_count || 0;

    return stats;
});


function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    title: 'Zyphora Creations — PBilling',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  try {
    await initDb();
  } catch (err) {
    console.error('Error initializing database:', err);
  }

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
