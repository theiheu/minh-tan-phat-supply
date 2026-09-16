
import csv
import json
import re
import uuid
from collections import defaultdict, Counter

with open('/tmp/ten_vat_tu_don_vi_tinh.csv', mode='r', encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    header = next(reader)
    raw_items = []
    for idx, r in enumerate(reader, 1):
        if not r or not any(c.strip() for c in r):
            continue
        name = r[0].strip()
        name = re.sub(r'\s+', ' ', name)
        unit = r[1].strip() if len(r) > 1 else ""
        if not unit:
            if 'cánh quạt' in name.lower():
                unit = 'cánh'
            else:
                unit = 'cái'
        raw_items.append({'id': idx, 'raw_name': name, 'unit': unit})

from full_parser import parse_item_full

categories_map = {
    'Điện - Điện tử': 'a1c4a990-c8ec-4a39-9725-36c1833710b6',
    'Phụ tùng Xe - Máy móc': 'df6f225d-08eb-4771-9807-f855ec895a9a',
    'Dụng cụ - Bảo hộ': 'd6044261-a7e5-41fa-8355-6a7485e9dccb',
    'Thiết bị Chăn nuôi': '3f4c169a-50be-4c33-90cb-75c6feccf89f',
    'Nước - Khí nén': 'f031a294-313f-4004-ae26-a7e8a0a5631d',
    'Vòng bi - Bạc đạn': 'ba9cb1b2-818e-42b8-a6d0-a2ee7b950ff2',
    'Dây curoa - Nhông xích': 'ff7a982c-5a6f-4adc-a69d-fdfd6fe4fd88',
    'Dầu mỡ - Hóa chất': '672b5392-791b-40e2-b023-ddc2d4d35513',
    'Hàn - Cắt - Gia công': '8367bf09-5922-4455-ac3c-7bd7c6d2c0a9',
    'Kim khí - Bulong - Ốc vít': 'df35f6d3-4fd4-4e2d-a7a4-f0c74dfd159f',
    'Đóng gói - Bạt - Dây': '61e3675f-9fd7-4958-983e-c1d8fa88108e',
    'Vật tư Khác': '203a0797-8b1f-4a85-b227-04777bf9311f'
}

prod_groups = defaultdict(list)
for item in raw_items:
    cat, prod_name, options, attrs, unit = parse_item_full(item)
    key = (cat, prod_name, tuple(options))
    prod_groups[key].append({
        'raw_id': item['id'],
        'raw_name': item['raw_name'],
        'attrs': attrs,
        'unit': unit
    })

# Disambiguate duplicate variant attributes within product
for key, variants in prod_groups.items():
    if len(variants) > 1:
        seen = Counter(json.dumps(v['attrs'], sort_keys=True) for v in variants)
        dup_attrs = {k for k, count in seen.items() if count > 1}
        if dup_attrs:
            for v in variants:
                s = json.dumps(v['attrs'], sort_keys=True)
                if s in dup_attrs:
                    opt_key = list(v['attrs'].keys())[0]
                    v['attrs'][opt_key] = f"{v['attrs'][opt_key]} ({v['unit'].capitalize()})"

def escape_sql(val):
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"

def escape_array(arr):
    elements = ['"' + str(x).replace('"', '\\"') + '"' for x in arr]
    return "'{" + ",".join(elements) + "}'"

sql_lines = []
sql_lines.append("BEGIN;")
sql_lines.append("-- 1. Clear old transactions and catalog (in strict FK dependency order)")
sql_lines.append("DELETE FROM public.repair_order_items;")
sql_lines.append("DELETE FROM public.repair_orders;")
sql_lines.append("DELETE FROM public.exchange_note_items;")
sql_lines.append("DELETE FROM public.exchange_notes;")
sql_lines.append("DELETE FROM public.requisition_return_items;")
sql_lines.append("DELETE FROM public.requisition_returns;")
sql_lines.append("DELETE FROM public.requisition_items;")
sql_lines.append("DELETE FROM public.requisitions;")
sql_lines.append("DELETE FROM public.defect_note_items;")
sql_lines.append("DELETE FROM public.defect_notes;")
sql_lines.append("DELETE FROM public.issue_items;")
sql_lines.append("DELETE FROM public.issues;")
sql_lines.append("DELETE FROM public.receipt_items;")
sql_lines.append("DELETE FROM public.receipts;")
sql_lines.append("DELETE FROM public.liquidation_items;")
sql_lines.append("DELETE FROM public.liquidation_notes;")
sql_lines.append("DELETE FROM public.tool_borrowing_items;")
sql_lines.append("DELETE FROM public.tool_borrowings;")
sql_lines.append("DELETE FROM public.stocktake_items;")
sql_lines.append("DELETE FROM public.stocktake_sessions;")
sql_lines.append("DELETE FROM public.stock_movements;")
sql_lines.append("DELETE FROM public.stock_balances;")
sql_lines.append("DELETE FROM public.variant_components;")
sql_lines.append("DELETE FROM public.variants;")
sql_lines.append("DELETE FROM public.products;")

sql_lines.append("-- 2. Insert Products and Variants")
name_to_variant_id = {}
all_variants = []

for (cat, prod_name, options), variants in prod_groups.items():
    cat_id = categories_map[cat]
    prod_id = str(uuid.uuid4())
    
    prod_sql = f"INSERT INTO public.products (id, name, description, category_id, options, images, created_at, updated_at) VALUES ({escape_sql(prod_id)}, {escape_sql(prod_name)}, {escape_sql('Danh mục: ' + cat)}, {escape_sql(cat_id)}, {escape_array(list(options))}, '{{}}', NOW(), NOW());"
    sql_lines.append(prod_sql)
    
    for idx, v in enumerate(variants):
        var_id = str(uuid.uuid4())
        is_default = "true" if idx == 0 else "false"
        attrs_json = json.dumps(v['attrs'], ensure_ascii=False)
        var_sql = f"INSERT INTO public.variants (id, product_id, attributes, unit, price, min_stock, is_trackable_lot, is_default, images, created_at, updated_at) VALUES ({escape_sql(var_id)}, {escape_sql(prod_id)}, {escape_sql(attrs_json)}::jsonb, {escape_sql(v['unit'])}, NULL, 0, false, {is_default}, '{{}}', NOW(), NOW());"
        sql_lines.append(var_sql)
        
        name_to_variant_id[v['raw_name'].lower().strip()] = var_id
        all_variants.append({
            'id': var_id,
            'raw_name': v['raw_name']
        })

sql_lines.append("-- 3. Insert Assembly Kit Components")
kits_to_link = [
    {
        'parent': 'bánh xoay 150+càng',
        'children': [
            ('bánh xe đỏ a150', 1),
            ('càng xoay a150', 1)
        ]
    },
    {
        'parent': 'moter dc cho gà ăn',
        'children': [
            ('đầu moter dc cho gà ăn', 1),
            ('hộp số moter dc cho gà ăn', 1)
        ]
    },
    {
        'parent': 'bộ khung quạt đỏ mulifan 3 pha',
        'children': [
            ('cánh quạt đỏ omysu', 1),
            ('buli moter quạt đỏ', 1),
            ('cốt gắn bạc đạn quạt', 1),
            ('bạc đạn quạt 6203-2rsh', 2)
        ]
    },
    {
        'parent': 'dây kích bình',
        'children': [
            ('dây hàn nối bình', 2),
            ('cọc bình', 2)
        ]
    },
    {
        'parent': 'bộ kìm bấm coss',
        'children': [
            ('khuôn ép cos cho kìm thuỷ lực 16mm', 1),
            ('khuôn ép cos cho kìm thuỷ lực 25mm', 1),
            ('khuôn ép cos cho kìm thuỷ lực 35mm', 1)
        ]
    },
    {
        'parent': 'bulong 12x30(máy đảo phân)',
        'children': [
            ('bulong m12x30 xi 4.6', 1),
            ('tán 12', 1),
            ('long đền 12', 1)
        ]
    },
    {
        'parent': 'bulong 20x80 đen',
        'children': [
            ('tán 20', 1),
            ('long đền 20', 1)
        ]
    },
    {
        'parent': 'bulong xiết dao đập bắp',
        'children': [
            ('tán 14 đen', 1),
            ('long đền 14 trắng', 1)
        ]
    }
]

composite_parent_ids = set()
for kit in kits_to_link:
    parent_id = name_to_variant_id.get(kit['parent'].lower().strip())
    if not parent_id:
        print(f"Parent not found: {kit['parent']}")
        continue
    composite_parent_ids.add(parent_id)
    for child_name, qty in kit['children']:
        child_id = name_to_variant_id.get(child_name.lower().strip())
        if not child_id:
            print(f"Child not found: {child_name}")
            continue
        vc_id = str(uuid.uuid4())
        vc_sql = f"INSERT INTO public.variant_components (id, parent_variant_id, child_variant_id, quantity, created_at) VALUES ({escape_sql(vc_id)}, {escape_sql(parent_id)}, {escape_sql(child_id)}, {qty}, NOW());"
        sql_lines.append(vc_sql)

sql_lines.append("-- 4. Initialize stock_balances for non-composite variants at KHO_CHINH")
for v in all_variants:
    if v['id'] not in composite_parent_ids:
        sb_id = str(uuid.uuid4())
        sb_sql = f"INSERT INTO public.stock_balances (id, variant_id, location_id, quantity, updated_at) VALUES ({escape_sql(sb_id)}, {escape_sql(v['id'])}, (SELECT id FROM public.stock_locations WHERE code = 'KHO_CHINH'), 0, NOW());"
        sql_lines.append(sb_sql)

sql_lines.append("COMMIT;")

with open('/tmp/import_materials.sql', 'w', encoding='utf-8') as f:
    f.write("\n".join(sql_lines))

print(f"Generated /tmp/import_materials.sql with {len(sql_lines)} SQL statements.")
