export interface ProviderSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AppSettings {
  activeProvider: string;
  providers: Record<string, ProviderSettings>;
  appearance: {
    fontSize: number;
    fontFamily: string;
    themeName: string;
    terminalBackground: string;
    terminalForeground: string;
    terminalCursor: string;
    mode: 'dark' | 'light';
  };
  notifications: {
    soundEnabled: boolean;
    minCommandDuration: number;
    volume: number;
  };
}
