"use server";

import { requireManager } from "@/lib/auth";
import {
  fetchGeneralReportData,
  fetchPartnersReportData,
  fetchStockCardData,
  fetchVehicleReportData,
  fetchZoneCostReportData,
} from "./queries";
import type {
  GeneralReportData,
  PartnersReportData,
  StockCardData,
  VehicleReportData,
  ZoneCostReportData,
} from "./types";

/**
 * Server action to fetch general overview report (valuation, XNT stock ledger, category breakdown, subsystems).
 */
export async function getGeneralReportAction(params: {
  locationId?: string;
  from: string;
  to: string;
}): Promise<GeneralReportData> {
  await requireManager();
  return fetchGeneralReportData(params);
}

/**
 * Server action to fetch zone/poultry house cost analysis data.
 */
export async function getZoneCostReportAction(params: {
  from: string;
  to: string;
}): Promise<ZoneCostReportData> {
  await requireManager();
  return fetchZoneCostReportData(params);
}

/**
 * Server action to fetch vehicle fuel consumption analytics against norms.
 */
export async function getVehicleReportAction(params: {
  from: string;
  to: string;
}): Promise<VehicleReportData> {
  await requireManager();
  return fetchVehicleReportData(params);
}

/**
 * Server action to fetch partner analytics (suppliers and customer revenue).
 */
export async function getPartnersReportAction(params: {
  from: string;
  to: string;
}): Promise<PartnersReportData> {
  await requireManager();
  return fetchPartnersReportData(params);
}

/**
 * Server action to fetch detailed stock card ledger (thẻ kho) for a specific variant.
 */
export async function getStockCardAction(params: {
  variantId: string;
  locationId?: string;
  from: string;
  to: string;
}): Promise<StockCardData> {
  await requireManager();
  return fetchStockCardData(params);
}
