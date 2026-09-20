"use server";

import { requireManager } from "@/lib/auth";
import {
  fetchGeneralReportData,
  fetchManagementOverviewData,
  fetchPartnersReportData,
  fetchStockCardData,
  fetchVehicleReportData,
  fetchZoneCostReportData,
} from "./queries";
import type {
  GeneralReportData,
  ManagementOverviewData,
  PartnersReportData,
  StockCardData,
  VehicleReportData,
  ZoneCostReportData,
} from "./types";
import {
  getMetabaseEmbedUrl,
  getMetabaseSiteUrl,
  METABASE_DASHBOARDS,
  type MetabaseDashboardConfig,
} from "@/lib/metabase";

/**
 * Server action to fetch general overview report (valuation, XNT stock ledger, category breakdown, subsystems).
 */
export async function getManagementOverviewAction(params: {
  locationId?: string;
  from: string;
  to: string;
}): Promise<ManagementOverviewData> {
  await requireManager();
  return fetchManagementOverviewData(params);
}

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

export interface MetabaseDashboardResult {
  embedUrl: string;
  directUrl: string;
  dashboard: MetabaseDashboardConfig;
  siteUrl: string;
  dashboards: MetabaseDashboardConfig[];
}

/**
 * Server action to generate secure embedded URL for Metabase BI Dashboards.
 */
export async function getMetabaseDashboardAction(params: {
  dashboardId?: string;
  filterParams?: Record<string, string | number | boolean>;
}): Promise<MetabaseDashboardResult> {
  await requireManager();

  const requestedId = params.dashboardId || METABASE_DASHBOARDS[0].id;
  const dashboard = METABASE_DASHBOARDS.find((d) => d.id === requestedId);
  if (!dashboard) throw new Error("Dashboard Metabase không hợp lệ");

  const siteUrl = getMetabaseSiteUrl();
  const embedUrl = getMetabaseEmbedUrl({
    dashboardNumericId: dashboard.numericId,
    params: {},
    bordered: true,
    titled: true,
  });

  const directUrl = `${siteUrl}/dashboard/${dashboard.numericId}`;

  return {
    embedUrl,
    directUrl,
    dashboard,
    siteUrl,
    dashboards: METABASE_DASHBOARDS,
  };
}
