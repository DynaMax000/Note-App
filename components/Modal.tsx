import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "confirm" | "input" | "image" | "custom";
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  isDanger?: boolean;
  onConfirm?: (value?: string, dontAsk?: boolean) => void;
  imageSrc?: string;
  showDontAskAgain?: boolean;
  children?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  defaultValue = "",
  placeholder,
  confirmLabel = "Confirm",
  isDanger,
  onConfirm,
  imageSrc,
  showDontAskAgain,
  children,
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [dontAskChecked, setDontAskChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle Scroll Locking and Layout Shift
  useEffect(() => {
    if (isOpen) {
      // Calculate scrollbar width
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      // Lock scroll and compensate for scrollbar width to prevent layout shift
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      // Initialize state
      setInputValue(defaultValue || "");
      setDontAskChecked(false);

      // Focus input if applicable
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Restore styles
      const timeout = setTimeout(() => {
        // We wait for exit animation? No, restore immediately after close trigger
        // But component stays mounted until AnimatePresence finishes?
        // Actually, if we modify body style here, it happens when isOpen becomes false.
        // If AnimatePresence keeps it in DOM, that's fine, but we want scroll back.
        // Usually better to unlock after exit animation, but for simplicity:
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      }, 0);
      return () => clearTimeout(timeout);
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isOpen, defaultValue]);

  const handleConfirm = () => {
    // @ts-ignore
    if (onConfirm) onConfirm(inputValue, dontAskChecked);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 25,
            }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 font-sans z-10 overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={20} />
              </button>
            </div>

            {message && (
              <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm leading-relaxed">
                {message}
              </p>
            )}

            {type === "input" && (
              <div className="mb-6">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border-2 border-transparent focus:border-violet-500 dark:focus:border-violet-500 rounded-xl outline-none text-zinc-900 dark:text-white transition-all text-sm font-medium placeholder-zinc-400"
                />
              </div>
            )}

            {type === "image" && imageSrc && (
              <div className="mb-6 flex justify-center bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-hidden relative">
                <img
                  src={imageSrc}
                  alt={title}
                  className="max-h-[60vh] max-w-full object-contain"
                />
              </div>
            )}

            {type === "custom" && children}

            {showDontAskAgain && (
              <div className="mb-6 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="dontAsk"
                  checked={dontAskChecked}
                  onChange={(e) => setDontAskChecked(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <label
                  htmlFor="dontAsk"
                  className="text-sm text-zinc-600 dark:text-zinc-400 select-none cursor-pointer"
                >
                  Do not ask again
                </label>
              </div>
            )}

            {type !== "image" && (
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 ${
                    isDanger
                      ? "bg-red-500 hover:bg-red-600 shadow-red-500/20"
                      : "bg-violet-600 hover:bg-violet-700 shadow-violet-500/20"
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
