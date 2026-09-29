<template>
  <!-- 報名與修改共用同一個頁面元件，以路由名稱為 key 確保切換時重新建立 -->
  <RouterView v-slot="{ Component, route }">
    <component :is="Component" :key="route.name" />
  </RouterView>
</template>
