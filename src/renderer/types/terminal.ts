export interface TerminalTab {
  id: string;
  title: string;
  pid?: number;
  shell?: string;
  isAlive: boolean;
  cwd?: string;
}
