import type { ReactNode } from "react";

export function NumberField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        value={props.value}
        step={props.step ?? 1}
        min={props.min}
        max={props.max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) props.onChange(v);
        }}
      />
    </label>
  );
}

export function SliderField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>
        {props.label} <em>{props.value.toFixed(2)}</em>
      </span>
      <input
        type="range"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step ?? 0.01}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function SelectField<T extends string>(props: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Section(props: { title: string; children: ReactNode }) {
  return (
    <details className="section" open>
      <summary>{props.title}</summary>
      <div className="section-body">{props.children}</div>
    </details>
  );
}
