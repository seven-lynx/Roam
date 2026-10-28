/** Small dashed coordinate / sector tag. Flavour text only. */
export function CoordTag({ children }: { children: string }) {
  return <span className="coord-tag" aria-hidden="true">{children}</span>;
}
