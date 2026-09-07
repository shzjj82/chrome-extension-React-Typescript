import { cn } from '@extension/ui';
import { ChevronLeft } from 'lucide-react';

type BackIconButtonProps = {
  onClick: () => void;
  label?: string;
  className?: string;
  /** 图标边长，默认 20 */
  iconSize?: number;
};

const BackIconButton = ({ onClick, label = '返回', className, iconSize = 20 }: BackIconButtonProps) => (
  <button type="button" className={cn('sm-back-icon', className)} onClick={onClick} aria-label={label}>
    <ChevronLeft size={iconSize} strokeWidth={2.4} />
  </button>
);

export default BackIconButton;
