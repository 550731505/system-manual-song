<template>
  <div :class="['manual-kb', { 'is-embed': embed }]">
    <template v-if="!kb">
      <div class="kb-missing">
        <div class="kb-missing-title">没有找到「{{ systemId }}」的手册</div>
        <div class="kb-missing-desc">
          请确认 src/systems/{{ systemId }} 目录下存在 config.json 与 data/kb.json，
          或返回<router-link to="/">手册首页</router-link>。
        </div>
      </div>
    </template>

    <template v-else>
      <!-- 顶部说明（嵌入业务系统时隐藏） -->
      <div v-if="!embed" class="kb-header">
        <div class="kb-header-main">
          <h2 class="kb-title">{{ kb.title }}</h2>
          <p class="kb-subtitle">{{ kb.subtitle }}</p>
        </div>
        <div class="kb-header-stat">
          共 <b>{{ kb.entries.length }}</b> 条答疑 ·
          另有 <b>{{ kb.gaps.length }}</b> 项手册未覆盖 ·
          <router-link to="/" class="kb-back">全部手册</router-link>
        </div>
      </div>

      <!-- 角色切换 + 搜索 + 浏览/问答切换 -->
      <div class="kb-toolbar">
        <div v-if="kb.roles.length > 1" class="kb-roles">
          <button
            v-for="role in kb.roles"
            :key="role.id"
            type="button"
            :class="['kb-role-btn', { active: role.id === currentRole }]"
            @click="changeRole(role.id)"
          >
            {{ role.name }}
          </button>
        </div>

        <div v-if="mode === 'browse'" class="kb-search">
          <svg class="kb-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            v-model="query"
            type="text"
            class="kb-search-input"
            placeholder="描述你遇到的问题，例如：房源核验不通过、门店提交后怎么改"
            @input="onSearchInput"
          />
          <span v-if="query" class="kb-search-clear" @click="clearQuery">&times;</span>
        </div>

        <div class="kb-mode-switch">
          <button
            type="button"
            :class="['kb-mode-btn', { active: mode === 'browse' }]"
            @click="setMode('browse')"
          >
            浏览手册
          </button>
          <button
            type="button"
            :class="['kb-mode-btn', { active: mode === 'qa' }]"
            @click="setMode('qa')"
          >
            智能问答
          </button>
        </div>
      </div>

      <!-- 智能问答 -->
      <div v-if="mode === 'qa'" class="kb-qa">
        <manual-chat
          :kb="kb"
          :role="currentRole"
          :shots-of="shotsOf"
          @preview="openLightbox"
        />
      </div>

      <!-- 浏览手册 -->
      <div v-else class="kb-body">
        <aside class="kb-aside">
          <div :class="['kb-side-item', { active: !category }]" @click="selectCategory(null)">
            <span>全部问题</span>
            <span class="kb-side-count">{{ roleEntries.length }}</span>
          </div>
          <div
            v-for="item in modules"
            :key="item.name"
            :class="['kb-side-item', { active: category === item.name }]"
            @click="selectCategory(item.name)"
          >
            <span>{{ item.name }}</span>
            <span class="kb-side-count">{{ item.count }}</span>
          </div>
        </aside>

        <main class="kb-main">
          <!-- 搜索结果 -->
          <template v-if="searchMode">
            <div class="kb-section-title">
              搜索结果
              <span class="kb-section-sub" v-if="searchResults.length">
                关键词「{{ query.trim() }}」找到 {{ searchResults.length }} 条
              </span>
            </div>
            <template v-if="searchResults.length">
              <article v-for="entry in searchResults" :key="entry.id" class="kb-card">
                <entry-card :entry="entry" :role="currentRole" :shots-of="shotsOf" @preview="openLightbox" />
              </article>
            </template>
            <template v-else>
              <div class="kb-uncovered">
                <svg class="kb-uncovered-icon" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
                <div class="kb-uncovered-title">手册暂未覆盖这个问题</div>
                <div class="kb-uncovered-desc">
                  操作手册里没有对应的说明，建议联系系统管理员或对应管理部门确认。
                </div>
                <div v-if="relatedGaps.length" class="kb-uncovered-block">
                  <div class="kb-uncovered-block-title">手册未覆盖的相关说明</div>
                  <div v-for="gap in relatedGaps" :key="gap.topic" class="kb-gap-item">
                    <span :class="['kb-risk', gap.risk === '中' ? 'is-mid' : '']">{{ gap.risk }}</span>
                    <span><b>{{ gap.topic }}</b>：{{ gap.detail }}</span>
                  </div>
                </div>
                <div class="kb-uncovered-block">
                  <div class="kb-uncovered-block-title">你可能还想问</div>
                  <ul class="kb-recommend">
                    <li v-for="entry in recommendEntries" :key="entry.id" @click="askEntry(entry)">
                      {{ entry.title }}
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </template>

          <!-- 分类查看 -->
          <template v-else-if="category">
            <div class="kb-section-title">
              {{ category }}
              <span class="kb-section-sub">{{ categoryEntries.length }} 条</span>
            </div>
            <article v-for="entry in categoryEntries" :key="entry.id" class="kb-card">
              <entry-card :entry="entry" :role="currentRole" :shots-of="shotsOf" @preview="openLightbox" />
            </article>
          </template>

          <!-- 默认：高频问题 + 按模块分组 -->
          <template v-else>
            <div class="kb-section-title">
              高频问题
              <span class="kb-section-sub">先看最常被问到的几条</span>
            </div>
            <article v-for="entry in hotEntries" :key="entry.id" class="kb-card">
              <entry-card :entry="entry" :role="currentRole" :shots-of="shotsOf" @preview="openLightbox" />
            </article>

            <div v-for="group in groupedModules" :key="group.name" class="kb-group">
              <div class="kb-group-title">
                <span class="kb-dot"></span>{{ group.name }}
                <span class="kb-section-sub">{{ group.entries.length }} 条</span>
              </div>
              <article v-for="entry in group.entries" :key="entry.id" class="kb-card">
                <entry-card :entry="entry" :role="currentRole" :shots-of="shotsOf" @preview="openLightbox" />
              </article>
            </div>
          </template>

          <!-- 底部免责声明 -->
          <div class="kb-disclaimer">{{ kb.disclaimer }}</div>
        </main>
      </div>

      <!-- 截图预览 -->
      <div v-if="lightbox.open" class="kb-lightbox" @click.self="closeLightbox">
        <button v-if="lightbox.list.length > 1" type="button" class="kb-lb-btn kb-lb-prev" @click.stop="moveLightbox(-1)">&lsaquo;</button>
        <img :src="lightbox.list[lightbox.index]" class="kb-lb-img" alt="操作截图" />
        <button v-if="lightbox.list.length > 1" type="button" class="kb-lb-btn kb-lb-next" @click.stop="moveLightbox(1)">&rsaquo;</button>
        <div v-if="lightbox.list.length > 1" class="kb-lb-counter">
          {{ lightbox.index + 1 }} / {{ lightbox.list.length }}
        </div>
        <button type="button" class="kb-lb-close" @click.stop="closeLightbox">&times;</button>
      </div>
    </template>
  </div>
