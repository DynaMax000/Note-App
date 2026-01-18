import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
} from "react";
import {
  Plus,
  Search,
  Network,
  FileText,
  Moon,
  Sun,
  Sparkles,
  Trash2,
  Sidebar as SidebarIcon,
  Folder as FolderIcon,
  ChevronDown,
  X,
  Eye,
  EyeOff,
  Pencil,
  ExternalLink,
  FolderPlus,
  Home,
  ChevronRight,
  Calendar,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Hash,
  Tag,
  Send,
  Bot,
  User as UserIcon,
  GripHorizontal,
  Paperclip,
  Lightbulb,
  Book,
  Code,
  ListTodo,
  Bug,
  Target,
  Palette,
  Smile,
  Zap,
  SlidersHorizontal,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Note,
  Folder,
  Attachment,
  ViewMode,
  Theme,
  ContextMenuState,
} from "./types";
import { Skeleton } from "./components/Skeleton";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { Graph } from "./components/Graph";
import { generateGraphData } from "./utils/graphUtils";
import {
  streamAiChat,
  suggestNoteTitle,
  ChatMessage,
} from "./services/geminiService";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Modal, ModalProps } from "./components/Modal";
import { CommandPalette } from "./components/CommandPalette";

// Cast motion components
const MotionAside = motion.aside as any;
const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;
const MotionMain = motion.main as any;

const generateId = () => Math.random().toString(36).substring(2, 9);

const INITIAL_NOTE: Note = {
  id: generateId(),
  title: "Welcome to ObsidianGen",
  content: `# Welcome!\n\nThis is a minimalist, AI-powered note-taking app.\n\n## New Features:\n- **AI Chat Assistant**: Click the sparkles icon to chat with your note! The chat window is now compact and draggable.\n- **Graph View**: A visual network of your notes. \n- **Reading Progress**: Check the top of the editor for a progress bar as you scroll.\n- **Slash Commands**: Type \`/\` to quickly insert headers, lists, and more!\n- **Tags**: Add tags like #ideas or #todo to organize your notes.\n\nTry typing \`/\` below:\n\n`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const ICON_OPTIONS = [
  { id: "FileText", icon: FileText, label: "Default" },
  { id: "Lightbulb", icon: Lightbulb, label: "Idea" },
  { id: "Book", icon: Book, label: "Journal" },
  { id: "Code", icon: Code, label: "Code" },
  { id: "ListTodo", icon: ListTodo, label: "Todo" },
  { id: "Bug", icon: Bug, label: "Issue" },
  { id: "Target", icon: Target, label: "Goal" },
  { id: "Palette", icon: Palette, label: "Design" },
  { id: "Smile", icon: Smile, label: "Personal" },
  { id: "Zap", icon: Zap, label: "Urgent" },
];

const IconPickerModal = ({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconId: string) => void;
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Icon" type="custom">
      <div className="grid grid-cols-5 gap-2">
        {ICON_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={option.label}
            >
              <div className="p-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg">
                <Icon size={20} className="text-zinc-700 dark:text-zinc-300" />
              </div>
              <span className="text-[10px] text-zinc-500">{option.label}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
};

// --- Inline Rename Input Component ---
const RenameInput = ({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSave(value);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleBlur = () => {
    onSave(value);
  };

  return (
    <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="w-full bg-white dark:bg-zinc-800 border border-violet-500 rounded px-1 py-0.5 text-sm text-zinc-900 dark:text-zinc-100 outline-none h-6 leading-none"
      />
    </div>
  );
};

// --- Context Menu Item Component ---
const ContextMenuItem = ({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
      danger
        ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
    }`}
  >
    <span className={danger ? "text-red-500" : "text-zinc-400"}>{icon}</span>
    <span className="font-medium">{label}</span>
  </button>
);

// --- Recursive File Tree Component ---
const FileTree = React.memo(
  ({
    folders,
    notes,
    attachments,
    parentId,
    activeNoteId,
    editingId,
    level = 0,
    onNoteClick,
    onMoveNote,
    onMoveFolder,
    onMoveAttachment,
    toggleFolder,
    onContextMenu,
    onRename,
    onAttachmentClick,
    selectedIds,
    onFolderClick,
    showAttachments,
  }: {
    folders: Folder[];
    notes: Note[];
    attachments: Attachment[];
    parentId?: string;
    activeNoteId: string;
    editingId: string | null;
    level?: number;
    onNoteClick: (id: string, e?: React.MouseEvent) => void; // Updated
    onMoveNote: (noteId: string, targetFolderId?: string) => void;
    onMoveFolder: (folderId: string, targetFolderId?: string) => void;
    onMoveAttachment: (attachmentId: string, targetFolderId?: string) => void;
    toggleFolder: (folderId: string, forceOpen?: boolean) => void;
    onContextMenu: (
      e: React.MouseEvent,
      type: "root" | "folder" | "note" | "attachment",
      targetId?: string,
    ) => void;
    onRename: (id: string, newName: string) => void;
    onAttachmentClick: (id: string, e: React.MouseEvent) => void;

    selectedIds?: Set<string>;
    onFolderClick: (id: string, e: React.MouseEvent) => void;
    showAttachments: boolean;
  }) => {
    // Filter items that belong to this level
    const currentFolders = folders.filter(
      (f) =>
        (f.parentId === parentId || (!parentId && !f.parentId)) && // Filter logic
        (showAttachments || f.name !== "Attachments"),
    );
    const currentNotes = notes.filter(
      (n) => n.folderId === parentId || (!parentId && !n.folderId),
    );
    const currentAttachments = showAttachments
      ? attachments.filter(
          (a) => a.folderId === parentId || (!parentId && !a.folderId),
        )
      : [];

    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(
      null,
    );

    // Indentation calculation: base padding + level * step
    const paddingLeft = 16 + level * 16;

    const handleDragStart = (
      e: React.DragEvent,
      type: "note" | "folder" | "attachment",
      id: string,
    ) => {
      e.stopPropagation();
      e.dataTransfer.setData(
        type === "note"
          ? "noteId"
          : type === "folder"
            ? "folderId"
            : "attachmentId",
        id,
      );
      e.dataTransfer.effectAllowed = "move";
    };

    const onFolderDragOver = (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(folderId);
    };

    const onFolderDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(null);
    };

    const onFolderDrop = (e: React.DragEvent, targetFolderId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(null);

      const noteId = e.dataTransfer.getData("noteId");
      const folderId = e.dataTransfer.getData("folderId");
      const attachmentId = e.dataTransfer.getData("attachmentId");

      if (noteId) {
        onMoveNote(noteId, targetFolderId);
        toggleFolder(targetFolderId, true);
      } else if (folderId) {
        if (folderId !== targetFolderId) {
          onMoveFolder(folderId, targetFolderId);
          toggleFolder(targetFolderId, true);
        }
      } else if (attachmentId) {
        onMoveAttachment(attachmentId, targetFolderId);
        toggleFolder(targetFolderId, true);
      }
    };

    const handleFolderClick = (e: React.MouseEvent, folderId: string) => {
      e.stopPropagation();
      // Select the folder without opening it (activeNoteId)
      onFolderClick(folderId, e);

      // If no modifiers are pressed, also toggle the folder
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        toggleFolder(folderId);
      }
    };

    return (
      <div className="w-full">
        <AnimatePresence mode="popLayout">
          {currentFolders.map((folder) => {
            const childNoteCount = notes.filter(
              (n) => n.folderId === folder.id,
            ).length;
            const childFolderCount = folders.filter(
              (f) => f.parentId === folder.id,
            ).length;
            const childAttachmentCount = attachments.filter(
              (a) => a.folderId === folder.id,
            ).length;
            const totalFiles =
              childNoteCount + childFolderCount + childAttachmentCount;
            const isEditing = editingId === folder.id;
            const isDragOver = dragOverFolderId === folder.id;
            const isSelected = selectedIds?.has(folder.id);

            return (
              <MotionDiv
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                key={folder.id}
                className="w-full overflow-hidden"
              >
                <div className="px-2 w-full">
                  <div
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, "folder", folder.id)}
                    className={`group flex items-center gap-2 py-1.5 pr-2 rounded-lg text-sm transition-all duration-200 cursor-pointer
                      ${
                        isSelected
                          ? "bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 font-medium"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-white/5"
                      }
                      ${isEditing ? "bg-zinc-100 dark:bg-zinc-800" : ""}
                      ${
                        isDragOver
                          ? "bg-accent/10 text-accent ring-1 ring-inset ring-accent"
                          : ""
                      }
                  `}
                    style={{ paddingLeft: `${paddingLeft}px` }}
                    onClick={(e) =>
                      !isEditing && handleFolderClick(e, folder.id)
                    }
                    onContextMenu={(e) => onContextMenu(e, "folder", folder.id)}
                    onDragOver={(e) => onFolderDragOver(e, folder.id)}
                    onDragLeave={onFolderDragLeave}
                    onDrop={(e) => onFolderDrop(e, folder.id)}
                  >
                    <div
                      className={`transition-transform duration-200 flex-shrink-0 cursor-pointer p-0.5 hover:bg-black/5 dark:hover:bg-white/10 rounded ${
                        folder.collapsed ? "-rotate-90" : "rotate-0"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolder(folder.id);
                      }}
                    >
                      <ChevronDown
                        size={14}
                        className={
                          folder.collapsed ? "text-zinc-400" : "text-zinc-500"
                        }
                      />
                    </div>
                    <FolderIcon
                      size={14}
                      className={`flex-shrink-0 ${
                        isDragOver
                          ? "text-accent"
                          : folder.collapsed
                            ? "text-zinc-400"
                            : "text-amber-400"
                      }`}
                    />

                    {isEditing ? (
                      <RenameInput
                        initialValue={folder.name}
                        onSave={(val) => onRename(folder.id, val)}
                        onCancel={() => onRename(folder.id, folder.name)}
                      />
                    ) : (
                      <span className="flex-1 truncate font-medium select-none">
                        {folder.name}
                      </span>
                    )}

                    {!isEditing && totalFiles > 0 && (
                      <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded-md ml-auto font-mono">
                        {totalFiles}
                      </span>
                    )}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {!folder.collapsed && (
                    <MotionDiv
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <FileTree
                        folders={folders}
                        notes={notes}
                        attachments={attachments}
                        parentId={folder.id}
                        activeNoteId={activeNoteId}
                        editingId={editingId}
                        level={level + 1}
                        onNoteClick={onNoteClick}
                        onFolderClick={onFolderClick}
                        onMoveNote={onMoveNote}
                        onMoveFolder={onMoveFolder}
                        onMoveAttachment={onMoveAttachment}
                        toggleFolder={toggleFolder}
                        onContextMenu={onContextMenu}
                        onRename={onRename}
                        onAttachmentClick={onAttachmentClick}
                        selectedIds={selectedIds}
                        showAttachments={showAttachments}
                      />
                    </MotionDiv>
                  )}
                </AnimatePresence>
              </MotionDiv>
            );
          })}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {currentNotes.map((note) => (
            <MotionDiv
              key={note.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="px-2 w-full overflow-hidden"
            >
              <FileRow
                note={note}
                isActive={note.id === activeNoteId}
                isSelected={selectedIds?.has(note.id)}
                isEditing={editingId === note.id}
                paddingLeft={paddingLeft + 22} // Indent for files
                onClick={(e) => onNoteClick(note.id, e)}
                onContextMenu={onContextMenu}
                onRename={onRename}
                onDragStart={(e: React.DragEvent) =>
                  handleDragStart(e, "note", note.id)
                }
              />
            </MotionDiv>
          ))}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showAttachments && currentAttachments.length > 0 && (
            <MotionDiv
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full overflow-hidden"
            >
              {currentAttachments.map((attachment) => (
                <div key={attachment.id} className="px-2 w-full">
                  <AttachmentRow
                    attachment={attachment}
                    paddingLeft={paddingLeft + 22}
                    onContextMenu={onContextMenu}
                    isSelected={selectedIds?.has(attachment.id)}
                    onDragStart={(e) =>
                      handleDragStart(e, "attachment", attachment.id)
                    }
                    onClick={(e) => onAttachmentClick(attachment.id, e)}
                  />
                </div>
              ))}
            </MotionDiv>
          )}
        </AnimatePresence>

        {parentId &&
          currentFolders.length === 0 &&
          currentNotes.length === 0 &&
          currentAttachments.length === 0 && (
            <div
              className="py-1 text-xs text-zinc-400 italic opacity-50 select-none"
              style={{ paddingLeft: `${paddingLeft + 30}px` }}
            >
              Empty
            </div>
          )}
      </div>
    );
  },
);

