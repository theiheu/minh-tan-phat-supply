import { inventoryTools } from "./tools/inventory-tools";
import { fuelTools } from "./tools/fuel-tools";
import { reportTools } from "./tools/report-tools";
import { sopTools } from "./tools/sop-tools";
import { actionTools } from "./tools/action-tools";

export interface AIUserContext {
  userId: string;
  role: string;
  userName?: string;
  requestId?: string;
}

/**
 * Mọi tool phải kiểm tra authorization trực tiếp qua userContext thay vì chỉ dựa vào registry filtering.
 */
export function getRegisteredTools(userContext: AIUserContext) {
  const isPrivileged = ["owner", "accountant", "warehouse", "superuser"].includes(userContext.role || "requester");

  const buildTools = (toolConfigs: Record<string, any>) => {
    const wrapped: Record<string, any> = {};
    for (const [key, config] of Object.entries(toolConfigs)) {
      wrapped[key] = {
        ...config,
        // Bind the context to the original execute function
        execute: async (args: any, toolsCtx?: any) => config.execute(args, { ...toolsCtx, userContext })
      };
    }
    return wrapped;
  };

  const baseTools = {
    ...buildTools(inventoryTools),
    ...buildTools(sopTools),
    ...buildTools(actionTools),
  };

  if (isPrivileged) {
    return {
      ...baseTools,
      ...buildTools(fuelTools),
      ...buildTools(reportTools),
    };
  }

  return baseTools;
}
