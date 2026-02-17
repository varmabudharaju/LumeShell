import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { List } from 'react-window';
import { useFileStore, FileEntry } from '../../stores/file-store';
import { useTerminalStore } from '../../stores/terminal-store';
import { useUIStore } from '../../stores/ui-store';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { FileTree } from './FileTree';

const VIRTUALIZATION_THRESHOLD = 100;
const ROW_HEIGHT = 26;

/* ── Utility functions ───────────────────────────────────────── */

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '--';
  const d = new Date(timestamp);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;

  const sameYear = d.getFullYear() === now.getFullYear();
  if (sameYear) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + `, ${time}`;
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const KIND_MAP: Record<string, string> = {
  // Folders
  '': 'Folder',
  // Code
  ts: 'TypeScript', tsx: 'TypeScript JSX', js: 'JavaScript', jsx: 'JavaScript JSX',
  py: 'Python Script', rb: 'Ruby Script', go: 'Go Source', rs: 'Rust Source',
  c: 'C Source', cpp: 'C++ Source', h: 'C Header', hpp: 'C++ Header',
  java: 'Java Source', kt: 'Kotlin Source', swift: 'Swift Source',
  // Web
  html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'LESS',
  // Data
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML', csv: 'CSV',
  // Config
  env: 'Environment', ini: 'Config', cfg: 'Config', conf: 'Config',
  lock: 'Lock File', gitignore: 'Git Ignore',
  // Docs
  md: 'Markdown', txt: 'Plain Text', pdf: 'PDF Document', doc: 'Word Document',
  // Images
  png: 'PNG Image', jpg: 'JPEG Image', jpeg: 'JPEG Image', gif: 'GIF Image',
  svg: 'SVG Image', ico: 'Icon', webp: 'WebP Image',
  // Archives
  zip: 'ZIP Archive', tar: 'TAR Archive', gz: 'GZip Archive', dmg: 'Disk Image',
  // Shell
  sh: 'Shell Script', bash: 'Bash Script', zsh: 'Zsh Script', fish: 'Fish Script',
  // Other
  log: 'Log File', sql: 'SQL', wasm: 'WebAssembly',
};

function getFileKind(entry: FileEntry): string {
  if (entry.isDirectory) return 'Folder';
  const ext = entry.name.split('.').pop()?.toLowerCase() || '';
  // Check dotfile names without extension
  if (!entry.name.includes('.') || entry.name.startsWith('.')) {
    const baseName = entry.name.replace(/^\./, '');
    if (KIND_MAP[baseName]) return KIND_MAP[baseName];
  }
  return KIND_MAP[ext] || (ext ? ext.toUpperCase() + ' File' : 'Document');
}

/* ── Sort state ──────────────────────────────────────────────── */

type SortKey = 'name' | 'modified' | 'size' | 'kind';
type SortDir = 'asc' | 'desc';

/* ── Icons ───────────────────────────────────────────────────── */

const FolderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--sb-yellow)" stroke="none">
    <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--sb-text-secondary)" strokeWidth="2">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const ChevronIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const SortArrow = ({ dir }: { dir: SortDir }) => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ opacity: 0.6 }}>
    {dir === 'asc'
      ? <path d="M12 4l-8 14h16z" />
      : <path d="M12 20l8-14H4z" />
    }
  </svg>
);

/* ── Context menu button (reusable) ───────────────────────── */

