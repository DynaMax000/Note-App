import React from "react";
import { NodeViewContent, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Copy, Check } from "lucide-react";

export const CodeBlockComponent: React.FC<NodeViewProps> = ({
  node: {
    attrs: { language: defaultLanguage },
  },
  editor,
  getPos,
}) => {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = () => {
    if (typeof getPos === "function") {
      const pos = getPos();
      const node = editor.state.doc.nodeAt(pos);
      if (node) {
        const text = node.textContent;
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }
    }
  };

  return (
    <NodeViewWrapper className="code-block relative my-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shadow-sm group">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 select-none">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase font-mono">
          {defaultLanguage || "text"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors text-zinc-500"
            title="Copy code"
          >
            {copied ? (
              <Check size={14} className="text-green-500" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      </div>
      {/* Tiptap uses standard pre/code structure for lowlight */}
      <pre className="!p-3 !m-0 !bg-transparent !border-0 !shadow-none overflow-x-auto text-sm font-mono flex flex-col">
        <NodeViewContent
          className={`language-${defaultLanguage || "text"} !bg-transparent !p-0 !m-0 !border-0 !shadow-none outline-none ring-0`}
          spellCheck="false"
        />
      </pre>
    </NodeViewWrapper>
  );
};
