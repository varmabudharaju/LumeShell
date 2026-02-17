import React from 'react';

type EditorType = 'vim' | 'nano' | 'other';

interface EditorToolbarProps {
  editorType: EditorType;
  tabId: string;
}

interface ButtonDef {
  label: string;
  keys: string;
  title: string;
}

const VIM_BUTTONS: ButtonDef[] = [
  { label: 'i Insert', keys: 'i', title: 'Enter insert mode' },
  { label: 'Esc Normal', keys: '\x1b', title: 'Return to normal mode' },
  { label: ':w Save', keys: ':w\r', title: 'Save file' },
  { label: ':q Quit', keys: ':q\r', title: 'Quit' },
  { label: ':wq Save & Quit', keys: ':wq\r', title: 'Save and quit' },
  { label: ':q! Force Quit', keys: ':q!\r', title: 'Quit without saving' },
  { label: 'u Undo', keys: 'u', title: 'Undo last change' },
];

const NANO_BUTTONS: ButtonDef[] = [
  { label: '^O Save', keys: '\x0f', title: 'Save file (Ctrl+O)' },
  { label: '^X Exit', keys: '\x18', title: 'Exit nano (Ctrl+X)' },
  { label: '^K Cut', keys: '\x0b', title: 'Cut line (Ctrl+K)' },
  { label: '^U Paste', keys: '\x15', title: 'Paste (Ctrl+U)' },
  { label: '^W Search', keys: '\x17', title: 'Search (Ctrl+W)' },
];

const OTHER_BUTTONS: ButtonDef[] = [
  { label: 'q Quit', keys: 'q', title: 'Quit' },
];

function getButtons(editorType: EditorType): ButtonDef[] {
  switch (editorType) {
    case 'vim': return VIM_BUTTONS;
    case 'nano': return NANO_BUTTONS;
    case 'other': return OTHER_BUTTONS;
  }
}

function getExitDef(editorType: EditorType): ButtonDef {
  switch (editorType) {
    case 'vim': return { label: ':q Quit', keys: '\x1b:q\r', title: 'Escape + :q — exit vim' };
    case 'nano': return { label: '^X Exit', keys: '\x18', title: 'Ctrl+X — exit nano' };
    case 'other': return { label: 'q Quit', keys: 'q', title: 'Quit' };
  }
}

function getEditorLabel(editorType: EditorType): string {
  switch (editorType) {
    case 'vim': return 'vim';
    case 'nano': return 'nano';
    case 'other': return 'pager';
  }
}

const EditorButton: React.FC<{
  def: ButtonDef;
  onClick: () => void;
}> = ({ def, onClick }) => (
  <button
    onClick={onClick}
    className="editor-cmd-btn"
    title={def.title}
  >
    {def.label}
  </button>
);

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editorType, tabId }) => {
  const buttons = getButtons(editorType);
  const exitDef = getExitDef(editorType);

  const sendKeys = (keys: string) => {
    window.lumeshell.terminal.write(tabId, keys);
  };

  return (
    <div
      className="h-[38px] flex items-center px-2 gap-1.5 shrink-0 glass"
      style={{ background: 'var(--sb-bg-base)', borderBottom: '1px solid var(--sb-border)' }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-wider px-1.5 shrink-0"
        style={{ color: 'var(--sb-accent)' }}
      >
        {getEditorLabel(editorType)}
      </span>
      <div className="w-px h-[16px] shrink-0" style={{ background: 'var(--sb-border)' }} />

      {/* Scroll controls */}
      <button
        onClick={() => sendKeys(editorType === 'vim' ? 'gg' : '\x1b[1;5H')}
        className="toolbar-btn-3d"
        title="Scroll to top"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="18 15 12 9 6 15" />
          <line x1="6" y1="4" x2="18" y2="4" />
        </svg>
      </button>
      <button
        onClick={() => sendKeys(editorType === 'vim' ? 'G' : '\x1b[1;5F')}
        className="toolbar-btn-3d"
        title="Scroll to bottom"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
          <line x1="6" y1="20" x2="18" y2="20" />
        </svg>
      </button>

      <div className="w-px h-[16px] shrink-0" style={{ background: 'var(--sb-border)' }} />

      <div className="flex items-center gap-1 overflow-x-auto">
        {buttons.map((def) => (
          <EditorButton key={def.label} def={def} onClick={() => sendKeys(def.keys)} />
        ))}
      </div>

      <div className="flex-1" />

      {/* Exit button — prominent red */}
      <button
        onClick={() => sendKeys(exitDef.keys)}
        className="editor-exit-btn"
        title={exitDef.title}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Exit
      </button>
    </div>
  );
};
