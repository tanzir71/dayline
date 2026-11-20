/**
 * Guide Markdown → page structure.
 * "## 1. Before" becomes <h2 data-step="1">Before</h2>; lists render as numbered step circles in CSS.
 */
function walk(node, fn) {
  fn(node);
  if (node.children) for (const child of node.children) walk(child, fn);
}

export default function rehypeGuide() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'h2') return;
      const first = node.children?.[0];
      if (!first || first.type !== 'text') return;
      const m = first.value.match(/^\s*([0-9০-৯]+)[.)]\s*/);
      if (!m) return;
      first.value = first.value.slice(m[0].length);
      node.properties = { ...(node.properties ?? {}), dataStep: m[1] };
    });
  };
}
