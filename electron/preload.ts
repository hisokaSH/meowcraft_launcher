// Preload script for Electron
// Currently not used as contextIsolation is false for simplicity
// But included for future security improvements

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  
  // Authentication
  microsoftLogin: () => ipcRenderer.invoke('microsoft-login'),
  offlineLogin: (username: string) => ipcRenderer.invoke('offline-login', username),
  
  // Game launch
  launchGame: (accountData: any) => ipcRenderer.invoke('launch-game', accountData),
  
  // Discord
  initDiscord: () => ipcRenderer.invoke('init-discord'),
  updateDiscord: (details: string, state: string) => 
    ipcRenderer.invoke('update-discord', details, state),
  
  // System checks
  checkPrism: () => ipcRenderer.invoke('check-prism'),
});
