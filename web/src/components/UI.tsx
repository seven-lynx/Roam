export function Spinner() {
  return (
    <div className="inline-block animate-spin text-phosphor">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="min-h-full flex items-center justify-center">
      <Spinner />
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`panel p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
  }[variant];

  return (
    <button className={`btn ${variantClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input({
  label,
  error,
  className = '',
  ...props
}: {
  label?: string;
  error?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="font-mono text-xs uppercase tracking-wide text-muted">{label}</label>}
      <input
        className={`field ${className} ${error ? 'field-error' : ''}`}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

const AVATAR_PALETTES = [
  ['bg-teal-600',    'text-white'],
  ['bg-ember',       'text-abyss'],
  ['bg-gold',        'text-abyss'],
  ['bg-blue-600',    'text-white'],
  ['bg-violet-600',  'text-white'],
  ['bg-verdigris',   'text-bone'],
  ['bg-oxide-3',     'text-bone'],
] as const;

export function avatarPalette(name: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
  }[size];
  const [bg, fg] = avatarPalette(name || '?');
  const initial = (name || '?')[0].toUpperCase();

  return (
    <div className={`${sizeClass} ${bg} ${fg} rounded-full flex items-center justify-center font-bold shrink-0`}>
      {initial}
    </div>
  );
}

export function Toast({ message, variant = 'error', onDismiss }: { message: string; variant?: 'error' | 'success' | 'info'; onDismiss: () => void }) {
  const variantClass = {
    error: 'toast-error',
    success: 'toast-ok',
    info: 'toast-info',
  }[variant];

  return (
    <div className={`fixed bottom-4 right-4 p-4 panel border-l-4 max-w-sm z-50 flex items-start gap-3 ${variantClass}`}>
      <div className="flex-1">{message}</div>
      <button
        onClick={onDismiss}
        className="text-current opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}