const CtxBtn: React.FC<{
  label: string;
  onClick: () => void;
  danger?: boolean;
}> = ({ label, onClick, danger }) => (
  <button
    onClick={onClick}
    title={label}
    className="w-full px-3 py-1.5 text-left text-xs transition-colors"
    style={{ color: danger ? 'var(--sb-red)' : 'var(--sb-text-primary)' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sb-bg-hover)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    {label}
  </button>
);

/* ── FileRow component — Finder-style with columns ─────────── */

interface FileRowProps {
  entry: FileEntry;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  isRenaming: boolean;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onClick: (entry: FileEntry, index: number) => void;
  onDoubleClick: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  itemRef?: (el: HTMLDivElement | null) => void;
  style?: React.CSSProperties;
}

const FileRow: React.FC<FileRowProps> = ({
  entry, index, isSelected, isFocused, isRenaming, renameValue, setRenameValue,
  onSubmitRename, onCancelRename, onClick, onDoubleClick, onContextMenu, itemRef, style,
}) => {
  const isEven = index % 2 === 0;

  let bg = isEven ? 'transparent' : 'var(--sb-finder-stripe)';
  if (isSelected) bg = 'var(--sb-finder-select)';

  return (
    <div
      ref={itemRef}
      className="finder-row"
      style={{
        ...style,
        height: ROW_HEIGHT,
        background: bg,
        color: isSelected ? 'var(--sb-finder-select-text)' : 'var(--sb-text-primary)',
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', entry.path);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => onClick(entry, index)}
      onDoubleClick={() => onDoubleClick(entry)}
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      {/* Name column */}
      <div className="finder-col-name">
        <span className="finder-icon">{entry.isDirectory ? <FolderIcon /> : <FileIcon />}</span>
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitRename();
              if (e.key === 'Escape') onCancelRename();
              e.stopPropagation();
            }}
            onBlur={onSubmitRename}
            className="finder-rename-input"
            style={{ background: 'var(--sb-bg-input)', border: '1px solid var(--sb-accent)', color: 'var(--sb-text-primary)' }}
          />
        ) : (
          <span className="truncate" style={{ opacity: entry.name.startsWith('.') ? 0.5 : 1 }}>{entry.name}</span>
        )}
      </div>
      {/* Date Modified column */}
      <div className="finder-col-date" style={{ color: isSelected ? 'var(--sb-finder-select-text)' : 'var(--sb-text-muted)' }}>
        {formatDate(entry.modified)}
      </div>
      {/* Size column */}
      <div className="finder-col-size" style={{ color: isSelected ? 'var(--sb-finder-select-text)' : 'var(--sb-text-muted)' }}>
        {entry.isDirectory ? '--' : formatSize(entry.size)}
      </div>
      {/* Kind column */}
      <div className="finder-col-kind" style={{ color: isSelected ? 'var(--sb-finder-select-text)' : 'var(--sb-text-muted)' }}>
        {getFileKind(entry)}
      </div>
    </div>
  );
};

/* ── Virtualized row for react-window ────────────────────────── */

interface VirtualizedRowData {
  entries: FileEntry[];
  selectedPath: string | null;
  focusedIndex: number;
  renamingPath: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  submitRename: () => void;
  setRenamingPath: (v: string | null) => void;
  handleClickEntry: (entry: FileEntry, index: number) => void;
  handleDoubleClick: (entry: FileEntry) => void;
  handleContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  itemRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}

function VirtualizedRow({ index, style, ...data }: { index: number; style: React.CSSProperties } & VirtualizedRowData): React.ReactElement | null {
  const entry = data.entries[index];
  if (!entry) return null;
  return (
    <FileRow
      entry={entry}
      index={index}
      isSelected={data.selectedPath === entry.path}
      isFocused={data.focusedIndex === index}
      isRenaming={data.renamingPath === entry.path}
      renameValue={data.renameValue}
      setRenameValue={data.setRenameValue}
      onSubmitRename={data.submitRename}
      onCancelRename={() => data.setRenamingPath(null)}
      onClick={data.handleClickEntry}
      onDoubleClick={data.handleDoubleClick}
      onContextMenu={data.handleContextMenu}
      itemRef={(el) => { if (el) data.itemRefs.current.set(index, el); else data.itemRefs.current.delete(index); }}
      style={style}
    />
  );
}

/* ── FileExplorer ─────────────────────────────────────────── */

