/**
 * Presentational glitch text. The label is duplicated via CSS (data-text)
 * into two offset, clipped layers that flash periodically.
 */
export function GlitchText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`glitch ${className}`} data-text={text}>
      {text}
    </span>
  );
}
