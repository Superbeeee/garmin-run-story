<script setup lang="ts">
/** 素材來源與授權：LPC 授權要求列出作者與授權，不可省略 */
import credits from '../assets/credits.json'
</script>

<template>
  <footer class="credits">
    <h2>素材來源與授權</h2>
    <p>
      角色素材來自
      <a href="https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator" target="_blank" rel="noopener">Universal LPC Spritesheet Character Generator</a>
      與 <a href="https://opengameart.org/" target="_blank" rel="noopener">OpenGameArt</a> 的 Liberated Pixel Cup 系列，本站經過裁切與重新上色，修改後的圖同樣依原授權釋出。
      各素材依其授權（OGA-BY 3.0、CC-BY-SA 3.0、GPL 3.0 等）使用，作者如下。表情頭頂的小圖示為本站自繪。
    </p>
    <ul>
      <li v-for="c in credits" :key="c.file">
        <span class="file">{{ c.file }}</span>：{{ c.authors.join(', ') }}（{{ c.licenses.join(' / ') }}）
        <span class="src">
          來源<a v-for="(u, i) in c.urls" :key="u" :href="u" target="_blank" rel="noopener" :aria-label="`${c.file} 來源 ${i + 1}`">{{ i + 1 }}</a>
        </span>
      </li>
    </ul>
  </footer>
</template>

<style scoped>
.credits {
  font-size: 13px;
  color: var(--muted);
  border-top: 1px solid var(--line);
  padding-top: 16px;
}
h2 {
  font-size: 15px;
  font-weight: 500;
  color: var(--ink);
  margin: 0 0 6px;
}
p {
  margin: 0 0 10px;
  max-width: 80ch;
}
ul {
  margin: 0;
  padding-left: 18px;
  columns: 2;
  column-gap: 28px;
}
li {
  break-inside: avoid;
  margin-bottom: 6px;
  overflow-wrap: anywhere;
}
.src {
  margin-left: 0.3em;
}
.src a {
  margin-left: 0.45em;
}
@media (max-width: 820px) {
  ul {
    columns: 1;
  }
}
</style>
