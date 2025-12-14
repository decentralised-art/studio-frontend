export type ApiTransformation = {
  name: string;
  args?: number[];
};

export type ApiDimension = {
  feature_name?: string;
  transformations?: ApiTransformation[];
};

export type ApiFeature = {
  address: string;
  local_address: string;
  name: string;
  owner: string;
  dimensions?: ApiDimension[];
};
