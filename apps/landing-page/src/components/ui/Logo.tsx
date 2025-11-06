import type { FC, SVGProps } from 'react';

type LogoProps = {
  withWordmark?: boolean;
  className?: string;
} & SVGProps<SVGSVGElement>;

const Logo: FC<LogoProps> = ({ withWordmark = true, className, ...rest }) => {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden="true"
          {...rest}
        >
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--accent))" />
              <stop offset="100%" stopColor="hsl(var(--accent) / 0.7)" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="18" height="18" rx="4" fill="url(#lg)" />
          <path d="M6 10h8" stroke="hsl(var(--accent-contrast))" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 6v8" stroke="hsl(var(--accent-contrast))" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {withWordmark && (
          <span className="text-base font-semibold tracking-tight text-text">ParapetAI</span>
        )}
      </div>
    </div>
  );
};

export default Logo;


