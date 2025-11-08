import type { AnchorHTMLAttributes, ButtonHTMLAttributes, FC, PropsWithChildren, ReactNode } from 'react';

type ButtonAsButton = ButtonHTMLAttributes<HTMLButtonElement>;
type ButtonAsAnchor = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

type ButtonProps = PropsWithChildren<
  { 
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'default' | 'large';
    icon?: ReactNode;
  } & (ButtonAsButton | ButtonAsAnchor)
>;

const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-none border-[3px] font-medium transition-all duration-200 will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none motion-reduce:transition-none';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'border-border bg-accent text-accent-contrast shadow-md hover:bg-accent/90 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm',
  secondary: 'border-border bg-surface text-text shadow-md hover:bg-surface/90 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm',
  ghost: 'border-border bg-transparent text-text hover:bg-surface/80 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm'
};

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'px-4 py-2 text-sm',
  large: 'px-6 py-3 text-base'
};

const Button: FC<ButtonProps> = ({ variant = 'primary', size = 'default', icon, className, children, ...rest }) => {
  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className ?? ''}`.trim();

  if ('href' in rest && typeof (rest as ButtonAsAnchor).href === 'string') {
    const anchorProps = rest as ButtonAsAnchor;
    return (
      <a className={classes} role="button" {...anchorProps}>
        {icon && <span className="inline-flex">{icon}</span>}
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonAsButton;
  return (
    <button className={classes} {...buttonProps}>
      {icon && <span className="inline-flex">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;


