import { cn } from '@extension/ui';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

type SmSelectOption = {
  value: string;
  label: string;
};

type SmSelectProps = {
  value: string;
  options: SmSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
};

const SmSelect = ({
  value,
  options,
  onChange,
  placeholder = '请选择',
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: SmSelectProps) => {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find(item => item.value === value);
  const selectedLabel = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setHighlight(-1);
      return;
    }
    const index = Math.max(
      0,
      options.findIndex(item => item.value === value),
    );
    setHighlight(index);
  }, [open, options, value]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight(prev => Math.min(options.length - 1, Math.max(0, prev) + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight(prev => Math.max(0, (prev < 0 ? 0 : prev) - 1));
      return;
    }
    if (event.key === 'Enter' && highlight >= 0 && options[highlight]) {
      event.preventDefault();
      pick(options[highlight].value);
    }
  };

  return (
    <div ref={rootRef} className={cn('sm-select', open && 'sm-select--open', className)}>
      <button
        type="button"
        className="sm-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen(prev => !prev)}
        onKeyDown={onTriggerKeyDown}>
        <span className={cn('sm-select__value', !selected && 'sm-select__value--placeholder')}>{selectedLabel}</span>
        <span className="sm-select__chevron" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          className="sm-select__menu"
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={highlight >= 0 ? `${listId}-opt-${highlight}` : undefined}
          onKeyDown={onListKeyDown}>
          {options.map((item, index) => {
            const isActive = item.value === value;
            const isHi = index === highlight;
            return (
              <li key={item.value} role="presentation">
                <button
                  type="button"
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    'sm-select__option',
                    isActive && 'sm-select__option--selected',
                    isHi && 'sm-select__option--highlight',
                  )}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pick(item.value)}>
                  <span>{item.label}</span>
                  {isActive ? (
                    <span className="sm-select__check" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
                        <path
                          d="M4.5 10.5L8 14L15.5 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

export type { SmSelectOption };
export default SmSelect;
