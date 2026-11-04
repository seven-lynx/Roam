import type { IconDef } from "@/lib/icons";

interface IconProps {
  def: IconDef;
  /** Tailwind colour token class — the glyph inherits it via `currentColor`. */
  className?: string;
  size?: number;
}

/**
 * Renders a stroke-based SVG glyph from the code-defined pack. Children are
 * static, developer-authored markup, so `dangerouslySetInnerHTML` is safe
 * here (no user input flows into it).
 */
export function Icon({ def, className = "", size = 24 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: def.children }}
    />
  );
}
