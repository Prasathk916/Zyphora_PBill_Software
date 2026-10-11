// --- Browser Mode Fallback (if opened directly without Electron) ---
if (!window.api) {
    console.warn("Desktop API not detected. Falling back to Browser Mode with LocalStorage.");
    
    if (!localStorage.getItem('zyphora_products')) {
        const initialProducts = [
            { id: 1, sku: 'SKU-DEMO-01', name: 'Premium Wireless Mouse', category: 'Electronics', purchase_price: 15.0, selling_price: 29.99, stock_quantity: 50, low_stock_threshold: 10 },
            { id: 2, sku: 'SKU-DEMO-02', name: 'Mechanical Keyboard', category: 'Electronics', purchase_price: 40.0, selling_price: 89.99, stock_quantity: 15, low_stock_threshold: 20 },
            { id: 3, sku: 'SKU-DEMO-03', name: 'USB-C Charging Cable', category: 'Accessories', purchase_price: 2.0, selling_price: 9.99, stock_quantity: 5, low_stock_threshold: 10 },
            { id: 4, sku: 'SKU-DEMO-04', name: 'Ergonomic Desk Chair', category: 'Furniture', purchase_price: 80.0, selling_price: 150.0, stock_quantity: 0, low_stock_threshold: 5 }
        ];
        localStorage.setItem('zyphora_products', JSON.stringify(initialProducts));
    }

    window.api = {
        getProducts: async (search = '', category = '') => {
            const products = JSON.parse(localStorage.getItem('zyphora_products') || '[]');
            return products.filter(p => {
                const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
                const matchCat = !category || p.category === category;
                return matchSearch && matchCat;
            });
        },
        addProduct: async (product) => {
            const products = JSON.parse(localStorage.getItem('zyphora_products') || '[]');
            if (products.some(p => p.sku === product.sku)) {
                return { success: false, error: 'SKU must be unique' };
            }
            const newProduct = { ...product, id: Date.now() };
            products.push(newProduct);
            localStorage.setItem('zyphora_products', JSON.stringify(products));
            return { success: true, id: newProduct.id };
        },
        updateProduct: async (id, updated) => {
            const products = JSON.parse(localStorage.getItem('zyphora_products') || '[]');
            const index = products.findIndex(p => String(p.id) === String(id));
            if (index === -1) return { success: false, error: 'Product not found' };
            if (products.some(p => p.sku === updated.sku && String(p.id) !== String(id))) {
                return { success: false, error: 'SKU must be unique' };
            }
            products[index] = { ...products[index], ...updated, id: products[index].id };
            localStorage.setItem('zyphora_products', JSON.stringify(products));
            return { success: true };
        },
        updateStock: async (id, quantityChange) => {
            const products = JSON.parse(localStorage.getItem('zyphora_products') || '[]');
            const index = products.findIndex(p => String(p.id) === String(id));
            if (index === -1) return { success: false, error: 'Product not found' };
            const newStock = products[index].stock_quantity + parseInt(quantityChange);
            if (newStock < 0) return { success: false, error: 'Stock cannot be negative' };
            products[index].stock_quantity = newStock;
            localStorage.setItem('zyphora_products', JSON.stringify(products));
            return { success: true, newStock };
        },
        getDashboardStats: async () => {
            const products = JSON.parse(localStorage.getItem('zyphora_products') || '[]');
            const totalStock = products.reduce((acc, p) => acc + (p.stock_quantity || 0), 0);
            const lowStock = products.filter(p => p.stock_quantity <= p.low_stock_threshold).length;
            return { totalStock, lowStock };
        }
    };
}

// --- Navigation Logic ---
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');
    
    const targetNav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
    if (targetNav) targetNav.classList.add('active');

    if (viewId === 'dashboard-view') loadDashboardStats();
    if (viewId === 'products-view') loadProducts();
}

document.querySelectorAll('.nav-item').forEach(navItem => {
    navItem.addEventListener('click', (e) => {
        e.preventDefault();
        switchView(navItem.getAttribute('data-target'));
    });
});

document.getElementById('btn-new-bill').addEventListener('click', () => switchView('new-bill-view'));
document.getElementById('btn-add-product').addEventListener('click', () => switchView('products-view'));
document.getElementById('btn-view-reports').addEventListener('click', () => switchView('reports-view'));