export const FileExplorer: React.FC = () => {
  const {
    currentPath, entries, loading, error,
    init, navigateTo, goUp, refresh,
    selectedPath, setSelected, contextMenu, setContextMenu,
    deleteEntry, renameEntry, createEntry,
    showHidden, toggleHidden,
    editingFile, openFile, saveFile, closeFile, setEditingContent,
    viewMode, setViewMode,
  } = useFileStore();
  const activeTabId = useTerminalStore((s) => s.activeTabId);
  const showToast = useUIStore((s) => s.showToast);
  const explorerMinimized = useUIStore((s) => s.explorerMinimized);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [createValue, setCreateValue] = useState('');
  const [permModal, setPermModal] = useState<{ path: string; mode: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [emptyCtxMenu, setEmptyCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [listHeight, setListHeight] = useState(400);
  const [editorHeight, setEditorHeight] = useState(300);

  const clickRenameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickedPath = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // BUG-L15: Only re-fetch when the CWD actually changes, not on every tab switch
  useEffect(() => {
    if (activeTabId) {
      window.lumeshell.terminal.getCwd(activeTabId).then((cwd) => {
        if (cwd && cwd !== currentPath) {
          navigateTo(cwd);
        }
      });
    } else {
      init();
    }
  }, [activeTabId]);

  useEffect(() => {
    const handler = () => { setContextMenu(null); setEmptyCtxMenu(null); };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [setContextMenu]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [currentPath]);

  // Track container height for virtualized list
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) setListHeight(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Sorting ──────────────────────────────────────────────── */

  const sortedEntries = React.useMemo(() => {
    const sorted = [...entries];
    const dir = sortDir === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      // Directories always first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'modified':
          return dir * (a.modified - b.modified);
        case 'size':
          return dir * (a.size - b.size);
        case 'kind': {
          const kindA = getFileKind(a);
          const kindB = getFileKind(b);
          return dir * kindA.localeCompare(kindB);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [entries, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  /* ── Handlers ─────────────────────────────────────────────── */

  const handleDoubleClick = (entry: FileEntry) => {
    if (clickRenameTimer.current) {
      clearTimeout(clickRenameTimer.current);
      clickRenameTimer.current = null;
    }
    if (entry.isDirectory) {
      navigateTo(entry.path);
    } else {
      openFile(entry.path);
    }
  };

  const handleClickEntry = (entry: FileEntry, index: number) => {
    setFocusedIndex(index);

    if (selectedPath === entry.path && lastClickedPath.current === entry.path && !renamingPath) {
      if (clickRenameTimer.current) clearTimeout(clickRenameTimer.current);
      clickRenameTimer.current = setTimeout(() => {
        startRename(entry);
        clickRenameTimer.current = null;
      }, 400);
    } else {
      if (clickRenameTimer.current) {
        clearTimeout(clickRenameTimer.current);
        clickRenameTimer.current = null;
      }
    }

    lastClickedPath.current = entry.path;
    setSelected(entry.path);
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setEmptyCtxMenu(null);
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    setContextMenu(null);
    setEmptyCtxMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDelete = (entry: FileEntry) => {
    setContextMenu(null);
    setDeleteTarget(entry);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deleteEntry(deleteTarget.path);
    }
    setDeleteTarget(null);
  };

  const startRename = (entry: FileEntry) => {
    setContextMenu(null);
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
  };

  const submitRename = async () => {
    if (renamingPath && renameValue.trim()) {
      await renameEntry(renamingPath, renameValue.trim());
    }
    setRenamingPath(null);
  };

  const startCreate = (type: 'file' | 'folder') => {
    setContextMenu(null);
    setEmptyCtxMenu(null);
    setCreating(type);
    setCreateValue('');
  };

  const submitCreate = async () => {
    if (creating && createValue.trim()) {
      await createEntry(createValue.trim(), creating === 'folder');
    }
    setCreating(null);
  };

  const openPermissions = useCallback(async (entry: FileEntry) => {
    setContextMenu(null);
    try {
      const result = await window.lumeshell.files.getPermissions(entry.path);
      setPermModal({ path: entry.path, mode: result.mode });
    } catch {
      // ignore
    }
  }, [setContextMenu]);

  const togglePerm = (bit: number) => {
    if (!permModal) return;
    setPermModal({ ...permModal, mode: permModal.mode ^ bit });
  };

  const savePerm = async () => {
    if (!permModal) return;
    await window.lumeshell.files.setPermissions(permModal.path, permModal.mode);
    setPermModal(null);
    await refresh();
  };

  /* ── Keyboard navigation ──────────────────────────────────── */

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (renamingPath || creating) return;

    const len = sortedEntries.length;
    if (len === 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = focusedIndex < len - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(next);
        setSelected(sortedEntries[next].path);
        itemRefs.current.get(next)?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = focusedIndex > 0 ? focusedIndex - 1 : len - 1;
        setFocusedIndex(prev);
        setSelected(sortedEntries[prev].path);
        itemRefs.current.get(prev)?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < len) {
          handleDoubleClick(sortedEntries[focusedIndex]);
        }
        break;
      }
      case 'F2': {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < len) {
          startRename(sortedEntries[focusedIndex]);
        }
        break;
      }
      case 'Backspace':
      case 'Delete': {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < len) {
          handleDelete(sortedEntries[focusedIndex]);
        }
        break;
      }
    }
  };

  const pathParts = currentPath.split('/').filter(Boolean);

  const itemCount = `${sortedEntries.length} item${sortedEntries.length !== 1 ? 's' : ''}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--sb-bg-body)' }}>
      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="finder-toolbar">
        {/* Navigation + actions */}
        <div className="flex items-center gap-1.5">
          <button onClick={goUp} className="finder-toolbar-btn-labeled" title="Go up">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="finder-btn-label">Back</span>
          </button>
          <button onClick={refresh} className="finder-toolbar-btn-labeled" title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
            </svg>
            <span className="finder-btn-label">Refresh</span>
          </button>

          <div style={{ width: 1, height: 28, background: 'var(--sb-border)', margin: '0 4px' }} />

          <button onClick={() => startCreate('file')} className="finder-toolbar-btn-labeled" title="New File">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            <span className="finder-btn-label">New File</span>
          </button>
          <button onClick={() => startCreate('folder')} className="finder-toolbar-btn-labeled" title="New Folder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            <span className="finder-btn-label">New Folder</span>
          </button>
          <button
            onClick={toggleHidden}
            className={`finder-toolbar-btn-labeled ${showHidden ? 'finder-toolbar-btn-active' : ''}`}
            title={showHidden ? 'Hide dotfiles' : 'Show dotfiles'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {showHidden ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              )}
            </svg>
            <span className="finder-btn-label">{showHidden ? 'Hide' : 'Show'}</span>
          </button>
        </div>

        <div style={{ width: 1, height: 28, background: 'var(--sb-border)', margin: '0 4px' }} />

        <button
          onClick={() => useUIStore.getState().toggleExplorerMinimized()}
          className="finder-toolbar-btn-labeled"
          title={explorerMinimized ? 'Show Files' : 'Hide Files'}
        >
          {explorerMinimized ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
          <span className="finder-btn-label">{explorerMinimized ? 'Expand' : 'Minimize'}</span>
        </button>

        {/* Breadcrumb path bar */}
        <div className="finder-breadcrumb">
          <button onClick={() => navigateTo('/')} className="finder-breadcrumb-seg" title="Go to root">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
          {pathParts.map((part, i) => (
            <React.Fragment key={i}>
              <span className="finder-breadcrumb-chevron"><ChevronIcon size={9} /></span>
              <button
                onClick={() => navigateTo('/' + pathParts.slice(0, i + 1).join('/'))}
                className="finder-breadcrumb-seg"
                title={`Navigate to ${part}`}
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── File editor ──────────────────────────────────────── */}
      {editingFile && (
        <div className={explorerMinimized ? "flex flex-col flex-1" : "flex flex-col"} style={explorerMinimized ? { minHeight: 100 } : { height: editorHeight, minHeight: 100, borderBottom: '1px solid var(--sb-border)' }}>
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{
              background: 'var(--sb-bg-base)',
              borderBottom: '1px solid var(--sb-border)',
            }}
          >
            <span className="text-xs truncate flex-1" style={{ color: 'var(--sb-text-primary)' }}>
              {editingFile.path.split('/').pop()}
              {editingFile.dirty && <span style={{ color: 'var(--sb-yellow)' }} className="ml-1">*</span>}
            </span>
            <button onClick={saveFile} className="finder-toolbar-btn" style={{ fontSize: 11, padding: '2px 8px', width: 'auto' }} title="Save file (Cmd+S)">
              Save
            </button>
            <button onClick={closeFile} className="finder-toolbar-btn" style={{ fontSize: 11, padding: '2px 8px', width: 'auto' }} title="Close editor">
              Close
            </button>
          </div>
          <textarea
            value={editingFile.content}
            onChange={(e) => setEditingContent(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                saveFile();
              }
            }}
            className="flex-1 w-full p-3 text-xs font-mono resize-none outline-none"
            style={{ background: 'var(--sb-bg-input)', color: 'var(--sb-text-primary)' }}
            spellCheck={false}
          />
          {/* Resize handle (hidden when files minimized — editor takes full height) */}
          {!explorerMinimized && <div
            className="h-[5px] shrink-0 cursor-row-resize transition-colors duration-150 hover:bg-[var(--sb-accent)]"
            style={{ background: 'var(--sb-border)' }}
            title="Drag to resize editor"
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startH = editorHeight;
              document.body.style.cursor = 'row-resize';
              document.body.style.userSelect = 'none';
              const onMove = (ev: MouseEvent) => {
                const delta = ev.clientY - startY;
                setEditorHeight(Math.max(100, Math.min(startH + delta, window.innerHeight - 200)));
              };
              const onUp = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          />}
        </div>
      )}

      {/* ── Column headers + File list (hidden when minimized) ── */}
      {!explorerMinimized && (
      <>
      <div className="finder-header">
        <button className="finder-col-name finder-header-cell" onClick={() => handleSort('name')} title="Sort by name">
          Name {sortKey === 'name' && <SortArrow dir={sortDir} />}
        </button>
        <button className="finder-col-date finder-header-cell" onClick={() => handleSort('modified')} title="Sort by date modified">
          Date Modified {sortKey === 'modified' && <SortArrow dir={sortDir} />}
        </button>
        <button className="finder-col-size finder-header-cell" onClick={() => handleSort('size')} title="Sort by size">
          Size {sortKey === 'size' && <SortArrow dir={sortDir} />}
        </button>
        <button className="finder-col-kind finder-header-cell" onClick={() => handleSort('kind')} title="Sort by kind">
          Kind {sortKey === 'kind' && <SortArrow dir={sortDir} />}
        </button>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto outline-none"
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        onContextMenu={handleEmptyContextMenu}
      >
        {loading && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--sb-text-secondary)' }}>Loading...</div>
        )}
        {error && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--sb-red)' }}>{error}</div>
        )}

        {creating && (
          <div className="finder-row" style={{ height: ROW_HEIGHT, background: 'var(--sb-bg-surface)' }}>
            <div className="finder-col-name">
              <span className="finder-icon">{creating === 'folder' ? <FolderIcon /> : <FileIcon />}</span>
              <input
                autoFocus
                value={createValue}
                onChange={(e) => setCreateValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate();
                  if (e.key === 'Escape') setCreating(null);
                  e.stopPropagation();
                }}
                onBlur={submitCreate}
                className="finder-rename-input"
                style={{ background: 'var(--sb-bg-input)', border: '1px solid var(--sb-accent)', color: 'var(--sb-text-primary)' }}
                placeholder={creating === 'folder' ? 'New folder name...' : 'New file name...'}
              />
            </div>
          </div>
        )}

        {!loading && !creating && sortedEntries.length === 0 && (
          <div className="p-8 text-center text-xs" style={{ color: 'var(--sb-text-secondary)' }}>
            This folder is empty
          </div>
        )}

        {sortedEntries.length > 0 && sortedEntries.length <= VIRTUALIZATION_THRESHOLD && sortedEntries.map((entry, index) => (
          <FileRow
            key={entry.path}
            entry={entry}
            index={index}
            isSelected={selectedPath === entry.path}
            isFocused={focusedIndex === index}
            isRenaming={renamingPath === entry.path}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            onSubmitRename={submitRename}
            onCancelRename={() => setRenamingPath(null)}
            onClick={handleClickEntry}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            itemRef={(el) => { if (el) itemRefs.current.set(index, el); else itemRefs.current.delete(index); }}
          />
        ))}

        {sortedEntries.length > VIRTUALIZATION_THRESHOLD && (
          <List
            rowCount={sortedEntries.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={VirtualizedRow as any}
            rowProps={{
              entries: sortedEntries,
              selectedPath,
              focusedIndex,
              renamingPath,
              renameValue,
              setRenameValue,
              submitRename,
              setRenamingPath,
              handleClickEntry,
              handleDoubleClick,
              handleContextMenu,
              itemRefs,
            } as any}
            style={{ height: listHeight }}
          />
        )}
      </div>

      {/* ── Status bar ───────────────────────────────────────── */}
      <div className="finder-statusbar">
        <span>{itemCount}</span>
      </div>
      </>
      )}

      {/* ── Minimized: pull-up restore bar ─────────────────── */}
      {explorerMinimized && !editingFile && (
        <div className="flex-1 flex flex-col" style={{ background: 'var(--sb-bg-body)' }}>
          <div className="flex-1" />
          <div
            className="explorer-minimized-bar"
            onClick={() => useUIStore.getState().setExplorerMinimized(false)}
          >
            <div className="pull-indicator" />
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
              </svg>
              Click to restore files
            </span>
            <div className="pull-indicator" />
          </div>
        </div>
      )}

      {/* ── Context menu (on entry) ──────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-50 dropdown-3d py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.entry.isDirectory && (
            <CtxBtn label="Open" onClick={() => { navigateTo(contextMenu.entry.path); setContextMenu(null); }} />
          )}
          {!contextMenu.entry.isDirectory && (
            <>
              <CtxBtn label="Open" onClick={() => { openFile(contextMenu.entry.path); setContextMenu(null); }} />
              <CtxBtn label="Edit" onClick={() => { openFile(contextMenu.entry.path); setContextMenu(null); }} />
            </>
          )}
          {activeTabId && (
            <CtxBtn
              label="cd here in terminal"
              onClick={() => {
                window.lumeshell.terminal.runCommand(activeTabId, `cd "${contextMenu.entry.isDirectory ? contextMenu.entry.path : currentPath}"`);
                setContextMenu(null);
              }}
            />
          )}
          <CtxBtn
            label="Copy Path"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.entry.path);
              showToast('Path copied!');
              setContextMenu(null);
            }}
          />
          <div style={{ borderTop: '1px solid var(--sb-border-strong)' }} className="my-1" />
          <CtxBtn label="Rename" onClick={() => startRename(contextMenu.entry)} />
          <CtxBtn label="Permissions" onClick={() => openPermissions(contextMenu.entry)} />
          <CtxBtn label="Delete" onClick={() => handleDelete(contextMenu.entry)} danger />
        </div>
      )}

      {/* Empty-space context menu */}
      {emptyCtxMenu && (
        <div
          className="fixed z-50 dropdown-3d py-1 min-w-[140px]"
          style={{ left: emptyCtxMenu.x, top: emptyCtxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <CtxBtn label="New File" onClick={() => startCreate('file')} />
          <CtxBtn label="New Folder" onClick={() => startCreate('folder')} />
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete"
        message={deleteTarget ? `Delete "${deleteTarget.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        confirmColor="var(--sb-red)"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Permissions modal */}
      {permModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card-3d p-4 w-[300px]">
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--sb-text-primary)' }}>Permissions</h3>
            <p className="text-xs mb-3 truncate" style={{ color: 'var(--sb-text-secondary)' }}>{permModal.path.split('/').pop()}</p>
            <div className="space-y-2">
              {(['Owner', 'Group', 'Other'] as const).map((label, i) => {
                const shift = (2 - i) * 3;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs w-12" style={{ color: 'var(--sb-text-secondary)' }}>{label}</span>
                    {(['r', 'w', 'x'] as const).map((perm, j) => {
                      const bit = 1 << (shift + (2 - j));
                      const isSet = (permModal.mode & bit) !== 0;
                      return (
                        <label key={perm} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSet}
                            onChange={() => togglePerm(bit)}
                            style={{ accentColor: 'var(--sb-accent)' }}
                          />
                          <span style={{ color: 'var(--sb-text-primary)' }}>{perm}</span>
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--sb-text-muted)' }}>
              Octal: {permModal.mode.toString(8).padStart(3, '0')}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPermModal(null)} title="Cancel changes" className="btn-3d px-3 py-1.5 text-xs rounded-md">
                Cancel
              </button>
              <button onClick={savePerm} title="Save permissions" className="btn-3d btn-3d-success px-3 py-1.5 text-xs rounded-md">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
