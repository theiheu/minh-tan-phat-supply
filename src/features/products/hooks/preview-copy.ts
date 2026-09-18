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

  // Chuẩn hóa định nghĩa options của vật tư
  const definedOptions = useMemo(() => {
    if (product.options && Array.isArray(product.options) && product.options.length > 0) {
      return product.options.map((o) => o.trim()).filter(Boolean);
    }
    return [];
  }, [product.options]);

  // Phân tích cấu trúc phân cấp cho toàn bộ biến thể
  const parsedVariants = useMemo(() => {
    return variants.map((v) => {
      const hierarchy = parseVariantHierarchy(v, definedOptions);
      return {
        ...v,
        parsedHierarchy: hierarchy,
      };
    });
  }, [variants, definedOptions]);

  // Trích xuất danh sách các trục thuộc tính (Axes) theo thứ tự
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

  // Nhóm các hãng / phân nhóm chính (Level 1)
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

  // Trạng thái các giá trị đang chọn ở từng trục (Cascading Selection State)
  const [selectedAxisValues, setSelectedAxisValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    const defaultParsed = parsedVariants.find((v) => v.id === selectedVariantId) ?? parsedVariants[0];
    if (defaultParsed) {
      for (const axis of optionAxes) {
        const val = defaultParsed.parsedHierarchy.levels[axis];
        if (val) initial[axis] = val;
      }
    }
    return initial;
  });

  const selectedVariant = useMemo(() => {
    return variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;
  }, [variants, selectedVariantId, defaultVariant]);

  // Lọc phụ thuộc đa cấp (Cascading Values for each axis) - chỉ trả về các giá trị khả dụng kèm ảnh thumbnail đại diện nếu có
  const getAvailableValuesForAxis = (
    axisIndex: number
  ): Array<{ value: string; isAvailable: boolean; stock: number; thumbnailSrc?: string }> => {
    const targetAxis = optionAxes[axisIndex];
    if (!targetAxis) return [];

    const prefixFilters = optionAxes.slice(0, axisIndex);
    const candidateVariants = parsedVariants.filter((pv) => {
      return prefixFilters.every((prevAxis) => {
        const selectedVal = selectedAxisValues[prevAxis];
        return !selectedVal || pv.parsedHierarchy.levels[prevAxis] === selectedVal;
      });
    });

    const valMap = new Map<string, { stock: number; thumbnailSrc?: string }>();
    for (const pv of candidateVariants) {
      const val = pv.parsedHierarchy.levels[targetAxis];
      if (val) {
        const current = valMap.get(val) || { stock: 0 };
        const thumbnailSrc = current.thumbnailSrc || (pv.images?.[0] ? pv.images[0] : undefined);
        valMap.set(val, {
          stock: current.stock + pv.stock,
          thumbnailSrc,
        });
      }
    }

    return Array.from(valMap.entries()).map(([val, data]) => ({
      value: val,
      isAvailable: true,
      stock: data.stock,
      thumbnailSrc: data.thumbnailSrc,
    }));
  };

  const handleSelectAxisValue = (axisIndex: number, axisName: string, val: string) => {
    const nextSelections = { ...selectedAxisValues, [axisName]: val };

    const targetAxisKeys = optionAxes.slice(0, axisIndex + 1);
    let matchedVariant = parsedVariants.find((pv) => {
      return optionAxes.every((a) => {
        const targetVal = nextSelections[a];
        return !targetVal || pv.parsedHierarchy.levels[a] === targetVal;
      });
    });

    if (!matchedVariant) {
      matchedVariant = parsedVariants.find((pv) => {
        return targetAxisKeys.every((a) => pv.parsedHierarchy.levels[a] === nextSelections[a]);
      });
    }

    if (matchedVariant) {
      setSelectedVariantId(matchedVariant.id);
      const updatedAxes: Record<string, string> = {};
      for (const a of optionAxes) {
        const vVal = matchedVariant.parsedHierarchy.levels[a];
        if (vVal) updatedAxes[a] = vVal;
      }
      setSelectedAxisValues(updatedAxes);
    } else {
      setSelectedAxisValues(nextSelections);
    }
  };

  const handleSelectVariantDirect = (v: typeof parsedVariants[0]) => {
    setSelectedVariantId(v.id);
    const next: Record<string, string> = {};
    for (const axis of optionAxes) {
      const val = v.parsedHierarchy.levels[axis];
      if (val) next[axis] = val;
    }
    setSelectedAxisValues(next);
  };

  // Khi chọn vào 1 biến thể:
  // - Nếu biến thể có ảnh riêng (có thể có nhiều ảnh): CHỈ hiển thị đúng bộ ảnh của biến thể đó.
  // - Nếu biến thể chưa có ảnh riêng: fallback về ảnh chung của sản phẩm (nếu có).
  // - Tuyệt đối không gộp chung ảnh của các biến thể khác!
  const displayedImages = useMemo(() => {
    if (selectedVariant?.images && selectedVariant.images.length > 0) {
      return selectedVariant.images.filter((img): img is string => Boolean(img?.trim()));
    }
    if (product.images && product.images.length > 0) {
      return product.images.filter((img): img is string => Boolean(img?.trim()));
    }
    return [];
  }, [selectedVariant?.images, product.images]);

  const isOutOfStock = (selectedVariant?.stock ?? 0) <= 0;
  const isLowStock = !isOutOfStock && (selectedVariant?.stock ?? 0) <= (selectedVariant?.min_stock ?? 0);

  const filteredFlatVariants = useMemo(() => {
    if (!searchFilter.trim()) return parsedVariants;
    return parsedVariants.filter((v) => {
      const text = `${v.parsedHierarchy.fullLabel} ${v.sku_code || ""} ${v.unit || ""}`;
      return matchesSearchTokens(text, searchFilter);
    });
  }, [parsedVariants, searchFilter]);

  const filteredBatchVariants = useMemo(() => {
    let list = parsedVariants;
    if (batchBrandFilter !== "all") {
      list = list.filter((v) => (v.parsedHierarchy.brandOrGroup || "Quy cách chung") === batchBrandFilter);
    }
    if (batchSearch.trim()) {
      list = list.filter((v) => {
        const text = `${v.parsedHierarchy.fullLabel} ${v.sku_code || ""} ${v.unit || ""}`;
        return matchesSearchTokens(text, batchSearch);
      });
    }
    return list;
  }, [parsedVariants, batchBrandFilter, batchSearch]);

  const batchGroupedMap = useMemo(() => {
    const map = new Map<string, typeof parsedVariants>();
    for (const v of filteredBatchVariants) {
      const groupName = v.parsedHierarchy.brandOrGroup || "Quy cách khác";
      const list = map.get(groupName) || [];
      list.push(v);
      map.set(groupName, list);
    }
    return map;
  }, [filteredBatchVariants]);

  const batchEntries = useMemo(() => {
    return Object.entries(batchQuantities).filter(([, q]) => q > 0);
  }, [batchQuantities]);

  const batchCount = batchEntries.length;
  const batchTotalQty = batchEntries.reduce((sum, [, q]) => sum + q, 0);

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

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    addItem({
      skuId: selectedVariant.id,
      transactionUnitId: selectedUom?.id,
      transactionUnitName: selectedUom?.displayName,
      factorToBase: selectedUom?.factorToBase ?? 1,
      enteredQuantity: quantity,
      name: product.name,
      label: variantLabel(selectedVariant.attributes, selectedVariant.unit),
      unit: selectedUom?.displayName || selectedVariant.unit || null,
      baseUnitSymbol: selectedVariant.unit || null,
      image: selectedVariant.images?.[0] ?? product.images?.[0] ?? null,
      stock: selectedVariant.stock,
    });

    const displayUnit = selectedUom?.displayName || selectedVariant.unit || "phần";
    toast.success(
      isOutOfStock
        ? "Đã thêm " + quantity + " " + displayUnit + " " + product.name + " vào giỏ (hết hàng — chờ đặt)"
        : "Đã thêm " + quantity + " " + displayUnit + " " + product.name + " vào giỏ"
    );
  };

  const handleQuickRequisition = () => {
    handleAddToCart();
    onOpenChange(false);
    setCartOpen(false);
    router.push("/requisitions/new");
  };

  const handleBatchAddToCart = () => {
    if (batchCount === 0) return;

    for (const [vId, qty] of batchEntries) {
      const v = variants.find((item) => item.id === vId);
      if (!v) continue;
      addItem({
        skuId: v.id,
        enteredQuantity: qty,
        name: product.name,
        label: variantLabel(v.attributes, v.unit),
        unit: v.unit ?? null,
        image: v.images?.[0] ?? product.images?.[0] ?? null,
        stock: v.stock,
      });
    }

    toast.success(
      "Đã thêm " + batchCount + " quy cách (tổng " + batchTotalQty + " " + (selectedVariant?.unit || "món") + ") vào giỏ"
    );
  };

  const handleBatchQuickRequisition = () => {
    handleBatchAddToCart();
    onOpenChange(false);
    setCartOpen(false);
    router.push("/requisitions/new");
  };

  const hasMultiAxis = optionAxes.length >= 2;
