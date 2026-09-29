import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { getRegistration } from './lib/registration'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'signup',
    component: () => import('./pages/SignupPage.vue'),
    props: { mode: 'new' },
    // 這台裝置已報名過就直接看自己的角色
    beforeEnter: () => (getRegistration() ? { name: 'done' } : true),
  },
  {
    path: '/edit',
    name: 'edit',
    component: () => import('./pages/SignupPage.vue'),
    props: { mode: 'edit' },
    beforeEnter: () => (getRegistration() ? true : { name: 'signup' }),
  },
  {
    path: '/done',
    name: 'done',
    component: () => import('./pages/DonePage.vue'),
    beforeEnter: () => (getRegistration() ? true : { name: 'signup' }),
  },
  { path: '/roster', name: 'roster', component: () => import('./pages/RosterPage.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

if (import.meta.env.DEV) {
  routes.unshift({ path: '/dev', name: 'dev', component: () => import('./pages/DevPage.vue') })
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})
