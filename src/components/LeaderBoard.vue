<script setup lang="ts">
/** 得分排名（手機結算與主持畫面共用） */
import type { LeaderRow } from '../lib/game'
import AvatarPortrait from './AvatarPortrait.vue'

defineProps<{ rows: LeaderRow[]; meId?: string; total?: number }>()
</script>

<template>
  <ol class="board">
    <li v-for="r in rows" :key="r.id" class="win" :class="[`r${r.rank}`, { me: r.id === meId }]">
      <span class="rank">{{ r.rank }}</span>
      <AvatarPortrait :config="r.avatar" :label="r.name" />
      <b class="name">{{ r.name }}<span v-if="r.id === meId" class="you">（你）</span></b>
      <span class="score">{{ r.score }}<small v-if="total"> / {{ total }}</small></span>
    </li>
  </ol>
</template>

<style scoped>
.board {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.board li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  min-width: 0;
}
.board li.me {
  box-shadow:
    0 0 0 2px var(--outline),
    0 0 0 4.5px var(--gold),
    0 0 0 6.5px var(--outline),
    0 0 18px var(--gold-glow),
    0 10px 24px -6px rgba(10, 16, 26, 0.4);
}
.rank {
  flex: none;
  width: 1.9em;
  font-size: 22px;
  text-align: center;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.18);
}
.r1 .rank {
  color: #e6a800;
  text-shadow: 0 0 10px rgba(240, 196, 77, 0.55);
}
.r2 .rank {
  color: #7c95ad;
}
.r3 .rank {
  color: #c27229;
}
.board canvas {
  width: 32px;
  height: 50px;
  flex: none;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.22));
}
.name {
  flex: 1;
  min-width: 0;
  font-weight: normal;
  overflow-wrap: anywhere;
}
.you {
  font-size: 13px;
  color: var(--gold-lo);
}
.score {
  flex: none;
  font-size: 22px;
  color: var(--gold-lo);
}
@media (prefers-color-scheme: dark) {
  .r1 .rank,
  .score {
    color: var(--gold);
  }
}
.score small {
  font-size: 13px;
  color: var(--muted);
}
</style>