// --- Dashboard Logic ---
async function loadDashboardStats() {
    try {
        const stats = await window.api.getDashboardStats();
        document.getElementById('dashboard-total-stock').innerText = stats.totalStock;
        document.getElementById('dashboard-low-stock').innerText = stats.lowStock;
    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

// --- Products & Stock Logic ---
const productsTableBody = document.getElementById('products-table-body');
const searchInput = document.getElementById('product-search');
const categoryFilter = document.getElementById('product-category-filter');
const loadingMsg = document.getElementById('products-loading');
const emptyMsg = document.getElementById('products-empty');

async function loadProducts() {
    productsTableBody.innerHTML = '';
    loadingMsg.style.display = 'block';
    emptyMsg.style.display = 'none';

    try {
        const search = searchInput.value;
        const category = categoryFilter.value;
        const products = await window.api.getProducts(search, category);
        
        loadingMsg.style.display = 'none';
        
        if (products.length === 0) {
            emptyMsg.style.display = 'block';
            return;
        }

        products.forEach(p => {
            const tr = document.createElement('tr');
            
            let stockBadge = `<span class="badge success">In Stock</span>`;
            if (p.stock_quantity === 0) stockBadge = `<span class="badge danger">Out of Stock</span>`;
            else if (p.stock_quantity <= p.low_stock_threshold) stockBadge = `<span class="badge warning">Low Stock</span>`;

            tr.innerHTML = `
                <td>${p.sku}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.category}</td>
                <td>$${p.selling_price.toFixed(2)}</td>
                <td>${p.stock_quantity}</td>
                <td>${stockBadge}</td>
                <td class="actions-cell">
                    <button class="btn secondary small edit-btn" data-product='${JSON.stringify(p)}'>Edit</button>
                    <button class="btn primary small stock-btn" data-id="${p.id}" data-name="${p.name}">Stock</button>
                </td>
            `;
            productsTableBody.appendChild(tr);
        });

        // Bind edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const product = JSON.parse(e.target.getAttribute('data-product'));
                openProductModal(product);
            });
        });

        // Bind stock buttons
        document.querySelectorAll('.stock-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const name = e.target.getAttribute('data-name');
                openStockModal(id, name);
            });
        });

    } catch(err) {
        loadingMsg.innerText = "Error loading products: " + err.message;
    }
}

searchInput.addEventListener('input', () => loadProducts());
categoryFilter.addEventListener('change', () => loadProducts());

// --- Product Modal Logic ---
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const productFormError = document.getElementById('product-form-error');

document.getElementById('btn-show-add-product').addEventListener('click', () => {
    openProductModal();
});

document.querySelectorAll('.close-modal, .close-modal-btn').forEach(el => {
    el.addEventListener('click', () => {
        productModal.classList.remove('show');
    });
});

function openProductModal(product = null) {
    productFormError.style.display = 'none';
    productForm.reset();
    
    if (product) {
        document.getElementById('modal-title').innerText = 'Edit Product';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-sku').value = product.sku;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-purchase').value = product.purchase_price;
        document.getElementById('product-selling').value = product.selling_price;
        document.getElementById('product-stock').value = product.stock_quantity;
        document.getElementById('product-alert').value = product.low_stock_threshold;
    } else {
        document.getElementById('modal-title').innerText = 'Add Product';
        document.getElementById('product-id').value = '';
    }
    
    productModal.classList.add('show');
}

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    productFormError.style.display = 'none';
    
    const id = document.getElementById('product-id').value;
    const product = {
        sku: document.getElementById('product-sku').value,
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        purchase_price: parseFloat(document.getElementById('product-purchase').value),
        selling_price: parseFloat(document.getElementById('product-selling').value),
        stock_quantity: parseInt(document.getElementById('product-stock').value),
        low_stock_threshold: parseInt(document.getElementById('product-alert').value)
    };

    let result;
    if (id) {
        result = await window.api.updateProduct(id, product);
    } else {
        result = await window.api.addProduct(product);
    }

    if (result.success) {
        productModal.classList.remove('show');
        loadProducts();
    } else {
        productFormError.innerText = result.error;
        productFormError.style.display = 'block';
    }
});

// --- Stock Update Modal Logic ---
const stockModal = document.getElementById('stock-modal');
const stockForm = document.getElementById('stock-form');
const stockFormError = document.getElementById('stock-form-error');

document.querySelectorAll('.close-stock-modal, .close-stock-modal-btn').forEach(el => {
    el.addEventListener('click', () => {
        stockModal.classList.remove('show');
    });
});

function openStockModal(id, name) {
    stockFormError.style.display = 'none';
    stockForm.reset();
    document.getElementById('stock-product-id').value = id;
    document.getElementById('stock-product-name').innerText = name;
    stockModal.classList.add('show');
}

stockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    stockFormError.style.display = 'none';
    
    const id = document.getElementById('stock-product-id').value;
    const qtyChange = parseInt(document.getElementById('stock-change').value);
    
    const result = await window.api.updateStock(id, qtyChange);
    
    if (result.success) {
        stockModal.classList.remove('show');
        loadProducts();
    } else {
        stockFormError.innerText = result.error;
        stockFormError.style.display = 'block';
    }
});

// Initial load
loadDashboardStats();
