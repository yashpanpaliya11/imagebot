import React, { useState, useEffect } from 'react';
import './index.css';

const STYLE_PRESETS = [
  "Cinematic Lighting",
  "Anime Aesthetic",
  "Cyberpunk Neon",
  "Watercolor Painting",
  "3D Render Unreal Engine",
  "Vintage Photography"
];

function App() {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Custom Token Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customToken, setCustomToken] = useState(() => {
    return localStorage.getItem('hf_custom_token') || '';
  });

  // Recent Context
  const [recentMasterpieces, setRecentMasterpieces] = useState([]);

  // Persistence (Prompts only for localStorage, Images for session)
  useEffect(() => {
    const savedPrompts = localStorage.getItem('recent_prompts');
    if (savedPrompts) {
      const parsed = JSON.parse(savedPrompts);
      // We start with prompts, images will fill in as the user works
      setRecentMasterpieces(parsed.map(p => ({ prompt: p, url: null })));
    }
  }, []);

  // Theme Management
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Only show if no custom token exists AND no system token exists
    const hasCustom = localStorage.getItem('hf_custom_token')?.startsWith('hf_');
    const hasSystem = import.meta.env.VITE_HF_API_TOKEN?.startsWith('hf_');
    return !hasCustom && !hasSystem;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const [imageCache, setImageCache] = useState({});
  const [toast, setToast] = useState({ message: '', visible: false });

  const showToast = (message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  };

  const saveToken = () => {
    if (customToken && !customToken.startsWith('hf_')) {
      setError('Invalid token format! Must start with hf_');
      return;
    }
    localStorage.setItem('hf_custom_token', customToken);
    setIsSettingsOpen(false);
    setShowOnboarding(false);
    setError('');
    showToast(customToken ? 'Token Activated! 🚀' : 'Using Default Token ✅');
  };

  const clearHistory = () => {
    setRecentMasterpieces([]);
    localStorage.removeItem('recent_prompts');
    showToast('History Cleared 🗑️');
  };

  const addStyleToPrompt = (style) => {
    if (prompt.includes(style)) return;
    const newPrompt = prompt ? `${prompt}, ${style}` : style;
    setPrompt(newPrompt);
    showToast(`Style: ${style} Added!`);
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    const currentPrompt = prompt.trim();

    if (imageCache[currentPrompt]) {
      setImageUrl(imageCache[currentPrompt]);
      setError('');
      showToast('Loaded from Cache! ⚡');
      return;
    }

    setLoading(true);
    setError('');
    setImageUrl(null);

    const API_URL = "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0";
    const API_TOKEN = (customToken && customToken.startsWith("hf_")) ? customToken : import.meta.env.VITE_HF_API_TOKEN;

    if (!API_TOKEN || !API_TOKEN.startsWith("hf_")) {
      setError('Please enter token');
      setLoading(false);
      setShowOnboarding(true);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: currentPrompt }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP Error ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (errorText) errorMessage += `: ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json = await response.json();
        if (json.error) throw new Error(json.error);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      
      setImageCache(prev => ({ ...prev, [currentPrompt]: url }));

      // Update Visual History
      const newMasterpiece = { prompt: currentPrompt, url: url };
      const filteredHistory = recentMasterpieces.filter(m => m.prompt !== currentPrompt);
      const newHistory = [newMasterpiece, ...filteredHistory].slice(0, 6);
      
      setRecentMasterpieces(newHistory);
      localStorage.setItem('recent_prompts', JSON.stringify(newHistory.map(m => m.prompt)));
      showToast('Masterpiece Added to Gallery! 🎨');

    } catch (err) {
      console.error(err);
      if (err.name === 'AbortError') {
        setError('Request timed out. The model might be loading, please try again.');
      } else {
        setError(err.message || 'Failed to generate image. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading && !isSettingsOpen) {
      if (showOnboarding) {
        saveToken();
      } else {
        generateImage();
      }
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `AI_Studio_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Downloading Image... 📥');
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    showToast('Prompt Copied! 📋');
  };

  if (showOnboarding) {
    return (
      <div className="app-container onboarding">
        <div className="nav-bar">
          <h1>Welcome to Image Studio</h1>
        </div>
        <div className="settings-panel">
          <label>Step 1: Activate Your AI Engine</label>
          <p>This app uses Hugging Face to generate images. Please enter your Read-only API token (starts with hf_) to begin.</p>
          <input 
            type="text" 
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="hf_..."
            autoFocus
          />
          {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '2rem'}}>
            {import.meta.env.VITE_HF_API_TOKEN?.startsWith('hf_') && (
              <button className="clear-btn" onClick={() => setShowOnboarding(false)} style={{ flex: 1, padding: '1rem' }}>Use Default</button>
            )}
            <button className="primary-btn" onClick={saveToken} style={{ flex: 2 }}>Activate Token</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className={`toast-container ${toast.visible ? 'visible' : ''}`}>
        {toast.message}
      </div>
      <div className="nav-bar">
        <h1>Image Generator By Yash Panpaliya</h1>
        <div className="nav-actions">
          <button 
            className="icon-btn"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <button 
            className={`icon-btn ${isSettingsOpen ? 'active' : ''}`}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Magic Styles Chips Row */}
      <div className="chips-container">
        {STYLE_PRESETS.map((style, i) => (
          <button 
            key={i} 
            className="chip-btn" 
            onClick={() => addStyleToPrompt(style)}
          >
            ✧ {style}
          </button>
        ))}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="settings-panel">
          <label>Hugging Face Token</label>
          <p>Add your own token below. If left empty, it uses the system's default token.</p>
          <input 
            type="text" 
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value)}
            placeholder="hf_..."
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginTop: '1rem'}}>
            <button className="primary-btn" onClick={saveToken} style={{minWidth: 'unset', padding: '0.8rem 1.5rem'}}>Save</button>
          </div>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}

      <div className="input-section">
        <input 
          type="text" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the image you want to create..."
          disabled={loading}
          autoFocus
        />
        <button className="primary-btn" onClick={generateImage} disabled={loading}>
          {loading ? <div className="spinner"></div> : 'Generate'}
        </button>
      </div>

      <div className={`image-preview ${imageUrl ? 'has-image' : ''}`}>
        {loading ? (
          <>
            <div className="loading-scanner"></div>
            <div className="loading-pulse">
              <div className="placeholder-text">Creating your masterpiece...</div>
            </div>
          </>
        ) : imageUrl ? (
          <>
            <img src={imageUrl} alt={prompt} />
            <div className="image-actions">
              <button className="action-btn" onClick={downloadImage}>
                💾 Download
              </button>
              <button className="action-btn" onClick={copyPrompt}>
                📋 Copy
              </button>
            </div>
          </>
        ) : (
          <div className="placeholder-text">Your image will appear here</div>
        )}
      </div>

      {recentMasterpieces.length > 0 && (
        <div className="history-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>Gallery of Masterpieces</h3>
            <button className="clear-btn" onClick={clearHistory}>Clear History</button>
          </div>
          <div className="gallery-grid">
            {recentMasterpieces.map((master, i) => (
              <div 
                key={i} 
                className="gallery-card" 
                onClick={() => {
                  setPrompt(master.prompt);
                  if (master.url) setImageUrl(master.url);
                  showToast('Prompt Restored from Gallery');
                }}
              >
                {master.url ? (
                  <img src={master.url} alt={master.prompt} />
                ) : (
                  <div className="gallery-card-placeholder">
                    <span>{master.prompt.substring(0, 20)}...</span>
                  </div>
                )}
                <div className="gallery-card-overlay">
                  <p>{master.prompt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
