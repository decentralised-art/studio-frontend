import type { ContractName, SoliditySnippet } from "./types.ts";

export type TransformationTemplateInput = {
  readonly name: ContractName;
  readonly argsCount: number; // e.g. 0
  readonly code: SoliditySnippet; // goes into {CODE}
  readonly baseImportPath: string; // e.g. "../TransformationBase.sol"
};

function indentBlock(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  return lines.map((l) => (l.length === 0 ? "" : pad + l)).join("\n");
}

export function renderTransformationSolidity(input: TransformationTemplateInput): string {
  // Defensive: argsCount should not be negative
  const argsCount = input.argsCount < 0 ? 0 : input.argsCount;

  // Indent code to match function body indentation (8 spaces in this template)
  const codeIndented = indentBlock(String(input.code), 8);

  // Use a single literal template string (readable + stable)
  return `// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

import "${input.baseImportPath}";

contract ${input.name} is TransformationBase
{
    constructor(address registryAddr) TransformationBase(registryAddr, "${input.name}", ${argsCount}) {}

    function run(uint32 x, uint32 [] calldata args) view external returns (uint32)
    {
        require(args.length == this.getArgsCount(), "wrong number of arguments");
${codeIndented.length > 0 ? codeIndented : "        return x;"}
    }
}
`;
}
