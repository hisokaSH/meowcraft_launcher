import { useState, useEffect } from 'react';
import './App.css';

const { ipcRenderer } = window.require('electron');

interface Account {
  username: string;
  uuid: string;
  type: 'microsoft' | 'offline';
}

type View = 'welcome' | 'login' | 'launcher';

function App() {
  const [currentView, setCurrentView] = useState<View>('welcome');
  const [account, setAccount] = useState<Account | null>(null);
  const [offlineUsername, setOfflineUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [launchStatus, setLaunchStatus] = useState('');
  const [prismInstalled, setPrismInstalled] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    active: boolean;
    stage: string;
    progress: number;
    message: string;
  }>({
    active: false,
    stage: '',
    progress: 0,
    message: ''
  });

  useEffect(() => {
    ipcRenderer.invoke('check-prism').then((result: any) => {
      setPrismInstalled(result.installed);
      if (!result.installed) {
        setError('Prism Launcher not found. Please install it first.');
      }
    });

    ipcRenderer.invoke('init-discord').then((result: any) => {
      if (result.success) {
        console.log('Discord RPC connected');
      }
    });

    // Listen for instance download progress
    const handleDownloadProgress = (_event: any, data: any) => {
      setDownloadProgress({
        active: true,
        stage: data.stage,
        progress: data.progress,
        message: data.message
      });

      // Hide progress after completion
      if (data.stage === 'complete') {
        setTimeout(() => {
          setDownloadProgress({
            active: false,
            stage: '',
            progress: 0,
            message: ''
          });
        }, 2000);
      }
    };

    ipcRenderer.on('instance-download-progress', handleDownloadProgress);

    // Cleanup
    return () => {
      ipcRenderer.removeListener('instance-download-progress', handleDownloadProgress);
    };
  }, []);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await ipcRenderer.invoke('microsoft-login');
      
      if (result.success) {
        setAccount(result.account);
        setCurrentView('launcher');
      } else {
        setError(result.error || 'Microsoft login failed');
      }
    } catch (err: any) {
      setError('Authentication error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineLogin = async () => {
    if (offlineUsername.length < 3 || offlineUsername.length > 16) {
      setError('Username must be between 3 and 16 characters');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await ipcRenderer.invoke('offline-login', offlineUsername);
      
      if (result.success) {
        setAccount(result.account);
        setCurrentView('launcher');
      } else {
        setError(result.error || 'Offline login failed');
      }
    } catch (err: any) {
      setError('Authentication error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!account) return;
    if (!prismInstalled) {
      setError('Prism Launcher must be installed to play');
      return;
    }

    setIsLaunching(true);
    setError('');
    setLaunchStatus('Preparing to launch...');

    try {
      const result = await ipcRenderer.invoke('launch-game', account);
      
      if (result.success) {
        setLaunchStatus('Starting Prism Launcher...');
        
        setTimeout(() => {
          setLaunchStatus('Loading instance...');
        }, 1000);
        
        setTimeout(() => {
          setLaunchStatus('Minecraft is starting...');
        }, 2000);
        
        setTimeout(() => {
          setLaunchStatus('Game launched! Check Prism Launcher window.');
          setTimeout(() => {
            setLaunchStatus('');
            setIsLaunching(false);
          }, 3000);
        }, 4000);
        
        await ipcRenderer.invoke('update-discord', 'Playing on MeowCraft', 'Catching Pokémon');
      } else {
        setError(result.error || 'Failed to launch Minecraft');
        setLaunchStatus('');
        setIsLaunching(false);
      }
    } catch (err: any) {
      setError('Launch error: ' + err.message);
      setLaunchStatus('');
      setIsLaunching(false);
    }
  };

  const handleLogout = () => {
    setAccount(null);
    setCurrentView('welcome');
    setOfflineUsername('');
    setError('');
    setLaunchStatus('');
  };

  const minimizeWindow = () => {
    ipcRenderer.send('minimize-window');
  };

  const maximizeWindow = () => {
    ipcRenderer.send('maximize-window');
  };

  const closeWindow = () => {
    ipcRenderer.send('close-window');
  };

  // ✅ NEW: Open external links
  const openDiscord = () => {
    window.require('electron').shell.openExternal('https://discord.gg/wQJ7ZcVbRe');
  };

  const openWebsite = () => {
    window.require('electron').shell.openExternal('https://nearcsx.dev');
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-red-950/40 via-gray-900 to-purple-950/40 flex flex-col overflow-hidden">
      {/* Title Bar - Now Draggable! */}
      <div 
        className="h-8 bg-gray-900/95 flex items-center justify-between px-4 select-none border-b border-gray-800"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2 text-sm text-gray-300 font-medium">
          <img 
            src="https://i.ibb.co/8n39QhcC/Adobe-Express-file.png" 
            alt="Logo" 
            className="w-5 h-5 rounded-full"
          />
          <span>MeowCraft Launcher</span>
        </div>

        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={minimizeWindow}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 transition-colors rounded text-gray-400 hover:text-white"
            title="Minimize"
          >
            <svg width="12" height="2" viewBox="0 0 12 2" fill="currentColor">
              <rect width="12" height="2" />
            </svg>
          </button>

          <button
            onClick={maximizeWindow}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 transition-colors rounded text-gray-400 hover:text-white"
            title="Maximize"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="0.5" y="0.5" width="11" height="11" />
            </svg>
          </button>

          <button
            onClick={closeWindow}
            className="w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors rounded text-gray-400 hover:text-white"
            title="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M0 0 L12 12 M12 0 L0 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Welcome Page with Background Image */}
        {currentView === 'welcome' && (
          <div 
            className="h-full flex flex-col items-center justify-center p-8"
            style={{
              backgroundImage: 'url(https://i.ibb.co/5XkShDNx/image-2025-11-08-220243333.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Logo with bounce animation */}
            <div className="mb-6 animate-bounce">
              <img 
                src="https://i.ibb.co/8n39QhcC/Adobe-Express-file.png" 
                alt="MeowCraft Logo" 
                className="w-32 h-32"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>

            <h1 className="text-6xl font-bold mb-2">
              <span className="text-pink-400">Welcome </span>
              <span className="text-yellow-400">Trainer!</span>
            </h1>
            
            <p className="text-2xl text-gray-900 mb-3 font-bold" style={{ textShadow: '0 0 20px rgba(255,255,255,0.9), 0 0 10px rgba(255,255,255,0.8), 2px 2px 4px rgba(0,0,0,0.5)' }}>
              MeowCraft Launcher
            </p>
            
            <p className="text-gray-900 mb-12 text-center max-w-2xl font-semibold text-lg" style={{ textShadow: '0 0 15px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.7), 2px 2px 4px rgba(0,0,0,0.4)' }}>
              Embark on your Pokémon journey in Minecraft! Catch, train, and battle<br />
              with your favorite Pokémon in this incredible mod experience.
            </p>

            {/* Feature Cards */}
            <div className="grid grid-cols-3 gap-6 mb-12 max-w-4xl w-full">
              <div className="bg-gradient-to-br from-gray-800/20 to-gray-900/30 backdrop-blur rounded-2xl p-6 border border-gray-700/30 hover:border-yellow-500/50 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl flex items-center justify-center mb-4 border border-red-500/30">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                </div>
                <h3 className="text-yellow-400 font-bold text-lg mb-2">One-Click Launch</h3>
                <p className="text-gray-900 text-sm font-semibold" style={{ textShadow: '0 0 10px rgba(255,255,255,0.8), 1px 1px 3px rgba(0,0,0,0.3)' }}>Start instantly with Prism Launcher</p>
              </div>

              <div className="bg-gradient-to-br from-gray-800/20 to-gray-900/30 backdrop-blur rounded-2xl p-6 border border-gray-700/30 hover:border-yellow-500/50 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl flex items-center justify-center mb-4 border border-yellow-500/30">
                  <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-yellow-400 font-bold text-lg mb-2">Quick Launch</h3>
                <p className="text-gray-900 text-sm font-semibold" style={{ textShadow: '0 0 10px rgba(255,255,255,0.8), 1px 1px 3px rgba(0,0,0,0.3)' }}>Start your adventure instantly</p>
              </div>

              <div className="bg-gradient-to-br from-gray-800/20 to-gray-900/30 backdrop-blur rounded-2xl p-6 border border-gray-700/30 hover:border-yellow-500/50 transition-all">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl flex items-center justify-center mb-4 border border-orange-500/30">
                  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-yellow-400 font-bold text-lg mb-2">Auto-Connect</h3>
                <p className="text-gray-900 text-sm font-semibold" style={{ textShadow: '0 0 10px rgba(255,255,255,0.8), 1px 1px 3px rgba(0,0,0,0.3)' }}>Join the server automatically</p>
              </div>
            </div>

            <button
              onClick={() => setCurrentView('login')}
              className="px-16 py-5 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-600 hover:via-orange-600 hover:to-yellow-600 text-white font-bold text-xl rounded-xl shadow-2xl hover:shadow-orange-500/50 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
              Begin Your Journey
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>

            <p className="mt-8 text-gray-900 text-sm font-semibold" style={{ textShadow: '0 0 15px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.7), 2px 2px 4px rgba(0,0,0,0.4)' }}>
              Ready to catch 'em all in Minecraft? Let's get started!
            </p>
          </div>
        )}

        {/* Login Page */}
        {currentView === 'login' && (
          <div className="h-full flex flex-col p-8">
            <button
              onClick={() => setCurrentView('welcome')}
              className="self-start flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Back</span>
            </button>

            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md bg-gradient-to-br from-gray-800/30 to-gray-900/50 backdrop-blur-xl rounded-3xl p-10 border border-yellow-500/30 shadow-2xl">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>

                <h2 className="text-3xl font-bold text-center mb-2 text-yellow-400">
                  Choose Your Path
                </h2>
                <p className="text-center text-gray-400 mb-8">
                  Select your login method to begin
                </p>

                <button
                  onClick={handleMicrosoftLogin}
                  disabled={isLoading}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 mb-6 shadow-lg hover:shadow-blue-500/50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  {isLoading ? 'Opening Microsoft Login...' : 'Login with Microsoft'}
                </button>

                <p className="text-center text-xs text-gray-500 mb-6">
                  A browser window will open for secure Microsoft authentication
                </p>

                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-gray-700"></div>
                  <span className="text-yellow-500 font-medium text-sm">or play offline</span>
                  <div className="flex-1 h-px bg-gray-700"></div>
                </div>

                <div className="space-y-4">
                  <label className="block text-yellow-400 font-bold text-sm">
                    Trainer Name
                  </label>
                  
                  <input
                    type="text"
                    value={offlineUsername}
                    onChange={(e) => setOfflineUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleOfflineLogin()}
                    placeholder="Enter your trainer name"
                    className="w-full px-5 py-4 bg-gray-900/50 border-2 border-yellow-500/50 focus:border-yellow-400 rounded-xl text-white placeholder-gray-500 outline-none transition-all"
                    maxLength={16}
                  />

                  <button
                    onClick={handleOfflineLogin}
                    disabled={!offlineUsername.trim() || isLoading}
                    className="w-full py-4 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 disabled:from-gray-800 disabled:to-gray-900 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                    Start Adventure
                  </button>
                </div>

                <div className="mt-6 p-4 bg-gray-900/50 rounded-xl border border-yellow-500/20 flex gap-3">
                  <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-gray-400">
                    <span className="text-yellow-400 font-semibold">Offline mode</span> lets you play without a Minecraft account.
                    Microsoft login provides full features and official server access.
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 rounded-lg text-sm text-center bg-red-900/30 text-red-400 border border-red-700">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Launcher Page */}
        {currentView === 'launcher' && account && (
          <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-y-auto">
            <div className="p-8 border-b border-gray-700/50">
              <div className="flex items-center justify-between max-w-6xl mx-auto">
                <div>
                  <h1 className="text-4xl font-bold mb-1">
                    <span className="text-orange-400">Welcome, </span>
                    <span className="text-yellow-400">{account.username}!</span>
                  </h1>
                  <p className="text-gray-400">Ready to start your adventure?</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white rounded-xl transition-all border border-gray-600/50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>

            <div className="flex-1 p-8">
              <div className="max-w-6xl mx-auto space-y-6">
                
                {/* ✅ UPDATED: Server Information with new IP */}
                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur rounded-2xl p-8 border border-yellow-500/30">
                  <div className="flex items-center gap-3 mb-4">
                    <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                    <h2 className="text-2xl font-bold text-yellow-400">Server Information</h2>
                  </div>
                  
                  <div className="inline-block px-4 py-2 bg-gray-900/70 rounded-lg font-mono text-gray-300 border border-gray-700">
                    meowcraft.play-network.io
                  </div>

                  {/* ✅ NEW: Discord and Website buttons */}
                  <div className="flex gap-4 mt-6">
                    <button
                      onClick={openDiscord}
                      className="flex-1 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-[#5865F2]/50"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      Join Discord
                    </button>

                    <button
                      onClick={openWebsite}
                      className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-purple-500/50"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      Visit Website
                    </button>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur rounded-2xl p-8 border border-yellow-500/30">
                  <div className="flex items-center gap-3 mb-6">
                    <svg className="w-7 h-7 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-yellow-400">Launcher Status</h2>
                  </div>

                  <p className="text-gray-400 mb-6">Minecraft 1.21.1 with Fabric 0.17.3</p>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between items-center py-3 border-b border-gray-700/50">
                      <span className="text-gray-400">Prism Launcher:</span>
                      <span className="flex items-center gap-2 text-green-400 font-semibold">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Ready
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-3 border-b border-gray-700/50">
                      <span className="text-gray-400">Instance:</span>
                      <span className="text-yellow-400 font-semibold">Cobblemon</span>
                    </div>

                    <div className="flex justify-between items-center py-3">
                      <span className="text-gray-400">Total Mods:</span>
                      <span className="text-yellow-400 font-semibold">260+</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLaunch}
                    disabled={isLaunching || !prismInstalled || downloadProgress.active}
                    className={`w-full py-5 rounded-xl font-bold text-xl transition-all transform flex items-center justify-center gap-3 shadow-2xl ${
                      isLaunching || !prismInstalled || downloadProgress.active
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-600 hover:via-orange-600 hover:to-yellow-600 hover:scale-[1.02] active:scale-[0.98] hover:shadow-orange-500/50'
                    } text-white`}
                  >
                    {downloadProgress.active ? (
                      <>
                        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{downloadProgress.stage === 'extracting' ? 'Extracting...' : 'Downloading...'}</span>
                      </>
                    ) : isLaunching ? (
                      <>
                        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Launching...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Start Adventure!</span>
                      </>
                    )}
                  </button>

                  {/* Download Progress */}
                  {downloadProgress.active && (
                    <div className="mt-6 p-6 bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-500/30">
                      <div className="flex items-center gap-3 mb-4">
                        <svg className="w-6 h-6 text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <h3 className="text-xl font-bold text-blue-400">
                          {downloadProgress.stage === 'downloading' ? 'Downloading MeowCraft Modpack' : 'Installing Modpack'}
                        </h3>
                      </div>

                      <p className="text-gray-300 mb-4">{downloadProgress.message}</p>

                      {/* Progress Bar */}
                      {downloadProgress.stage === 'downloading' && (
                        <div className="w-full bg-gray-700/50 rounded-full h-4 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out rounded-full flex items-center justify-center"
                            style={{ width: `${downloadProgress.progress}%` }}
                          >
                            <span className="text-xs font-bold text-white">{downloadProgress.progress}%</span>
                          </div>
                        </div>
                      )}

                      {downloadProgress.stage === 'extracting' && (
                        <div className="flex items-center gap-2 text-purple-400">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span className="font-medium">Extracting files, please wait...</span>
                        </div>
                      )}

                      <div className="mt-4 p-3 bg-yellow-900/20 rounded-lg border border-yellow-500/30 flex gap-2">
                        <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-yellow-200">
                          <strong>First-time setup:</strong> This may take 1-2 minutes. Please be patient while we download and install the modpack. This only happens once!
                        </p>
                      </div>
                    </div>
                  )}

                  {(launchStatus || error) && (
                    <div className={`mt-4 p-4 rounded-xl text-sm text-center font-medium ${
                      error
                        ? 'bg-red-900/30 text-red-400 border border-red-700'
                        : launchStatus.includes('Game launched')
                        ? 'bg-green-900/30 text-green-400 border border-green-700'
                        : 'bg-blue-900/30 text-blue-400 border border-blue-700'
                    }`}>
                      {error ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {error}
                        </div>
                      ) : launchStatus.includes('Game launched') ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {launchStatus}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {launchStatus}
                        </div>
                      )}
                    </div>
                  )}

                  {!prismInstalled && (
                    <div className="mt-4 p-4 bg-yellow-900/30 text-yellow-400 border border-yellow-700 rounded-xl text-sm">
                      ⚠️ Prism Launcher is not installed. Please download it from <a href="https://prismlauncher.org" target="_blank" rel="noopener noreferrer" className="underline">prismlauncher.org</a>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;