</template>

<script>
import { getSystem } from '@/systems'
import EntryCard from '@/components/EntryCard.vue'
import ManualChat from '@/components/ManualChat.vue'
import { searchHits, matchGaps } from '@/utils/manualSearch'

const HOT_LIMIT = 6

export default {
  name: 'ManualPage',
  components: { EntryCard, ManualChat },
  props: {
    systemId: { type: String, required: true },
    embed: { type: Boolean, default: false },
    qa: { type: Boolean, default: false }
  },
  data() {
    const system = getSystem(this.systemId)
    return {
      system: system,
      currentRole: system && system.kb.roles.length ? system.kb.roles[0].id : '',
      category: null,
      query: '',
      searchMode: false,
      searchResults: [],
      lightbox: { open: false, list: [], index: 0 },
      searchTimer: null,
      mode: this.qa ? 'qa' : 'browse'
    }
  },
  computed: {
    kb() {
      return this.system ? this.system.kb : null
    },
    roleEntries() {
      const role = this.currentRole
      return this.kb.entries.filter(function (e) {
        return e.roles.indexOf(role) !== -1
      })
    },
    modules() {
      const order = []
      const counts = {}
      this.roleEntries.forEach(function (e) {
        if (!counts[e.module]) {
          counts[e.module] = 0
          order.push(e.module)
        }
        counts[e.module]++
      })
      return order.map(function (name) {
        return { name: name, count: counts[name] }
      })
    },
    hotEntries() {
      const hot = this.roleEntries.filter(function (e) {
        return e.hot
      })
      const rest = this.roleEntries.filter(function (e) {
        return !e.hot
      })
      return hot.concat(rest).slice(0, HOT_LIMIT)
    },
    groupedModules() {
      const entries = this.roleEntries
      return this.modules
        .map(function (m) {
          return {
            name: m.name,
            entries: entries.filter(function (e) {
              return e.module === m.name
            })
          }
        })
        .filter(function (g) {
          return g.entries.length
        })
    },
    categoryEntries() {
      const cate = this.category
      return this.roleEntries.filter(function (e) {
        return e.module === cate
      })
    },
    relatedGaps() {
      return matchGaps(this.kb.gaps, this.query, 3)
    },
    recommendEntries() {
      const hot = this.roleEntries.filter(function (e) {
        return e.hot
      })
      return (hot.length ? hot : this.roleEntries).slice(0, 4)
    }
  },
  watch: {
    systemId() {
      this.system = getSystem(this.systemId)
      this.currentRole = this.system && this.system.kb.roles.length ? this.system.kb.roles[0].id : ''
      this.category = null
      this.clearQuery()
    },
    qa(val) {
      const next = val ? 'qa' : 'browse'
      if (this.mode !== next) this.mode = next
    }
  },
  mounted() {
    document.addEventListener('keydown', this.onKeydown)
    if (this.kb) document.title = this.kb.title
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeydown)
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },
  methods: {
    changeRole(roleId) {
      if (roleId === this.currentRole) return
      this.currentRole = roleId
      this.category = null
      this.clearQuery()
    },
    setMode(mode) {
      if (this.mode === mode) return
      this.mode = mode
      if (mode === 'qa') this.clearQuery()
      // 同步到地址栏，刷新或分享链接时保留当前模式
      const query = Object.assign({}, this.$route.query)
      if (mode === 'qa') {
        query.mode = 'qa'
      } else {
        delete query.mode
      }
      this.$router.replace({ path: this.$route.path, query: query }).catch(function () {})
    },
    selectCategory(name) {
      this.category = name
      this.searchMode = false
      this.searchResults = []
      this.query = ''
      this.scrollTop()
    },
    askEntry(entry) {
      this.query = entry.title
      this.runSearch()
      this.scrollTop()
    },
    onSearchInput() {
      // 输入防抖，避免每敲一个字就全量检索
      if (this.searchTimer) clearTimeout(this.searchTimer)
      const self = this
      this.searchTimer = setTimeout(function () {
        self.runSearch()
      }, 200)
    },
    runSearch() {
      const raw = this.query.trim()
      if (!raw) {
        this.searchMode = false
        this.searchResults = []
        return
      }
      this.searchMode = true
      this.category = null
      this.searchResults = searchHits(this.roleEntries, raw).map(function (h) {
        return h.entry
      })
      this.scrollTop()
    },
    clearQuery() {
      this.query = ''
      this.searchMode = false
      this.searchResults = []
    },
    scrollTop() {
      // 滚动当前页面（独立访问时滚 window，嵌入时滚内部容器）
      const main = this.$el.querySelector('.kb-main')
      const scroller = main && main.scrollHeight > main.clientHeight ? main : null
      if (scroller) {
        scroller.scrollTop = 0
      }
      if (window.scrollTo) window.scrollTo(0, 0)
    },
    /** 取某条答疑在指定角色手册里对应的截图地址 */
    shotsOf(entry, role) {
      const roles = this.kb.roles
      let dir = ''
      for (let i = 0; i < roles.length; i++) {
        if (roles[i].id === role) {
          dir = roles[i].dir
          break
        }
      }
      if (!dir) return []
      const nums = (entry.shots && entry.shots[role]) || []
      const list = []
      nums.forEach(function (n) {
        const name = dir + '_' + (n < 10 ? '0' + n : String(n)) + '.jpg'
        const src = this.system.shots[dir + '/' + name]
        if (src) list.push(src)
      }, this)
      return list
    },
    openLightbox(list, index) {
      this.lightbox = { open: true, list: list, index: index || 0 }
      document.body.style.overflow = 'hidden'
    },
    closeLightbox() {
      this.lightbox = { open: false, list: [], index: 0 }
      document.body.style.overflow = ''
    },
    moveLightbox(delta) {
      const total = this.lightbox.list.length
      if (total <= 1) return
      this.lightbox.index = (this.lightbox.index + delta + total) % total
    },
    onKeydown(e) {
      if (!this.lightbox.open) return
      if (e.key === 'Escape') this.closeLightbox()
      else if (e.key === 'ArrowLeft') this.moveLightbox(-1)
      else if (e.key === 'ArrowRight') this.moveLightbox(1)
    }
  }
}
</script>