const FileRow = ({
  note,
  isActive,
  isSelected,
  isEditing,
  paddingLeft,
  onClick,
  onContextMenu,
  onRename,
  onDragStart,
}: {
  note: Note;
  isActive: boolean;
  isSelected?: boolean;
  isEditing: boolean;
  paddingLeft: number;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: any;
  onRename: (id: string, name: string) => void;
  onDragStart: (e: React.DragEvent) => void;
}) => {
  return (
    <div
      draggable={!isEditing}
      onDragStart={onDragStart}
      onClick={(e) => !isEditing && onClick(e)}
      onContextMenu={(e) => onContextMenu(e, "note", note.id)}
      style={{ paddingLeft: `${paddingLeft}px` }}
      className={`group w-full flex items-center gap-2 py-1.5 pr-2 rounded-lg text-sm cursor-pointer transition-colors ${
        isActive
          ? "bg-white dark:bg-zinc-800 text-violet-600 dark:text-violet-400 shadow-sm font-medium"
          : isSelected
            ? "bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 font-medium"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-white/5"
      }`}
    >
      <div
        className={`flex-shrink-0 ${isActive ? "text-violet-500" : "opacity-70"}`}
      >
        {(() => {
          const IconComponent =
            ICON_OPTIONS.find((opt) => opt.id === note.icon)?.icon || FileText;
          return <IconComponent size={14} />;
        })()}
      </div>

      {isEditing ? (
        <RenameInput
          initialValue={note.title}
          onSave={(val) => onRename(note.id, val)}
          onCancel={() => onRename(note.id, note.title)}
        />
      ) : (
        <span className="truncate flex-1 select-none">
          {note.title || "Untitled Note"}
        </span>
      )}

      {note.pinned && <Pin size={10} className="text-zinc-400 flex-shrink-0" />}
    </div>
  );
};

const AttachmentRow = ({
  attachment,
  paddingLeft,
  onContextMenu,
  onDragStart,
  onClick,
  isSelected,
}: {
  attachment: Attachment;
  paddingLeft: number;
  onContextMenu: any;
  onDragStart: (e: React.DragEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  isSelected?: boolean;
}) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, "attachment", attachment.id)}
      style={{ paddingLeft: `${paddingLeft}px` }}
      className={`group w-full flex items-center gap-2 py-1.5 pr-2 rounded-lg text-sm cursor-pointer transition-colors ${
        isSelected
          ? "bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100 font-medium"
          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-white/5"
      }`}
    >
      <Paperclip size={14} className="flex-shrink-0 opacity-70" />
      <span className="truncate flex-1 select-none">{attachment.fileName}</span>
    </div>
  );
};

