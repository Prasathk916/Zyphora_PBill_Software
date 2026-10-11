const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getProducts: (search, category) => ipcRenderer.invoke('get-products', search, category),
  addProduct: (product) => ipcRenderer.invoke('add-product', product),
  updateProduct: (id, product) => ipcRenderer.invoke('update-product', id, product),
  updateStock: (id, quantityChange) => ipcRenderer.invoke('update-stock', id, quantityChange),
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats')
});