<style lang="less" scoped>
.manual-kb {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f5f7fa;
  color: #1f2329;
  font-size: 14px;
}

.manual-kb.is-embed {
  min-height: 100%;
}

.kb-missing {
  margin: 60px auto;
  padding: 24px;
  max-width: 560px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(15, 32, 63, 0.06);
}

.kb-missing-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.kb-missing-desc {
  color: #86909c;
  line-height: 22px;
}

.kb-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 18px 24px 12px;
  background: linear-gradient(120deg, #1a5fd0 0%, #3e7afc 100%);
  color: #fff;
}

.kb-header-main {
  min-width: 0;
}

.kb-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  line-height: 30px;
}

.kb-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  opacity: 0.9;
}

.kb-header-stat {
  font-size: 13px;
  opacity: 0.92;
  white-space: nowrap;
}

.kb-back {
  color: #fff;
  text-decoration: underline;
}

.kb-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid #e8ecf2;
  flex-wrap: wrap;
}

.kb-roles {
  display: flex;
  background: #f2f4f8;
  border-radius: 6px;
  padding: 3px;
}

.kb-role-btn {
  border: none;
  background: transparent;
  padding: 6px 18px;
  font-size: 14px;
  color: #4e5969;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s;
}

.kb-role-btn:hover {
  color: #1a5fd0;
}

