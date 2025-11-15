import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import { Copy } from 'lucide-react';

type CodeSnippetProps = {
  title?: ReactNode;
  lines: string[];
  headerRight?: ReactNode;
};

const CodeSnippet: FC<CodeSnippetProps> = ({ title, lines, headerRight }) => {
  const code = lines.join('\n');
  const [copied, setCopied] = useState<boolean>(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-none border-[3px] border-border bg-surface shadow-md">
      <div className="flex items-center justify-between border-b-[3px] border-border px-4 py-2 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>{title}</span>
            {headerRight}
          </div>
          
          <button
            type="button"
            onClick={onCopy}
            aria-label={copied ? 'Copied' : 'Copy snippet'}
            className="inline-flex items-center gap-1 rounded-none border-[3px] border-border bg-surface px-2 py-1 text-[11px] text-text shadow-md transition-all duration-200 will-change-transform hover:bg-surface/80 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span aria-live="polite">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      <pre className="flex-1 overflow-auto p-4 text-[13px] leading-relaxed text-text/90 whitespace-pre-wrap break-words">
        <code className="font-mono">
          {code}
        </code>
      </pre>
    </div>
  );
};

export default CodeSnippet;


