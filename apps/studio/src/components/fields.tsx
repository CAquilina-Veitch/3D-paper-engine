import { type ReactNode, useRef, useState } from "react";

/** Pixels of horizontal drag per `step` increment while scrubbing. */
const PX_PER_STEP = 3;

function trim(value: number, precision: number): string {
  const s = value.toFixed(precision);
  return precision > 0 ? s.replace(/\.?0+$/, "") : s;
}

/**
 * A draggable numeric value (drag horizontally to scrub, click to type).
 * The default control for numbers that lack an obvious slider range —
 * heights, angles, spacings, frequencies, seeds, print dimensions.
 */
export function Scrubber(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  unit?: string;
}) {
  const { label, value, onChange, step = 1, min, max, precision = 2, unit } = props;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const drag = useRef<{ x: number; v: number; moved: boolean } | null>(null);

  const clamp = (v: number) => {
    let out = v;
    if (min != null) out = Math.max(min, out);
    if (max != null) out = Math.min(max, out);
    return out;
  };

  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && text.trim() !== "") onChange(clamp(n));
    setEditing(false);
  };

  if (editing) {
    return (
      <label className="field">
        <span>{label}</span>
        {/* biome-ignore lint/a11y/noAutofocus: focus the field the user just clicked to type in */}
        <input
          type="number"
          autoFocus
          value={text}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      </label>
    );
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div
        className="scrubber"
        title="Drag to change · click to type"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, v: value, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 2) d.moved = true;
          if (d.moved) onChange(clamp(d.v + Math.round(dx / PX_PER_STEP) * step));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          if (d && !d.moved) {
            setText(trim(value, precision));
            setEditing(true);
          }
        }}
      >
        {trim(value, precision)}
        {unit && <span className="unit"> {unit}</span>}
      </div>
    </label>
  );
}

/** A bounded 0..1-style control: a real slider, with a typeable value. */
export function SliderField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  precision?: number;
}) {
  const { min, max, precision = 2 } = props;
  const step = props.step ?? 0.01;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <label className="field">
      <span>
        {props.label}
        <input
          className="val-input"
          type="number"
          value={props.value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) props.onChange(clamp(v));
          }}
        />
      </span>
      <input
        type="range"
        value={props.value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => props.onChange(Number(e.target.value))}
        aria-label={`${props.label} (${trim(props.value, precision)})`}
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
