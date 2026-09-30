<script setup lang="ts">
/** 主持後台：編輯題庫、建立場次（設定代碼）、開啟主持畫面 */
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { DEFAULT_CONFIG } from '../avatar'
import AvatarPortrait from '../components/AvatarPortrait.vue'
import { ApiError, ERROR_TEXT, getApi, type Api, type Player } from '../lib/api'
import { getDrawApi, type DrawApi, type DrawEntry } from '../lib/draw'
import { getGameApi, type GameApi, type GameState, type Question, type QuestionInput } from '../lib/game'

const router = useRouter()
let gapi: GameApi | null = null
const state = ref<'loading' | 'ready' | 'forbidden' | 'error'>('loading')
const err = ref('')
const questions = shallowRef<Question[]>([])
const games = shallowRef<GameState[]>([])

const STATUS_TEXT: Record<GameState['status'], string> = { waiting: '等待開始', question: '作答中', reveal: '公布答案', finished: '已結束' }
const TRUE_FALSE = ['是', '否']

const message = (e: unknown) => (e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network)

async function refresh() {
  if (!gapi) return
  ;[questions.value, games.value] = await Promise.all([gapi.listQuestions(), gapi.listGames()])
}

// ---------- 報名管理 ----------
let api: Api | null = null
const regs = shallowRef<(Player & { email: string })[]>([])
const regErr = ref('')
const renaming = ref<{ id: string; name: string } | null>(null)
const confirmDelete = ref<string | null>(null)
const fmtDate = (iso: string) => new Date(iso).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

async function refreshRegs() {
  if (api) regs.value = await api.adminPlayers()
}
async function saveRename() {
  const r = renaming.value
  if (!api || !r) return
  regErr.value = ''
  try {
    await api.adminRename(r.id, r.name)
    renaming.value = null
    await Promise.all([refreshRegs(), refreshPool()])
  } catch (e) {
    regErr.value = message(e)
  }
}
/** 按兩次才刪除 */
async function removePlayer(p: Player) {
  if (!api) return
  if (confirmDelete.value !== p.id) {
    confirmDelete.value = p.id
    setTimeout(() => {
      if (confirmDelete.value === p.id) confirmDelete.value = null
    }, 4000)
    return
  }
  confirmDelete.value = null
  regErr.value = ''
  try {
    await api.adminDelete(p.id)
    await Promise.all([refreshRegs(), refreshPool()])
  } catch (e) {
    regErr.value = message(e)
  }
}

// ---------- 接力抽禮物：籤池 ----------
let dapi: DrawApi | null = null
const pool = shallowRef<DrawEntry[]>([])
const drawErr = ref('')
const newName = ref('')
const confirmReset = ref(false)
const drawnCount = computed(() => pool.value.filter((e) => e.order !== null).length)
const inPool = computed(() => pool.value.filter((e) => !e.excluded && e.order === null).length)

async function refreshPool() {
  if (dapi) pool.value = await dapi.pool()
}
async function drawOp(fn: (d: DrawApi) => Promise<void>) {
  if (!dapi) return
  drawErr.value = ''
  try {
    await fn(dapi)
    await refreshPool()
  } catch (e) {
    drawErr.value = message(e)
  }
}
async function addName() {
  const n = newName.value
  await drawOp((d) => d.addName(n))
  if (!drawErr.value) newName.value = ''
}
async function reset() {
  if (!confirmReset.value) {
    confirmReset.value = true
    setTimeout(() => (confirmReset.value = false), 4000)
    return
  }
  confirmReset.value = false
  await drawOp((d) => d.reset())
}

onMounted(async () => {
  try {
    gapi = await getGameApi()
    if (!(await gapi.isAdmin())) {
      state.value = 'forbidden'
      return
    }
    dapi = await getDrawApi()
    api = await getApi()
    await Promise.all([refresh(), refreshPool(), refreshRegs()])
    state.value = 'ready'
  } catch (e) {
    err.value = message(e)
    state.value = 'error'
  }
})

// ---------- 題目編輯 ----------
type Kind = 'tf' | 'choice'
interface Draft {
  id?: string
  position: number
  kind: Kind
  prompt: string
  choices: string[]
  answer: number
  seconds: number
}
const editing = ref<Draft | null>(null)
const formErr = ref('')
const busy = ref(false)

