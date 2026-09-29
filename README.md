# 聖誕跑者報名

聖誕交換禮物活動的報名網站：參加者捏一個自己的像素跑者並填上名字，就完成報名。活動當天會用這些角色一起玩遊戲（第二階段，尚未製作）。

- Vue 3 + Vite + TypeScript，角色以 Canvas 2D 繪製
- 後端 Supabase（Postgres），部署在 Vercel
- 角色素材來自 [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)，授權見頁尾

## 頁面

| 路徑 | 說明 |
| --- | --- |
| `/` | 報名頁；這台裝置已報名過會自動轉到 `/done` |
| `/done` | 報名成功，顯示自己的角色，可修改造型 |
| `/edit` | 修改造型（以 localStorage 裡的 edit_token 驗證） |
| `/roster?key=…` | 管理用名單，所有角色在跑道上跑；`key` 需等於 `VITE_ROSTER_KEY` |
| `/dev` | 只在開發環境：角色除錯與多角色壓力測試 |

任何頁面網址加上 `?debug` 會顯示慢動作與圖層除錯面板。

## 本機開發

```sh
pnpm install
pnpm dev
```

沒有設定 Supabase 環境變數時，前端會改用 localStorage 模擬後端，可以直接測試完整流程。

### 串接 Supabase

1. 在 Supabase 建立專案。
2. 依檔名順序執行 `supabase/migrations/` 裡的所有 SQL：在 Dashboard 的 SQL Editor 逐一貼上執行，或用 CLI `supabase link` 後執行 `supabase db push`。
3. 複製 `.env.example` 為 `.env.local`，填入 Project URL、anon（publishable）key 與名單頁密語。

## 部署到 Vercel

匯入 repo 後，在 Project Settings → Environment Variables 設定 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_ROSTER_KEY`。`vercel.json` 已設定 SPA 路由與素材快取。

## 素材管線

```sh
pnpm build:assets   # 抓取 LPC 素材、裁切、產生 manifest / credits / palettes
pnpm verify:assets  # 與 reference/ 的原型逐像素比對
```

- 素材清單集中在 `scripts/assets.config.ts`，LPC repo 鎖定在其中的 `LPC_COMMIT`。
- 以 sparse checkout（`--filter=blob:none`）只下載需要的檔案，快取在 `.cache/lpc`。
- 產出的 `public/sprites/` 與 `src/assets/*.json` 有 commit 進 repo，部署時不需要重跑。

新增髮型、衣服的步驟：

1. 在 `scripts/assets.config.ts` 加上素材，執行 `pnpm build:assets`。
2. 在 `src/avatar/catalog.ts` 把選項與中文名稱加進對應清單。
3. 新素材原型沒有，`verify:assets` 會回報「多出圖層」，屬於預期結果。

## 資料庫

- `players`：`id`、`name`（不分大小寫唯一、1～20 字）、`avatar`（AvatarConfig JSON）、`edit_token`、`created_at`、`updated_at`
- anon 只能讀 `id, name, avatar, created_at`，讀不到 `edit_token`，也不能直接寫入
- 寫入一律透過 function：`register_player`、`get_my_player`、`update_player`（驗證 edit_token）

```sh
pnpm test:db   # 用 PGlite 以 anon 角色驗證權限與 function
```

## 角色渲染模組（src/avatar）

與 Vue 無關的純 TypeScript，第二階段的遊戲畫面可以直接沿用：

```ts
import { AvatarActor, drawAvatar, preloadAvatar } from './avatar'

await preloadAvatar(config)
const actor = new AvatarActor()
actor.setMode('run') // idle / walk / run
actor.jump()
actor.emote(0, performance.now()) // 表情 0～7

// 每一幀
actor.update(dt)
drawAvatar(ctx, config, actor.pose(now, config.face), x, groundY, { flip: dir < 0 })
```

- 換色結果依（圖層, 動作, 調色盤）全域快取，同時畫幾十個角色也只換色一次。
- 頭頂圖示位置使用建置時預算好的 bounding box（`manifest.json`）。
- `CrowdRunway.vue` 是多角色跑道的範例（名單頁使用）。
