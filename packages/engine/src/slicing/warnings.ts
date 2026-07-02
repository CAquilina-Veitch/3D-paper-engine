export type PieceWarningType =
  | "severed" // slot subtraction disconnected the piece
  | "thin-web" // material below/beside a slot thinner than minWeb
  | "edge-slot" // slot too close to the piece's end
  | "shallow-crossing" // shared extent at the crossing too small for a working slot
  | "glue-joint" // crossing column has multiple intervals; slot placed on largest, rest need glue
  | "same-opening"; // both families open the same way — cannot interlock

export interface PieceWarning {
  type: PieceWarningType;
  /** Plane-local u position the warning refers to, if applicable. */
  u?: number;
  detail: string;
}

export type ModelWarningType = "triple-intersection" | "dropped-plane" | "empty-layer";

export interface ModelWarning {
  type: ModelWarningType;
  layerId: string;
  detail: string;
}
