import React, { useEffect, forwardRef, useImperativeHandle } from "react";
import {
  useEditor,
  EditorContent,
  Editor,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Typography from "@tiptap/extension-typography";
import Image from "@tiptap/extension-image";
import { marked } from "marked";
import TurndownService from "turndown";
import { all, createLowlight } from "lowlight";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { CodeBlockComponent } from "./CodeBlockComponent";
import Underline from "@tiptap/extension-underline";
import { WikiLinkExtension } from "./WikiLinkExtension";
import "highlight.js/styles/atom-one-dark.css";

const lowlight = createLowlight(all);

interface TiptapEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onSelectionUpdate?: () => void;
  getAttachmentSrc?: (src: string) => string;
  onWikiLinkClick?: (title: string, isCtrl: boolean) => void;
}

export interface TiptapEditorRef {
  editor: Editor | null;
}

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Configure Turndown to keep Wiki Links as [[Page Name]]
turndownService.addRule("wikiLinks", {
  filter: (node, options) => {
    return (
      node.nodeName === "A" &&
      node.getAttribute("href")?.startsWith("wiki:") === true
    );
  },
  replacement: (content, node) => {
    const href = (node as HTMLElement).getAttribute("href");
    const pageName = href ? href.replace("wiki:", "") : content;
    return `[[${pageName}]]`;
  },
});

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";

