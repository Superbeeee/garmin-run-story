# 聖誕跑者報名

聖誕交換禮物活動的報名網站：參加者用 Google 登入，捏一個自己的像素跑者並填上名字就完成報名，接著進大廳看所有人的角色（一個帳號一個角色，用同一個帳號在任何裝置都能修改）。活動當天在大廳的「活動專區」輸入主持人公布的代碼，用這些角色一起玩遊戲。

- Vue 3 + Vite + TypeScript，角色以 Canvas 2D 繪製
- 後端 Supabase（Postgres），部署在 Vercel
- 角色素材來自 [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator)，授權見頁尾

## 頁面

| 路徑 | 說明 |
| --- | --- |
| `/login` | 登入頁：用 Google 登入 |
| `/` | 捏角色並報名（需登入、尚未報名） |
| `/lobby` | 大廳：所有角色在跑道上跑、全部名單與自己的角色（需已報名；每 30 秒自動更新） |
| `/edit` | 修改自己的角色（需已報名） |
| `/play` | 活動專區：輸入遊戲代碼（需已報名） |
| `/play/:id` | 手機遊戲畫面：看題目、用十字鍵移動角色作答、結算排名 |
| `/host` | 主持後台：題庫與場次、籤池、報名管理（改名、刪除）（需為主持人） |
| `/host/:id` | 主持畫面（投影用）：代碼、題目、倒數、所有人的角色；主持人在這裡按下一題 |
| `/host/draw` | 接力抽禮物的拉霸機（投影用） |
| `/roster?key=…` | 管理用名單，所有角色在跑道上跑；`key` 需等於 `VITE_ROSTER_KEY` |
| `/dev` | 只在開發環境：角色除錯與多角色壓力測試 |

任何頁面網址加上 `?debug` 會顯示慢動作與圖層除錯面板。

## 本機開發

```sh
pnpm install
pnpm dev
```

沒有設定 Supabase 環境變數時，前端會改用 localStorage 模擬後端，可以直接測試完整流程。模擬模式按「用 Google 登入」會直接產生一個假帳號（存在 sessionStorage，每個分頁是不同的人），每個人都是主持人。測試遊戲時開一個分頁當主持人、其他分頁各自登入當玩家即可。

### 串接 Supabase

1. 在 Supabase 建立專案。
2. 依檔名順序執行 `supabase/migrations/` 裡的所有 SQL：在 Dashboard 的 SQL Editor 逐一貼上執行，或用 CLI `supabase link` 後執行 `supabase db push`。
3. 複製 `.env.example` 為 `.env.local`，填入 Project URL、anon（publishable）key 與名單頁密語。

### 設定 Google 登入

