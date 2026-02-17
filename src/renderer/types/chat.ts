export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp: number;
}

export interface CommandBlock {
  command: string;
  explanation?: string;
  riskLevel?: 'safe' | 'moderate' | 'dangerous';
  sideEffects?: string[];
  reversible?: boolean;
  isExplaining?: boolean;
}