// Custom Extension for Delayed Rendering (Markdown on Enter)
const DelayedMarkdown = Extension.create({
  name: "delayedMarkdown",

  addOptions() {
    return {
      types: [
        "heading",
        "bulletList",
        "orderedList",
        "blockquote",
        "codeBlock",
      ],
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => {
        // Exit Code Block shortcut
        if (this.editor.isActive("codeBlock")) {
          this.editor.chain().focus().exitCode().run();
          return true;
        }
        return false;
      },
      Tab: () => {
        // Global Tab handler: Always insert 2 spaces
        // This overrides default focus behavior but gives "IDE-like" feeling
        this.editor.chain().insertContent("  ").run();
        return true;
      },
      // Auto-closing brackets/quotes
      "(": () => {
        if (this.editor.isActive("codeBlock")) {
          this.editor
            .chain()
            .insertContent("()")
            .setTextSelection(this.editor.state.selection.from + 1)
            .run();
          return true;
        }
        return false;
      },
      "{": () => {
        if (this.editor.isActive("codeBlock")) {
          this.editor
            .chain()
            .insertContent("{}")
            .setTextSelection(this.editor.state.selection.from + 1)
            .run();
          return true;
        }
        return false;
      },
      "[": () => {
        if (this.editor.isActive("codeBlock")) {
          this.editor
            .chain()
            .insertContent("[]")
            .setTextSelection(this.editor.state.selection.from + 1)
            .run();
          return true;
        }
        return false;
      },
      '"': () => {
        if (this.editor.isActive("codeBlock")) {
          this.editor
            .chain()
            .insertContent('""')
            .setTextSelection(this.editor.state.selection.from + 1)
            .run();
          return true;
        }
        return false;
      },
      "'": () => {
        if (this.editor.isActive("codeBlock")) {
          this.editor
            .chain()
            .insertContent("''")
            .setTextSelection(this.editor.state.selection.from + 1)
            .run();
          return true;
        }
        return false;
      },
      Enter: () => {
        const { state, dispatch } = this.editor.view;
        const { selection, schema } = state;
        const { $from } = selection;
        const node = $from.node();

        // 1. Handle Code Blocks specifically
        if (node.type.name === "codeBlock") {
          // Check if we are inside `{}` to auto-indent on Enter?
          // Advanced feature. For now, just allow default new line.

          // If user triggers standard behavior, it's already good.
          return false; // let default handler insert newline
        }

        // 2. Only trigger "Parse Line" on paragraphs
        if (node.type.name !== "paragraph") {
          // If we are in a list item or heading, let default behavior happen (split list item, etc.)
          return false;
        }

        const text = node.textContent;

        // 3. Check for Block Patterns (Heading, List, CodeFence) - These change the NODE TYPE

        // Explicit Task List Handling (- [ ] task)
        // We handle this manually because `marked` returns HTML checkboxes which Tiptap's `TaskItem` extension
        // needs specific configuration to parse, or we can just toggle the node directly which is reliable.
        const taskMatch = text.match(/^-\s\[([ xX])\]\s(.*)$/);
        if (taskMatch) {
          const isChecked = taskMatch[1].toLowerCase() === "x";
          const content = taskMatch[2];

          this.editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const start = $from.start();
              const end = $from.end();
              tr.delete(start, end);
              return true;
            })
            .toggleTaskList()
            .run();

          // Insert content into the new TaskItem
          if (content) {
            this.editor.chain().insertContent(content).run();
          }

          if (isChecked) {
            this.editor
              .chain()
              .updateAttributes("taskItem", { checked: true })
              .run();
          }

          // Move to new line? Standard behavior is good.
          this.editor.chain().enter().run();
          return true;
        }

        // Code Block Match (```lang)
        const codeBlockMatch = text.match(/^```(\w*)$/);
        if (codeBlockMatch) {
          const language = codeBlockMatch[1];
          this.editor
            .chain()
            .focus()
            .command(({ tr }) => {
              const start = $from.start();
              const end = $from.end();
              tr.delete(start, end);
              return true;
            })
            .toggleCodeBlock({ language })
            .run();
          return true;
        }

        // If line is empty, just normal enter
        if (!text.trim()) return false;

        // OPTIMIZATION & BUG FIX:
        // Only run "Parse" if the line actually contains common Markdown characters.
        // This prevents "Plain Text" -> "Delete/Insert" cycle which breaks `Enter` behavior often.
        // Regex:
        // - `[*_~`]` matches Inline (Bold, Italic, Strike, Code)
        // - `^(#{1,6}|-|\d+\.|>|\[.*\])\s` matches Blocks (Heading, List, Blockquote, Task) — NOT strictly needed as some blocks handled above, but good for completeness.
        // - Link `[` or Image `!` also triggers.

        const isMarkdown = /[*_~`!\[\]]|^(#{1,6}|-|\d+\.|>)\s/.test(text);
        if (!isMarkdown) {
          return false; // Let default Tiptap Enter handle plain text
        }

        // 4. "Parse on Enter" for Inline Markdown (Bold, Italic) + Block Markdown (Heading, List)
        // We use `marked` to parse the line.
        // If the result contains ANY formatting different from plain text, we replace the line.

        // Ensure GFM is supported (marked defaults to gfm: true in v4+, we are on v12+)
        // Verify whitespace handling: marked adds \n at end.
        let html = marked.parse(text) as string;

        // Strip trailing newline to prevent double block insertion?
        if (html.endsWith("\n")) {
          html = html.slice(0, -1);
        }

        // CRITICAL FIX: `marked` wraps plain text in <p>.
        // If we insert "<p><strong>text</strong></p>" into an existing paragraph, Tiptap might get confused or double-wrap.
        // We want to extract the INLINE content if the result is just a single paragraph.
        // If it is a block (h1, ul, etc), we keep it.

        if (
          html.startsWith("<p>") &&
          html.endsWith("</p>") &&
          !html.includes("</p><p>")
        ) {
          html = html.substring(3, html.length - 4);
        }

        // Fix Bold/Italic bleeding: Append a zero-width space or normal space if it ends with a tag?
        if (/[>]$/.test(html)) {
          html += " ";
        }

        // Use a transaction to replace the current text node range with the HTML content
        this.editor
          .chain()
          .focus()
          .command(({ tr }) => {
            const start = $from.start();
            const end = $from.end();
            tr.delete(start, end); // Clear the raw markdown text
            return true;
          })
          .insertContent(html) // Insert the rendered HTML
          .run();

        // After rendering, we initiate a new paragraph (the "Enter" effect)
        // Check if we just created a CodeBlock? If so, don't double enter?
        // If we created a Heading, we want new paragraph.

        // If the inserted content was a Block (Heading, List), `insertContent` usually puts cursor inside it.
        // We want to break out to a new line.
        this.editor.chain().focus().scrollIntoView().enter().run();

        return true;
      },
    };
  },
});

export const TiptapEditor = forwardRef<TiptapEditorRef, TiptapEditorProps>(
  (
    {
      content,
      onChange,
      className,
      style,
      placeholder,
      onSelectionUpdate,
      getAttachmentSrc,
      onWikiLinkClick,
    },
    ref,
  ) => {
    // Custom CSS for specific Tiptap styling needs (Checkboxes, etc)
    const customStyles = `
      /* Remove default list styles for task lists */
      ul[data-type="taskList"] {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      /* Flex container for the item */
      li[data-type="taskItem"] {
        display: flex;
        align-items: flex-start; /* Align checkbox with top of text */
        gap: 0.5rem;
        margin-bottom: 0.25rem;
      }

      /* Fix the label wrapper preventing line breaks */
      li[data-type="taskItem"] label {
        flex-shrink: 0;
        margin-top: 0.35em; /* Optical alignment needed because text has line-height */
        user-select: none;
        line-height: 1; /* Reset line height for checkbox container */
      }

      /* THE CHECKBOX ITSELF - Fully Custom */
      li[data-type="taskItem"] input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        background-color: transparent;
        margin: 0;
        cursor: pointer;
        width: 1.1em;
        height: 1.1em;
        border: 2px solid #a1a1aa;
        border-radius: 0.25rem;
        display: grid;
        place-content: center;
        transition: all 0.2s ease-in-out;
      }

      .dark li[data-type="taskItem"] input[type="checkbox"] {
        border-color: #52525b;
      }

      /* Checkbox Checkmark (Pseudo-element) */
      li[data-type="taskItem"] input[type="checkbox"]::before {
        content: "";
        width: 0.65em;
        height: 0.65em;
        transform: scale(0);
        transition: 120ms transform ease-in-out;
        box-shadow: inset 1em 1em white;
        transform-origin: center;
        clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
      }

      /* Checked State Colors */
      li[data-type="taskItem"] input[type="checkbox"]:checked {
        background-color: #8b5cf6; /* violet-500 */
        border-color: #8b5cf6;
      }
      
      li[data-type="taskItem"] input[type="checkbox"]:checked::before {
        transform: scale(1);
      }

      /* CONTENT STYLING */
      li[data-type="taskItem"] > div {
        flex: 1;
        margin: 0 !important; /* Force remove prose margins */
      }
      
      /* Target the paragraph inside to remove its margins too */
      li[data-type="taskItem"] > div > p {
        margin: 0 !important;
      }

      /* Checked Text Strikethrough */
      li[data-type="taskItem"][data-checked="true"] > div {
        text-decoration: line-through;
        color: #a1a1aa; /* zinc-400 */
        text-decoration-color: #a1a1aa;
      }
      
      /* Wiki Link Styling */
      .wiki-link {
        @apply text-violet-500 hover:text-violet-600 font-semibold cursor-pointer transition-colors;
        text-decoration: none;
      }
      .wiki-link:hover {
        text-decoration: underline;
      }
    `;

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        CodeBlockLowlight.extend({
          addNodeView() {
            return ReactNodeViewRenderer(CodeBlockComponent);
          },
        }).configure({
          lowlight,
        }),
        Typography,
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: "text-violet-500 hover:underline cursor-pointer font-medium",
          },
        }),
        WikiLinkExtension.configure({}),
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        DelayedMarkdown,
      ],
      editorProps: {
        attributes: {
          class:
            "prose prose-zinc dark:prose-invert focus:outline-none max-w-none min-h-[500px] prose-p:my-1 prose-headings:mt-4 prose-headings:mb-2 prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-li:my-0 prose-ul:my-0 prose-ol:my-0 prose-blockquote:my-1 prose-blockquote:not-italic",
        },
        handleClick: (view, pos, event) => {
          const target = event.target as HTMLElement;
          // Check if clicked element is a wiki link
          if (target.closest(".wiki-link")) {
            event.preventDefault(); // Prevent default navigation
            const link = target.closest(".wiki-link") as HTMLAnchorElement;
            const href = link.getAttribute("href");
            if (href && href.startsWith("wiki:")) {
              const title = href.replace("wiki:", "");
              if (onWikiLinkClick) {
                onWikiLinkClick(title, event.ctrlKey || event.metaKey);
              }
              return true; // Stop propagation
            }
          }
          return false;
        },
      },
      enableInputRules: true, // Re-enable input rules so wiki link input rules work!
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        const markdown = turndownService.turndown(html);
        onChange(markdown);
      },
      onSelectionUpdate: ({ editor }) => {
        if (onSelectionUpdate) onSelectionUpdate();
      },
      // Ensure images are resolved correctly
    });

    // Effect to update images in the editor DOM when getAttachmentSrc is available
    useEffect(() => {
      if (!editor || !getAttachmentSrc) return;

      // This is a bit of a hack: direct DOM manipulation or re-render node views is needed
      // Tiptap doesn't easily let us "transform" src on render without a custom NodeView.
      // But we can scan the images and update their src if they are local IDs.

      const updateImages = () => {
        const images = editor.view.dom.querySelectorAll("img");
        images.forEach((img) => {
          const src = img.getAttribute("src");
          if (
            src &&
            !src.startsWith("data:") &&
            !src.startsWith("http") &&
            !src.startsWith("blob:")
          ) {
            // Assume it's a local ID/path
            const newSrc = getAttachmentSrc(src);
            if (newSrc && newSrc !== src) {
              img.src = newSrc;
            }
          }
        });
      };

      updateImages();

      // Also subscribe to updates?
      editor.on("update", updateImages);
      return () => {
        editor.off("update", updateImages);
      };
    }, [editor, getAttachmentSrc]);

    useImperativeHandle(ref, () => ({
      editor: editor,
    }));

    // Sync content from prop if it changes externally
    useEffect(() => {
      if (editor && content) {
        const currentMarkdown = turndownService.turndown(editor.getHTML());

        if (
          editor.isEmpty ||
          Math.abs(currentMarkdown.length - content.length) > 5
        ) {
          // Check if content has wiki links and we need to pre-process them for Tiptap?
          // WikiLinkExtension's input rules/paste rules handle creation, but setContent needs HTML or valid structure.
          // marked parse will generic '<a>' tags for links, but wiki links [[ ]] are not standard markdown.
          // We might need to pre-convert [[Foo]] -> <a href="wiki:Foo">Foo</a> before passing to setContent?
          // BUT marked doesn't know about [[ ]].

          // Custom pre-processing for persistence -> editor loading
          let html = marked.parse(content) as string;

          // Basic [[ ]] to link converter for INITIAL LOAD which marked missed
          // Note: This is a simple regex, might be brittle for code blocks but better than nothing.
          // We can't easily rely on marked extensions here without significant change.
          // We'll rely on our stored markdown having standard [[ ]] which marked ignores or treats as text.
          // So we replace [[Text]] with the Wiki Link HTML Mark.

          // Only replace text not in code? Hard to tell.
          // Let's replace global for now.
          html = html.replace(
            /\[\[(.*?)\]\]/g,
            '<a href="wiki:$1" class="wiki-link">$1</a>',
          );

          // Fix: marked often adds extra newlines to code blocks which Tiptap preserves.
          // We can try to normalize it.
          html = html.replace(
            /<pre><code class="language-(.*?)">([\s\S]*?)\n<\/code><\/pre>/g,
            '<pre><code class="language-$1">$2</code></pre>',
          );
          html = html.replace(
            /<pre><code>([\s\S]*?)\n<\/code><\/pre>/g,
            "<pre><code>$1</code></pre>",
          );

          // @ts-ignore
          editor.commands.setContent(html, false);
        }
      }
    }, [content, editor]);

    if (!editor) {
      return null;
    }

    return (
      <div className={className} style={style}>
        <style>{customStyles}</style>
        <EditorContent editor={editor} />
      </div>
    );
  },
);

TiptapEditor.displayName = "TiptapEditor";
