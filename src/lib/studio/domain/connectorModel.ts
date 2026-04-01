export type StudioTransformationRef = {
  name: string;
  args: number[];
};

export type StudioConnectorDimension = {
  transformations: StudioTransformationRef[];
  composite?: string;
  // Slot keys must be canonical decimal integers: "0", "1", ...
  // Bindings are only valid when `composite` is set on this dimension.
  bindings: Record<string, string>;
  riStart?: number;
  riShift?: number;
};

export type StudioConnectorDef = {
  name: string;
  dimensions: StudioConnectorDimension[];
  conditionName?: string;
  conditionArgs?: number[];
  formatHash?: string;
  localAddress?: string;
  ownerAddress?: string;
};

export type StudioRegistry = {
  connectors: Record<string, StudioConnectorDef>;
  transformations: Record<string, { argc: number }>;
  conditions: Record<string, { argc: number }>;
};
