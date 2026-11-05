<script setup lang="ts">
/** 已報名角色的頭像清單（大廳與名單頁共用） */
import type { Player } from '../lib/api'
import AvatarPortrait from './AvatarPortrait.vue'

defineProps<{
  players: Player[]
  /** 標記為「你」的角色 */
  meId?: string
  /** 顯示報名時間 */
  showTime?: boolean
}>()

const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <p v-if="!players.length" class="win empty">還沒有人報名。</p>
  <ol v-else class="list">
    <li v-for="p in players" :key="p.id" class="win" :class="{ me: p.id === meId }">
      <AvatarPortrait :config="p.avatar" :label="p.name" />
      <div>
        <b>{{ p.name }}</b>
        <span v-if="p.id === meId" class="you">你</span>
        <span v-else-if="showTime" class="muted">{{ fmt(p.createdAt) }}</span>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
}
.list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  min-width: 0;
  transition: transform 140ms ease;
}
.list li:hover {
  transform: translateY(-2px);
}
.list li.me {
  box-shadow:
    0 0 0 2px var(--outline),
    0 0 0 4.5px var(--gold),
    0 0 0 6.5px var(--outline),
    0 0 18px var(--gold-glow),
    0 10px 24px -6px rgba(10, 16, 26, 0.4);
}
.empty {
  margin-top: 8px;
}
.list canvas {
  width: 40px;
  height: 62px;
  flex: none;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.22));
}
.list div {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}
.list b {
  font-weight: normal;
  overflow-wrap: anywhere;
}
.list span {
  font-size: 12px;
}
.you {
  display: inline-block;
  width: fit-content;
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--gold);
  color: var(--outline);
  font-size: 11px !important;
}
</style>
