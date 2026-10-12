import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { readImageFile } from '../utils/images';

const FONT_FAMILIES = ['Default', 'Georgia', 'Times New Roman', 'Arial', 'Courier New', 'Verdana'];
const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '24px', '32px', '48px'];

export interface ToolbarProps {
  editor: Editor;
  onFind(): void;
  onPrint(): void;
}

export function Toolbar({ editor, onFind, onPrint }: ToolbarProps) {
  const imageInput = useRef<HTMLInputElement>(null);
  const textStyle = editor.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
  const inTable = editor.isActive('table');

  const run = () => editor.chain().focus();

  function setLink() {
    const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt('Link URL (leave empty to remove)', previous);
    if (url === null) return;
    if (url.trim() === '') run().extendMarkRange('link').unsetLink().run();
    else run().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }

  async function insertImages(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const src = await readImageFile(file);
      if (src) run().setImage({ src, alt: file.name }).run();
    }
    if (imageInput.current) imageInput.current.value = '';
  }

  function insertMergeField() {
    const key = window.prompt('Merge field key (e.g. customer.name)')?.trim();
    if (key) run().insertMergeField({ key }).run();
  }

  const btn = (label: string, active: boolean, onClick: () => void, content: ReactNode, shortcut?: string) => (
    <button
      key={label}
      className={`toolbar-button${active ? ' is-active' : ''}`}
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={!editor.isEditable}
      onClick={onClick}
    >
      {content}
    </button>
  );
  const divider = (key: string) => <span key={key} className="toolbar-divider" aria-hidden="true" />;
  const disabled = !editor.isEditable;

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      {btn('Undo', false, () => run().undo().run(), '↶', 'Ctrl+Z')}
      {btn('Redo', false, () => run().redo().run(), '↷', 'Ctrl+Shift+Z')}
      {divider('d1')}
      <select
        className="toolbar-select"
        aria-label="Font family"
        disabled={disabled}
        value={textStyle.fontFamily ?? 'Default'}
        onChange={(event) =>
          event.target.value === 'Default' ? run().unsetFontFamily().run() : run().setFontFamily(event.target.value).run()
        }
      >
        {FONT_FAMILIES.map((family) => (
          <option key={family}>{family}</option>
        ))}
        {textStyle.fontFamily && !FONT_FAMILIES.includes(textStyle.fontFamily) && <option>{textStyle.fontFamily}</option>}
      </select>
      <select
        className="toolbar-select"
        aria-label="Font size"
        disabled={disabled}
        value={textStyle.fontSize ?? ''}
        onChange={(event) => (event.target.value ? run().setFontSize(event.target.value).run() : run().unsetFontSize().run())}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size.replace('px', '')}
          </option>
        ))}
      </select>
      {divider('d2')}
      {btn('Bold', editor.isActive('bold'), () => run().toggleBold().run(), <strong>B</strong>, 'Ctrl+B')}
      {btn('Italic', editor.isActive('italic'), () => run().toggleItalic().run(), <em>I</em>, 'Ctrl+I')}
      {btn('Underline', editor.isActive('underline'), () => run().toggleUnderline().run(), <span className="underlined">U</span>, 'Ctrl+U')}
      {btn('Strikethrough', editor.isActive('strike'), () => run().toggleStrike().run(), <s>S</s>, 'Ctrl+Shift+S')}
      {btn('Subscript', editor.isActive('subscript'), () => run().toggleSubscript().run(), <>x<sub>2</sub></>)}
      {btn('Superscript', editor.isActive('superscript'), () => run().toggleSuperscript().run(), <>x<sup>2</sup></>)}
      <label className="toolbar-color" title="Text color">
        <span aria-hidden="true">A</span>
        <input
          type="color"
          aria-label="Text color"
          disabled={disabled}
          value={textStyle.color ?? '#182335'}
          onChange={(event) => run().setColor(event.target.value).run()}
        />
      </label>
      <label className="toolbar-color" title="Highlight color">
        <span aria-hidden="true" className="highlight-swatch">H</span>
        <input
          type="color"
          aria-label="Highlight color"
          disabled={disabled}
          value={(editor.getAttributes('highlight').color as string | undefined) ?? '#fff176'}
          onChange={(event) => run().setHighlight({ color: event.target.value }).run()}
        />
      </label>
      {divider('d3')}
      {btn('Heading 1', editor.isActive('heading', { level: 1 }), () => run().toggleHeading({ level: 1 }).run(), 'H1')}
      {btn('Heading 2', editor.isActive('heading', { level: 2 }), () => run().toggleHeading({ level: 2 }).run(), 'H2')}
      {btn('Heading 3', editor.isActive('heading', { level: 3 }), () => run().toggleHeading({ level: 3 }).run(), 'H3')}
      {btn('Align left', editor.isActive({ textAlign: 'left' }), () => run().setTextAlign('left').run(), '⇤')}
      {btn('Align center', editor.isActive({ textAlign: 'center' }), () => run().setTextAlign('center').run(), '↔')}
      {btn('Align right', editor.isActive({ textAlign: 'right' }), () => run().setTextAlign('right').run(), '⇥')}
      {btn('Justify', editor.isActive({ textAlign: 'justify' }), () => run().setTextAlign('justify').run(), '≣')}
      {divider('d4')}
      {btn('Bulleted list', editor.isActive('bulletList'), () => run().toggleBulletList().run(), '• List')}
      {btn('Numbered list', editor.isActive('orderedList'), () => run().toggleOrderedList().run(), '1. List')}
      {btn('Task list', editor.isActive('taskList'), () => run().toggleTaskList().run(), '☑ Tasks')}
      {btn('Block quote', editor.isActive('blockquote'), () => run().toggleBlockquote().run(), '❝')}
      {btn('Horizontal rule', false, () => run().setHorizontalRule().run(), '―')}
      {divider('d5')}
      {btn('Link', editor.isActive('link'), setLink, 'Link', 'Ctrl+K')}
      {btn('Insert image', false, () => imageInput.current?.click(), 'Image')}
      <input
        ref={imageInput}
        className="visually-hidden"
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void insertImages(event.target.files)}
      />
      {btn('Insert table', false, () => run().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), 'Table')}
      {inTable && (
        <>
          {btn('Add row below', false, () => run().addRowAfter().run(), '+Row')}
          {btn('Add column right', false, () => run().addColumnAfter().run(), '+Col')}
          {btn('Delete row', false, () => run().deleteRow().run(), '−Row')}
          {btn('Delete column', false, () => run().deleteColumn().run(), '−Col')}
          {btn('Merge or split cells', false, () => run().mergeOrSplit().run(), 'Merge')}
          {btn('Toggle header row', false, () => run().toggleHeaderRow().run(), 'Header')}
          {btn('Delete table', false, () => run().deleteTable().run(), '🗑')}
        </>
      )}
      {divider('d6')}
      {btn('Insert page break', false, () => run().insertContent({ type: 'pageBreak' }).run(), 'Page break', 'Ctrl+Enter')}
      {btn('Insert merge field', false, insertMergeField, '{{ }}', 'Ctrl+Shift+M')}
      {btn('Find and replace', false, onFind, 'Find', 'Ctrl+F')}
      <button className="toolbar-button" type="button" onClick={onPrint}>
        Print
      </button>
    </div>
  );
}
