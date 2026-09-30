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
  padding: 6px 14px;
  min-width: 0;
}
.board li.me {
  outline: 4px solid var(--gold);
  outline-offset: 4px;
}
.rank {
  flex: none;
  width: 1.8em;
  font-size: 22px;
  text-align: center;
}
.r1 .rank {
  color: #d9a400;
}
.r2 .rank {
  color: #8a9bb0;
}
.r3 .rank {
  color: var(--gold-lo);
}
.board canvas {
  width: 32px;
  height: 50px;
  flex: none;
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
}
.score small {
  font-size: 13px;
  color: var(--muted);
}
</style>