1. 到 [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services：
   - OAuth consent screen：選 External，填應用程式名稱與聯絡信箱，發布（Publish）為正式版，否則只有測試使用者能登入。
   - Credentials → Create OAuth client ID → Web application，Authorized redirect URIs 填 `https://<project-ref>.supabase.co/auth/v1/callback`。
2. Supabase Dashboard → Authentication → Sign In / Providers → Google：啟用並貼上 Client ID 與 Client Secret。
3. Supabase Dashboard → Authentication → URL Configuration：
   - Site URL：正式網址（例如 `https://xxx.vercel.app`）
   - Redirect URLs：加入 `http://localhost:5173/**` 與 `https://xxx.vercel.app/**`

Google 不允許在 LINE 等 App 的內建瀏覽器登入。從 LINE 開啟時，`src/main.ts` 會加上 `openExternalBrowser=1` 改用手機預設瀏覽器；Facebook、Instagram 的內建瀏覽器沒有對應參數，只能請使用者自行用瀏覽器開啟。

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

### 設定主持人

主持人以 Google email 判斷，在 SQL Editor 執行：

```sql
insert into public.admins (email) values ('you@gmail.com');  -- 需小寫
```

### 避免免費專案被暫停

Supabase 免費專案 7 天沒有使用會自動暫停。`.github/workflows/supabase-keepalive.yml` 每天查一次公開的角色名單讓專案保持使用中，需要在 GitHub repo 的 Settings → Secrets and variables → Actions 設定 `SUPABASE_URL` 與 `SUPABASE_ANON_KEY`（與前端相同的公開 key）。活動前一天仍建議到 Supabase Dashboard 確認專案狀態。

## 遊戲：搶答跑位

1. 主持人在 `/host` 編輯題庫（是非題或 2～4 選項的選擇題，可設作答秒數），輸入代碼建立場次，開啟主持畫面投影。
2. 參加者在大廳點「活動專區」輸入代碼加入，手機上用十字鍵 ▲ ◀ ▶ ▼（或鍵盤方向鍵、WASD）上下左右移動角色，答案以左右位置決定；「跳」（空白鍵）與 8 個表情（數字鍵 1～8）隨時可按，投影上看得到，每人每 0.5 秒最多一次。
3. 主持人按「開始第 1 題」，場地依選項平均分成幾區；倒數結束時站在哪一區就是答案。時間到自動公布答案，主持人再按下一題。
4. 最後一題之後顯示排名（答對一題 1 分，同分同名次）。

實作重點：

- 場次狀態存在 `games`，用 Realtime（postgres_changes）推送；正確答案存在只有主持人能讀的 `quiz_questions`，公布時才寫入 `games.q_answer`。
- 玩家換區時呼叫 `set_answer`，伺服器只收截止前的最後一次（寬限 1 秒），公布答案時計分。
- 遊戲中與投影畫面會要求螢幕保持常亮（Screen Wake Lock API，不支援的瀏覽器略過）。
- 角色位置與跳躍、表情走 Realtime broadcast：手機以 REST 送出（移動時每 400ms、停著每 5 秒），只有主持畫面訂閱，避免每支手機都收到所有人的位置。Supabase 免費方案的 Realtime 有訊息量與連線數上限，人數很多時留意用量。

## 遊戲：接力抽禮物

1. 主持人在 `/host` 的「接力抽禮物 · 籤池」管理籤池：所有報名的人自動加入，可取消勾選排除、手動加入沒報名的人、把抽過的人放回、重設紀錄。
2. 開啟 `/host/draw` 投影，按拉桿（或空白鍵、Enter、簡報筆翻頁鍵）抽出第一位；抽中的人上台拿禮物，再按「OOO 抽下一位」接力，直到籤池抽完。
3. 被抽中的人如果手機開著大廳或遊戲頁，會在拉霸動畫結束時跳出「你被抽中了！」；沒連線的人一樣抽得到。

實作重點：

- 抽中的人由 `draw_next` 在伺服器隨機決定並記下順序，畫面再用滾輪動畫停到那個人身上。
- 最新結果寫在 `draw_state`（只有一列）以 Realtime 推給手機，帶 `reveal_at`，手機等動畫結束才顯示。
- 音效用 Web Audio 即時合成（`src/lib/sfx.ts`），畫面上可以關掉。

## 資料庫

- `players`：`id`、`name`（不分大小寫唯一、1～20 字）、`avatar`（AvatarConfig JSON）、`user_id`（`auth.users`，唯一；刪除帳號會一併刪除角色）、`created_at`、`updated_at`
- 任何人只能讀 `id, name, avatar, created_at`，讀不到 `user_id`，也不能直接寫入
- 報名、取回、修改透過 `register_player`、`get_my_player`、`update_player`，只開放給已登入的使用者，以 `auth.uid()` 找自己的那筆
- 搶答跑位：`admins`、`quiz_questions`、`games`、`game_players`、`game_answers`，說明見 `supabase/migrations/20261010000000_quiz_game.sql` 開頭；已結束的場次可在主持後台刪除（`delete_game`，連同參加者與作答紀錄）
- 接力抽禮物：`draw_entries`、`draw_state`，說明見 `supabase/migrations/20261015000000_gift_draw.sql` 開頭
- `pnpm test:db` 用 PGlite 跑所有 migration 並測試權限與 function
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
