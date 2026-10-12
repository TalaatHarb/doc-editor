import './styles.css';

export { DocEditor, type DocEditorProps } from './components/doc-editor';
export { FetchBackend, ConflictError, NetworkError } from './backend/fetch-backend';
export { PageBreak } from './extensions/page-break';
export { MergeField } from './extensions/merge-field';
export { buildExtensions } from './extensions';
export { type DocEditorHandle } from './components/doc-editor';
export { applyMergeData, extractMergeKeys, type MergeFallback } from './merge/merge-fields';
export {
  DEFAULT_DOC_META,
  type AuthProvider,
  type DocContent,
  type DocMeta,
  type DocSummary,
  type DocVersionSummary,
  type DocumentBackend,
  type PageSize,
} from './types';
