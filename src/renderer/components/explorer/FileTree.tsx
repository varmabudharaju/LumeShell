import React, { memo, useCallback } from 'react';
import { useFileStore, FileEntry } from '../../stores/file-store';

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

const ChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  onSelect: (path: string) => void;
  onDoubleClick: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  selectedPath: string | null;
}

const FileTreeItem = memo<FileTreeItemProps>(({
  entry, depth, onSelect, onDoubleClick, onContextMenu, selectedPath,
}) => {
  const expandedDirs = useFileStore((s) => s.expandedDirs);
  const children = useFileStore((s) => s.children);
  const toggleExpanded = useFileStore((s) => s.toggleExpanded);

  const isExpanded = entry.isDirectory && expandedDirs.has(entry.path);
  const childEntries = children.get(entry.path) || [];

  const handleClick = useCallback(() => {
    onSelect(entry.path);
  }, [entry.path, onSelect]);

  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.isDirectory) {
      toggleExpanded(entry.path);
    }
  }, [entry.isDirectory, entry.path, toggleExpanded]);

  const handleDoubleClickEntry = useCallback(() => {
    if (entry.isDirectory) {
      toggleExpanded(entry.path);
    } else {
      onDoubleClick(entry);
    }
  }, [entry, onDoubleClick, toggleExpanded]);

  return (
    <>
      <div
        className="flex items-center gap-1 py-1 cursor-pointer text-xs transition-colors"
        style={{
          paddingLeft: depth * 16 + 8,
          paddingRight: 12,
          background: selectedPath === entry.path ? 'var(--sb-bg-surface)' : 'transparent',
          color: 'var(--sb-text-primary)',
        }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', entry.path);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClickEntry}
        onContextMenu={(e) => onContextMenu(e, entry)}
        onMouseEnter={(e) => {
          if (selectedPath !== entry.path) e.currentTarget.style.background = 'var(--sb-bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (selectedPath !== entry.path) e.currentTarget.style.background = 'transparent';
        }}
      >
        {entry.isDirectory ? (
          <span
            className="shrink-0 w-3 flex items-center justify-center"
            style={{ color: 'var(--sb-text-secondary)' }}
            onClick={handleChevronClick}
          >
            {isExpanded ? <ChevronDown /> : <ChevronRight />}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0">
          {entry.isDirectory ? <FolderIcon /> : <FileIcon />}
        </span>
        <span className="flex-1 truncate ml-1">{entry.name}</span>
        {!entry.isDirectory && (
          <span style={{ color: 'var(--sb-text-muted)' }} className="shrink-0">{formatSize(entry.size)}</span>
        )}
      </div>
      {isExpanded && childEntries.map((child) => (
        <FileTreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          selectedPath={selectedPath}
        />
      ))}
    </>
  );
});

FileTreeItem.displayName = 'FileTreeItem';

interface FileTreeProps {
  entries: FileEntry[];
  depth: number;
  onSelect: (path: string) => void;
  onDoubleClick: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  selectedPath: string | null;
}

export const FileTree: React.FC<FileTreeProps> = ({
  entries, depth, onSelect, onDoubleClick, onContextMenu, selectedPath,
}) => {
  return (
    <>
      {entries.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={depth}
          onSelect={onSelect}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          selectedPath={selectedPath}
        />
      ))}
    </>
  );
};
