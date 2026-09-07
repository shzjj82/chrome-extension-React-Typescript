import { cn } from '@/lib/utils';
import type { CSSProperties, ReactNode } from 'react';

type SegmentedSwitchOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

type SegmentedSwitchProps<T extends string> = {
  options: Array<SegmentedSwitchOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  'aria-label'?: string;
};

const SegmentedSwitch = <T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'sm',
  disabled = false,
  'aria-label': ariaLabel,
}: SegmentedSwitchProps<T>) => {
  const activeIndex = Math.max(
    0,
    options.findIndex(option => option.value === value),
  );
  const count = Math.max(1, options.length);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        'sm-segmented-switch',
        size === 'md' && 'sm-segmented-switch--md',
        disabled && 'sm-segmented-switch--disabled',
        className,
      )}
      style={
        {
          '--sm-segmented-count': count,
          '--sm-segmented-index': activeIndex,
        } as CSSProperties
      }>
      <span className="sm-segmented-switch__pill" aria-hidden="true" />
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || option.disabled}
            className={cn(
              'sm-segmented-switch__option',
              selected && 'sm-segmented-switch__option--active',
              (disabled || option.disabled) && 'sm-segmented-switch__option--disabled',
            )}
            onClick={() => {
              if (!disabled && !option.disabled && option.value !== value) {
                onChange(option.value);
              }
            }}>
            <span className="sm-segmented-switch__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export { SegmentedSwitch };
export type { SegmentedSwitchOption, SegmentedSwitchProps };
