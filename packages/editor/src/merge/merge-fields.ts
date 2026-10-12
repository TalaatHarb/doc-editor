export type MergeFallback = 'keep' | 'empty' | 'marker';

type JsonNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  [key: string]: unknown;
};

export function extractMergeKeys(document: unknown): string[] {
  const keys = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const candidate = node as JsonNode;
    if (candidate.type === 'mergeField' && typeof candidate.attrs?.key === 'string') {
      keys.add(candidate.attrs.key);
    }
    if (Array.isArray(candidate.content)) candidate.content.forEach(visit);
  };

  visit(document);
  return [...keys].sort((left, right) => left.localeCompare(right));
}

export function applyMergeData(
  document: unknown,
  values: Record<string, string>,
  fallback: MergeFallback = 'keep',
): unknown {
  const visit = (node: JsonNode): JsonNode | JsonNode[] | null => {
    if (node.type === 'mergeField') {
      const key = typeof node.attrs?.key === 'string' ? node.attrs.key : '';
      if (Object.hasOwn(values, key)) return { type: 'text', text: values[key] };
      if (fallback === 'empty') return null;
      if (fallback === 'marker') return { type: 'text', text: `[[${key || 'missing'}]]` };
      return { ...node, attrs: node.attrs ? { ...node.attrs } : undefined };
    }
    if (!Array.isArray(node.content)) return { ...node };

    return {
      ...node,
      content: node.content.flatMap((child) => {
        const result = visit(child);
        if (result === null) return [];
        return Array.isArray(result) ? result : [result];
      }),
    };
  };

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new TypeError('Document content must be a ProseMirror JSON object');
  }
  return visit(document as JsonNode);
}
