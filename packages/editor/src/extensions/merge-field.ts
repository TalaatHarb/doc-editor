import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeField: {
      insertMergeField(attrs: { key: string; label?: string }): ReturnType;
    };
  }
}

export interface MergeFieldOptions {
  /** Whether merge fields are visually highlighted. Can be toggled at runtime. */
  highlight: boolean;
}

export const mergeHighlightKey = new PluginKey<boolean>('mergeHighlight');

export const MergeField = Node.create<MergeFieldOptions>({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { highlight: true };
  },

  addStorage() {
    return { highlight: this.options.highlight };
  },

  addAttributes() {
    return {
      key: { default: '' },
      label: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-field]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const key = String(node.attrs.key);
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-merge-field': key,
        class: 'merge-field',
        title: `Merge field: ${key}`,
      }),
      `{{${node.attrs.label || key}}}`,
    ];
  },

  renderText({ node }) {
    return `{{${node.attrs.key}}}`;
  },

  addCommands() {
    return {
      insertMergeField:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent([
            { type: this.name, attrs },
            { type: 'text', text: ' ' },
          ]),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => {
        const key = window.prompt('Merge field key (e.g. customer.name)')?.trim();
        if (!key) return true;
        return this.editor.commands.insertMergeField({ key });
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: mergeHighlightKey,
        props: {
          decorations: (state) => {
            if (!this.storage.highlight) return null;
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name === this.name) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, { class: 'merge-field-highlight' }),
                );
              }
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