.kb-role-btn.active {
  background: #fff;
  color: #1a5fd0;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(26, 95, 208, 0.18);
}

.kb-search {
  position: relative;
  flex: 1;
  min-width: 260px;
  max-width: 620px;
}

.kb-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9aa4b2;
}

.kb-search-input {
  width: 100%;
  height: 36px;
  padding: 0 34px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  outline: none;
  font-size: 14px;
  background: #fafbfc;
  transition: all 0.2s;
}

.kb-search-input:focus {
  border-color: #3e7afc;
  background: #fff;
  box-shadow: 0 0 0 2px rgba(62, 122, 252, 0.12);
}

.kb-search-clear {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #b6bec9;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.kb-mode-switch {
  display: flex;
  margin-left: auto;
  border: 1px solid #d6e4ff;
  border-radius: 6px;
  overflow: hidden;
}

.kb-mode-btn {
  border: none;
  background: #fff;
  color: #1a5fd0;
  padding: 7px 16px;
  font-size: 14px;
  cursor: pointer;

  &.active {
    background: #1a5fd0;
    color: #fff;
  }
}

.kb-qa {
  flex: 1;
  min-height: 0;
  height: calc(100vh - 230px);
  display: flex;
  flex-direction: column;
}

.manual-kb.is-embed .kb-qa {
  height: calc(100vh - 60px);
}

