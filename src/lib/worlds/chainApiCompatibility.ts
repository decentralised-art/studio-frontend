import {
  normalizeChainExecuteResponse,
  type ChainExecutionProvenance,
} from "$lib/chain/registryApi";
import type { DcnClient } from "dcn";

/** The SDK's iframe protocol is still v1; chainApiVersion negotiates only execute's result shape. */
export const createWorldChainClient = (
  client: DcnClient,
  chainApiVersion: 1 | 2 = 1,
  onExecution?: (provenance: ChainExecutionProvenance) => void,
): DcnClient =>
  new Proxy(client, {
    get(target, property) {
      if (property === "execute")
        return async (...args: Parameters<DcnClient["execute"]>) => {
          const result = normalizeChainExecuteResponse(await target.execute(...args));
          onExecution?.({
            block_number: result.block_number,
            block_hash: result.block_hash,
            runner: result.runner,
          });
          // This facade is the sole intentional type boundary for already-uploaded JavaScript worlds.
          // Simulation remains explicit; v1 only unwraps an actual chain execution result.
          return chainApiVersion === 1 ? result.particles : result;
        };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
