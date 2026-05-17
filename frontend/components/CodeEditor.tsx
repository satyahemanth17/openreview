'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

const MonacoDiffEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.DiffEditor),
  { ssr: false }
);

const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  cpp: 'cpp', cc: 'cpp', c: 'c', cs: 'csharp', php: 'php',
  swift: 'swift', kt: 'kotlin', md: 'markdown', json: 'json',
  yaml: 'yaml', yml: 'yaml', sh: 'shell', css: 'css', scss: 'css',
  html: 'html', xml: 'xml', sql: 'sql', toml: 'ini', env: 'ini',
};

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANG[ext] ?? 'plaintext';
}

function parsePatch(patch: string): { original: string; modified: string } {
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];

  for (const line of patch.split('\n')) {
    if (line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      continue;
    } else if (line.startsWith('-')) {
      originalLines.push(line.slice(1));
    } else if (line.startsWith('+')) {
      modifiedLines.push(line.slice(1));
    } else {
      const content = line.startsWith(' ') ? line.slice(1) : line;
      originalLines.push(content);
      modifiedLines.push(content);
    }
  }

  return { original: originalLines.join('\n'), modified: modifiedLines.join('\n') };
}

const DIFF_STYLE_ID = 'openreview-diff-style';

function ensureDiffStyles() {
  if (typeof document === 'undefined' || document.getElementById(DIFF_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DIFF_STYLE_ID;
  style.textContent = [
    '.monaco-diff-editor .line-insert span { color: #4ec94e !important; }',
    '.monaco-diff-editor .char-insert span { color: #4ec94e !important; }',
    '.monaco-diff-editor .line-delete span { color: #f85149 !important; }',
    '.monaco-diff-editor .char-delete span { color: #f85149 !important; }',
    '.openreview-highlight-line { background-color: rgba(255, 105, 180, 0.35) !important; }',
    '.openreview-selection-overlay { background-color: rgba(66, 153, 225, 0.35) !important; }',
  ].join('\n');
  document.head.appendChild(style);
}

interface CodeEditorProps {
  filename: string;
  patch: string;
  onLineClick?: (line: number) => void;
  onAddLineComment?: (lineStart: number, lineEnd: number, body: string) => Promise<void>;
  highlightLine?: number | null;
}

export default function CodeEditor({ filename, patch, onLineClick, onAddLineComment, highlightLine }: CodeEditorProps) {
  const { original, modified } = parsePatch(patch);
  const language = getLanguage(filename);

  const [overlay, setOverlay] = useState<{ y: number; lineStart: number; lineEnd: number } | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [inputBody, setInputBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorRef = useRef<any>(null);
  const decorationRef = useRef<string[] | null>(null);
  const selectionDecorationRef = useRef<string[] | null>(null);
  const selectionDecorationOrigRef = useRef<string[] | null>(null);
  const fileChangedRef = useRef(false);

  useEffect(() => {
    ensureDiffStyles();
  }, []);

  useEffect(() => {
    fileChangedRef.current = true;
  }, [filename]);

  useEffect(() => {
    if (decorationRef.current && editorRef.current) {
      editorRef.current.getModifiedEditor().deltaDecorations(decorationRef.current, []);
      decorationRef.current = null;
    }
    if (!highlightLine || !editorRef.current) return;
    const needsDelay = fileChangedRef.current;
    fileChangedRef.current = false;
    const timer = setTimeout(() => {
      if (!editorRef.current) return;
      const modEditor = editorRef.current.getModifiedEditor();
      modEditor.revealLineInCenter(highlightLine);
      decorationRef.current = modEditor.deltaDecorations([], [{
        range: { startLineNumber: highlightLine, startColumn: 1, endLineNumber: highlightLine, endColumn: 1 },
        options: { isWholeLine: true, className: 'openreview-highlight-line' },
      }]);
    }, needsDelay ? 600 : 0);
    return () => clearTimeout(timer);
  }, [highlightLine]);

  async function handleSubmit() {
    if (!overlay || !inputBody.trim() || !onAddLineComment || submitting) return;
    setSubmitting(true);
    try {
      await onAddLineComment(overlay.lineStart, overlay.lineEnd, inputBody.trim());
      setInputBody('');
      setShowInput(false);
      setOverlay(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-gh-surface border-b border-gh-border">
        <span className="text-xs font-mono text-gh-textSecondary">{filename}</span>
      </div>
      <div className="flex-1 relative">
        <MonacoDiffEditor
          height="100%"
          language={language}
          theme="openreview-dark"
          original={original}
          modified={modified}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            wordWrap: 'on',
            renderSideBySide: true,
            contextmenu: false,
          }}
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('openreview-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [],
              colors: {
                'diffEditor.insertedLineBackground': '#1a2e1a',
                'diffEditor.removedLineBackground': '#2e1a1a',
                'diffEditorGutter.insertedLineBackground': '#2d4a2d',
                'diffEditorGutter.removedLineBackground': '#4a2d2d',
                'diffEditor.insertedTextBackground': '#1a2e1a80',
                'diffEditor.removedTextBackground': '#2e1a1a80',
              },
            });
          }}
          onMount={(editor) => {
            editorRef.current = editor;
            const modEditor = editor.getModifiedEditor();
            const origEditor = editor.getOriginalEditor();

            function clearNavHighlight() {
              if (decorationRef.current) {
                modEditor.deltaDecorations(decorationRef.current, []);
                decorationRef.current = null;
              }
            }

            modEditor.onMouseDown(clearNavHighlight);
            origEditor.onMouseDown(clearNavHighlight);

            if (onLineClick) {
              modEditor.onMouseDown((e) => {
                const lineNumber = e.target.position?.lineNumber;
                if (lineNumber != null) onLineClick(lineNumber);
              });
            }

            modEditor.onDidChangeCursorSelection((e) => {
              const sel = e.selection;

              if (sel.isEmpty()) {
                if (selectionDecorationRef.current) {
                  modEditor.deltaDecorations(selectionDecorationRef.current, []);
                  selectionDecorationRef.current = null;
                }
              } else {
                selectionDecorationRef.current = modEditor.deltaDecorations(
                  selectionDecorationRef.current ?? [],
                  [{
                    range: {
                      startLineNumber: sel.startLineNumber,
                      startColumn: sel.startColumn,
                      endLineNumber: sel.endLineNumber,
                      endColumn: sel.endColumn,
                    },
                    options: { className: 'openreview-selection-overlay', isWholeLine: true },
                  }]
                );
              }

              if (onAddLineComment) {
                if (sel.isEmpty()) {
                  if (document.activeElement !== inputRef.current) setOverlay(null);
                } else {
                  const lineStart = sel.startLineNumber;
                  const lineEnd = sel.endLineNumber;
                  const pos = modEditor.getScrolledVisiblePosition({ lineNumber: lineEnd, column: 1 });
                  if (pos) {
                    setOverlay({ y: pos.top, lineStart, lineEnd });
                    setShowInput(false);
                    setInputBody('');
                  }
                }
              }
            });

            // Bug 1: selection overlay on original (left) pane for red deleted lines
            origEditor.onDidChangeCursorSelection((e) => {
              const sel = e.selection;

              if (sel.isEmpty()) {
                if (selectionDecorationOrigRef.current) {
                  origEditor.deltaDecorations(selectionDecorationOrigRef.current, []);
                  selectionDecorationOrigRef.current = null;
                }
              } else {
                selectionDecorationOrigRef.current = origEditor.deltaDecorations(
                  selectionDecorationOrigRef.current ?? [],
                  [{
                    range: {
                      startLineNumber: sel.startLineNumber,
                      startColumn: sel.startColumn,
                      endLineNumber: sel.endLineNumber,
                      endColumn: sel.endColumn,
                    },
                    options: { className: 'openreview-selection-overlay', isWholeLine: true },
                  }]
                );
              }
            });
          }}
        />

        {overlay && onAddLineComment && (
          <div style={{ position: 'absolute', top: Math.max(0, overlay.y), right: 0, zIndex: 20 }}>
            {!showInput ? (
              <button
                onClick={() => setShowInput(true)}
                className="w-6 h-6 rounded-full bg-gh-primary text-white text-sm font-bold flex items-center justify-center hover:bg-gh-primary/80 shadow-lg mr-2 cursor-pointer"
                title={overlay.lineStart === overlay.lineEnd ? `Comment on line ${overlay.lineStart}` : `Comment on lines ${overlay.lineStart}–${overlay.lineEnd}`}
              >
                +
              </button>
            ) : (
              <div className="bg-gh-surface border border-gh-border rounded-lg p-3 shadow-xl mr-2 w-72">
                <p className="text-xs font-mono text-gh-textSecondary mb-2">
                  {filename} · {overlay.lineStart === overlay.lineEnd ? `Line ${overlay.lineStart}` : `Lines ${overlay.lineStart}–${overlay.lineEnd}`}
                </p>
                <textarea
                  ref={inputRef}
                  autoFocus
                  className="w-full bg-gh-bg border border-gh-border rounded px-2 py-1.5 text-sm text-gh-textPrimary focus:outline-none focus:border-gh-primary resize-none"
                  rows={3}
                  placeholder="Add a line comment..."
                  value={inputBody}
                  onChange={(e) => setInputBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !submitting) {
                      e.preventDefault();
                      handleSubmit();
                    }
                    if (e.key === 'Escape') {
                      setShowInput(false);
                      setInputBody('');
                    }
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !inputBody.trim()}
                    className="px-3 py-1 text-xs bg-gh-primary text-white rounded disabled:opacity-50 hover:bg-gh-primary/90 cursor-pointer"
                  >
                    {submitting ? 'Saving...' : 'Comment'}
                  </button>
                  <button
                    onClick={() => { setShowInput(false); setInputBody(''); }}
                    className="px-3 py-1 text-xs text-gh-textSecondary hover:text-gh-textPrimary cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
