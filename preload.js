// preload.js
// This file runs before the web page loads. It has access to Node.js APIs.
// We use contextBridge to safely expose specific functions to the frontend (renderer.js)
// without giving the frontend full access to your computer.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // We will add functions here later when we need to communicate with the backend
});
