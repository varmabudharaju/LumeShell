import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settings-store';

export const ProviderConfig: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const [testResults, setTestResults] = useState<Record<string, 'testing' | 'success' | 'failed'>>({});
  const [googleAuth, setGoogleAuth] = useState<{ signedIn: boolean; email?: string }>({ signedIn: false });
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    window.lumeshell.google.getAuthStatus().then(setGoogleAuth);
  }, []);

  if (!settings) return null;

  const handleProviderChange = (provider: string) => {
    updateSettings('activeProvider', provider);
  };

  const handleFieldChange = (provider: string, field: string, value: string) => {
    const providers = { ...settings.providers };
    providers[provider] = { ...providers[provider], [field]: value };
    updateSettings('providers', providers);
  };

  const handleTestConnection = async (provider: string) => {
    setTestResults((prev) => ({ ...prev, [provider]: 'testing' }));
    try {
      const result = await window.lumeshell.ai.testConnection(provider);
      setTestResults((prev) => ({ ...prev, [provider]: result ? 'success' : 'failed' }));
    } catch {
      setTestResults((prev) => ({ ...prev, [provider]: 'failed' }));
    }
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const result = await window.lumeshell.google.signIn();
      if (result.success) {
        setGoogleAuth({ signedIn: true, email: result.email });
      } else {
        setAuthError(result.error || 'Sign-in failed');
      }
    } catch (err) {
      setAuthError('Sign-in failed — please try again');
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await window.lumeshell.google.signOut();
    setGoogleAuth({ signedIn: false });
    setTestResults((prev) => {
      const next = { ...prev };
      delete next.gemini;
      return next;
    });
  };

  const ollamaSettings = settings.providers.ollama || { apiKey: '', baseUrl: 'http://localhost:11434', model: 'qwen2.5-coder:1.5b' };
  const geminiSettings = settings.providers.gemini || { apiKey: '', baseUrl: '', model: 'gemini-2.0-flash' };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium" style={{ color: 'var(--sb-text-primary)' }}>AI Provider</h2>

      {/* Provider selector */}
      <div className="flex gap-2">
        <button
          onClick={() => handleProviderChange('ollama')}
          title="Use Ollama for local AI"
          className={`btn-3d px-3 py-1.5 text-xs rounded-md ${settings.activeProvider === 'ollama' ? 'btn-3d-primary' : ''}`}
        >
          Ollama (Local)
        </button>
        <button
          onClick={() => handleProviderChange('gemini')}
          title="Use Google Gemini for cloud AI"
          className={`btn-3d px-3 py-1.5 text-xs rounded-md ${settings.activeProvider === 'gemini' ? 'btn-3d-primary' : ''}`}
        >
          Google Gemini
        </button>
      </div>

      {/* Ollama config */}
      <div
        className={`card-3d space-y-3 p-4 ${settings.activeProvider !== 'ollama' ? 'opacity-60' : ''}`}
        style={settings.activeProvider === 'ollama' ? { boxShadow: 'var(--sb-shadow-raised), 0 0 12px rgba(56, 139, 253, 0.15)' } : {}}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--sb-text-primary)' }}>Ollama (Local)</span>
          {settings.activeProvider === 'ollama' && (
            <span className="text-xs" style={{ color: 'var(--sb-accent)' }}>Active</span>
          )}
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--sb-text-secondary)' }}>Base URL</label>
          <input
            type="text"
            value={ollamaSettings.baseUrl}
            onChange={(e) => handleFieldChange('ollama', 'baseUrl', e.target.value)}
            placeholder="http://localhost:11434"
            className="input-3d w-full px-3 py-2 text-sm rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--sb-text-secondary)' }}>Model</label>
          <input
            type="text"
            value={ollamaSettings.model}
            onChange={(e) => handleFieldChange('ollama', 'model', e.target.value)}
            placeholder="qwen2.5-coder:1.5b"
            className="input-3d w-full px-3 py-2 text-sm rounded-lg"
          />
        </div>

        <button
          onClick={() => handleTestConnection('ollama')}
          disabled={testResults.ollama === 'testing'}
          title="Test Ollama connection"
          className={`btn-3d px-3 py-1.5 text-xs rounded-md disabled:opacity-50 ${testResults.ollama === 'success' ? 'btn-3d-success' : ''}`}
        >
          {testResults.ollama === 'testing'
            ? 'Testing...'
            : testResults.ollama === 'success'
            ? 'Connected!'
            : testResults.ollama === 'failed'
            ? 'Failed - Retry'
            : 'Test Connection'}
        </button>
        {testResults.ollama === 'success' && (
          <span className="text-xs ml-2" style={{ color: 'var(--sb-green-bright)' }}>Connection successful</span>
        )}
        {testResults.ollama === 'failed' && (
          <span className="text-xs ml-2" style={{ color: 'var(--sb-red)' }}>Connection failed</span>
        )}
      </div>

      {/* Gemini config */}
      <div
        className={`card-3d space-y-3 p-4 ${settings.activeProvider !== 'gemini' ? 'opacity-60' : ''}`}
        style={settings.activeProvider === 'gemini' ? { boxShadow: 'var(--sb-shadow-raised), 0 0 12px rgba(56, 139, 253, 0.15)' } : {}}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: 'var(--sb-text-primary)' }}>Google Gemini</span>
          {settings.activeProvider === 'gemini' && (
            <span className="text-xs" style={{ color: 'var(--sb-accent)' }}>Active</span>
          )}
        </div>

        {googleAuth.signedIn ? (
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ backgroundColor: 'rgba(35, 134, 54, 0.1)', border: '1px solid rgba(35, 134, 54, 0.3)' }}
          >
            <span className="text-sm" style={{ color: 'var(--sb-text-primary)' }}>
              Signed in as {googleAuth.email || 'Google account'}
            </span>
            <button
              onClick={handleGoogleSignOut}
              title="Sign out of Google"
              className="btn-3d px-2 py-1 text-xs rounded-md"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              title="Sign in with your Google account"
              className="btn-3d btn-3d-primary px-4 py-2 text-sm rounded-md disabled:opacity-50"
            >
              {signingIn ? 'Waiting for browser...' : 'Sign in with Google'}
            </button>
            <p className="text-xs" style={{ color: 'var(--sb-text-muted)' }}>
              One click — no API keys needed
            </p>
            {authError && (
              <p className="text-xs" style={{ color: 'var(--sb-red)' }}>{authError}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--sb-text-secondary)' }}>Model</label>
          <input
            type="text"
            value={geminiSettings.model}
            onChange={(e) => handleFieldChange('gemini', 'model', e.target.value)}
            placeholder="gemini-2.0-flash"
            className="input-3d w-full px-3 py-2 text-sm rounded-lg"
          />
        </div>

        {googleAuth.signedIn && (
          <>
            <button
              onClick={() => handleTestConnection('gemini')}
              disabled={testResults.gemini === 'testing'}
              title="Test Gemini connection"
              className={`btn-3d px-3 py-1.5 text-xs rounded-md disabled:opacity-50 ${testResults.gemini === 'success' ? 'btn-3d-success' : ''}`}
            >
              {testResults.gemini === 'testing'
                ? 'Testing...'
                : testResults.gemini === 'success'
                ? 'Connected!'
                : testResults.gemini === 'failed'
                ? 'Failed - Retry'
                : 'Test Connection'}
            </button>
            {testResults.gemini === 'success' && (
              <span className="text-xs ml-2" style={{ color: 'var(--sb-green-bright)' }}>Connection successful</span>
            )}
            {testResults.gemini === 'failed' && (
              <span className="text-xs ml-2" style={{ color: 'var(--sb-red)' }}>Connection failed</span>
            )}
          </>
        )}
      </div>
    </div>
  );
};
