import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [{ path: '/', name: 'signup', component: () => import('./pages/DevPage.vue') }]

if (import.meta.env.DEV) {
  routes.push({ path: '/dev', name: 'dev', component: () => import('./pages/DevPage.vue') })
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})