.kb-body {
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 16px 24px 0;
  gap: 16px;
}

.kb-aside {
  width: 176px;
  flex: 0 0 176px;
  align-self: flex-start;
  position: sticky;
  top: 8px;
  background: #fff;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 1px 4px rgba(15, 32, 63, 0.06);
}

.kb-side-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: 6px;
  color: #4e5969;
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
}

.kb-side-item:hover {
  background: #f2f6ff;
  color: #1a5fd0;
}

.kb-side-item.active {
  background: #eaf1ff;
  color: #1a5fd0;
  font-weight: 600;
}

.kb-side-count {
  font-size: 12px;
  color: #9aa4b2;
  font-weight: normal;
}

.kb-main {
  flex: 1;
  min-width: 0;
  padding-bottom: 8px;
}

.kb-section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 4px 0 12px;
  color: #1f2329;
}

.kb-section-sub {
  font-size: 12px;
  font-weight: normal;
  color: #86909c;
  margin-left: 8px;
}

.kb-group {
  margin-top: 22px;
}

.kb-group-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.kb-dot {
  width: 6px;
  height: 14px;
  border-radius: 3px;
  background: #3e7afc;
  margin-right: 8px;
}

.kb-card {
  background: #fff;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(15, 32, 63, 0.06);
  transition: box-shadow 0.2s;
}

.kb-card:hover {
  box-shadow: 0 4px 14px rgba(15, 32, 63, 0.1);
}

.kb-uncovered {
  background: #fff;
  border-radius: 8px;
  padding: 28px 24px;
  box-shadow: 0 1px 4px rgba(15, 32, 63, 0.06);
}

.kb-uncovered-icon {
  color: #c9d1dc;
}

.kb-uncovered-title {
  font-size: 16px;
  font-weight: 600;
  margin: 10px 0 6px;
}

.kb-uncovered-desc {
  color: #86909c;
  font-size: 13px;
  line-height: 22px;
}

.kb-uncovered-block {
  margin-top: 20px;
  border-top: 1px dashed #e8ecf2;
  padding-top: 16px;
}

.kb-uncovered-block-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.kb-gap-item {
  display: flex;
  align-items: flex-start;
  line-height: 22px;
  color: #4e5969;
  font-size: 13px;
  margin-bottom: 8px;
}

.kb-risk {
  flex: 0 0 auto;
  font-size: 12px;
  padding: 0 6px;
  height: 20px;
  line-height: 20px;
  border-radius: 3px;
  background: #ffece8;
  color: #d4380d;
  margin: 1px 8px 0 0;
}

.kb-risk.is-mid {
  background: #fff7e0;
  color: #b07800;
}

.kb-recommend {
  margin: 0;
  padding-left: 0;
  list-style: none;
}

.kb-recommend li {
  color: #1a5fd0;
  cursor: pointer;
  line-height: 28px;
  font-size: 13px;
}

.kb-recommend li:hover {
  text-decoration: underline;
}

.kb-disclaimer {
  margin: 18px 0 24px;
  padding: 12px 16px;
  background: #eef2f8;
  border-radius: 6px;
  color: #86909c;
  font-size: 12px;
  line-height: 20px;
}

.kb-lightbox {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.78);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.kb-lb-img {
  max-width: 88%;
  max-height: 88%;
  border-radius: 4px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  background: #fff;
}

.kb-lb-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
}

.kb-lb-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.kb-lb-prev {
  left: 24px;
}

.kb-lb-next {
  right: 24px;
}

.kb-lb-close {
  position: absolute;
  top: 20px;
  right: 24px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.kb-lb-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.kb-lb-counter {
  position: absolute;
  bottom: 24px;
  color: #fff;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 12px;
  border-radius: 12px;
}
</style>
