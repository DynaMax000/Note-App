import {
  Mark,
  mergeAttributes,
  InputRule,
  PasteRule,
} from '@tiptap/core';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attributes: { href: string }) => ReturnType;
      unsetWikiLink: () => ReturnType;
    };
  }
}

export const WikiLinkExtension = Mark.create<WikiLinkOptions>({
  name: 'wikiLink',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'wiki-link text-violet-500 hover:text-violet-600 font-semibold cursor-pointer transition-colors',
      },
    };
  },

  inclusive: false,

  addAttributes() {
    return {
      href: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[href^="wiki:"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetWikiLink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ state, range, match }) => {
          const { tr } = state;
          const start = range.from;
          const end = range.to;
          const text = match[1];

          if (text) {
            tr.replaceWith(start, end, this.type.schema.text(text));
            tr.addMark(
              start,
              start + text.length,
              this.type.create({ href: `wiki:${text}` })
            );
          }
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /\[\[([^\]]+)\]\]/g,
        handler: ({ state, range, match }) => {
            const { tr } = state;
            const start = range.from;
            const end = range.to;
            const text = match[1];
  
            if (text) {
              tr.replaceWith(start, end, this.type.schema.text(text));
              tr.addMark(
                start,
                start + text.length,
                this.type.create({ href: `wiki:${text}` })
              );
            }
        },
      }),
    ];
  },
});
