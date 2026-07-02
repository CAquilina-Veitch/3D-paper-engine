/** Nice round tick spacing aiming for ~10 divisions across the extent. */
const STEPS = [5, 10, 20, 25, 50, 100, 200, 500];
function niceStep(extentMm: number): number {
  const target = extentMm / 10;
  return STEPS.find((s) => s >= target) ?? 1000;
}

/**
 * A measurement ruler along one edge of the cutting-mat canvas, labelled in
 * millimetres of world space so the 2D map reads as a real measuring surface.
 */
export function Ruler({
  extentMm,
  orientation,
}: {
  extentMm: number;
  orientation: "top" | "left";
}) {
  const step = niceStep(extentMm);
  const ticks: number[] = [];
  for (let m = 0; m <= extentMm + 1e-6; m += step) ticks.push(Math.round(m));

  return (
    <div className={`ruler ruler-${orientation}`}>
      {ticks.map((m) => {
        const pct = (m / extentMm) * 100;
        const pos = orientation === "top" ? { left: `${pct}%` } : { top: `${pct}%` };
        return (
          <div className="tick" key={m} style={pos}>
            <span className="tick-label">{m}</span>
          </div>
        );
      })}
    </div>
  );
}
