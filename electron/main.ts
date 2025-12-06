import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as https from 'https';
import * as crypto from 'crypto';  // For UUID generation
import { autoUpdater } from 'electron-updater';

// ✅ CHANGED: Using MSMC instead of prismarine-auth
import { Auth } from 'msmc';

// Discord RPC
const DiscordRPC = require('discord-rpc');
const clientId = '1427935073570652284'; // MeowCraft Discord app client ID
const rpc = new DiscordRPC.Client({ transport: 'ipc' });

let mainWindow: BrowserWindow | null = null;
let discordConnected = false;

// ===================================================================
// 🆕 AUTO-UPDATER CONFIGURATION
// ===================================================================
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  // Check for updates
  autoUpdater.checkForUpdates();

  autoUpdater.on('checking-for-update', () => {
    console.log('🔄 Checking for updates...');
    mainWindow?.webContents.send('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('📦 Update available:', info.version);
    mainWindow?.webContents.send('update-status', { 
      status: 'available', 
      version: info.version 
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('✓ Launcher is up to date');
    mainWindow?.webContents.send('update-status', { status: 'not-available' });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`⬇️ Downloading: ${Math.round(progress.percent)}%`);
    mainWindow?.webContents.send('update-status', { 
      status: 'downloading', 
      percent: Math.round(progress.percent) 
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    mainWindow?.webContents.send('update-status', { 
      status: 'downloaded', 
      version: info.version 
    });
    
    // Show dialog to restart
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: `MeowCraft Launcher ${info.version} has been downloaded.`,
      detail: 'The update will be installed when you restart the launcher.',
      buttons: ['Restart Now', 'Later']
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error.message);
    mainWindow?.webContents.send('update-status', { 
      status: 'error', 
      message: error.message 
    });
  });
}

// Configuration
const INSTANCE_NAME = 'Cobblemon';  // Changed from 'MeowCraft' to match ZIP contents
const SERVER_ADDRESS = 'meowcraft.play-network.io';
const INSTANCE_DOWNLOAD_URL = 'https://github.com/hisokaSH/meowcraft_modpack/releases/download/v1/Cobblemon-instance.zip';

// ===================================================================
// 🆕 DISCORD BOT CONFIGURATION
// ===================================================================
const DISCORD_BOT_CONFIG = {
  // Your Discord bot's API endpoint (Prof Oak via ngrok)
  apiUrl: 'https://exilable-nonseasonally-nilsa.ngrok-free.dev/api/assign-launcher-role',
  
  // Secret key to authenticate requests (MUST match Prof Oak's LAUNCHER_API_SECRET)
  apiSecret: 'meowcraft-launcher-2024-xK9mP2vL',
  
  // The role ID to assign to launcher users
  launcherRoleId: '1444384379941031980'
};

// ===================================================================
// 🆕 FUNCTION: Notify Discord bot to assign launcher role
// ===================================================================
async function notifyDiscordBot(minecraftUsername: string, minecraftUuid: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log('[Discord Role] Sending role assignment request...');
      console.log('[Discord Role] Username:', minecraftUsername);
      console.log('[Discord Role] UUID:', minecraftUuid);
      
      const url = new URL(DISCORD_BOT_CONFIG.apiUrl);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? require('https') : require('http');
      
      const postData = JSON.stringify({
        minecraftUsername: minecraftUsername,
        minecraftUuid: minecraftUuid,
        secret: DISCORD_BOT_CONFIG.apiSecret,
        roleId: DISCORD_BOT_CONFIG.launcherRoleId
      });
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = httpModule.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('[Discord Role] ✓ Role assignment request sent successfully');
            console.log('[Discord Role] Response:', data);
            resolve();
          } else {
            console.warn('[Discord Role] ⚠ Bot responded with status:', res.statusCode);
            console.warn('[Discord Role] Response:', data);
            // Don't reject - we don't want login to fail if role assignment fails
            resolve();
          }
        });
      });
      
      req.on('error', (error: any) => {
        console.warn('[Discord Role] ⚠ Failed to contact Discord bot:', error.message);
        // Don't reject - we don't want login to fail if the bot is unreachable
        resolve();
      });
      
      req.setTimeout(5000, () => {
        console.warn('[Discord Role] ⚠ Request timed out');
        req.destroy();
        resolve();
      });
      
      req.write(postData);
      req.end();
      
    } catch (error: any) {
      console.warn('[Discord Role] ⚠ Error sending request:', error.message);
      // Don't reject - login should still work even if role assignment fails
      resolve();
    }
  });
}

