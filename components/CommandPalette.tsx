import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, FolderPlus, Moon, Sun, Network, FileText, Home } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: {
    id: string;
    label: string;
    icon: React.ReactNode;
    action: () => void;
    shortcut?: string;
  }[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, actions }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredActions = actions.filter(action => 
    action.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    // Scroll selected into view
    if (listRef.current) {
        const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest' });
        }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden font-sans z-10"
          >
            <div className="flex items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <Search size={18} className="text-zinc-400 mr-3" />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a command..."
                    className="flex-1 bg-transparent outline-none text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
                />
                <div className="text-xs text-zinc-400 font-mono border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5 rounded">ESC</div>
            </div>
            
            <div ref={listRef} className="max-h-[300px] overflow-y-auto py-2 custom-scrollbar">
                {filteredActions.length === 0 ? (
                    <div className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                        No commands found.
                    </div>
                ) : (
                    filteredActions.map((action, index) => (
                        <div
                            key={action.id}
                            onClick={() => { action.action(); onClose(); }}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                                index === selectedIndex 
                                    ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-900 dark:text-violet-100 border-l-2 border-violet-500' 
                                    : 'text-zinc-700 dark:text-zinc-300 border-l-2 border-transparent'
                            }`}
                        >
                            <span className={`${index === selectedIndex ? 'text-violet-500' : 'text-zinc-400'}`}>
                                {action.icon}
                            </span>
                            <span className="flex-1 text-sm font-medium">{action.label}</span>
                            {action.shortcut && (
                                <span className="text-xs text-zinc-400 font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                    {action.shortcut}
                                </span>
                            )}
                        </div>
                    ))
                )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}