function blank(): Draft {
  const last = questions.value.at(-1)
  return { position: (last?.position ?? 0) + 1, kind: 'tf', prompt: '', choices: [...TRUE_FALSE], answer: 0, seconds: 15 }
}
function edit(q: Question) {
  const tf = q.choices.length === 2 && q.choices.every((c, i) => c === TRUE_FALSE[i])
  editing.value = { ...q, kind: tf ? 'tf' : 'choice', choices: [...q.choices] }
  formErr.value = ''
}
function startNew() {
  editing.value = blank()
  formErr.value = ''
}
function setKind(d: Draft, kind: Kind) {
  d.kind = kind
  d.choices = kind === 'tf' ? [...TRUE_FALSE] : ['', '', '', '']
  d.answer = 0
}
function removeChoice(d: Draft, i: number) {
  d.choices.splice(i, 1)
  if (d.answer >= d.choices.length) d.answer = 0
  else if (d.answer > i) d.answer--
}

async function save() {
  const d = editing.value
  if (!d || !gapi) return
  const choices = d.choices.map((c) => c.trim())
  if (!d.prompt.trim()) return void (formErr.value = '請輸入題目。')
  if (choices.some((c) => !c)) return void (formErr.value = '選項不能空白。')
  if (choices.some((c) => c.length > 40)) return void (formErr.value = '每個選項最多 40 個字。')
  const q: QuestionInput = { id: d.id, position: d.position, prompt: d.prompt.trim(), choices, answer: d.answer, seconds: d.seconds }
  busy.value = true
  try {
    await gapi.saveQuestion(q)
    editing.value = null
    await refresh()
  } catch (e) {
    formErr.value = message(e)
  } finally {
    busy.value = false
  }
}

async function remove(q: Question) {
  if (!gapi) return
  try {
    await gapi.deleteQuestion(q.id)
    await refresh()
  } catch (e) {
    err.value = message(e)
  }
}

/** 與相鄰題目交換順序 */
async function move(i: number, delta: number) {
  const list = questions.value
  const a = list[i]
  const b = list[i + delta]
  if (!gapi || !a || !b) return
  // 位置相同時（例如都是預設值）先拉開
  const [pa, pb] = a.position === b.position ? [i + delta, i] : [b.position, a.position]
  try {
    await Promise.all([gapi.saveQuestion({ ...a, position: pa }), gapi.saveQuestion({ ...b, position: pb })])
    await refresh()
  } catch (e) {
    err.value = message(e)
  }
}

// ---------- 場次 ----------
const code = ref('')
const gameErr = ref('')
const activeGames = computed(() => games.value.filter((g) => g.status !== 'finished'))
const pastGames = computed(() => games.value.filter((g) => g.status === 'finished').slice(0, 5))
const confirmGameDelete = ref<string | null>(null)

/** 刪除已結束的場次；按兩次才刪除 */
async function deleteGame(g: GameState) {
  if (!gapi) return
  if (confirmGameDelete.value !== g.id) {
    confirmGameDelete.value = g.id
    setTimeout(() => {
      if (confirmGameDelete.value === g.id) confirmGameDelete.value = null
    }, 4000)
    return
  }
  confirmGameDelete.value = null
  gameErr.value = ''
  try {
    await gapi.deleteGame(g.id)
    games.value = games.value.filter((x) => x.id !== g.id)
  } catch (e) {
    gameErr.value = message(e)
  }
}

async function createGame() {
  if (!gapi) return
  gameErr.value = ''
  busy.value = true
  try {
    const id = await gapi.createGame(code.value)
    router.push({ name: 'host-game', params: { id } })
  } catch (e) {
    gameErr.value = message(e)
    busy.value = false
  }
}
</script>

