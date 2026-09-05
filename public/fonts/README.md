# Font PDF tiếng Việt

Hai font TTF này được dùng bởi `@react-pdf/renderer` (qua `src/features/pdf/fonts.ts`)
để in các phiếu có dấu tiếng Việt (font PDF chuẩn Helvetica không có glyph dấu).

- `Roboto-Regular.ttf`, `Roboto-Bold.ttf`
- Nguồn: https://github.com/googlefonts/roboto (nhánh `main`, `src/hinted/`)
- Giấy phép: Apache License 2.0 — https://www.apache.org/licenses/LICENSE-2.0

Không xoá 2 file này: các route `/api/{defects,repairs,liquidations,receipts,requisitions}/[id]/pdf`
sẽ fail (throw) nếu thiếu font.
