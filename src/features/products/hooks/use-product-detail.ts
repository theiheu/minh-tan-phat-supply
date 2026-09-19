import { useMemo, useState } from "react";
import { parseVariantHierarchy } from "../utils/variant-hierarchy";
import type { Product } from "@/lib/types";
import type { VariantWithStock } from "../types";
import type { TransactionUom } from "@/features/catalog/domain/types";
import { computeSearchScore } from "@/lib/search";

export function useProductDetail({
  product,
  variants,
}: {
  product: Product;
  variants: VariantWithStock[];
}) {
  const [mode, setMode] = useState<"single" | "batch">("single");

  // Single mode state
  const defaultVariant = variants.find((v) => v.is_default) ?? variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState<string>(defaultVariant?.id ?? "");
  const [selectedUom, setSelectedUom] = useState<TransactionUom | undefined>();
  const [quantity, setQuantity] = useState<number>(1);
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Batch mode state: map of variantId -> quantity
  const [batchQuantities, setBatchQuantities] = useState<Record<string, number>>({});
  const [batchSearch, setBatchSearch] = useState<string>("");
  const [batchBrandFilter, setBatchBrandFilter] = useState<string>("all");

  const definedOptions = useMemo(() => {
    if (product.options && Array.isArray(product.options) && product.options.length > 0) {
      return product.options.map((o) => o.trim()).filter(Boolean);
    }
    return [];
  }, [product.options]);

  const parsedVariants = useMemo(() => {
    return variants.map((v) => {
      const hierarchy = parseVariantHierarchy(v, definedOptions);
      return {
        ...v,
        parsedHierarchy: hierarchy,
      };
    });
  }, [variants, definedOptions]);

  const optionAxes = useMemo(() => {
    if (definedOptions.length > 0) return definedOptions;
    const keysSet = new Set<string>();
    for (const pv of parsedVariants) {
      for (const k of Object.keys(pv.parsedHierarchy.levels)) {
        if (k.trim()) keysSet.add(k.trim());
      }
    }
    return Array.from(keysSet);
  }, [definedOptions, parsedVariants]);

  const brandGroups = useMemo(() => {
    const map = new Map<string, typeof parsedVariants>();
    for (const pv of parsedVariants) {
      const brand = pv.parsedHierarchy.brandOrGroup || "Quy cách chung";
      const list = map.get(brand) || [];
      list.push(pv);
      map.set(brand, list);
    }
    return map;
  }, [parsedVariants]);

  const uniqueBrands = useMemo(() => {
    return Array.from(brandGroups.keys());
  }, [brandGroups]);

  const [selectedAxisValues, setSelectedAxisValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const defaultParsed = parsedVariants.find((v) => v.id === selectedVariantId) ?? parsedVariants[0];
    if (defaultParsed) {
      for (const axis of optionAxes) {
        initial[axis] = defaultParsed.parsedHierarchy.levels[axis] || "";
      }
    }
    return initial;
  });

  const selectedVariant = useMemo(() => {
    if (optionAxes.length === 0) return parsedVariants.find((v) => v.id === selectedVariantId);
    const candidateVariants = parsedVariants.filter((pv) => {
      return optionAxes.every((axis) => pv.parsedHierarchy.levels[axis] === selectedAxisValues[axis]);
    });
    if (candidateVariants.length === 1) return candidateVariants[0];
    if (candidateVariants.length > 1) {
      const exactTarget = candidateVariants.find((v) => v.id === selectedVariantId);
      return exactTarget || candidateVariants[0];
    }
    return parsedVariants.find((v) => v.id === selectedVariantId);
  }, [parsedVariants, optionAxes, selectedAxisValues, selectedVariantId]);

  const getAvailableValuesForAxis = (
    axisIndex: number
  ): Array<{ value: string; isAvailable: boolean; stock: number; thumbnailSrc?: string }> => {
    const targetAxis = optionAxes[axisIndex];
    if (!targetAxis) return [];

    const prefixFilters = optionAxes.slice(0, axisIndex);
    const candidateVariants = parsedVariants.filter((pv) => {
      return prefixFilters.every((prevAxis) => pv.parsedHierarchy.levels[prevAxis] === selectedAxisValues[prevAxis]);
    });

    const valMap = new Map<string, { isAvailable: boolean; stock: number; thumbnailSrc?: string }>();
    for (const pv of candidateVariants) {
      const val = pv.parsedHierarchy.levels[targetAxis];
      if (!val) continue;

      const restFilters = optionAxes.slice(axisIndex + 1);
      const isAvailable = restFilters.every(
        (postAxis) => pv.parsedHierarchy.levels[postAxis] === selectedAxisValues[postAxis]
      );
      
      const thumb = (pv.images && pv.images.length > 0) ? pv.images[0] : undefined;

      if (!valMap.has(val)) {
        valMap.set(val, { isAvailable, stock: isAvailable ? pv.stock : 0, thumbnailSrc: thumb });
      } else {
        const existing = valMap.get(val)!;
        if (isAvailable && !existing.isAvailable) existing.isAvailable = true;
        if (isAvailable) existing.stock += pv.stock;
        if (!existing.thumbnailSrc && thumb) existing.thumbnailSrc = thumb;
      }
    }

    return Array.from(valMap.entries()).map(([value, info]) => ({
      value,
      ...info,
    }));
  };

  const handleSelectAxisValue = (axisIndex: number, axisName: string, val: string) => {
    const newSelected = { ...selectedAxisValues, [axisName]: val };
    const exactMatch = parsedVariants.find((pv) => {
      return optionAxes.every((a) => pv.parsedHierarchy.levels[a] === newSelected[a]);
    });
    if (exactMatch) {
      setSelectedVariantId(exactMatch.id);
      setSelectedAxisValues(newSelected);
      return;
    }

    const nextAvailableVariants = parsedVariants.filter((pv) => {
      const prefix = optionAxes.slice(0, axisIndex + 1);
      return prefix.every((a) => pv.parsedHierarchy.levels[a] === newSelected[a]);
    });

    if (nextAvailableVariants.length > 0) {
      const fallback = nextAvailableVariants[0];
      setSelectedVariantId(fallback.id);
      const fixSelected: Record<string, string> = { ...newSelected };
      for (const axis of optionAxes) {
        fixSelected[axis] = fallback.parsedHierarchy.levels[axis] || "";
      }
      setSelectedAxisValues(fixSelected);
    } else {
      setSelectedAxisValues(newSelected);
    }
  };

  const handleSelectVariantDirect = (v: typeof parsedVariants[0]) => {
    setSelectedVariantId(v.id);
    const newSelected: Record<string, string> = {};
    for (const axis of optionAxes) {
      newSelected[axis] = v.parsedHierarchy.levels[axis] || "";
    }
    setSelectedAxisValues(newSelected);
    setSearchFilter("");
  };

  const displayedImages = useMemo(() => {
    if (selectedVariant) {
      return selectedVariant.images && selectedVariant.images.length > 0 ? selectedVariant.images : [];
    }
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    return [];
  }, [selectedVariant, product.images]);

  const filteredFlatVariants = useMemo(() => {
    if (!searchFilter.trim()) return parsedVariants;
    return parsedVariants
      .map((pv) => {
        const text = `${pv.parsedHierarchy.fullLabel} ${pv.sku_code || ""} ${pv.unit || ""}`;
        const score = computeSearchScore(text, searchFilter);
        return { pv, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.pv);
  }, [parsedVariants, searchFilter]);

  const filteredBatchVariants = useMemo(() => {
    let list = parsedVariants;
    if (batchBrandFilter && batchBrandFilter !== "all") {
      list = list.filter((pv) => (pv.parsedHierarchy.brandOrGroup || "Quy cách chung") === batchBrandFilter);
    }
    if (batchSearch.trim()) {
      list = list
        .map((pv) => {
          const text = `${pv.parsedHierarchy.fullLabel} ${pv.sku_code || ""} ${pv.unit || ""}`;
          return { pv, score: computeSearchScore(text, batchSearch) };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.pv);
    }
    return list;
  }, [parsedVariants, batchBrandFilter, batchSearch]);

  const batchGroupedMap = useMemo(() => {
    const map = new Map<string, typeof parsedVariants>();
    for (const pv of filteredBatchVariants) {
      const group = pv.parsedHierarchy.brandOrGroup || "Quy cách chung";
      const array = map.get(group) || [];
      array.push(pv);
      map.set(group, array);
    }
    return map;
  }, [filteredBatchVariants]);

  const batchEntries = useMemo(() => {
    return Object.entries(batchQuantities).filter(([, q]) => q > 0);
  }, [batchQuantities]);

  const batchTotalQty = batchEntries.reduce((sum, [, q]) => sum + q, 0);
  const batchCount = batchEntries.length;

  const setBatchQty = (variantId: string, q: number) => {
    setBatchQuantities((prev) => {
      const next = { ...prev };
      if (q <= 0) {
        delete next[variantId];
      } else {
        next[variantId] = q;
      }
      return next;
    });
  };

  return {
    mode, setMode,
    defaultVariant,
    selectedVariantId, setSelectedVariantId,
    selectedUom, setSelectedUom,
    quantity, setQuantity,
    searchFilter, setSearchFilter,
    batchQuantities, setBatchQuantities,
    batchSearch, setBatchSearch,
    batchBrandFilter, setBatchBrandFilter,
    definedOptions,
    parsedVariants,
    optionAxes,
    brandGroups, uniqueBrands,
    selectedAxisValues, setSelectedAxisValues,
    selectedVariant,
    getAvailableValuesForAxis,
    handleSelectAxisValue,
    handleSelectVariantDirect,
    displayedImages,
    filteredFlatVariants, filteredBatchVariants,
    batchGroupedMap, batchEntries, batchTotalQty, batchCount,
    setBatchQty
  };
}
