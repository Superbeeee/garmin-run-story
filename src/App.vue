<script setup lang="ts">
import { useRoute } from 'vue-router'
import DrawNotice from './components/DrawNotice.vue'

const route = useRoute()
</script>

<template>
  <!-- 報名與修改共用同一個頁面元件，以路由名稱為 key 確保切換時重新建立 -->
  <RouterView v-slot="{ Component, route: r }">
    <component :is="Component" :key="r.name" />
  </RouterView>
  <!-- 已報名的人在大廳、遊戲等頁面時，被抽中會跳通知 -->
  <DrawNotice v-if="route.meta.stage === 'player'" />
</template>
