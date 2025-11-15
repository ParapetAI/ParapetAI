import type { FC } from 'react';
import { Network } from 'lucide-react';

type LogoProps = {
  withWordmark?: boolean;
  className?: string;
};

const Logo: FC<LogoProps> = ({ withWordmark = true, className }) => {
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <Network className="h-9 w-9 text-accent" aria-hidden="true" />
        {withWordmark && (
          <span className="text-3xl font-bold tracking-tight text-text">
            ParapetAI
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;