// Get Prism Launcher path (bundled in app)
function getPrismPath(): string {
  const isProduction = app.isPackaged;
  
  if (!isProduction) {
    // Development: use current working directory
    return path.join(process.cwd(), 'prism-launcher', 'PrismLauncher.exe');
  } else {
    // Production: look in the resources folder
    if (process.platform === 'win32') {
      return path.join(process.resourcesPath, 'prism-launcher', 'PrismLauncher.exe');
    } else if (process.platform === 'darwin') {
      return path.join(process.resourcesPath, 'prism-launcher', 'PrismLauncher.app', 'Contents', 'MacOS', 'PrismLauncher');
    } else {
      return path.join(process.resourcesPath, 'prism-launcher', 'PrismLauncher');
    }
  }
}

// Get bundled Prism data directory
function getBundledPrismDataPath(): string {
  const isProduction = app.isPackaged;
  
  if (!isProduction) {
    return path.join(process.cwd(), 'prism-data');
  } else {
    return path.join(process.resourcesPath, 'prism-data');
  }
}

// Get Prism Launcher data directory
function getPrismDataDir(): string {
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'PrismLauncher');
  } else if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'PrismLauncher');
  } else {
    return path.join(os.homedir(), '.local', 'share', 'PrismLauncher');
  }
}

// Initialize Prism data directory with bundled config
function initializePrismData() {
  const prismDataDir = getPrismDataDir();
  const bundledDataPath = getBundledPrismDataPath();
  
  // Create Prism data directory if it doesn't exist
  if (!fs.existsSync(prismDataDir)) {
    fs.mkdirSync(prismDataDir, { recursive: true });
  }
  
  // Copy config file if it doesn't exist
  const configFile = 'prismlauncher.cfg';
  const sourceConfig = path.join(bundledDataPath, configFile);
  const destConfig = path.join(prismDataDir, configFile);
  
  if (fs.existsSync(sourceConfig) && !fs.existsSync(destConfig)) {
    try {
      fs.copyFileSync(sourceConfig, destConfig);
      console.log('Prism config initialized');
    } catch (error) {
      console.error('Failed to copy Prism config:', error);
    }
  }
}

// ===================================================================
// Create offline account with FULL Prism format
// ===================================================================
function createOfflineAccount(username: string): boolean {
  const prismDataDir = getPrismDataDir();
  const accountsFile = path.join(prismDataDir, 'accounts.json');
  
  try {
    // Create data dir if it doesn't exist
    if (!fs.existsSync(prismDataDir)) {
      fs.mkdirSync(prismDataDir, { recursive: true });
    }
    
    // Generate proper UUID from username (Minecraft offline UUID format)
    const hash = crypto.createHash('md5').update(`OfflinePlayer:${username}`).digest('hex');
    const accountId = [
      hash.slice(0, 8),
      hash.slice(8, 12),
      '3' + hash.slice(13, 16), // Version 3 UUID
      ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.slice(18, 20),
      hash.slice(20, 32)
    ].join('-');
    
    console.log('[Account] Generated offline UUID:', accountId);
    
    // Create COMPLETE accounts structure (from old launcher)
    const accounts = {
      accounts: [],
      activeAccount: accountId,
      lastUsedAccount: accountId,  // Also needed!
      formatVersion: 3
    };
    
    console.log('Creating new offline account:', username);
    
    // Create account entry with COMPLETE Prism Launcher format
    const accountEntry: any = {
      type: 'Offline',
      entitlement: {
        canPlayMinecraft: true,
        ownsMinecraft: false  // Offline accounts don't "own" Minecraft
      },
      profile: {
        capes: [],
        id: accountId,
        name: username,
        skin: {  // Required by Prism!
          id: "",
          url: "",
          variant: ""
        }
      },
      ygg: {  // Yggdrasil auth data - Required by Prism!
        extra: {
          clientToken: accountId,
          userName: username
        },
        iat: Math.floor(Date.now() / 1000),
        token: "0"
      }
    };
    
    // Add the account
    accounts.accounts.push(accountEntry);
    
    // Write back to file
    fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2), 'utf8');
    console.log('✓ Offline account ready:', username);
    console.log('✓ Active account ID:', accounts.activeAccount);
    
    return true;
  } catch (error) {
    console.error('✗ Failed to create offline account:', error);
    return false;
  }
}

