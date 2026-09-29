<script setup lang="ts">
/**
 * 報名頁（mode = new）與修改造型頁（mode = edit）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  BANDS,
  BUILD_BY,
  CLOTH_COLORS,
  DEFAULT_CONFIG,
  EYE_OPTIONS,
  FACES,
  GENDERS,
  GLASSES,
  HAIR_BY,
  HAIR_COLORS,
  HATS,
  HATS_FIXED_COLOR,
  HEAD_BY,
  LEGS,
  SKINS,
  TOP_BY,
  withGender,
  type AvatarConfig,
  type Gender,
} from '../avatar'
import AvatarStage from '../components/AvatarStage.vue'
import ColorSwatches from '../components/ColorSwatches.vue'
import CreditsFooter from '../components/CreditsFooter.vue'
import OptionChips from '../components/OptionChips.vue'
import { ApiError, ERROR_TEXT, getApi } from '../lib/api'
import { NAME_MAX, nameError, normalizeName } from '../lib/name'
import { clearDraft, getDraft, getRegistration, saveDraft, saveRegistration } from '../lib/registration'

const props = defineProps<{ mode: 'new' | 'edit' }>()
const route = useRoute()
const router = useRouter()
const debug = computed(() => 'debug' in route.query)
const isEdit = computed(() => props.mode === 'edit')

const draft = isEdit.value ? null : getDraft()
const config = ref<AvatarConfig>(draft?.config ?? { ...DEFAULT_CONFIG })
const name = ref(draft?.name ?? '')
const err = ref('')
const ok = ref('')
const busy = ref(false)
/** 修改模式：先向後端取回原本的資料 */
const loadState = ref<'loading' | 'ready' | 'error'>(isEdit.value ? 'loading' : 'ready')

const gender = computed({
  get: () => config.value.gender,
  set: (g: Gender) => (config.value = withGender(config.value, g)),
})

onMounted(async () => {
  if (!isEdit.value) return
  const reg = getRegistration()
  if (!reg) return router.replace('/')
  try {
    const me = await (await getApi()).getMine(reg.id, reg.editToken)
    if (!me) throw new ApiError('forbidden')
    config.value = { ...me.avatar }
    name.value = me.name
    loadState.value = 'ready'
  } catch (e) {
    err.value = e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network
    loadState.value = 'error'
  }
})

// 報名前的草稿存在這台裝置，重新整理不會不見
watch(
  [config, name],
  () => {
    if (!isEdit.value) saveDraft(name.value, config.value)
  },
  { deep: true },
)

const nameInput = ref<HTMLInputElement>()