export default function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem("obsidian-gen-notes");
    return saved ? JSON.parse(saved) : [INITIAL_NOTE];
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem("obsidian-gen-folders");
    return saved ? JSON.parse(saved) : [];
  });

  const [attachments, setAttachments] = useState<Attachment[]>(() => {
    const saved = localStorage.getItem("obsidian-gen-attachments");
    return saved ? JSON.parse(saved) : [];
  });

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [activeNoteId, setActiveNoteId] = useState<string>(() => {
    const saved = localStorage.getItem("obsidian-gen-active-note");
    if (saved) return saved;
    // Fallback to existing logic if no saved ID
    const savedNotes = localStorage.getItem("obsidian-gen-notes");
    const parsedNotes = savedNotes ? JSON.parse(savedNotes) : [INITIAL_NOTE];
    return parsedNotes[0]?.id || "";
  });
  const [openNoteIds, setOpenNoteIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("obsidian-gen-open-notes");
    if (saved) {
      return JSON.parse(saved);
    }
    const savedNotes = localStorage.getItem("obsidian-gen-notes");
    const parsedNotes = savedNotes ? JSON.parse(savedNotes) : [INITIAL_NOTE];
    return parsedNotes.length > 0 ? [parsedNotes[0].id] : [];
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EDITOR);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("obsidian-gen-theme");
    if (savedTheme === Theme.DARK || savedTheme === Theme.LIGHT) {
      return savedTheme;
    }
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return Theme.DARK;
    }
    return Theme.LIGHT;
  });

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [zenMode, setZenMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [showAiBlob, setShowAiBlob] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsAppLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Chat State
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconPickerTargetId, setIconPickerTargetId] = useState<string | null>(
    null,
  );

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Drag Controls for AI Blob
  const aiDragControls = useDragControls();

  // UI State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: "root",
  });
  const [modal, setModal] = useState<
    Partial<ModalProps> & {
      isOpen: boolean;
      action?: (val?: string, dontAsk?: boolean) => void;
    }
  >({ isOpen: false });
  // Track previous window width to detect real resize events vs scrollbar changes
  const prevWidthRef = useRef(window.innerWidth);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Derived State: Tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    const regex = /(^|\s)(#[a-zA-Z0-9-_]+)/g;
    notes.forEach((note) => {
      const matches = note.content.match(regex);
      if (matches) {
        matches.forEach((m) => tags.add(m.trim()));
      }
    });
    return Array.from(tags).sort();
  }, [notes]);

  // Optimization: Only re-generate graph data when note content/structure or FOLDER STRUCTURE changes.
  // We ignore folder "collapsed" state to prevent graph refresh on sidebar toggles.
  const folderStructureHash = JSON.stringify(
    folders.map((f) => ({ id: f.id, parentId: f.parentId, name: f.name })),
  );

  const graphData = useMemo(
    () => generateGraphData(notes, folders),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes, folderStructureHash],
  );

  const getBreadcrumbs = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return [];

    const path = [];
    let currentFolderId = note.folderId;

    while (currentFolderId) {
      const folder = folders.find((f) => f.id === currentFolderId);
      if (folder) {
        path.unshift(folder.name);
        currentFolderId = folder.parentId;
      } else {
        break;
      }
    }
    return path;
  };

  const getBacklinks = (targetId: string) => {
    const targetNote = notes.find((n) => n.id === targetId);
    if (!targetNote) return [];

    const targetTitleLower = targetNote.title.toLowerCase();

    return notes.filter((n) => {
      if (n.id === targetId) return false;
      const contentLower = n.content.toLowerCase();
      return (
        contentLower.includes(`[[${targetTitleLower}]]`) ||
        contentLower.includes(`[[${targetTitleLower}|`)
      );
    });
  };

  useEffect(() => {
    setSaveStatus("saving");
    const saveTimeout = setTimeout(() => {
      localStorage.setItem("obsidian-gen-notes", JSON.stringify(notes));
      localStorage.setItem("obsidian-gen-folders", JSON.stringify(folders));
      localStorage.setItem(
        "obsidian-gen-attachments",
        JSON.stringify(attachments),
      );
      setSaveStatus("saved");
    }, 1500);
    return () => clearTimeout(saveTimeout);
  }, [notes, folders, attachments]);

  useEffect(() => {
    localStorage.setItem("obsidian-gen-active-note", activeNoteId);
  }, [activeNoteId]);

  useEffect(() => {
    localStorage.setItem(
      "obsidian-gen-open-notes",
      JSON.stringify(openNoteIds),
    );
  }, [openNoteIds]);

  useEffect(() => {
    if (theme === Theme.DARK) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;

      // If body scroll is locked, it means a modal is likely open (hiding scrollbar).
      // We should ignore resize events in this state to prevent sidebar layout shifts.
      if (document.body.style.overflow === "hidden") {
        prevWidthRef.current = currentWidth;
        return;
      }

      const prevWidth = prevWidthRef.current;
      prevWidthRef.current = currentWidth;

      const isNowMobile = currentWidth < 768;
      const wasMobile = prevWidth < 768;

      if (isNowMobile !== wasMobile) {
        setIsMobile(isNowMobile);
        if (!isNowMobile && !zenMode) {
          setSidebarOpen(true);
        } else if (isNowMobile) {
          setSidebarOpen(false);
        }
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [zenMode]);

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible)
        setContextMenu({ ...contextMenu, visible: false });
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [contextMenu]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, aiThinking]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === "Escape" && zenMode) {
        setZenMode(false);
        if (window.innerWidth >= 768) setSidebarOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zenMode]);

  useEffect(() => {
    const activeNote = notes.find((n) => n.id === activeNoteId);
    if (
      activeNote &&
      (activeNote.title === "Untitled Note" || !activeNote.title.trim()) &&
      activeNote.content.length > 20
    ) {
      const timer = setTimeout(async () => {
        const currentNote = notes.find((n) => n.id === activeNoteId);
        if (
          currentNote &&
          (currentNote.title === "Untitled Note" ||
            !currentNote.title.trim()) &&
          editingId !== currentNote.id
        ) {
          setIsGeneratingTitle(true);
          try {
            const newTitle = await suggestNoteTitle(currentNote.content);
            if (newTitle && newTitle !== "Untitled Note") {
              handleUpdateNote(activeNoteId, { title: newTitle });
            }
          } finally {
            setIsGeneratingTitle(false);
          }
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeNoteId, notes, editingId]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === Theme.LIGHT ? Theme.DARK : Theme.LIGHT;
      localStorage.setItem("obsidian-gen-theme", newTheme);
      return newTheme;
    });
  };

  const toggleThemeWithTransition = (e?: React.MouseEvent) => {
    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY : window.innerHeight / 2;
    // @ts-ignore
    if (!document.startViewTransition) {
      toggleTheme();
      return;
    }
    // @ts-ignore
    const transition = document.startViewTransition(() => {
      toggleTheme();
    });
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${Math.hypot(
              Math.max(x, window.innerWidth - x),
              Math.max(y, window.innerHeight - y),
            )}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 600,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  };

  const toggleZenMode = () => {
    setZenMode((prev) => {
      const next = !prev;
      if (next) setSidebarOpen(false);
      else if (window.innerWidth >= 768) setSidebarOpen(true);
      return next;
    });
  };

  // Calculate visible items linear list for shift-selection
  const visibleItemIds = useMemo(() => {
    const traverse = (parentId?: string): string[] => {
      const currentFolders = folders.filter(
        (f) => f.parentId === parentId || (!parentId && !f.parentId),
      );

      const currentNotes = notes.filter(
        (n) => n.folderId === parentId || (!parentId && !n.folderId),
      );

      const currentAttachments = attachments.filter(
        (a) => a.folderId === parentId || (!parentId && !a.folderId),
      );

      let ids: string[] = [];
      // Folders first (recursive)
      for (const folder of currentFolders) {
        ids.push(folder.id); // Add folder itself
        if (!folder.collapsed) {
          ids = [...ids, ...traverse(folder.id)];
        }
      }
      // Then notes
      ids = [...ids, ...currentNotes.map((n) => n.id)];
      // Then attachments

      ids = [...ids, ...currentAttachments.map((a) => a.id)];

      return ids;
    };
    return traverse(undefined);
  }, [folders, notes, attachments]);

  const handleItemClick = (
    id: string,
    e?: React.MouseEvent,
    type: "note" | "folder" | "attachment" = "note",
  ) => {
    // Handling actual opening of notes/attachments separately from selection
    if (type === "note") {
      if (!openNoteIds.includes(id)) {
        setOpenNoteIds((prev) => [...prev, id]);
      }
      setActiveNoteId(id);
      setViewMode(ViewMode.EDITOR);
      if (window.innerWidth < 768 && !e?.ctrlKey && !e?.shiftKey)
        setSidebarOpen(false);
    } else if (type === "attachment") {
      // Attachments open in modal usually, handled separately?
      // For now, let's keep the click separate for 'open' but unified for 'select'.
      // We might need to call handleAttachmentClick here if it is a simple click.
      // But wait, the previous code called handleAttachmentClick which opened modal.
      // We should probably preserve that behavior for single click.
    }

    // Multi-select Logic
    if (!e) {
      // Programmatic
      setSelectedIds(new Set([id]));
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      setSelectedIds(newSet);
    } else if (e.shiftKey) {
      // Find the "anchor" - usually the last active note or just the last selected thing
      // We can use activeNoteId as a fallback anchor if it's in the selection?
      // Or we can just track the last clicked item.
      // For simplicity, let's try to search for the first item in selectedIds that is also in visibleItemIds?
      // Or just use activeNoteId if it's set.
      // Better: Use the LAST added item to selectedMap? We don't have that history.
      // Let's use activeNoteId if it's a note selection, but for pure file browser, we might need 'lastFocusedId'.
      // For now, let's use activeNoteId if available, otherwise just start from 0 if nothing selected.

      let anchorId = activeNoteId;
      // If we clicked a folder/attachment, activeNoteId might not be relevant if we just selected a folder.
      // But we don't track 'activeFolderId'.
      // Let's iterate visibleItemIds to find the first selected one to use as anchor?
      if (!selectedIds.has(anchorId)) {
        // If active note is not selected, try to find *any* selected item
        const firstSelected = visibleItemIds.find((vid) =>
          selectedIds.has(vid),
        );
        if (firstSelected) anchorId = firstSelected;
      }

      const lastIdx = visibleItemIds.indexOf(anchorId);
      const currentIdx = visibleItemIds.indexOf(id);

      if (lastIdx !== -1 && currentIdx !== -1) {
        const start = Math.min(lastIdx, currentIdx);
        const end = Math.max(lastIdx, currentIdx);
        const range = visibleItemIds.slice(start, end + 1);
        setSelectedIds(new Set(range));
      } else {
        setSelectedIds(new Set([id]));
      }
    } else {
      // Normal click
      setSelectedIds(new Set([id]));
    }
  };

  const handleOpenNote = (id: string, e?: React.MouseEvent) => {
    handleItemClick(id, e, "note");
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenNoteIds((prev) => {
      const newTabs = prev.filter((tId) => tId !== id);
      if (id === activeNoteId) {
        const index = prev.indexOf(id);
        if (newTabs.length > 0) {
          const newActiveIndex = Math.max(0, index - 1);
          setActiveNoteId(newTabs[newActiveIndex]);
        } else {
          setActiveNoteId("");
        }
      }
      return newTabs;
    });
  };

  const handleFileUpload = async (file: File): Promise<string> => {
    const activeNote = notes.find((n) => n.id === activeNoteId);
    const parentFolderId = activeNote?.folderId;

    let attachmentFolder = folders.find(
      (f) => f.name === "Attachments" && f.parentId === parentFolderId,
    );

    if (!attachmentFolder) {
      attachmentFolder = {
        id: generateId(),
        name: "Attachments",
        parentId: parentFolderId,
        collapsed: true,
      };
      setFolders((prev) => {
        // If we are creating a subfolder, ensure the parent is expanded
        if (parentFolderId) {
          return [
            ...prev.map((f) =>
              f.id === parentFolderId ? { ...f, collapsed: false } : f,
            ),
            attachmentFolder!,
          ];
        }
        return [...prev, attachmentFolder!];
      });
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const attachmentId = generateId();

        const newAttachment: Attachment = {
          id: attachmentId,
          fileName: file.name,
          mimeType: file.type,
          data: base64Data,
          folderId: attachmentFolder!.id,
          createdAt: Date.now(),
        };

        setAttachments((prev) => [...prev, newAttachment]);
        console.log(
          "File uploaded:",
          newAttachment.id,
          "Size:",
          newAttachment.data.length,
        );
        resolve(`attachment://${attachmentId}`);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getAttachmentSrc = (url: string): string | undefined => {
    if (typeof url === "string" && url.startsWith("attachment://")) {
      const id = url.replace("attachment://", "");
      const attachment = attachments.find((a) => a.id === id);
      if (attachment) {
        return attachment.data;
      } else {
        console.warn(
          `Attachment not found for id: ${id}`,
          attachments.map((a) => a.id),
        );
        return undefined;
      }
    }
    return url;
  };

  const openModal = (
    props: Partial<ModalProps> & {
      action: (val?: string, dontAsk?: boolean) => void;
    },
  ) => {
    setModal({
      isOpen: true,
      ...props,
      onConfirm: (val, dontAsk) => {
        props.action(val, dontAsk);
        setModal((prev) => ({ ...prev, isOpen: false }));
      },
      onClose: () => setModal((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const handleAttachmentClick = (id: string, e?: React.MouseEvent) => {
    // Select logic first
    handleItemClick(id, e, "attachment");

    // Check if we should open the modal (only on single click without modifiers? or always?)
    // Let's say we only open if NO modifiers are pressed, to allow selection management without popup spam.
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) return;

    const attachment = attachments.find((a) => a.id === id);
    if (attachment) {
      openModal({
        type: "image",
        title: attachment.fileName,
        imageSrc: attachment.data,
        confirmLabel: "Close",
        action: () => {},
      });
    }
  };

  const getUniqueTitle = (
    baseTitle: string,
    isFolder: boolean,
    parentId?: string,
  ) => {
    let counter = 0;
    let newTitle = baseTitle;
    const checkExists = (title: string) => {
      if (isFolder) {
        return folders.some((f) => f.name === title && f.parentId === parentId);
      } else {
        return notes.some((n) => n.title === title && n.folderId === parentId);
      }
    };
    while (checkExists(newTitle)) {
      counter++;
      newTitle = `${baseTitle} ${counter}`;
    }
    return newTitle;
  };

  const handleCreateNote = (folderId?: string) => {
    const title = getUniqueTitle("Untitled Note", false, folderId);
    const newNote: Note = {
      id: generateId(),
      title: title,
      content: `# ${title}\n\n`,
      folderId: folderId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (folderId) {
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, collapsed: false } : f)),
      );
    }
    setNotes((prev) => [newNote, ...prev]);
    handleOpenNote(newNote.id);
    setEditingId(newNote.id);
  };

  const handleCreateFolder = (parentId?: string) => {
    const name = getUniqueTitle("New Folder", true, parentId);
    const newFolder: Folder = {
      id: generateId(),
      name: name,
      parentId,
      collapsed: false,
    };
    if (parentId) {
      setFolders((prev) =>
        prev.map((f) => (f.id === parentId ? { ...f, collapsed: false } : f)),
      );
    }
    setFolders((prev) => [...prev, newFolder]);
    setEditingId(newFolder.id);
  };

  const handleRenameItem = (id: string, newName: string) => {
    setEditingId(null);
    if (!newName || !newName.trim()) return;
    const trimmedName = newName.trim();
    const folderExists = folders.find((f) => f.id === id);
    if (folderExists) {
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name: trimmedName } : f)),
      );
      return;
    }
    const noteExists = notes.find((n) => n.id === id);
    if (noteExists) {
      handleUpdateNote(id, { title: trimmedName });
      if (noteExists.content.startsWith(`# ${noteExists.title}`)) {
        const newContent = noteExists.content.replace(
          `# ${noteExists.title}`,
          `# ${trimmedName}`,
        );
        handleUpdateNote(id, { content: newContent });
      }
      return;
    }
  };

  const handleDeleteFolder = (id: string) => {
    const suppress =
      localStorage.getItem("obsidian-gen-suppress-delete-confirm") === "true";

    const deleteAction = () => {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setNotes((prev) =>
        prev.map((n) =>
          n.folderId === id ? { ...n, folderId: undefined } : n,
        ),
      );
      setFolders((prev) =>
        prev.map((f) =>
          f.parentId === id ? { ...f, parentId: undefined } : f,
        ),
      );
    };

    if (suppress) {
      deleteAction();
      return;
    }

    openModal({
      type: "confirm",
      title: "Delete Folder?",
      message:
        "This will delete the folder. Notes inside will be moved to the root level.",
      confirmLabel: "Delete",
      isDanger: true,
      showDontAskAgain: true,
      action: (_val, dontAsk) => {
        if (dontAsk) {
          localStorage.setItem("obsidian-gen-suppress-delete-confirm", "true");
        }
        deleteAction();
      },
    });
  };

  const handleDeleteNote = (id: string) => {
    const suppress =
      localStorage.getItem("obsidian-gen-suppress-delete-confirm") === "true";

    const deleteAction = () => {
      const newNotes = notes.filter((n) => n.id !== id);
      setNotes(newNotes);
      setOpenNoteIds((prev) => prev.filter((tId) => tId !== id));
      if (activeNoteId === id) {
        const remainingTabs = openNoteIds.filter((tId) => tId !== id);
        if (remainingTabs.length > 0) {
          setActiveNoteId(remainingTabs[remainingTabs.length - 1]);
        } else {
          setActiveNoteId(newNotes.length > 0 ? newNotes[0].id : "");
        }
      }
    };

    if (suppress) {
      deleteAction();
      return;
    }

    openModal({
      type: "confirm",
      title: "Delete Note?",
      message:
        "Are you sure you want to delete this note? This action cannot be undone.",
      confirmLabel: "Delete",
      isDanger: true,
      showDontAskAgain: true,
      action: (_val, dontAsk) => {
        if (dontAsk) {
          localStorage.setItem("obsidian-gen-suppress-delete-confirm", "true");
        }
        deleteAction();
      },
    });
  };

  const handleUpdateNote = (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n,
      ),
    );
  };

  const handleMoveNote = (noteId: string, targetFolderId?: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? { ...n, folderId: targetFolderId } : n,
      ),
    );
  };

  const handleMoveFolder = (folderId: string, targetParentId?: string) => {
    if (folderId === targetParentId) return;
    let current = targetParentId;
    let isDescendant = false;
    while (current) {
      if (current === folderId) {
        isDescendant = true;
        break;
      }
      const parent = folders.find((f) => f.id === current)?.parentId;
      current = parent;
    }
    if (isDescendant) return;
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, parentId: targetParentId } : f,
      ),
    );
  };

  const handleMoveAttachment = (
    attachmentId: string,
    targetFolderId?: string,
  ) => {
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === attachmentId ? { ...a, folderId: targetFolderId } : a,
      ),
    );
  };

  const toggleFolder = (folderId: string, forceOpen?: boolean) => {
    setFolders((prev) =>
      prev.map((f) =>
        f.id === folderId
          ? { ...f, collapsed: forceOpen ? false : !f.collapsed }
          : f,
      ),
    );
  };

  const handleTogglePin = (noteId: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)),
    );
  };

  const handleDailyNote = () => {
    const today = new Date().toISOString().split("T")[0];
    const existingNote = notes.find((n) => n.title === today);
    if (existingNote) {
      handleOpenNote(existingNote.id);
    } else {
      const newNote: Note = {
        id: generateId(),
        title: today,
        content: `# ${today}\n\n`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setNotes((prev) => [newNote, ...prev]);
      handleOpenNote(newNote.id);
    }
  };

  const handleIconChange = (iconId: string) => {
    if (!iconPickerTargetId) return;

    setNotes((prev) =>
      prev.map((n) =>
        n.id === iconPickerTargetId
          ? { ...n, icon: iconId, updatedAt: Date.now() }
          : n,
      ),
    );
    setShowIconPicker(false);
    setIconPickerTargetId(null);
  };
  const handleFolderSelect = (id: string, e: React.MouseEvent) => {
    handleItemClick(id, e, "folder");
  };

  const handleToggleAiChat = () => {
    setShowAiBlob((prev) => {
      if (!prev) {
        if (chatHistory.length === 0) {
          setChatHistory([
            {
              role: "model",
              text: "Hi! I've read this note. How can I help you with it? (e.g. Summarize, Extract Tasks, Translate)",
            },
          ]);
        }
      }
      return !prev;
    });
  };

  const handleSendAiMessage = async (msg: string = chatInput) => {
    const activeNote = notes.find((n) => n.id === activeNoteId);
    if (!activeNote || !msg.trim()) return;

    setChatInput("");
    const newHistory = [
      ...chatHistory,
      { role: "user", text: msg },
    ] as ChatMessage[];
    setChatHistory(newHistory);
    setAiThinking(true);

    const thinkingHistory = [
      ...newHistory,
      { role: "model", text: "" },
    ] as ChatMessage[];
    setChatHistory(thinkingHistory);

    let fullResponse = "";
    await streamAiChat(activeNote, notes, newHistory, msg, (chunk) => {
      setAiThinking(false);
      fullResponse += chunk;
      setChatHistory((prev) => {
        const last = prev[prev.length - 1];
        if (last.role === "model") {
          return [...prev.slice(0, -1), { ...last, text: fullResponse }];
        }
        return prev;
      });
    });
  };

  const handleWikiLinkClick = (title: string, isCtrl: boolean) => {
    const targetNote = notes.find(
      (n) => n.title.toLowerCase() === title.toLowerCase(),
    );
    if (targetNote) {
      handleOpenNote(targetNote.id);
    } else if (isCtrl) {
      const activeNote = notes.find((n) => n.id === activeNoteId);
      const targetFolderId = activeNote?.folderId;
      const newNote: Note = {
        id: generateId(),
        title: title,
        content: `# ${title}\n\n`,
        folderId: targetFolderId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (targetFolderId) {
        setFolders((prev) =>
          prev.map((f) =>
            f.id === targetFolderId ? { ...f, collapsed: false } : f,
          ),
        );
      }
      setNotes((prev) => [newNote, ...prev]);
      handleOpenNote(newNote.id);
    } else {
      const suppress =
        localStorage.getItem("obsidian-gen-suppress-create-wiki-confirm") ===
        "true";

      const createAction = () => {
        const activeNote = notes.find((n) => n.id === activeNoteId);
        const targetFolderId = activeNote?.folderId;
        const newNote: Note = {
          id: generateId(),
          title: title,
          content: `# ${title}\n\n`,
          folderId: targetFolderId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        if (targetFolderId) {
          setFolders((prev) =>
            prev.map((f) =>
              f.id === targetFolderId ? { ...f, collapsed: false } : f,
            ),
          );
        }
        setNotes((prev) => [newNote, ...prev]);
        handleOpenNote(newNote.id);
      };

      if (suppress) {
        createAction();
        return;
      }

      openModal({
        type: "confirm",
        title: "Create Note?",
        message: `Note "${title}" does not exist. Would you like to create it?`,
        confirmLabel: "Create",
        showDontAskAgain: true,
        action: (_val, dontAsk) => {
          if (dontAsk) {
            localStorage.setItem(
              "obsidian-gen-suppress-create-wiki-confirm",
              "true",
            );
          }
          createAction();
        },
      });
    }
  };

  const handleDeleteAttachment = (id: string) => {
    openModal({
      type: "confirm",
      title: "Delete Attachment?",
      message:
        "Are you sure you want to delete this attachment? This action cannot be undone.",
      confirmLabel: "Delete",
      isDanger: true,
      action: () => {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
      },
    });
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const suppress =
      localStorage.getItem("obsidian-gen-suppress-delete-confirm") === "true";

    const deleteAction = () => {
      // 1. Delete items from state
      setNotes((prev) =>
        prev.filter((n) => !ids.includes(n.id) && !ids.includes(n.folderId!)),
      );
      setFolders((prev) =>
        prev.filter((f) => !ids.includes(f.id) && !ids.includes(f.parentId!)),
      );
      setAttachments((prev) =>
        prev.filter((a) => !ids.includes(a.id) && !ids.includes(a.folderId!)),
      );

      // 2. Clear selection
      setSelectedIds(new Set());

      // 3. Handle active note if it was deleted
      if (ids.includes(activeNoteId)) {
        setActiveNoteId("");
        setOpenNoteIds((prev) => prev.filter((id) => !ids.includes(id)));
      }
    };

    if (suppress) {
      deleteAction();
      return;
    }

    openModal({
      type: "confirm",
      title: "Delete Selected Items?",
      message: `Are you sure you want to delete ${ids.length} item(s)? This will also delete any files inside selected folders.`,
      confirmLabel: "Delete",
      isDanger: true,
      showDontAskAgain: true,
      action: (_val, dontAsk) => {
        if (dontAsk) {
          localStorage.setItem("obsidian-gen-suppress-delete-confirm", "true");
        }
        deleteAction();
      },
    });
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    type: "root" | "folder" | "note" | "attachment",
    targetId?: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      targetId,
    });
  };

  const performActionAndCloseMenu = (action: () => void) => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
    setTimeout(() => action(), 10);
  };

  const onRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRoot(true);
  };

  const onRootDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRoot(false);
  };

  const onRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRoot(false);

    const noteId = e.dataTransfer.getData("noteId");
    const folderId = e.dataTransfer.getData("folderId");
    const attachmentId = e.dataTransfer.getData("attachmentId");

    if (noteId) {
      handleMoveNote(noteId, undefined);
    } else if (folderId) {
      handleMoveFolder(folderId, undefined);
    } else if (attachmentId) {
      handleMoveAttachment(attachmentId, undefined);
    }
  };

  const activeNote = notes.find((n) => n.id === activeNoteId);
  const pinnedNotes = notes.filter((n) => n.pinned);
  const breadcrumbs = activeNote ? getBreadcrumbs(activeNote.id) : [];
  const activeBacklinks = activeNote ? getBacklinks(activeNote.id) : [];

  const commandActions = [
    {
      id: "focus-mode",
      label: zenMode ? "Exit Focus Mode" : "Enter Focus Mode",
      icon: zenMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />,
      shortcut: "Z",
      action: () => toggleZenMode(),
    },
    {
      id: "new-note",
      label: "Create New Note",
      icon: <Plus size={16} />,
      shortcut: "N",
      action: () => handleCreateNote(),
    },
    {
      id: "new-folder",
      label: "Create New Folder",
      icon: <FolderPlus size={16} />,
      action: () => handleCreateFolder(),
    },
    {
      id: "daily-note",
      label: "Open Daily Note",
      icon: <Calendar size={16} />,
      action: () => handleDailyNote(),
    },
    {
      id: "search",
      label: "Search Notes",
      icon: <Search size={16} />,
      action: () => {
        if (!zenMode) setSidebarOpen(true);
        document
          .querySelector<HTMLInputElement>('input[placeholder="Search..."]')
          ?.focus();
      },
    },
    {
      id: "toggle-theme",
      label: "Toggle Theme",
      icon: theme === Theme.LIGHT ? <Moon size={16} /> : <Sun size={16} />,
      action: () => toggleThemeWithTransition(),
    },
    {
      id: "graph-view",
      label: "Graph View",
      icon: <Network size={16} />,
      action: () => setViewMode(ViewMode.GRAPH),
    },
    {
      id: "toggle-toolbox",
      label: "Toggle Toolbox",
      icon: <SlidersHorizontal size={16} />,
      shortcut: "T",
      action: () => setShowToolbar((prev) => !prev),
    },
    {
      id: "home",
      label: "Go to Home",
      icon: <Home size={16} />,
      action: () => {
        setActiveNoteId("");
        setViewMode(ViewMode.EDITOR);
      },
    },
  ];

  // Sidebar Animation Memoization
  const sidebarAnimation = useMemo(() => {
    const isVisible = !zenMode && (sidebarOpen || !isMobile);
    return {
      width: isVisible ? (isMobile ? "85vw" : "20rem") : 0,
      opacity: isVisible ? 1 : 0,
      x: isVisible ? 0 : isMobile ? -300 : -20,
    };
  }, [zenMode, sidebarOpen, isMobile]);

  return (
    <>
      {isAppLoading ? (
        <div className="flex h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-black p-2 md:p-3 font-sans gap-3">
          {/* Sidebar Skeleton */}
          <div className="hidden md:flex flex-col w-80 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-3xl p-5 gap-4 border border-white/20 dark:border-white/5 shadow-xl animate-pulse">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
            <div className="h-10 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl mb-2" />
            <div className="space-y-3 mt-4 flex-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
            <div className="h-10 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl mt-auto" />
          </div>

          {/* Main Skeleton */}
          <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-10 gap-8 border border-white/50 dark:border-white/5 shadow-2xl animate-pulse">
            <div className="h-12 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
            <div className="space-y-4">
              <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="h-4 w-3/4 bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="h-4 w-5/6 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
            <div className="mt-8 space-y-4">
              <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded" />
              <div className="h-4 w-11/12 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-screen w-screen overflow-hidden bg-zinc-100 dark:bg-black p-2 md:p-3 transition-colors duration-500 font-sans">
          {/* Modal */}
          <Modal
            isOpen={modal.isOpen}
            onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
            onConfirm={modal.onConfirm!}
            title={modal.title!}
            type={modal.type as "input" | "confirm"}
            message={modal.message}
            placeholder={modal.placeholder}
            defaultValue={modal.defaultValue}
            confirmLabel={modal.confirmLabel}
            isDanger={modal.isDanger}
            imageSrc={modal.imageSrc}
            showDontAskAgain={modal.showDontAskAgain}
          />

          <CommandPalette
            isOpen={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            actions={commandActions}
          />

          <AnimatePresence>
            {sidebarOpen && window.innerWidth < 768 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
              />
            )}
          </AnimatePresence>

          {/* Sidebar */}
          <MotionAside
            initial={false}
            animate={sidebarAnimation}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`flex flex-col bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 dark:border-white/5 overflow-hidden z-50 flex-shrink-0 absolute md:relative h-[calc(100vh-1rem)] md:h-auto`}
            onContextMenu={(e: React.MouseEvent) =>
              handleContextMenu(e, "root")
            }
          >
            <div className="w-[85vw] md:w-80 flex flex-col h-full">
              {/* Header */}
              <div className="p-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Network size={20} />
                  </div>
                  <span className="font-bold text-lg tracking-tight text-zinc-800 dark:text-zinc-100">
                    ObsidianGen
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDailyNote}
                    className="md:flex hidden p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
                    title="Daily Note"
                  >
                    <Calendar size={18} />
                  </button>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="md:hidden p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={() => setShowAttachments(!showAttachments)}
                    className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
                    title={
                      showAttachments ? "Hide Attachments" : "Show Attachments"
                    }
                  >
                    {showAttachments ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              {/* Controls */}
              <div className="px-4 space-y-4 flex-shrink-0 mb-2">
                <div className="relative group">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-accent transition-colors"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-zinc-800/50 border border-transparent focus:border-accent/30 rounded-xl text-sm outline-none transition-all shadow-sm focus:shadow-md dark:text-white placeholder-zinc-500"
                  />
                  <AnimatePresence>
                    {searchQuery && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-zinc-200 dark:bg-zinc-700 rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-white"
                      >
                        <X size={12} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-xl relative">
                  <button
                    onClick={() => setViewMode(ViewMode.EDITOR)}
                    className={`relative z-10 flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                      viewMode === ViewMode.EDITOR
                        ? "text-zinc-900 dark:text-white"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    List
                    {viewMode === ViewMode.EDITOR && (
                      <MotionDiv
                        className="absolute inset-0 bg-white dark:bg-zinc-700 shadow rounded-lg -z-10"
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.6,
                        }}
                      />
                    )}
                  </button>
                  <button
                    onClick={() => setViewMode(ViewMode.GRAPH)}
                    className={`relative z-10 flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                      viewMode === ViewMode.GRAPH
                        ? "text-zinc-900 dark:text-white"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    Graph
                    {viewMode === ViewMode.GRAPH && (
                      <MotionDiv
                        className="absolute inset-0 bg-white dark:bg-zinc-700 shadow rounded-lg -z-10"
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.6,
                        }}
                      />
                    )}
                  </button>
                </div>
              </div>

              {/* Tree Container */}
              <div
                className={`flex-1 overflow-y-auto custom-scrollbar min-h-0 ${
                  dragOverRoot
                    ? "bg-accent/5 ring-inset ring-2 ring-accent rounded-xl mx-2"
                    : ""
                }`}
                onContextMenu={(e) => {
                  if (e.target === e.currentTarget)
                    handleContextMenu(e, "root");
                }}
                onDragOver={onRootDragOver}
                onDragLeave={onRootDragLeave}
                onDrop={onRootDrop}
              >
                {/* Pinned Section */}
                <AnimatePresence>
                  {pinnedNotes.length > 0 && (
                    <motion.div
                      initial={{
                        height: 0,
                        opacity: 0,
                        marginTop: 0,
                        marginBottom: 0,
                      }}
                      animate={{
                        height: "auto",
                        opacity: 1,
                        marginTop: "0.5rem",
                        marginBottom: "1rem",
                      }}
                      exit={{
                        height: 0,
                        opacity: 0,
                        marginTop: 0,
                        marginBottom: 0,
                      }}
                      className="px-2 overflow-hidden"
                    >
                      <div className="px-3 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Pin size={10} /> Pinned
                      </div>
                      {pinnedNotes.map((note) => (
                        <MotionDiv
                          layout
                          key={`pinned-${note.id}`}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="px-2"
                        >
                          <FileRow
                            note={note}
                            isActive={note.id === activeNoteId}
                            isSelected={selectedIds.has(note.id)}
                            isEditing={false}
                            paddingLeft={12}
                            onClick={(e) => handleOpenNote(note.id, e)}
                            onContextMenu={handleContextMenu}
                            onRename={handleRenameItem}
                            onDragStart={() => {}}
                          />
                        </MotionDiv>
                      ))}
                      <div className="h-px bg-zinc-200 dark:bg-white/5 mx-3 my-2" />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tags Section */}
                <AnimatePresence>
                  {allTags.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mb-4 mt-2 px-2">
                        <div className="px-3 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Hash size={10} /> Tags
                        </div>
                        <div className="flex flex-wrap gap-1 px-2">
                          {allTags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() =>
                                setSearchQuery((prev) =>
                                  prev === tag ? "" : tag,
                                )
                              }
                              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                                searchQuery === tag
                                  ? "bg-violet-500 text-white"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <div className="h-px bg-zinc-200 dark:bg-white/5 mx-3 my-3" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <FileTree
                  folders={folders}
                  notes={notes.filter(
                    (n) =>
                      n.title
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()) ||
                      n.content
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                  )}
                  attachments={attachments.filter((a) =>
                    a.fileName
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()),
                  )}
                  activeNoteId={activeNoteId}
                  editingId={editingId}
                  onNoteClick={(id, e) => handleOpenNote(id, e)}
                  onMoveNote={handleMoveNote}
                  onMoveFolder={handleMoveFolder}
                  onMoveAttachment={handleMoveAttachment}
                  toggleFolder={toggleFolder}
                  onContextMenu={handleContextMenu}
                  onRename={handleRenameItem}
                  onAttachmentClick={handleAttachmentClick}
                  selectedIds={selectedIds}
                  onFolderClick={handleFolderSelect}
                  parentId={undefined}
                  showAttachments={showAttachments}
                />
                <div className="h-10 w-full" />
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 p-4 flex items-center justify-between border-t border-zinc-200/50 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-md">
                <button
                  onClick={(e) => toggleThemeWithTransition(e)}
                  className="p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/10 rounded-xl transition-colors"
                >
                  {theme === Theme.LIGHT ? (
                    <Moon size={18} />
                  ) : (
                    <Sun size={18} />
                  )}
                </button>
                <div className="text-[10px] font-mono text-zinc-400">
                  {notes.length} NOTES • {folders.length} FOLDERS
                </div>
              </div>
            </div>
          </MotionAside>

          {/* Main Content */}
          <MotionMain
            animate={{
              marginLeft:
                !zenMode && sidebarOpen && window.innerWidth >= 768 ? 12 : 0,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-1 relative flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-white/50 dark:border-white/5 z-10 transition-colors"
          >
            <div
              className={`md:hidden flex items-center p-4 border-b border-zinc-100 dark:border-white/5 bg-white dark:bg-zinc-900 ${
                zenMode ? "hidden" : ""
              }`}
            >
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-zinc-600 dark:text-zinc-300"
              >
                <SidebarIcon size={24} />
              </button>
              <span className="ml-2 font-bold text-lg dark:text-white">
                {viewMode === ViewMode.GRAPH ? "Graph View" : "Editor"}
              </span>
            </div>

            {viewMode === ViewMode.EDITOR &&
              openNoteIds.length > 0 &&
              !zenMode && (
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-white/10 px-2 pt-2 overflow-x-auto scrollbar-hide shrink-0 z-30">
                  <AnimatePresence mode="popLayout">
                    {openNoteIds.map((id) => {
                      const note = notes.find((n) => n.id === id);
                      if (!note) return null;
                      return (
                        <MotionDiv
                          layout={!commandPaletteOpen}
                          key={id}
                          initial={{ opacity: 0, scale: 0.9, y: 5 }}
                          animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            width: "auto",
                            paddingLeft: "0.75rem", // pl-3
                            paddingRight: "0.5rem", // pr-2
                            paddingTop: "0.5rem", // py-2
                            paddingBottom: "0.5rem",
                            marginBottom: 0,
                          }}
                          exit={{
                            opacity: 0,
                            scale: 0.9,
                            width: 0,
                            paddingLeft: 0,
                            paddingRight: 0,
                            paddingTop: 0,
                            paddingBottom: 0,
                            marginLeft: 0,
                            marginRight: 0,
                            marginBottom: 0,
                          }}
                          transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                            mass: 0.8,
                          }}
                          onClick={() => {
                            setActiveNoteId(id);
                            setSelectedIds(new Set([id]));
                          }}
                          className={`group flex items-center gap-2 rounded-t-xl text-sm font-medium cursor-pointer transition-colors border-t border-x border-transparent flex-shrink-0 relative overflow-hidden whitespace-nowrap ${
                            activeNoteId === id
                              ? "bg-white dark:bg-zinc-900 text-accent dark:text-accent border-zinc-200 dark:border-white/10 !border-b-white dark:!border-b-zinc-900 -mb-px z-10 shadow-sm min-w-[120px] max-w-[200px]"
                              : "bg-transparent text-zinc-500 dark:text-zinc-500 hover:bg-zinc-200/50 dark:hover:bg-white/5 min-w-[120px] max-w-[200px]"
                          }`}
                        >
                          <FileText
                            size={12}
                            className={
                              activeNoteId === id ? "text-accent" : "opacity-50"
                            }
                          />
                          <span className="truncate flex-1">
                            {note.title || "Untitled"}
                          </span>
                          <button
                            onClick={(e) => handleCloseTab(e, id)}
                            className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-zinc-300 dark:hover:bg-white/20 transition-all ${
                              activeNoteId === id ? "opacity-100" : ""
                            }`}
                          >
                            <X size={12} />
                          </button>
                        </MotionDiv>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

            {viewMode === ViewMode.EDITOR &&
              activeNote &&
              breadcrumbs.length > 0 &&
              !zenMode && (
                <div className="hidden md:flex items-center px-6 pt-4 pb-0 text-xs text-zinc-400 font-medium">
                  <Home size={10} className="mr-1" />
                  {breadcrumbs.map((crumb, i) => (
                    <React.Fragment key={i}>
                      <span className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-default">
                        {crumb}
                      </span>
                      <ChevronRight size={10} className="mx-1 opacity-50" />
                    </React.Fragment>
                  ))}
                </div>
              )}

            <AnimatePresence mode="wait">
              {viewMode === ViewMode.EDITOR ? (
                <MotionDiv
                  key="editor-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 relative overflow-hidden flex flex-col w-full"
                >
                  {activeNote ? (
                    <AnimatePresence mode="wait">
                      <MotionDiv
                        key={activeNote.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="flex-1 flex flex-col h-full overflow-hidden"
                      >
                        <MarkdownEditor
                          content={activeNote.content}
                          title={activeNote.title}
                          onChange={(newContent) =>
                            handleUpdateNote(activeNote.id, {
                              content: newContent,
                            })
                          }
                          onTitleChange={(newTitle) =>
                            handleUpdateNote(activeNote.id, { title: newTitle })
                          }
                          onWikiLinkClick={handleWikiLinkClick}
                          isGeneratingTitle={
                            isGeneratingTitle && editingId !== activeNoteId
                          }
                          theme={theme}
                          saveStatus={saveStatus}
                          onUploadFile={handleFileUpload}
                          getAttachmentSrc={getAttachmentSrc}
                          backlinks={activeBacklinks}
                          onNoteClick={handleOpenNote}
                          zenMode={zenMode}
                          showToolbar={showToolbar}
                          onToggleToolbar={() =>
                            setShowToolbar((prev) => !prev)
                          }
                        />
                      </MotionDiv>
                    </AnimatePresence>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-300 dark:text-zinc-700">
                      <FileText size={64} className="mb-4 opacity-20" />
                      <p>Select a note to begin</p>
                    </div>
                  )}
                </MotionDiv>
              ) : (
                <MotionDiv
                  key="graph"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 relative overflow-hidden bg-zinc-50 dark:bg-zinc-950"
                >
                  <div className="w-full h-full">
                    <Graph
                      data={graphData}
                      onNodeClick={(id) => handleOpenNote(id)}
                      theme={theme}
                      activeNoteId={activeNoteId}
                    />
                  </div>
                </MotionDiv>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showAiBlob && viewMode === ViewMode.EDITOR && (
                <MotionDiv
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 30 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  drag
                  dragListener={false} // Only allow dragging via the header
                  dragControls={aiDragControls}
                  dragMomentum={false}
                  className="absolute bottom-24 right-6 md:bottom-28 md:right-10 w-80 z-50"
                >
                  <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden flex flex-col ring-1 ring-black/5 dark:ring-white/10 h-[450px]">
                    {/* Header - Draggable Area */}
                    <div
                      onPointerDown={(e) => aiDragControls.start(e)}
                      className="px-5 py-4 border-b border-zinc-100/50 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50 cursor-grab active:cursor-grabbing select-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex items-center justify-center w-6 h-6 rounded-lg ${
                            aiThinking
                              ? "bg-gradient-to-tr from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30"
                              : "bg-gradient-to-tr from-violet-500/10 to-fuchsia-500/10 dark:from-violet-500/20 dark:to-fuchsia-500/20"
                          }`}
                        >
                          <Bot
                            size={14}
                            className={`${
                              aiThinking
                                ? "text-white animate-spin"
                                : "text-violet-600 dark:text-violet-400"
                            }`}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                            AI Assistant
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            Powered by Gemini
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-zinc-300 dark:text-zinc-600">
                          <GripHorizontal size={14} />
                        </div>
                        <button
                          onClick={() => setShowAiBlob(false)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-800 dark:hover:text-white rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors pointer-events-auto"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                      {chatHistory.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-3 ${
                            msg.role === "user" ? "flex-row-reverse" : ""
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                              msg.role === "user"
                                ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                : "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                            }`}
                          >
                            {msg.role === "user" ? (
                              <UserIcon size={14} />
                            ) : (
                              <Bot size={14} />
                            )}
                          </div>
                          <div
                            className={`p-3 rounded-2xl text-sm leading-relaxed max-w-[80%] ${
                              msg.role === "user"
                                ? "bg-violet-500 text-white rounded-tr-sm"
                                : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 rounded-tl-sm"
                            }`}
                          >
                            {msg.text ? (
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                            ) : (
                              <div className="w-full flex flex-col gap-2 min-w-[140px] py-1">
                                <Skeleton className="h-3 w-[90%] bg-zinc-400/20 dark:bg-zinc-500/20 rounded-full" />
                                <Skeleton className="h-3 w-[60%] bg-zinc-400/20 dark:bg-zinc-500/20 rounded-full" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Quick Actions (only if empty or last was user) */}
                    {chatHistory.length <= 1 && (
                      <div className="px-5 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
                        <button
                          onClick={() =>
                            handleSendAiMessage("Summarize this note")
                          }
                          className="whitespace-nowrap px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 rounded-full transition-colors border border-zinc-200 dark:border-zinc-700"
                        >
                          Summarize
                        </button>
                        <button
                          onClick={() =>
                            handleSendAiMessage("Extract action items")
                          }
                          className="whitespace-nowrap px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 rounded-full transition-colors border border-zinc-200 dark:border-zinc-700"
                        >
                          Extract Tasks
                        </button>
                        <button
                          onClick={() =>
                            handleSendAiMessage("Critique my writing")
                          }
                          className="whitespace-nowrap px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 rounded-full transition-colors border border-zinc-200 dark:border-zinc-700"
                        >
                          Critique
                        </button>
                      </div>
                    )}

                    {/* Input */}
                    <div className="p-3 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/30 dark:bg-zinc-900/30">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendAiMessage();
                        }}
                        className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 transition-all"
                      >
                        <input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask about your note..."
                          className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim() || aiThinking}
                          className="p-1.5 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </div>
                  </div>
                </MotionDiv>
              )}
            </AnimatePresence>

            {viewMode === ViewMode.EDITOR && !showAiBlob && (
              <MotionButton
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToggleAiChat}
                className={`absolute bottom-24 right-4 md:bottom-10 md:right-10 w-14 h-14 bg-white dark:bg-zinc-800 border border-violet-100 dark:border-white/10 rounded-2xl flex items-center justify-center text-violet-500 dark:text-violet-400 shadow-xl shadow-violet-500/10 hover:shadow-violet-500/20 transition-all z-40 group ${
                  zenMode ? "opacity-20 hover:opacity-100" : ""
                }`}
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Sparkles
                  size={24}
                  className="relative z-10 group-hover:text-white transition-colors duration-300"
                />
              </MotionButton>
            )}
          </MotionMain>

          {!sidebarOpen && window.innerWidth >= 768 && !zenMode && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed bottom-6 left-6 z-50 p-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full shadow-lg hover:scale-105 transition-all"
            >
              <SidebarIcon size={20} />
            </button>
          )}

          {/* Context Menu */}
          <AnimatePresence>
            {contextMenu.visible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="fixed z-[60] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-1.5 w-48 flex flex-col"
                style={{ top: contextMenu.y, left: contextMenu.x }}
              >
                {selectedIds.size > 1 &&
                selectedIds.has(contextMenu.targetId!) ? (
                  <ContextMenuItem
                    icon={<Trash2 size={16} />}
                    label={`Delete ${selectedIds.size} Items`}
                    onClick={() =>
                      performActionAndCloseMenu(() => handleDeleteSelected())
                    }
                    danger
                  />
                ) : (
                  <>
                    {contextMenu.type === "root" && (
                      <>
                        <ContextMenuItem
                          icon={<Plus size={16} />}
                          label="New Note"
                          onClick={() =>
                            performActionAndCloseMenu(() => handleCreateNote())
                          }
                        />
                        <ContextMenuItem
                          icon={<FolderIcon size={16} />}
                          label="New Folder"
                          onClick={() =>
                            performActionAndCloseMenu(() =>
                              handleCreateFolder(),
                            )
                          }
                        />
                      </>
                    )}
                    {contextMenu.type === "folder" && (
                      <>
                        <ContextMenuItem
                          icon={<Plus size={16} />}
                          label="New Note Here"
                          onClick={() =>
                            performActionAndCloseMenu(() =>
                              handleCreateNote(contextMenu.targetId),
                            )
                          }
                        />
                        <ContextMenuItem
                          icon={<FolderPlus size={16} />}
                          label="New Subfolder"
                          onClick={() =>
                            performActionAndCloseMenu(() =>
                              handleCreateFolder(contextMenu.targetId),
                            )
                          }
                        />
                        <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                        <ContextMenuItem
                          icon={<Pencil size={16} />}
                          label="Rename Folder"
                          onClick={() =>
                            contextMenu.targetId &&
                            performActionAndCloseMenu(() =>
                              setEditingId(contextMenu.targetId!),
                            )
                          }
                        />
                        <ContextMenuItem
                          icon={<Trash2 size={16} />}
                          label="Delete Folder"
                          onClick={() =>
                            contextMenu.targetId &&
                            performActionAndCloseMenu(() =>
                              handleDeleteFolder(contextMenu.targetId!),
                            )
                          }
                          danger
                        />
                      </>
                    )}
                    {contextMenu.type === "note" && (
                      <>
                        <ContextMenuItem
                          icon={<ExternalLink size={16} />}
                          label="Open in New Tab"
                          onClick={() =>
                            contextMenu.targetId &&
                            performActionAndCloseMenu(() =>
                              handleOpenNote(contextMenu.targetId!),
                            )
                          }
                        />

                        <ContextMenuItem
                          icon={<Smile size={16} />}
                          label="Change Icon"
                          onClick={() =>
                            performActionAndCloseMenu(() => {
                              setIconPickerTargetId(contextMenu.targetId!);
                              setShowIconPicker(true);
                            })
                          }
                        />

                        {/* Pin / Unpin Logic */}
                        {notes.find((n) => n.id === contextMenu.targetId)
                          ?.pinned ? (
                          <ContextMenuItem
                            icon={<PinOff size={16} />}
                            label="Unpin Note"
                            onClick={() =>
                              contextMenu.targetId &&
                              performActionAndCloseMenu(() =>
                                handleTogglePin(contextMenu.targetId!),
                              )
                            }
                          />
                        ) : (
                          <ContextMenuItem
                            icon={<Pin size={16} />}
                            label="Pin Note"
                            onClick={() =>
                              contextMenu.targetId &&
                              performActionAndCloseMenu(() =>
                                handleTogglePin(contextMenu.targetId!),
                              )
                            }
                          />
                        )}

                        <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1" />
                        <ContextMenuItem
                          icon={<Pencil size={16} />}
                          label="Rename Note"
                          onClick={() =>
                            contextMenu.targetId &&
                            performActionAndCloseMenu(() =>
                              setEditingId(contextMenu.targetId!),
                            )
                          }
                        />
                        <ContextMenuItem
                          icon={<Trash2 size={16} />}
                          label="Delete Note"
                          onClick={() =>
                            contextMenu.targetId &&
                            performActionAndCloseMenu(() =>
                              handleDeleteNote(contextMenu.targetId!),
                            )
                          }
                          danger
                        />
                      </>
                    )}
                    {contextMenu.type === "attachment" && (
                      <ContextMenuItem
                        icon={<Trash2 size={16} />}
                        label="Delete Attachment"
                        onClick={() =>
                          contextMenu.targetId &&
                          performActionAndCloseMenu(() =>
                            handleDeleteAttachment(contextMenu.targetId!),
                          )
                        }
                        danger
                      />
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <IconPickerModal
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelect={handleIconChange}
      />
    </>
  );
}
