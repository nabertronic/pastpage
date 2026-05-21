import { useId } from "react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

export function ChoiceGroup<T extends string>({
  label,
  description,
  value,
  options,
  onChange
}: {
  label: string;
  description?: string;
  value: T;
  options: Array<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold text-stone-950 dark:text-yellow-50">{label}</legend>
      {description ? <p className="text-sm leading-5 text-stone-600 dark:text-stone-300">{description}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={cn(
                "group min-h-20 rounded-md border p-3 text-left transition-all duration-200 ease-out focus-visible:outline-yellow-400 active:translate-y-px",
                selected
                  ? "border-yellow-400 bg-yellow-100 shadow-[0_8px_22px_rgba(255,212,0,0.18)] dark:border-yellow-300 dark:bg-yellow-300/15"
                  : "border-[var(--wf-border)] bg-[var(--wf-surface)] hover:-translate-y-0.5 hover:border-yellow-400 hover:bg-yellow-50 dark:border-stone-800 dark:bg-stone-950 dark:hover:border-yellow-300 dark:hover:bg-yellow-300/10"
              )}
              onClick={() => onChange(option.value)}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-medium text-stone-950 dark:text-yellow-50">{option.label}</span>
                {selected ? (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-yellow-400 text-stone-950">
                    <Check aria-hidden="true" size={13} />
                  </span>
                ) : null}
              </span>
              {option.description ? (
                <span className="mt-1 block text-xs leading-5 text-stone-600 dark:text-stone-300">
                  {option.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  warning
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  warning?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      className="flex w-full items-start justify-between gap-4 rounded-md border border-[var(--wf-border)] bg-[var(--wf-surface)] p-3 text-left transition-all duration-200 hover:border-yellow-400 hover:bg-yellow-50 focus-visible:outline-yellow-400 dark:border-stone-800 dark:bg-stone-950 dark:hover:border-yellow-300 dark:hover:bg-yellow-300/10"
      onClick={() => onChange(!checked)}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-stone-950 dark:text-yellow-50">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-stone-600 dark:text-stone-300">{description}</span>
        {warning ? (
          <span className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-amber-700 dark:text-amber-400">
            <AlertTriangle aria-hidden="true" className="mt-px shrink-0" size={13} />
            <span>{warning}</span>
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked ? "border-yellow-400 bg-yellow-400" : "border-[var(--wf-border-strong)] bg-[var(--wf-surface-muted)] dark:border-stone-700 dark:bg-stone-800"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}

export function SelectField<T extends string>({
  label,
  description,
  value,
  options,
  onChange
}: {
  label: string;
  description?: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const selectId = useId();

  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold text-stone-950 dark:text-yellow-50" id={`${selectId}-label`}>
        {label}
      </span>
      {description ? <span className="text-xs leading-5 text-stone-600 dark:text-stone-300">{description}</span> : null}
      <span className="relative">
        <select
          id={selectId}
          aria-labelledby={`${selectId}-label`}
          className="h-10 w-full appearance-none rounded-md border border-[var(--wf-border-strong)] bg-[var(--wf-surface)] px-3 pr-9 text-sm text-stone-950 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-0 bottom-0 my-auto text-stone-500 dark:text-stone-300"
          size={16}
        />
      </span>
    </label>
  );
}

export function NumberField({
  label,
  description,
  value,
  min,
  step = 1,
  onChange
}: {
  label: string;
  description?: string;
  value: string;
  min?: number;
  step?: number;
  onChange: (value: string) => void;
}) {
  const inputId = useId();

  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-semibold text-stone-950 dark:text-yellow-50" id={`${inputId}-label`}>
        {label}
      </span>
      {description ? <span className="text-xs leading-5 text-stone-600 dark:text-stone-300">{description}</span> : null}
      <input
        id={inputId}
        aria-labelledby={`${inputId}-label`}
        className="h-10 w-full rounded-md border border-[var(--wf-border-strong)] bg-[var(--wf-surface)] px-3 text-sm text-stone-950 transition hover:border-yellow-400 focus-visible:outline-yellow-400 dark:border-stone-700 dark:bg-stone-950 dark:text-yellow-50"
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
