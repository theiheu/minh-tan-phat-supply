import type { Vehicle } from "@/lib/types";

export type { Vehicle };

export interface VehicleWithRelations extends Vehicle {
  zone?: {
    name: string;
  } | null;
  fuel_type?: {
    name: string;
    code: string;
  } | null;
}

export type VehicleFilterType = "all" | "truck" | "excavator" | "generator" | "car" | "forklift" | "tractor" | "other";
