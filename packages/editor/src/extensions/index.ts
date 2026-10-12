import { Extension, type AnyExtension } from '@tiptap/core';
import { promptForLink } from '../utils/link';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import { Color, FontFamily, TextStyle } from '@tiptap/extension-text-style';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { FontSize } from './font-size';
import { MergeField } from './merge-field';
import { PageBreak } from './page-break';
import { Search } from './search';

// Word-style shortcuts that are not provided by the individual extensions.
const EditorShortcuts = Extension.create({
  name: 'editorShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-k': () => promptForLink(this.editor),
      'Mod-Alt-0': () => this.editor.commands.setParagraph(),
      'Mod-Space': () => this.editor.chain().unsetAllMarks().run(),
    };
  },
});

export function buildExtensions(options: { highlightMergeFields: boolean }): AnyExtension[] {
  return [
    StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
    Image.configure({ allowBase64: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Typography,
    CharacterCount,
    PageBreak,
    MergeField.configure({ highlight: options.highlightMergeFields }),
    Search,
    EditorShortcuts,
    Placeholder.configure({ placeholder: 'Start writing your document…' }),
  ];
}
