import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { getApi } from './lib/api'

/**
 * 使用者目前的階段：guest 未登入 → new 已登入未報名 → player 已報名。
 * 每個頁面標記它屬於哪個階段（meta.stage），不符合就導到該階段的頁面。
 * member 表示只要登入即可（主持後台：主持人不一定有報名角色）。
 */
type Stage = 'guest' | 'new' | 'player'
type Need = Stage | 'member'
const HOME: Record<Stage, string> = { guest: 'login', new: 'signup', player: 'lobby' }

async function currentStage(): Promise<Stage | null> {
  try {
    const api = await getApi()
    if (!(await api.getUser())) return 'guest'
    return (await api.getMine()) ? 'player' : 'new'
  } catch {
    return null // 連線失敗：留在原頁，由頁面顯示錯誤
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: () => import('./pages/LoginPage.vue'), meta: { stage: 'guest' } },
  { path: '/', name: 'signup', component: () => import('./pages/SignupPage.vue'), props: { mode: 'new' }, meta: { stage: 'new' } },
  { path: '/lobby', name: 'lobby', component: () => import('./pages/LobbyPage.vue'), meta: { stage: 'player' } },
  { path: '/edit', name: 'edit', component: () => import('./pages/SignupPage.vue'), props: { mode: 'edit' }, meta: { stage: 'player' } },
  { path: '/play', name: 'play', component: () => import('./pages/PlayJoinPage.vue'), meta: { stage: 'player' } },
  { path: '/play/:id', name: 'game', component: () => import('./pages/PlayGamePage.vue'), props: true, meta: { stage: 'player' } },
  { path: '/host', name: 'host', component: () => import('./pages/HostPage.vue'), meta: { stage: 'member' } },
  { path: '/host/draw', name: 'host-draw', component: () => import('./pages/DrawScreenPage.vue'), meta: { stage: 'member' } },
  { path: '/host/:id', name: 'host-game', component: () => import('./pages/HostScreenPage.vue'), props: true, meta: { stage: 'member' } },
  { path: '/done', redirect: '/lobby' },
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

router.beforeEach(async (to) => {
  const need = to.meta.stage as Need | undefined
  if (!need) return true
  const stage = await currentStage()
  if (!stage || stage === need || (need === 'member' && stage !== 'guest')) return true
  return { name: HOME[stage] }
})