<template>
  <main class="wrap">
    <h1 class="title">主持後台</h1>
    <p v-if="state === 'loading'" class="note">讀取中<span class="cursor">…</span></p>
    <section v-else-if="state === 'forbidden'" class="win box">
      <p>這個帳號不是主持人。請在 Supabase 的 <code>admins</code> 資料表加入你的 Google email。</p>
      <RouterLink class="btn" to="/lobby">▶ 回到大廳</RouterLink>
    </section>
    <section v-else-if="state === 'error'" class="win box">
      <p>{{ err }}</p>
    </section>

    <template v-else>
      <p v-if="err" class="err" role="alert">{{ err }}</p>

      <!-- 場次 -->
      <section class="win box">
        <span class="win-tag">搶答跑位 · 場次</span>
        <form class="row" novalidate @submit.prevent="createGame">
          <input v-model="code" class="field code" maxlength="12" autocapitalize="characters" placeholder="代碼，例如 XMAS" aria-label="遊戲代碼" />
          <button class="btn" type="submit" :disabled="busy || !questions.length">建立場次</button>
        </form>
        <p class="hint muted">建立時會依目前題庫的順序出題（共 {{ questions.length }} 題）。代碼 2～12 個英文字母或數字。</p>
        <p class="err" role="alert">{{ gameErr }}</p>
        <ul v-if="activeGames.length || pastGames.length" class="games">
          <li v-for="g in [...activeGames, ...pastGames]" :key="g.id">
            <b class="gcode">{{ g.code }}</b>
            <span class="muted">{{ STATUS_TEXT[g.status] }}<template v-if="g.qIndex >= 0 && g.status !== 'finished'">（第 {{ g.qIndex + 1 }}/{{ g.qTotal }} 題）</template></span>
            <RouterLink v-if="g.status !== 'finished'" class="btn ghost small" :to="{ name: 'host-game', params: { id: g.id } }">開啟主持畫面</RouterLink>
            <template v-else>
              <RouterLink class="small" :to="{ name: 'host-game', params: { id: g.id } }">看排名</RouterLink>
              <button class="btn ghost small" type="button" @click="deleteGame(g)">{{ confirmGameDelete === g.id ? '確定刪除？' : '刪除' }}</button>
            </template>
          </li>
        </ul>
      </section>

      <!-- 題庫 -->
      <section class="win box">
        <span class="win-tag">題庫（{{ questions.length }} 題）</span>
        <ol class="questions">
          <li v-for="(q, i) in questions" :key="q.id">
            <div class="q">
              <b>{{ i + 1 }}. {{ q.prompt }}</b>
              <span class="muted">
                <template v-for="(c, j) in q.choices" :key="j">
                  <span :class="{ right: j === q.answer }">{{ 'ABCD'[j] }}. {{ c }}</span>{{ ' ' }}
                </template>
                · {{ q.seconds }} 秒
              </span>
            </div>
            <div class="ops">
              <button class="btn ghost small" type="button" :disabled="i === 0" aria-label="上移" @click="move(i, -1)">↑</button>
              <button class="btn ghost small" type="button" :disabled="i === questions.length - 1" aria-label="下移" @click="move(i, 1)">↓</button>
              <button class="btn ghost small" type="button" @click="edit(q)">編輯</button>
              <button class="btn ghost small" type="button" @click="remove(q)">刪除</button>
            </div>
          </li>
        </ol>
        <p v-if="!questions.length" class="muted">還沒有題目。</p>

        <form v-if="editing" class="editor" novalidate @submit.prevent="save">
          <h2>{{ editing.id ? '編輯題目' : '新增題目' }}</h2>
          <div class="kinds" role="radiogroup" aria-label="題型">
            <button type="button" class="btn small" :class="{ ghost: editing.kind !== 'tf' }" @click="setKind(editing, 'tf')">是非題</button>
            <button type="button" class="btn small" :class="{ ghost: editing.kind !== 'choice' }" @click="setKind(editing, 'choice')">選擇題</button>
          </div>
          <label>題目<textarea v-model="editing.prompt" class="field" rows="2" maxlength="200"></textarea></label>
          <fieldset>
            <legend>選項（點左邊的圓圈設為正確答案）</legend>
            <div v-for="(_, i) in editing.choices" :key="i" class="choice">
              <input v-model="editing.answer" type="radio" name="answer" :value="i" :aria-label="`${'ABCD'[i]} 為正確答案`" />
              <span class="tag">{{ 'ABCD'[i] }}</span>
              <input v-model="editing.choices[i]" class="field" maxlength="40" :readonly="editing.kind === 'tf'" :aria-label="`選項 ${'ABCD'[i]}`" />
              <button
                v-if="editing.kind === 'choice' && editing.choices.length > 2"
                type="button"
                class="btn ghost small"
                aria-label="刪除選項"
                @click="removeChoice(editing, i)"
              >
                ✕
              </button>
            </div>
            <button v-if="editing.kind === 'choice' && editing.choices.length < 4" type="button" class="btn ghost small" @click="editing.choices.push('')">+ 選項</button>
          </fieldset>
          <label class="inline">作答秒數<input v-model.number="editing.seconds" class="field sec" type="number" min="5" max="120" /></label>
          <p class="err" role="alert">{{ formErr }}</p>
          <div class="row">
            <button class="btn" type="submit" :disabled="busy">儲存</button>
            <button class="btn ghost" type="button" @click="editing = null">取消</button>
          </div>
        </form>
        <button v-else class="btn add" type="button" @click="startNew">+ 新增題目</button>
      </section>

      <!-- 接力抽禮物 -->
      <section class="win box">
        <span class="win-tag">接力抽禮物 · 籤池</span>
        <div class="row">
          <RouterLink class="btn" :to="{ name: 'host-draw' }">開啟抽籤畫面</RouterLink>
          <span class="muted">籤池 {{ inPool }} 人 · 已抽 {{ drawnCount }} 人</span>
        </div>
        <p class="hint muted">所有報名的人會自動加入籤池；取消勾選的人不會被抽到。抽過的人可以「放回」重新抽。</p>
        <form class="row add-name" novalidate @submit.prevent="addName">
          <input v-model="newName" class="field" maxlength="20" placeholder="手動加入沒報名的人" aria-label="名字" />
          <button class="btn ghost" type="submit">加入</button>
        </form>
        <p class="err" role="alert">{{ drawErr }}</p>
        <ul class="pool">
          <li v-for="e in pool" :key="e.id" :class="{ off: e.excluded && e.order === null }">
            <label class="pick">
              <input type="checkbox" :checked="!e.excluded" :aria-label="`${e.name} 列入籤池`" @change="drawOp((d) => d.setExcluded(e.id, !e.excluded))" />
              <AvatarPortrait :config="e.avatar ?? DEFAULT_CONFIG" :label="e.name" />
              <span class="pname">{{ e.name }}<small v-if="!e.playerId" class="muted">（手動）</small></span>
            </label>
            <span v-if="e.order !== null" class="drawn">第 {{ e.order }} 位</span>
            <button v-if="e.order !== null" class="btn ghost small" type="button" @click="drawOp((d) => d.putBack(e.id))">放回</button>
            <button v-if="!e.playerId" class="btn ghost small" type="button" @click="drawOp((d) => d.removeName(e.id))">刪除</button>
          </li>
        </ul>
        <p v-if="!pool.length" class="muted">還沒有人報名。</p>
        <div class="row reset">
          <button class="btn ghost small" type="button" :disabled="!drawnCount" @click="reset">{{ confirmReset ? '確定要重設？再按一次' : '重設抽籤紀錄' }}</button>
          <button class="btn ghost small" type="button" @click="drawOp(async () => {})">重新整理</button>
        </div>
      </section>

      <!-- 報名管理 -->
      <section class="win box">
        <span class="win-tag">報名管理（{{ regs.length }} 人）</span>
        <p class="hint muted">刪除會一併移出遊戲紀錄與籤池；本人之後可以用同一個 Google 帳號重新報名。</p>
        <p class="err" role="alert">{{ regErr }}</p>
        <ul class="regs">
          <li v-for="p in regs" :key="p.id">
            <AvatarPortrait :config="p.avatar" :label="p.name" />
            <form v-if="renaming?.id === p.id" class="rename" novalidate @submit.prevent="saveRename">
              <input v-model="renaming.name" class="field" maxlength="30" aria-label="新名字" />
              <button class="btn small" type="submit">儲存</button>
              <button class="btn ghost small" type="button" @click="renaming = null">取消</button>
            </form>
            <div v-else class="reg">
              <b>{{ p.name }}</b>
              <span class="muted">{{ p.email || '（沒有 email）' }} · {{ fmtDate(p.createdAt) }}</span>
            </div>
            <div v-if="renaming?.id !== p.id" class="ops">
              <button class="btn ghost small" type="button" @click="(renaming = { id: p.id, name: p.name }), (regErr = '')">改名</button>
              <button class="btn ghost small" type="button" @click="removePlayer(p)">{{ confirmDelete === p.id ? '確定刪除？' : '刪除' }}</button>
            </div>
          </li>
        </ul>
        <p v-if="!regs.length" class="muted">還沒有人報名。</p>
      </section>

      <RouterLink to="/lobby" class="back">← 回到大廳</RouterLink>
    </template>
  </main>
