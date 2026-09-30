import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './style.css'

// Google 不允許在 LINE 內建瀏覽器登入：加上 LINE 的參數改用手機預設瀏覽器開啟
const url = new URL(location.href)
if (/ Line\//i.test(navigator.userAgent) && !url.searchParams.has('openExternalBrowser')) {
  url.searchParams.set('openExternalBrowser', '1')
  location.replace(url)
} else {
  createApp(App).use(router).mount('#app')
}
