import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchOptions {
  query: string;
  regex: boolean;
  matchCase: boolean;
}

export interface SearchMatch {
  from: number;
  to: number;
}

interface SearchState extends SearchOptions {
  matches: SearchMatch[];
  current: number;
}

export const searchKey = new PluginKey<SearchState>('docSearch');

const EMPTY: SearchState = { query: '', regex: false, matchCase: false, matches: [], current: 0 };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearch(options: Partial<SearchOptions>): ReturnType;
      clearSearch(): ReturnType;
      findNext(direction?: 1 | -1): ReturnType;
      replaceCurrent(replacement: string): ReturnType;
      replaceAll(replacement: string): ReturnType;
    };
  }
}

function buildRegex(options: SearchOptions): RegExp | null {
  if (!options.query) return null;
  try {
    const source = options.regex ? options.query : options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(source, options.matchCase ? 'g' : 'gi');
  } catch {
    return null;
  }
}

export function findMatches(doc: PMNode, options: SearchOptions): SearchMatch[] {
  const pattern = buildRegex(options);
  if (!pattern) return [];
  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    pattern.lastIndex = 0;
    let found: RegExpExecArray | null;
    while ((found = pattern.exec(node.text)) !== null) {
      if (found[0].length === 0) {
        pattern.lastIndex += 1;
        continue;
      }
      matches.push({ from: pos + found.index, to: pos + found.index + found[0].length });
    }
  });
  return matches;
}

export function getSearchState(editor: Editor): SearchState {
  return searchKey.getState(editor.state) ?? EMPTY;
}

export const Search = Extension.create({
  name: 'search',

  addCommands() {
    return {
      setSearch:
        (options) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { type: 'set', options }));
          return true;
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { type: 'set', options: { query: '' } }));
          return true;
        },
      findNext:
        (direction = 1) =>
        ({ tr, state, dispatch }) => {
          const current = searchKey.getState(state);
          if (!current || current.matches.length === 0) return false;
          const index = (current.current + direction + current.matches.length) % current.matches.length;
          const match = current.matches[index];
          if (dispatch) {
            dispatch(
              tr
                .setMeta(searchKey, { type: 'current', index })
                .setSelection(TextSelection.create(tr.doc, match.from, match.to))
                .scrollIntoView(),
            );
          }
          return true;
        },
      replaceCurrent:
        (replacement) =>
        ({ tr, state, dispatch }) => {
          const current = searchKey.getState(state);
          const match = current?.matches[current.current];
          if (!match) return false;
          if (dispatch) dispatch(tr.insertText(replacement, match.from, match.to));
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ tr, state, dispatch }) => {
          const current = searchKey.getState(state);
          if (!current || current.matches.length === 0) return false;
          if (dispatch) {
            // Apply from the end so earlier positions stay valid.
            [...current.matches].reverse().forEach((match) => tr.insertText(replacement, match.from, match.to));
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => EMPTY,
          apply(tr, previous) {
            const meta = tr.getMeta(searchKey) as
              | { type: 'set'; options: Partial<SearchOptions> }
              | { type: 'current'; index: number }
              | undefined;
            let next = previous;
            if (meta?.type === 'set') next = { ...previous, ...meta.options, current: 0 };
            else if (meta?.type === 'current') return { ...previous, current: meta.index };
            else if (!tr.docChanged) return previous;

            if (!next.query) return { ...next, matches: [], current: 0 };
            const matches = findMatches(tr.doc, next);
            return { ...next, matches, current: Math.min(next.current, Math.max(matches.length - 1, 0)) };
          },
        },
        props: {
          decorations(state) {
            const current = searchKey.getState(state);
            if (!current || current.matches.length === 0) return null;
            return DecorationSet.create(
              state.doc,
              current.matches.map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class: index === current.current ? 'search-match search-match-current' : 'search-match',
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});
