import React, { useState, useRef, useMemo, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import TextareaAutosize from "react-textarea-autosize";
import remarkGfm from "remark-gfm";
import {
  Image,
  Eye,
  Edit2,
  FileImage,
  Copy,
  Check,
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  Quote,
  Code,
  SlidersHorizontal,
  Strikethrough,
  CheckSquare,
  X,
  Undo,
  Redo,
  Columns,
  Cloud,
  CheckCircle2,
  Download,
  Link as LinkIcon,
  Clock,
  Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Note } from "../types";
import { Skeleton } from "./Skeleton";
import { TiptapEditor, TiptapEditorRef } from "./TiptapEditor";

// Cast motion components for TypeScript
const MotionDiv = motion.div as any;

interface MarkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
  title: string;
  onTitleChange: (value: string) => void;
  onWikiLinkClick: (title: string, isCtrl: boolean) => void;
  isGeneratingTitle?: boolean;
  theme: "light" | "dark";
  saveStatus: "saved" | "saving";
  onUploadFile?: (file: File) => Promise<string>;
  getAttachmentSrc?: (url: string) => string | undefined;
  backlinks?: Note[];
  onNoteClick?: (id: string) => void;
  zenMode?: boolean;
  showToolbar: boolean;
  onToggleToolbar: () => void;
}

