import { create } from 'zustand';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: number;
  permissions: string;
}

interface FileState {
  currentPath: string;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;
  selectedPath: string | null;
  contextMenu: { x: number; y: number; entry: FileEntry } | null;
  showHidden: boolean;
  viewMode: 'list' | 'tree';

  init: () => Promise<void>;
  setViewMode: (mode: 'list' | 'tree') => void;
  navigateTo: (dirPath: string, showHiddenOverride?: boolean) => Promise<void>;
  goUp: () => Promise<void>;
  refresh: () => Promise<void>;
  setSelected: (path: string | null) => void;
  setContextMenu: (menu: { x: number; y: number; entry: FileEntry } | null) => void;
  toggleHidden: () => void;
  deleteEntry: (targetPath: string) => Promise<void>;
  renameEntry: (oldPath: string, newName: string) => Promise<void>;
  createEntry: (name: string, isDirectory: boolean) => Promise<void>;

  // Tree view
  expandedDirs: Set<string>;
  children: Map<string, FileEntry[]>;
  toggleExpanded: (dirPath: string) => Promise<void>;

  // File editor
  editingFile: { path: string; content: string; dirty: boolean } | null;
  openFile: (path: string) => Promise<void>;
  saveFile: () => Promise<void>;
  closeFile: () => void;
  setEditingContent: (content: string) => void;
}

// BUG-L13: Navigation request counter to prevent stale responses from race conditions
let navRequestId = 0;

export const useFileStore = create<FileState>((set, get) => ({
  currentPath: '',
  entries: [],
  loading: false,
  error: null,
  selectedPath: null,
  contextMenu: null,
  showHidden: false,
  viewMode: 'list',

  setViewMode: (mode) => set({ viewMode: mode }),

  init: async () => {
    const home = await window.lumeshell.files.getHome();
    await get().navigateTo(home);
  },

  navigateTo: async (dirPath: string, showHiddenOverride?: boolean) => {
    const thisRequest = ++navRequestId; // BUG-L13: stamp this request
    set({ loading: true, error: null });
    try {
      const showH = showHiddenOverride ?? get().showHidden;
      const entries = await window.lumeshell.files.list(dirPath, showH);
      // BUG-L13: Only apply if this is still the latest request
      if (thisRequest !== navRequestId) return;
      set({
        currentPath: dirPath, entries: entries || [], loading: false, selectedPath: null,
        expandedDirs: new Set(), children: new Map(),
      });
    } catch (e) {
      if (thisRequest !== navRequestId) return;
      set({ entries: [], error: 'Failed to read directory', loading: false });
    }
  },

  goUp: async () => {
    const { currentPath } = get();
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    await get().navigateTo(parent);
  },

  refresh: async () => {
    const { currentPath } = get();
    if (currentPath) await get().navigateTo(currentPath);
  },

  setSelected: (path) => set({ selectedPath: path }),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  toggleHidden: () => {
    const { currentPath } = get();
    const newShowHidden = !get().showHidden;
    set({ showHidden: newShowHidden });
    if (currentPath) {
      get().navigateTo(currentPath, newShowHidden).catch(() => {
        // Ensure we're not stuck in loading state
        set({ loading: false });
      });
    }
  },

  deleteEntry: async (targetPath: string) => {
    try {
      await window.lumeshell.files.delete(targetPath);
      await get().refresh();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Delete failed' });
    }
  },

  renameEntry: async (oldPath: string, newName: string) => {
    try {
      await window.lumeshell.files.rename(oldPath, newName);
      await get().refresh();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Rename failed' });
    }
  },

  createEntry: async (name: string, isDirectory: boolean) => {
    try {
      const { currentPath } = get();
      await window.lumeshell.files.create(currentPath, name, isDirectory);
      await get().refresh();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Create failed' });
    }
  },

  // Tree view
  expandedDirs: new Set<string>(),
  children: new Map<string, FileEntry[]>(),

  toggleExpanded: async (dirPath: string) => {
    const { expandedDirs, children, showHidden } = get();
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
      set({ expandedDirs: newExpanded });
    } else {
      const entries = await window.lumeshell.files.list(dirPath, showHidden);
      const newChildren = new Map(children);
      newChildren.set(dirPath, entries);
      newExpanded.add(dirPath);
      set({ expandedDirs: newExpanded, children: newChildren });
    }
  },

  // File editor
  editingFile: null,

  openFile: async (filePath: string) => {
    try {
      const content = await window.lumeshell.files.read(filePath);
      set({ editingFile: { path: filePath, content, dirty: false }, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to open file' });
    }
  },

  saveFile: async () => {
    const { editingFile } = get();
    if (!editingFile) return;
    try {
      await window.lumeshell.files.write(editingFile.path, editingFile.content);
      set({ editingFile: { ...editingFile, dirty: false } });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Save failed' });
    }
  },

  closeFile: () => {
    set({ editingFile: null });
  },

  setEditingContent: (content: string) => {
    const { editingFile } = get();
    if (!editingFile) return;
    set({ editingFile: { ...editingFile, content, dirty: true } });
  },
}));
