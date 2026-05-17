'use client';

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

interface CodeEditorProps {
  filename: string;
  patch: string;
  onLineClick?: (line: number) => void;
}

export default function CodeEditor({ filename, patch, onLineClick }: CodeEditorProps) {
  const { original, modified } = parsePatch(patch);
  const language = getLanguage(filename);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-gh-surface border-b border-gh-border">
        <span className="text-xs font-mono text-gh-textSecondary">{filename}</span>
      </div>
      <div className="flex-1">
        <MonacoDiffEditor
          height="100%"
          language={language}
          theme="vs-dark"
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
          onMount={(editor) => {
            if (onLineClick) {
              editor.getModifiedEditor().onMouseDown((e) => {
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
