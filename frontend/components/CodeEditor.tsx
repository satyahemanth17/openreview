'use client';

import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CodeEditorProps {
  filename: string;
  patch: string;
  onLineClick?: (line: number) => void;
}

export default function CodeEditor({ filename, patch, onLineClick }: CodeEditorProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-gh-surface border-b border-gh-border">
        <span className="text-xs font-mono text-gh-textSecondary">{filename}</span>
      </div>
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language="diff"
          theme="vs-dark"
          value={patch}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            contextmenu: false,
          }}
          onMount={(editor) => {
            if (onLineClick) {
              editor.onMouseDown((e) => {
                const lineNumber = e.target.position?.lineNumber;
                if (lineNumber != null) onLineClick(lineNumber);
              });
            }
          }}
        />
      </div>
    </div>
  );
}