// ===================================================================
// ✅ NEW: Save Microsoft Account to Prism Launcher
// ===================================================================
function saveMicrosoftAccount(mcAuth: any): void {
  const prismDataDir = getPrismDataDir();
  const accountsFile = path.join(prismDataDir, 'accounts.json');
  
  try {
    console.log('[Microsoft Account] Saving to Prism Launcher...');
    
    // Create Prism data directory if it doesn't exist
    if (!fs.existsSync(prismDataDir)) {
      fs.mkdirSync(prismDataDir, { recursive: true });
      console.log('[Microsoft Account] Created Prism data directory');
    }
    
    // Read existing accounts.json or create new structure
    let accounts: any;
    if (fs.existsSync(accountsFile)) {
      accounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      console.log('[Microsoft Account] Loaded existing accounts.json');
    } else {
      accounts = {
        accounts: [],
        formatVersion: 3
      };
      console.log('[Microsoft Account] Created new accounts.json structure');
    }
    
    // Check if this account already exists (by UUID)
    const existingIndex = accounts.accounts.findIndex(
      (acc: any) => acc.profile?.id === mcAuth.uuid
    );
    
    // Create account entry in Prism Launcher format
    const accountEntry = {
      type: 'MSA',  // Microsoft Account type
      entitlement: {
        canPlayMinecraft: true,
        ownsMinecraft: true
      },
      profile: {
        id: mcAuth.uuid,
        name: mcAuth.name,
        skin: {
          id: '',
          url: '',
          variant: 'classic'
        },
        capes: []
      },
      ygg: {  // Yggdrasil auth data
        token: mcAuth.access_token,
        extra: {
          clientToken: mcAuth.uuid,
          userName: mcAuth.name
        },
        iat: Math.floor(Date.now() / 1000)
      }
    };
    
    if (existingIndex >= 0) {
      // Update existing account
      accounts.accounts[existingIndex] = accountEntry;
      console.log('[Microsoft Account] ✓ Updated existing account:', mcAuth.name);
    } else {
      // Add new account
      accounts.accounts.push(accountEntry);
      console.log('[Microsoft Account] ✓ Added new account:', mcAuth.name);
    }
    
    // Set this account as active
    accounts.activeAccount = mcAuth.uuid;
    accounts.lastUsedAccount = mcAuth.uuid;
    
    // Write to file with pretty formatting
    fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2), 'utf8');
    console.log('[Microsoft Account] ✓ Saved to:', accountsFile);
    console.log('[Microsoft Account] ✓ Active account:', mcAuth.uuid);
    
  } catch (error) {
    console.error('[Microsoft Account] ✗ Failed to save account:', error);
    // Don't throw - we still want login to succeed in the launcher
  }
}

// Download file from URL with progress tracking
async function downloadFile(url: string, dest: string, progressCallback?: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const handleResponse = (response: any) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
        const redirectUrl = response.headers.location;
        console.log('Following redirect to:', redirectUrl);
        https.get(redirectUrl, handleResponse).on('error', reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        if (progressCallback && totalSize) {
          progressCallback(Math.round((downloadedSize / totalSize) * 100));
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    };
    
    https.get(url, handleResponse).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete partial file
      reject(err);
    });
  });
}

// Extract ZIP file
async function extractZip(zipPath: string, destPath: string): Promise<void> {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destPath, true);
}

// Ensure instance exists
async function ensureInstanceExists(): Promise<boolean> {
  const prismDataDir = getPrismDataDir();
  const instancesDir = path.join(prismDataDir, 'instances');
  const instanceDir = path.join(instancesDir, INSTANCE_NAME);
  
  // Check if instance already exists
  if (fs.existsSync(instanceDir)) {
    console.log('Instance already exists:', instanceDir);
    return true;
  }
  
  console.log('Instance not found, downloading...');
  
  // Create instances directory if it doesn't exist
  if (!fs.existsSync(instancesDir)) {
    fs.mkdirSync(instancesDir, { recursive: true });
  }
  
  // Download the instance ZIP
  const zipPath = path.join(os.tmpdir(), 'meowcraft-instance.zip');
  
  try {
    // Send progress updates to renderer
    mainWindow?.webContents.send('instance-download-progress', {
      stage: 'downloading',
      progress: 0,
      message: 'Downloading MeowCraft modpack...'
    });
    
    await downloadFile(INSTANCE_DOWNLOAD_URL, zipPath, (progress) => {
      mainWindow?.webContents.send('instance-download-progress', {
        stage: 'downloading',
        progress: progress,
        message: `Downloading: ${progress}%`
      });
    });
    
    mainWindow?.webContents.send('instance-download-progress', {
      stage: 'extracting',
      progress: 100,
      message: 'Extracting modpack...'
    });
    
    // Extract to instances directory
    await extractZip(zipPath, instancesDir);
    
    // Clean up ZIP file
    fs.unlinkSync(zipPath);
    
    mainWindow?.webContents.send('instance-download-progress', {
      stage: 'complete',
      progress: 100,
      message: 'Installation complete!'
    });
    
    console.log('Instance installed successfully');
    return true;
    
  } catch (error) {
    console.error('Failed to download/install instance:', error);
    mainWindow?.webContents.send('instance-download-progress', {
      stage: 'error',
      progress: 0,
      message: 'Failed to install modpack'
    });
    return false;
  }
}

