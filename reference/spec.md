我要把一個已完成的「跑者紙娃娃」原型改寫成正式專案。原型是單一 HTML 檔，放在 reference/runner-avatar-lpc.html，請先完整讀過它，行為以原型為準。

## 專案背景
這是我每年舉辦的聖誕節交換禮物活動（參加者都是跑者）。今年分兩階段：
1. 事前預約（活動前一個月發連結）：輸入名字 + 捏自己的像素紙娃娃，完成即報名成功。
2. 活動當天：大家用自己的紙娃娃玩遊戲（之後再做，這次先不做，但架構要預留）。

本次範圍只做第一階段：捏臉 + 報名 + 資料存到後端。

## 技術選型
- Vue 3 + Vite + TypeScript（Composition API、<script setup>）
- 角色渲染用 Canvas 2D（沿用原型做法，imageSmoothingEnabled = false，CSS image-rendering: pixelated）
- 後端：Supabase（Postgres），前端用 @supabase/supabase-js
- 部署目標：Vercel
- 套件管理：pnpm

## 素材管線（最重要）
素材來自 Universal LPC Spritesheet Character Generator：
https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
請寫一個 Node 腳本 scripts/build-assets.ts，做以下事情：
1. 用 sparse checkout（--filter=blob:none）只抓需要的 spritesheets 與 sheet_definitions、palette_definitions，不要整包 clone。
2. 每張 LPC 精靈圖是 64×64 一格，列順序為 上、左、下、右。
   - idle / walk / run / jump 四個動作，只取第 3 列（面向右），向左時由程式水平翻轉。
   - 另外取 idle 的第 2 列第 0 格（面向正面）作為正面大圖用。
3. 裁切後輸出到 public/sprites/{layerKey}/{anim}.png 與 front.png，並產生 src/assets/manifest.json 列出所有圖層。
4. 從 sheet_definitions 的 credits 欄位整理出使用到的每個素材的作者、授權、來源網址，輸出 src/assets/credits.json。頁面底部必須顯示完整作者與授權（CC-BY-SA 3.0 / OGA-BY 3.0 / GPL 3.0 等），這是授權要求，不可省略。
5. 腳本要可重複執行，素材清單集中寫在一個設定檔 scripts/assets.config.ts，之後加減髮型、衣服只改這裡。

目前使用的素材清單請以原型內嵌的 DATA.layers 鍵值為準，包含：
- 身體：male、female、muscular、teen
- 頭：male、male_plump、male_small、female、female_small
- 表情（male / female 各一套）：neutral、happy、blush、closed、closing、anger、sad、shock、eyeroll、shame
- 髮型：原型中 HAIR_BY 的男女清單（部分有 bg 後髮層）
- 上衣：singlet、tshirt（male / female / teen），scoop、vneck、tscoop、lscoop（female / teen）
- 褲子：shortshorts、shorts、leggings（male / thin）
- 鞋子：basic（male / thin）
- 配件：thick headband

## 換色
用調色盤替換（palette swap），不要預先產生每種顏色的圖：
- 身體、頭、表情：基準色為 body_ulpc 的 light，替換成選擇的膚色；眼睛基準色 #2a3c49 #5686ae #57cee4 替換成選擇的眼睛顏色（blue / brown / green / gray，色碼見原型 EYES）
- 頭髮：基準色為 hair_ulpc 的 orange
- 衣服、褲子、鞋子、髮帶：基準色為 cloth_ulpc 的 white
替換結果依 (圖層, 動作, 調色盤) 快取成 canvas。

## 角色系統
- 圖層 z 順序：後髮 9 → 身體 10 → 鞋 15 → 褲 20 → 上衣 35 → 頭 100 → 表情 101 → 前髮 120 → 髮帶 125
- 體型對應：male / muscular 穿 male 版衣服、male 版褲鞋；female 穿 female 版上衣、thin 版褲鞋；teen 穿 teen 版上衣、thin 版褲鞋。
- 性別決定可選的體型、臉型、髮型、上衣清單（見原型 BUILD_BY、HEAD_BY、HAIR_BY、TOP_BY），切換性別時套用 DEFAULTS。
- 動作與每格時間照原型 ANIM：idle 2 格、walk 8 格、run 8 格、jump 5 格（含 lift 位移，播完回到原動作）。
- 每 2.2～5.2 秒隨機眨眼（closing → closed → closing）。
- 表情快捷鍵 1～8：臉部表情 + 頭頂像素圖示（圖示點陣見原型 ICON_ART，自繪、非 LPC 素材），持續 2 秒；圖示位置每格從頭與頭髮圖層的 bounding box 自動計算頭頂。

請把角色渲染抽成可重用的模組（例如 src/avatar/），對外只需要傳入 AvatarConfig 與動作狀態就能畫到任意 canvas，因為第二階段的遊戲畫面會同時畫二、三十個角色。

## 資料結構
```ts
type AvatarConfig = {
  gender: 'male' | 'female'
  build: string; head: string; skin: string; eye: string; face: string
  hair: string; hairColor: string
  top: string; topColor: string
  legs: string; legsColor: string
  shoesColor: string
  band: 'none' | 'thick'; bandColor: string
}
```

Supabase 資料表 players：
- id uuid PK default gen_random_uuid()
- name text not null unique
- avatar jsonb not null
- edit_token uuid not null default gen_random_uuid()
- created_at timestamptz default now()

不做登入。報名成功後把 edit_token 存在 localStorage，之後回來可以修改自己的造型。更新必須透過一個 Postgres function 驗證 edit_token，RLS 不開放直接 update。請附上 migration SQL。

## 頁面
- 報名頁：左側正面大圖 + 跑道動畫預覽，右側造型選項，底部輸入名字與「完成報名」，版面與互動參考原型。
- 報名成功頁：顯示自己的角色與名字，提供「修改造型」。
- 管理用的名單頁（簡單列出所有已報名角色在跑道上跑，當作之後遊戲畫面的雛形），用網址參數或環境變數保護即可。
- 支援手機（大多數人會用手機點連結），深色模式跟隨系統。

## 開發方式
- 先提出目錄結構與實作計畫給我確認，再開始寫。
- 分階段完成，每階段完成後可以本機執行驗證：1) 素材腳本 2) 角色渲染模組 3) 報名頁 UI 4) Supabase 串接 5) 名單頁
- commit 訊息用繁體中文，內容不要加上任何 Claude 相關標註（不要 Co-Authored-By、不要 Generated with Claude Code）。
