import { useState } from 'react';
import { buildSessionMarkdown, sessionFileName, type ExpressionSession } from '@/config/kidExpression';

/** 把一份语言表达课时记录导出成可并入「上课记录」目录的 markdown */
export function RecordExportSheet({ session, onClose }: { session: ExpressionSession; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const md = buildSessionMarkdown(session);
  const fileName = sessionFileName(session);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" data-testid="expression-export-sheet">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col rounded-[28px] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-slate-800">课堂记录已生成</h2>
            <p className="mt-1 truncate text-sm text-slate-500">
              文件名 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{fileName}</code>
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl">✕</button>
        </div>
        <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          这份 markdown 的 meta 块与四段文件名可直接被「上课记录」目录识别：存成同名文件后跑 <code>rebuild_index.py</code>，
          就会自动并入该孩子的汇总页与同类练习对照表。
        </p>
        <pre className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{md}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void copy()} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-slate-800 px-4 text-sm font-bold text-white">
            {copied ? '已复制 ✓' : '复制全文'}
          </button>
          <button type="button" onClick={download} className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-rose-500 px-4 text-sm font-bold text-white">
            下载 .md
          </button>
        </div>
      </div>
    </div>
  );
}