// Launch Minecraft with Prism Launcher
async function launchMinecraft(instanceName: string, username: string, accountType: string): Promise<{ success: boolean; error?: string }> {
  const prismPath = getPrismPath();
  
  if (!fs.existsSync(prismPath)) {
    return { success: false, error: 'Prism Launcher not found' };
  }
  
  // For offline accounts, create/update the account in Prism
  if (accountType === 'offline') {
    createOfflineAccount(username);
  }
  
  try {
    // Launch Prism with the instance
    const args = ['--launch', instanceName];
    
    console.log('Launching Prism:', prismPath);
    console.log('Arguments:', args);
    
    const prism = spawn(prismPath, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    prism.unref();
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Initialize Discord RPC
async function initDiscordRPC(): Promise<{ success: boolean }> {
  try {
    await rpc.login({ clientId });
    discordConnected = true;
    
    rpc.setActivity({
      details: 'In the Launcher',
      state: 'Preparing to play',
      largeImageKey: 'meowcraft_logo',
      largeImageText: 'MeowCraft',
      startTimestamp: new Date()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Discord RPC connection failed:', error);
    return { success: false };
  }
}

// Update Discord presence
function updateDiscordPresence(details: string, state: string) {
  if (discordConnected) {
    rpc.setActivity({
      details: details,
      state: state,
      largeImageKey: 'meowcraft_logo',
      largeImageText: 'MeowCraft',
      startTimestamp: new Date()
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.png')
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Initialize Prism data directory with bundled config
  initializePrismData();
  
  createWindow();

  // 🆕 Setup auto-updater (only in production)
  if (app.isPackaged) {
    setupAutoUpdater();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (discordConnected) {
      rpc.destroy();
    }
    app.quit();
  }
});

// IPC Handlers

// Window controls
ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('maximize-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) {
      win.restore();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('close-window', () => {
  mainWindow?.close();
});

// ===================================================================
// ✅ FIXED: Microsoft Login with MSMC (OAuth Popup)
// ✅ NEW: Now also notifies Discord bot to assign launcher role!
// ===================================================================
ipcMain.handle('microsoft-login', async () => {
  try {
    console.log('=======================================================');
    console.log('=== MICROSOFT LOGIN STARTING (MSMC OAuth Popup) ===');
    console.log('=======================================================');
    
    // Step 1: Create auth manager
    console.log('✓ Creating auth manager...');
    const authManager = new Auth('select_account');
    
    // Step 2: Launch OAuth popup window
    // This opens a popup window automatically (not browser tabs!)
    console.log('Opening Microsoft login popup window...');
    const xboxManager = await authManager.launch('electron');
    console.log('✓ OAuth login successful');
    
    // Step 3: Get Minecraft token
    console.log('Fetching Minecraft token...');
    const minecraftToken = await xboxManager.getMinecraft();
    console.log('✓ Minecraft token received');
    
    // Step 4: Get Minecraft profile
    console.log('Fetching Minecraft profile...');
    const mcAuth = minecraftToken.mclc();
    console.log('✓ Profile retrieved');
    
    console.log('=======================================================');
    console.log('=== MICROSOFT LOGIN COMPLETE ===');
    console.log('Username:', mcAuth.name);
    console.log('UUID:', mcAuth.uuid);
    console.log('=======================================================');
    
    // Step 5: Save to Prism Launcher
    saveMicrosoftAccount(mcAuth);
    
    // 🆕 Step 6: Notify Discord bot to assign launcher role
    console.log('=======================================================');
    console.log('=== NOTIFYING DISCORD BOT ===');
    console.log('=======================================================');
    await notifyDiscordBot(mcAuth.name, mcAuth.uuid);
    
    // Step 7: Return account data to renderer
    return {
      success: true,
      account: {
        username: mcAuth.name,
        uuid: mcAuth.uuid,
        type: 'microsoft',
        accessToken: mcAuth.access_token,
        profile: {
          id: mcAuth.uuid,
          name: mcAuth.name
        }
      }
    };
  } catch (error: any) {
    console.error('=======================================================');
    console.error('=== MICROSOFT LOGIN ERROR ===');
    console.error('Error:', error.message);
    console.error('=======================================================');
    
    // Handle user cancellation gracefully
    if (error.message?.includes('user') && error.message?.includes('cancel')) {
      return { 
        success: false, 
        error: 'Login cancelled by user' 
      };
    }
    
    // Generic error
    return { 
      success: false, 
      error: error.message || 'Microsoft login failed. Please try again.' 
    };
  }
});

// Offline/Cracked Authentication
ipcMain.handle('offline-login', async (event, username: string) => {
  if (!username || username.length < 3 || username.length > 16) {
    return { success: false, error: 'Username must be between 3 and 16 characters' };
  }

  // 🆕 Notify Discord bot for cracked users too
  console.log('=======================================================');
  console.log('=== NOTIFYING DISCORD BOT (Offline Login) ===');
  console.log('=======================================================');
  await notifyDiscordBot(username, 'offline-' + username.toLowerCase());

  return {
    success: true,
    account: {
      username: username,
      uuid: 'offline-' + username,
      type: 'offline'
    }
  };
});

// ===================================================================
// ✅ UPDATED: Launch game with account type support
// ===================================================================
ipcMain.handle('launch-game', async (event, accountData) => {
  console.log('Launch game requested with account:', accountData);
  
  // Ensure instance exists
  const instanceReady = await ensureInstanceExists();
  if (!instanceReady) {
    return { success: false, error: 'Failed to download game instance' };
  }

  // Launch with the provided account data
  const username = accountData?.username || 'Player';
  const accountType = accountData?.type || 'offline';
  
  const result = await launchMinecraft(INSTANCE_NAME, username, accountType);
  
  return result;
});

// Discord RPC
ipcMain.handle('init-discord', async () => {
  return await initDiscordRPC();
});

ipcMain.handle('update-discord', async (event, details: string, state: string) => {
  updateDiscordPresence(details, state);
  return { success: true };
});

// Check if Prism Launcher is bundled
ipcMain.handle('check-prism', async () => {
  const prismPath = getPrismPath();
  const exists = fs.existsSync(prismPath);
  
  console.log('=== PRISM LAUNCHER CHECK ===');
  console.log('Looking for Prism at:', prismPath);
  console.log('Exists:', exists);
  console.log('Is packaged:', app.isPackaged);
  console.log('Process cwd:', process.cwd());
  if (!app.isPackaged) {
    console.log('Development mode - expecting prism-launcher/PrismLauncher.exe');
  }
  console.log('===========================');
  
  return {
    installed: exists,
    path: prismPath
  };
});

// 🆕 Check for updates manually
ipcMain.handle('check-for-updates', async () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
    return { success: true };
  }
  return { success: false, reason: 'Development mode' };
});

// 🆕 Get current app version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Download instance
ipcMain.handle('download-instance', async () => {
  try {
    const success = await ensureInstanceExists();
    return { success };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Diagnostic handler to check Prism setup
ipcMain.handle('diagnose-prism', async () => {
  const prismDataDir = getPrismDataDir();
  const instancesDir = path.join(prismDataDir, 'instances');
  const instanceDir = path.join(instancesDir, INSTANCE_NAME);
  
  const diagnosis = {
    prismDataDir: prismDataDir,
    prismDataDirExists: fs.existsSync(prismDataDir),
    
    instancesDir: instancesDir,
    instancesDirExists: fs.existsSync(instancesDir),
    
    instanceDir: instanceDir,
    instanceExists: fs.existsSync(instanceDir),
    
    instanceFiles: [] as string[],
    
    accountsFile: path.join(prismDataDir, 'accounts.json'),
    accountsFileExists: fs.existsSync(path.join(prismDataDir, 'accounts.json')),
    
    configFile: path.join(prismDataDir, 'prismlauncher.cfg'),
    configFileExists: fs.existsSync(path.join(prismDataDir, 'prismlauncher.cfg'))
  };
  
  // Check instance files
  if (fs.existsSync(instanceDir)) {
    try {
      diagnosis.instanceFiles = fs.readdirSync(instanceDir);
    } catch (error) {
      diagnosis.instanceFiles = [`Error: ${error}`];
    }
  }
  
  console.log('=== PRISM DIAGNOSTIC ===');
  console.log(JSON.stringify(diagnosis, null, 2));
  console.log('========================');
  
  return diagnosis;
});

export {};