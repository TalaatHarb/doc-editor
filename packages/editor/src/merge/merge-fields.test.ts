import { describe, expect, it } from 'vitest';
import { applyMergeData, extractMergeKeys } from './merge-fields';

const document = {
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Hello ' },
      { type: 'mergeField', attrs: { key: 'clientName', label: 'Client name' } },
      { type: 'mergeField', attrs: { key: 'date' } },
    ],
  }],
};

describe('merge field utilities', () => {
  it('extracts unique keys in predictable order', () => {
    expect(extractMergeKeys(document)).toEqual(['clientName', 'date']);
  });

  it('replaces supplied fields and leaves unknown fields by default', () => {
    const merged = applyMergeData(document, { clientName: 'Northwind' });
    expect(merged).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'Northwind' },
          { type: 'mergeField', attrs: { key: 'date' } },
        ],
      }],
    });
    expect(document.content[0].content[1].type).toBe('mergeField');
  });

  it('supports empty and marker fallbacks', () => {
    expect(applyMergeData(document, {}, 'empty')).toMatchObject({
      content: [{ content: [{ text: 'Hello ' }] }],
    });
    expect(applyMergeData(document, {}, 'marker')).toMatchObject({
      content: [{ content: [{ text: 'Hello ' }, { text: '[[clientName]]' }, { text: '[[date]]' }] }],
    });
  });

  it('rejects non-document inputs', () => {
    expect(() => applyMergeData(null, {})).toThrow(TypeError);
  });
});
