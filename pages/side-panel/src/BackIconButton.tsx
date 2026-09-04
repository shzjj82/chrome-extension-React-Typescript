import { cn } from '@extension/ui';
import { ChevronLeft } from 'lucide-react';

type BackIconButtonProps = {
  onClick: () => void;
  label?: string;
  className?: string;
};

const BackIconButton = ({ onClick, label = '返回', className }: BackIconButtonProps) => (
  <button type="button" className={cn('sm-back-icon', className)} onClick={onClick} aria-label={label}>
    <ChevronLeft size={20} strokeWidth={2.4} />
  </button>
);

export default BackIconButton;