async function submit() {
  const n = normalizeName(name.value)
  const e = nameError(n)
  if (e) {
    err.value = e
    ok.value = ''
    nameInput.value?.focus()
    return
  }
  err.value = ''
  busy.value = true
  try {
    const api = await getApi()
    const avatar = { ...config.value }
    if (isEdit.value) {
      const reg = getRegistration()
      if (!reg) throw new ApiError('forbidden')
      await api.update(reg.id, reg.editToken, n, avatar)
      saveRegistration({ ...reg, name: n })
    } else {
      const { id, editToken } = await api.register(n, avatar)
      clearDraft()
      if (!saveRegistration({ id, editToken, name: n })) {
        ok.value = `報名成功：${n}！不過這個瀏覽器無法儲存資料（可能是私密瀏覽模式），之後將無法修改造型。`
        return
      }
    }
    router.push('/done')
  } catch (e) {
    err.value = e instanceof ApiError ? ERROR_TEXT[e.code] : ERROR_TEXT.network
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <header>
      <h1>{{ isEdit ? '修改你的跑者' : '捏一個你的跑者' }}</h1>
      <p v-if="isEdit" class="muted">改好之後按「儲存修改」，活動當天就會用新的造型登場。</p>
      <p v-else class="muted">聖誕交換禮物報名：選好造型、填上名字，按下「完成報名」就報名成功了。活動當天會用這個角色一起玩遊戲！</p>
    </header>

    <AvatarStage class="stage" :config="config" :debug="debug" sticky-on-mobile />

    <section class="panel" aria-label="造型設定">
      <p v-if="loadState === 'loading'" class="muted loading">讀取你的造型中…</p>
      <fieldset>
        <legend>性別</legend>
        <OptionChips v-model="gender" :options="GENDERS" label="性別" />
      </fieldset>
      <fieldset>
        <legend>體型與臉型</legend>
        <OptionChips v-model="config.build" :options="BUILD_BY[config.gender]" label="體型" />
        <OptionChips v-model="config.head" :options="HEAD_BY[config.gender]" label="臉型" />
      </fieldset>
      <fieldset>
        <legend>膚色</legend>
        <ColorSwatches v-model="config.skin" :options="SKINS" material="body" label="膚色" />
      </fieldset>
      <fieldset>
        <legend>預設表情與眼睛</legend>
        <OptionChips v-model="config.face" :options="FACES" label="預設表情" />
        <ColorSwatches v-model="config.eye" :options="EYE_OPTIONS" material="eye" label="眼睛顏色" />
      </fieldset>
      <fieldset>
        <legend>髮型</legend>
        <OptionChips v-model="config.hair" :options="HAIR_BY[config.gender]" label="髮型" />
        <ColorSwatches v-model="config.hairColor" :options="HAIR_COLORS" material="hair" label="髮色" />
      </fieldset>
      <fieldset>
        <legend>上衣</legend>
        <OptionChips v-model="config.top" :options="TOP_BY[config.gender]" label="上衣款式" />
        <ColorSwatches v-model="config.topColor" :options="CLOTH_COLORS" material="cloth" label="上衣顏色" />
      </fieldset>
      <fieldset>
        <legend>褲子</legend>
        <OptionChips v-model="config.legs" :options="LEGS" label="褲子款式" />
        <ColorSwatches v-model="config.legsColor" :options="CLOTH_COLORS" material="cloth" label="褲子顏色" />
      </fieldset>
      <fieldset>
        <legend>鞋子</legend>
        <ColorSwatches v-model="config.shoesColor" :options="CLOTH_COLORS" material="cloth" label="鞋子顏色" />
      </fieldset>
      <fieldset>
        <legend>帽子</legend>
        <OptionChips v-model="config.hat" :options="HATS" label="帽子" />
        <ColorSwatches
          v-if="config.hat !== 'none' && !HATS_FIXED_COLOR.has(config.hat)"
          v-model="config.hatColor"
          :options="CLOTH_COLORS"
          material="cloth"
          label="帽子顏色"
        />
      </fieldset>
      <fieldset>
        <legend>眼鏡</legend>
        <OptionChips v-model="config.glasses" :options="GLASSES" label="眼鏡" />
        <ColorSwatches v-if="config.glasses !== 'none'" v-model="config.glassesColor" :options="CLOTH_COLORS" material="cloth" label="鏡框顏色" />
      </fieldset>
      <fieldset>
        <legend>髮帶</legend>
        <OptionChips v-model="config.band" :options="BANDS" label="髮帶" />
        <ColorSwatches v-if="config.band !== 'none'" v-model="config.bandColor" :options="CLOTH_COLORS" material="cloth" label="髮帶顏色" />
      </fieldset>

      <form class="signup" novalidate @submit.prevent="submit">
        <label for="name">你的名字</label>
        <div class="row">
          <input
            id="name"
            ref="nameInput"
            v-model="name"
            @input="err = ''"
            autocomplete="off"
            enterkeyhint="done"
            :maxlength="NAME_MAX + 10"
            placeholder="例如：Eason"
            :disabled="loadState !== 'ready'"
          />
          <button class="btn" type="submit" :disabled="busy || loadState !== 'ready'">
            {{ busy ? '送出中…' : isEdit ? '儲存修改' : '完成報名' }}
          </button>
        </div>
        <div class="err" role="alert">{{ err }}</div>
        <div class="ok" aria-live="polite">{{ ok }}</div>
        <RouterLink v-if="isEdit" to="/done" class="cancel muted">取消，回到我的角色</RouterLink>
      </form>
    </section>

    <CreditsFooter class="full" />
  </div>
</template>

<style scoped>
.wrap {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 20px 48px;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}
header,
.full {
  grid-column: 1 / -1;
}
header p {
  margin: 0;
  max-width: 62ch;
}
.stage {
  position: sticky;
  top: 20px;
}
.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 6px 18px 18px;
}
.loading {
  margin: 12px 0 0;
}
fieldset {
  border: 0;
  margin: 0;
  padding: 14px 0 12px;
  border-bottom: 1px solid var(--line);
  min-width: 0;
}
legend {
  font-weight: 500;
  font-size: 14px;
  padding: 0;
  margin-bottom: 8px;
}
fieldset > :not(legend) + :not(legend) {
  margin-top: 10px;
}
.signup {
  padding-top: 16px;
}
.signup label {
  display: block;
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 6px;
}
.row {
  display: flex;
  gap: 8px;
}
.row input {
  flex: 1;
  min-width: 0;
  font: inherit;
  /* iOS 小於 16px 會自動放大畫面 */
  font-size: 16px;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 9px 12px;
}
.err {
  color: var(--danger);
  font-size: 13px;
  margin-top: 6px;
  min-height: 1em;
}
.ok {
  font-size: 14px;
  margin-top: 6px;
}
.cancel {
  display: inline-block;
  margin-top: 8px;
  font-size: 14px;
}
@media (max-width: 820px) {
  .wrap {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 20px 16px 40px;
  }
  .stage {
    position: static;
  }
  h1 {
    font-size: 24px;
  }
}
</style>
