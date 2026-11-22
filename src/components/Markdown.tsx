/**
 * ChatMarkdown - 轻量级儿童聊天气泡 Markdown 渲染。
 *
 * 内容先经过 toKidFriendlyMarkdown 清洗，再使用纯 React 元素渲染标题、列表、引用、
 * 粗体、斜体和安全图片；不引入 antd / @lobehub/ui，禁止渲染任何原始 HTML。
 */
import { Fragment, memo, useState } from 'react';
import { parseKidInline, parseKidMarkdown } from '@/utils/kidMarkdown';
import { toKidFriendlyMarkdown } from '@/utils/markdownContent';

export interface ChatMarkdownProps {
  content: string;
  isUser?: boolean;
  className?: string;
  fontSize?: number;
}

function renderInline(
  text: string,
  onPreview: (img: { src: string; alt: string }) => void,
) {
  const nodes = parseKidInline(text);
  return nodes.map((node, idx) => {
    if (node.type === 'bold') {
      return (
        <strong key={idx} className="font-bold">
          {node.text}
        </strong>
      );
    }
    if (node.type === 'italic') {
      return (
        <em key={idx} className="italic">
          {node.text}
        </em>
      );
    }
    if (node.type === 'image') {
      return (
        <img
          key={idx}
          src={node.url}
          alt={node.alt || 'image'}
          onClick={() => onPreview({ src: node.url, alt: node.alt || 'image' })}
          className="my-2 block max-h-[min(60vh,420px)] w-auto max-w-full cursor-zoom-in rounded-xl object-contain"
        />
      );
    }
    return <Fragment key={idx}>{node.text}</Fragment>;
  });
}

export const ChatMarkdown = memo(function ChatMarkdown({
  content,
  isUser,
  className = '',
  fontSize = 14,
}: ChatMarkdownProps) {
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const cleaned = toKidFriendlyMarkdown(content);
  const blocks = parseKidMarkdown(cleaned);

  return (
    <>
      <div
        className={`space-y-2 leading-relaxed ${isUser ? 'text-white' : 'text-slate-700'} ${className}`.trim()}
        style={{ fontSize }}
      >
        {blocks.map((block, idx) => {
          if (block.type === 'heading') {
            const sizeClass = block.level === 1 ? 'text-[1.2em]' : block.level === 2 ? 'text-[1.12em]' : 'text-[1.05em]';
            return (
              <div key={idx} className={`font-extrabold ${sizeClass}`}>
                {renderInline(block.text, setPreviewImage)}
              </div>
            );
          }
          if (block.type === 'quote') {
            return (
              <blockquote
                key={idx}
                className="whitespace-pre-wrap break-words rounded-r-xl border-l-4 border-amber-300 bg-amber-50/60 px-3 py-1.5 text-slate-600"
              >
                {renderInline(block.text, setPreviewImage)}
              </blockquote>
            );
          }
          if (block.type === 'ul') {
            return (
              <ul key={idx} className="list-disc space-y-1 pl-5">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="break-words">
                    {renderInline(item, setPreviewImage)}
                  </li>
                ))}
              </ul>
            );
          }
          if (block.type === 'ol') {
            return (
              <ol key={idx} className="list-decimal space-y-1 pl-5">
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="break-words">
                    {renderInline(item, setPreviewImage)}
                  </li>
                ))}
              </ol>
            );
          }
          if (block.type === 'image') {
            return (
              <img
                key={idx}
                src={block.url}
                alt={block.alt || 'image'}
                onClick={() => setPreviewImage({ src: block.url, alt: block.alt || 'image' })}
                className="my-2 block max-h-[min(60vh,420px)] w-auto max-w-full cursor-zoom-in rounded-xl object-contain"
              />
            );
          }
          return (
            <p key={idx} className="whitespace-pre-wrap break-words">
              {renderInline(block.text, setPreviewImage)}
            </p>
          );
        })}
      </div>

      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="flex max-h-[90vh] max-w-3xl flex-col items-end gap-3 rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="flex h-12 items-center rounded-2xl bg-slate-100 px-5 text-sm font-bold text-slate-600"
            >
              关闭
            </button>
            <img
              src={previewImage.src}
              alt={previewImage.alt}
              className="max-h-[75vh] w-auto rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
});

export default ChatMarkdown;
