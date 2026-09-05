import type { Variant } from "@/lib/types";

export interface VariantWithStock extends Variant {
  stock: number;
  isComposite: boolean;
}
