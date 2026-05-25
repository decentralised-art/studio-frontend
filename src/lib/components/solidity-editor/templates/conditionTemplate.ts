import type { ContractName, SoliditySnippet } from "./types.ts";

export type ConditionTemplateInput = {
  readonly name: ContractName;
  readonly argsCount: number;
  readonly code: SoliditySnippet;
  readonly baseImportPath: string;
};

function indentBlock(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  return lines.map((l) => (l.length === 0 ? "" : pad + l)).join("\n");
}

export function renderConditionSolidity(input: ConditionTemplateInput): string {
  const argsCount = input.argsCount < 0 ? 0 : input.argsCount;
  const codeIndented = indentBlock(String(input.code), 8);

  return `// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.2 <0.9.0;

import "${input.baseImportPath}";

contract ${input.name} is ConditionBase
{
    constructor(address registryAddr) ConditionBase(registryAddr, "${input.name}", ${argsCount}) {}

    function check(int32 [] calldata args) view external returns (bool)
    {
        require(args.length == this.getArgsCount(), "wrong number of arguments");
${codeIndented.length > 0 ? codeIndented : "        return true;"}
    }
}
`;
}
