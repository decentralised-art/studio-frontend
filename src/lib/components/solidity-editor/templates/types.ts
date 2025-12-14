// Branded names so you don’t accidentally pass random strings.
export type ContractName = string & { readonly __brand: "ContractName" };

export type SoliditySnippet = string & { readonly __brand: "SoliditySnippet" };

export type RenderResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
