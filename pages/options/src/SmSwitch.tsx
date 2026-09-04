import { cn } from '@extension/ui';
import { useId } from 'react';

type SmSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

const SmSwitch = ({ checked, onChange, label, description, disabled = false, className }: SmSwitchProps) => {
  const id = useId();

  return (
    <div className={cn('sm-switch', checked && 'sm-switch--on', disabled && 'sm-switch--disabled', className)}>
      <div className="sm-switch__copy">
        <label className="sm-switch__label" htmlFor={id}>
          {label}
        </label>
        {description ? <p className="sm-switch__desc">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className="sm-switch__control"
        onClick={() => {
          if (!disabled) {
            onChange(!checked);
          }
        }}>
        <span className="sm-switch__thumb" aria-hidden="true" />
      </button>
    </div>
  );
};

export default SmSwitch;