</template>

<style scoped>
.wrap {
  max-width: 820px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}
.note,
.back {
  color: var(--title);
  text-shadow: var(--text-outline);
}
.back {
  display: inline-block;
  margin-top: 24px;
}
.box {
  margin-top: 28px;
  padding: 20px 18px 16px;
}
.box p {
  margin: 0 0 10px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.field {
  font: inherit;
  font-family: var(--font-text);
  color: var(--ink);
  background: var(--panel-2);
  border: 2px solid var(--outline);
  padding: 6px 10px;
  min-width: 0;
}
.code {
  flex: 1;
  font-family: var(--font-pixel);
  font-size: 20px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.hint {
  margin-top: 8px !important;
  font-size: 13px;
}
.err {
  color: var(--danger);
  font-size: 14px;
  min-height: 1em;
}
.small {
  font-size: 13px;
  padding: 4px 10px;
}
.games {
  list-style: none;
  margin: 0;
  padding: 0;
}
.games li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 2px dashed var(--panel-lo);
}
.gcode {
  font-weight: normal;
  font-size: 18px;
  letter-spacing: 0.1em;
}
.games .muted {
  flex: 1;
}
.questions {
  list-style: none;
  margin: 0;
  padding: 0;
}
.questions li {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 2px dashed var(--panel-lo);
}
.q {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.q b {
  font-weight: normal;
  overflow-wrap: anywhere;
}
.q .muted {
  font-size: 13px;
}
.right {
  color: var(--green-lo);
  text-decoration: underline;
}
.ops {
  flex: none;
  display: flex;
  gap: 6px;
}
.editor {
  margin-top: 16px;
  padding-top: 8px;
  display: grid;
  gap: 12px;
}
.editor h2 {
  margin: 0;
  font-size: 18px;
}
.editor label {
  display: grid;
  gap: 4px;
}
.editor label.inline {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sec {
  width: 5em;
}
.kinds {
  display: flex;
  gap: 8px;
}
fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
legend {
  margin-bottom: 6px;
}
.choice {
  display: flex;
  align-items: center;
  gap: 8px;
}
.choice .field {
  flex: 1;
}
.choice input[type='radio'] {
  width: 20px;
  height: 20px;
  accent-color: var(--green);
}
.tag {
  flex: none;
  width: 1.4em;
  text-align: center;
}
.add {
  margin-top: 14px;
}
.add-name {
  margin-top: 10px;
}
.add-name .field {
  flex: 1;
}
.pool {
  list-style: none;
  margin: 0;
  padding: 0;
}
.pool li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 2px dashed var(--panel-lo);
}
.pool li.off {
  opacity: 0.5;
}
.pick {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.pick input {
  width: 20px;
  height: 20px;
  accent-color: var(--green);
  flex: none;
}
.pick canvas {
  width: 26px;
  height: 40px;
  flex: none;
}
.pname {
  overflow-wrap: anywhere;
}
.pname small {
  font-size: 12px;
}
.drawn {
  flex: none;
  padding: 2px 8px;
  font-size: 13px;
  color: #fff;
  background: var(--red);
}
.reset {
  margin-top: 12px;
}
.regs {
  list-style: none;
  margin: 0;
  padding: 0;
}
.regs li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 2px dashed var(--panel-lo);
}
.regs canvas {
  width: 26px;
  height: 40px;
  flex: none;
}
.reg {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.reg b {
  font-weight: normal;
  overflow-wrap: anywhere;
}
.reg .muted {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.rename {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.rename .field {
  flex: 1;
  min-width: 8em;
}
@media (max-width: 560px) {
  .questions li {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