const SlashMenu = ({ isOpen, onClose, onSelect, position }: any) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = [
    { label: "Heading 1", icon: <Heading1 size={14} />, action: "# " },
    { label: "Heading 2", icon: <Heading2 size={14} />, action: "## " },
    { label: "Bullet List", icon: <List size={14} />, action: "- " },
    { label: "Task List", icon: <CheckSquare size={14} />, action: "- [ ] " },
    { label: "Blockquote", icon: <Quote size={14} />, action: "> " },
    {
      label: "Code Block",
      icon: <Code size={14} />,
      action: "```\n\n```",
      cursorOffset: -4,
    },
    { label: "Divider", icon: <Minus size={14} />, action: "---\n" },
    { label: "Image", icon: <FileImage size={14} />, action: "image" },
  ];

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % items.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          onSelect(items[selectedIndex]);
        } else if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, selectedIndex, items, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      style={position}
      className="absolute z-50 w-64 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden py-1.5 flex flex-col"
    >
      <div className="px-3 py-1.5 text-xs font-bold text-zinc-400 uppercase tracking-wider">
        Insert
      </div>
      {items.map((item, index) => (
        <button
          key={item.label}
          onClick={() => onSelect(item)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
            index === selectedIndex
              ? "bg-violet-50 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100"
              : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <span className="opacity-70">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content,
  onChange,
  title,
  onTitleChange,
  onWikiLinkClick,
  isGeneratingTitle = false,
  theme,
  saveStatus,
  onUploadFile,
  getAttachmentSrc,
  backlinks = [],
  onNoteClick,
  zenMode = false,
  showToolbar,
  onToggleToolbar,
}) => {
  const [copied, setCopied] = useState(false);
  // showToolbar is now uncontrolled via props
  const [readingProgress, setReadingProgress] = useState(0);
  const [, forceUpdate] = useState({}); // Force update for toolbar active states

  // Slash Menu State
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState<
    { top: number; left: number } | undefined
  >(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TiptapEditorRef>(null);

  const wordCount = useMemo(() => {
    return content
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }, [content]);

  const readingTime = Math.ceil(wordCount / 200);

  const handleScrollUpdate = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const windowHeight = scrollHeight - clientHeight;
    if (windowHeight > 0) {
      const percent = (scrollTop / windowHeight) * 100;
      setReadingProgress(Math.min(100, Math.max(0, percent)));
    } else {
      setReadingProgress(0);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    if (onUploadFile) {
      onUploadFile(file)
        .then((url) => {
          const editor = editorRef.current?.editor;
          if (editor) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        })
        .catch((err) => {
          console.error("Upload failed", err);
          alert("Failed to upload image");
        });
    } else {
      // Fallback if no upload handler
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const editor = editorRef.current?.editor;
        if (editor) {
          editor.chain().focus().setImage({ src: base64String }).run();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) processFile(file);
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        processFile(file);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "Untitled"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const insertFormat = (prefix: string, suffix: string = "") => {
    const editor = editorRef.current?.editor;
    if (!editor) return;
    editor.chain().focus().run();

    // SPECIAL HANDLING: User wants "Tags in center" behavior for Bold/Italic
    // We insert the raw markdown syntax characters.
    // If there is a selection, we wrap it.
    // If no selection, we insert prefix+suffix and place cursor in middle.

    if (["**", "*", "~~", "<u>", "```", "`", "```\n"].includes(prefix)) {
      const { from, to } = editor.state.selection;
      const width = to - from;

      if (width > 0) {
        // Wrap selection
        // We use insertContentAt for precision?
        // Actually `command` is best.
        // But simple way:
        const text = editor.state.doc.textBetween(from, to);
        editor.chain().insertContent(`${prefix}${text}${suffix}`).run();
      } else {
        // Insert and move cursor
        editor.chain().insertContent(`${prefix}${suffix}`).run();
        // Move cursor back by suffix length
        const pos = editor.state.selection.from - suffix.length;
        editor.chain().setTextSelection(pos).run();
      }
      return;
    }

    // Map common block prefixes to Tiptap commands or Text Insertion
    // "delayed rendering" means we should just insert text and let the user press Enter?
    // User: "How do I exit code block nothing for that... toolbox... html syntax generated"
    // For Headings/Lists, effectively just typing the prefix is what they want?

    switch (prefix) {
      case "# ":
      case "## ":
      case "- ":
      case "- [ ] ":
      case "> ":
        // Just insert the text at start of line?
        // Or just insert at cursor?
        editor.chain().insertContent(prefix).run();
        break;
    }
  };

  const insertAtCursor = (text: string) => {
    const editor = editorRef.current?.editor;
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
  };

  const handleSlashSelect = (item: any) => {
    setSlashMenuOpen(false);
    const editor = editorRef.current?.editor;
    if (!editor) return;

    if (item.label === "Image") {
      triggerFileInput();
    } else {
      // Map item actions to formatting commands instead of raw text insertion where possible
      if (item.action === "# ")
        editor.chain().toggleHeading({ level: 1 }).run();
      else if (item.action === "## ")
        editor.chain().toggleHeading({ level: 2 }).run();
      else if (item.action === "- ") editor.chain().toggleBulletList().run();
      else if (item.action === "- [ ] ") editor.chain().toggleTaskList().run();
      else if (item.action === "> ") editor.chain().toggleBlockquote().run();
      else if (item.action === "```\n\n```")
        editor.chain().toggleCodeBlock().run();
      else if (item.action === "---\n")
        editor.chain().setHorizontalRule().run();
      else editor.chain().insertContent(item.action).run();
    }
  };

  const performUndo = () => {
    editorRef.current?.editor?.chain().focus().undo().run();
  };

  const performRedo = () => {
    editorRef.current?.editor?.chain().focus().redo().run();
  };

  const processedContent = useMemo(() => {
    return content.replace(/\[\[([^\]]+)\]\]/g, (match, p1) => {
      const parts = p1.split("|");
      const linkTarget = parts[0];
      const linkLabel = parts[1] || parts[0];
      return `[${linkLabel}](wiki://${linkTarget})`;
    });
  }, [content]);

  const BacklinksSection = () => {
    if (!backlinks || backlinks.length === 0) return null;

    return (
      <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-white/10 opacity-80 hover:opacity-100 transition-opacity">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <LinkIcon size={12} />
          Linked Mentions
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {backlinks.map((note) => (
            <div
              key={note.id}
              onClick={() => onNoteClick && onNoteClick(note.id)}
              className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/5 cursor-pointer transition-colors group"
            >
              <div className="font-medium text-sm text-zinc-700 dark:text-zinc-300 group-hover:text-accent transition-colors">
                {note.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEditor = () => (
    <div className="relative w-full h-full pb-40 max-w-3xl mx-auto">
      <SlashMenu
        isOpen={slashMenuOpen}
        onClose={() => setSlashMenuOpen(false)}
        onSelect={handleSlashSelect}
        position={{ top: "20%", left: "50%", transform: "translate(-50%, 0)" }}
      />
      <TiptapEditor
        ref={editorRef}
        content={content}
        onChange={(val) => {
          onChange(val);
        }}
        onSelectionUpdate={() => forceUpdate({})}
        getAttachmentSrc={getAttachmentSrc}
        onWikiLinkClick={onWikiLinkClick}
        placeholder="Start typing... use / for commands, [[WikiLinks]] to connect."
        className="w-full min-h-full p-6 md:p-10 outline-none bg-transparent"
        style={{
          flex: 1,
        }}
      />
      <div className="px-6 md:px-10 pb-10">
        <BacklinksSection />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent transition-colors duration-300 relative group w-full">
      {/* Redesigned Reading Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-zinc-200/20 dark:bg-zinc-800/20 z-[100] pointer-events-none">
        <motion.div
          className="h-full bg-violet-600 dark:bg-violet-400 origin-left shadow-[0_1px_4px_rgba(124,58,237,0.3)]"
          style={{ width: `${readingProgress}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${readingProgress}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 30 }}
        />
      </div>

      <motion.div
        animate={{
          opacity: zenMode ? 0 : 1,
          height: zenMode ? 0 : "auto",
          marginBottom: zenMode ? 0 : "1rem",
        }}
        className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-zinc-100 dark:border-white/5 z-20 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm overflow-hidden"
      >
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="relative flex-1 flex flex-col">
            {isGeneratingTitle ? (
              <Skeleton className="h-9 w-3/4 max-w-[300px]" />
            ) : (
              <input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Untitled Note"
                className="text-2xl md:text-3xl font-bold bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 w-full font-sans tracking-tight"
              />
            )}
            <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-400">
              {saveStatus === "saving" ? (
                <>
                  <Cloud size={12} className="animate-pulse" />
                  <span className="font-medium">Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} className="text-green-500" />
                  <span className="font-medium">All changes saved</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 ml-2">
            <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-zinc-400 mr-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
              <span>{wordCount} words</span>
              <span className="w-px h-3 bg-zinc-300 dark:bg-zinc-600"></span>
              <span className="flex items-center gap-1">
                <Clock size={10} /> {readingTime}m read
              </span>
            </div>

            {
              <button
                onClick={onToggleToolbar}
                className={`hidden md:block p-2 transition-colors rounded-xl ${
                  showToolbar
                    ? "text-accent bg-accent/10"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
                title="Toggle Toolbar"
              >
                <SlidersHorizontal size={20} />
              </button>
            }

            <button
              onClick={handleCopy}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Copy Note"
            >
              {copied ? (
                <Check size={20} className="text-green-500" />
              ) : (
                <Copy size={20} />
              )}
            </button>

            <button
              onClick={handleDownload}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Export Note"
            >
              <Download size={20} />
            </button>

            <button
              onClick={triggerFileInput}
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Insert Image"
            >
              <FileImage size={20} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
            />

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>
        </div>
      </motion.div>

      <div className="flex-1 overflow-hidden relative flex">
        <MotionDiv
          onScroll={handleScrollUpdate}
          initial={false}
          animate={{
            width: "100%",
            opacity: 1,
            x: 0,
          }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="h-full overflow-y-auto custom-scrollbar flex-shrink-0"
          style={{
            pointerEvents: "auto",
          }}
        >
          <div className="h-full w-full">{renderEditor()}</div>
        </MotionDiv>
      </div>

      <AnimatePresence>
        {showToolbar && !zenMode && (
          <MotionDiv
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute bottom-6 left-1/2 z-50 flex flex-nowrap items-center gap-1 p-1.5 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl shadow-xl shadow-black/10 dark:shadow-black/40 max-w-[92vw] w-auto ring-1 ring-black/5 dark:ring-white/5"
            style={{ x: "-50%" }}
          >
            <div className="flex items-center flex-shrink-0">
              <ToolbarBtn
                icon={<Undo size={18} />}
                onClick={performUndo}
                tooltip="Undo"
                active={false}
              />
              <ToolbarBtn
                icon={<Redo size={18} />}
                onClick={performRedo}
                tooltip="Redo"
                active={false}
              />
              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
            </div>
            <div className="flex items-center flex-shrink-0">
              <ToolbarBtn
                icon={<Bold size={18} />}
                onClick={() => insertFormat("**", "**")}
                tooltip="Bold"
                active={editorRef.current?.editor?.isActive("bold")}
              />
              <ToolbarBtn
                icon={<Italic size={18} />}
                onClick={() => insertFormat("*", "*")}
                tooltip="Italic"
                active={editorRef.current?.editor?.isActive("italic")}
              />
              <div className="hidden sm:flex items-center">
                <ToolbarBtn
                  icon={<Underline size={18} />}
                  onClick={() => insertFormat("<u>", "</u>")}
                  tooltip="Underline"
                  active={editorRef.current?.editor?.isActive("underline")}
                />
                <ToolbarBtn
                  icon={<Strikethrough size={18} />}
                  onClick={() => insertFormat("~~", "~~")}
                  tooltip="Strikethrough"
                  active={editorRef.current?.editor?.isActive("strike")}
                />
              </div>
              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
            </div>
            <div className="flex items-center flex-shrink-0">
              <ToolbarBtn
                icon={<Heading1 size={18} />}
                onClick={() => insertFormat("# ")}
                tooltip="Heading 1"
                active={editorRef.current?.editor?.isActive("heading", {
                  level: 1,
                })}
              />
              <div className="hidden sm:flex items-center">
                <ToolbarBtn
                  icon={<Heading2 size={18} />}
                  onClick={() => insertFormat("## ")}
                  tooltip="Heading 2"
                  active={editorRef.current?.editor?.isActive("heading", {
                    level: 2,
                  })}
                />
              </div>
              <ToolbarBtn
                icon={<List size={18} />}
                onClick={() => insertFormat("- ")}
                tooltip="Bullet List"
                active={editorRef.current?.editor?.isActive("bulletList")}
              />
              <div className="hidden sm:flex items-center">
                <ToolbarBtn
                  icon={<CheckSquare size={18} />}
                  onClick={() => insertFormat("- [ ] ")}
                  tooltip="Task List"
                  active={editorRef.current?.editor?.isActive("taskList")}
                />
              </div>
              <div className="hidden sm:block w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
            </div>
            <div className="hidden sm:flex items-center flex-shrink-0">
              <ToolbarBtn
                icon={<Quote size={18} />}
                onClick={() => insertFormat("> ")}
                tooltip="Quote"
                active={editorRef.current?.editor?.isActive("blockquote")}
              />
              <ToolbarBtn
                icon={<Code size={18} />}
                onClick={() => insertFormat("```")}
                tooltip="Code Block"
                active={editorRef.current?.editor?.isActive("codeBlock")}
              />
              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={onToggleToolbar}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};

const ToolbarBtn: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  tooltip: string;
  active?: boolean;
}> = ({ icon, onClick, tooltip, active }) => (
  <button
    onClick={onClick}
    title={tooltip}
    className={`p-2 rounded-xl transition-all active:scale-95 flex-shrink-0 ${
      active
        ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300"
        : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-accent dark:hover:text-accent"
    }`}
  >
    {icon}
  </button>
);
