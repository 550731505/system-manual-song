<template>
  <div class="manual-chat">
    <div ref="scroll" class="chat-scroll">
      <div v-for="msg in messages" :key="msg.id" :class="['chat-row', msg.from]">
        <div class="chat-avatar">{{ msg.from === 'bot' ? 'AI' : '我' }}</div>

        <div class="chat-bubble-wrap">
          <!-- 纯文字 -->
          <div v-if="msg.type === 'text'" class="chat-bubble chat-text">{{ msg.text }}</div>

          <!-- 命中的答疑 -->
          <div v-else-if="msg.type === 'answer'" class="chat-bubble chat-answer">
            <entry-card
              :entry="msg.entry"
              :role="role"
              :shots-of="shotsOf"
              @preview="(list, index) => $emit('preview', list, index)"
            />
            <div v-if="msg.gaps && msg.gaps.length" class="chat-gap-hint">
              <div class="chat-gap-title">手册没有写明的相关事项</div>
              <div v-for="gap in msg.gaps" :key="gap.topic" class="chat-gap-item">
                <span :class="['chat-risk', gap.risk === '中' ? 'is-mid' : '']">{{ gap.risk }}</span>
                <span><b>{{ gap.topic }}</b>：{{ gap.detail }}</span>
              </div>
            </div>
            <div v-if="msg.related && msg.related.length" class="chat-related">
              <div class="chat-related-title">相关问题</div>
              <button
                v-for="item in msg.related"
                :key="item.id"
                type="button"
                class="chat-related-item"
                @click="askEntry(item)"
              >
                {{ item.title }}
              </button>
            </div>
          </div>

          <!-- 没命中 -->
          <div v-else class="chat-bubble chat-uncovered">
            <div class="chat-uncovered-title">手册暂未覆盖这个问题</div>
            <div class="chat-uncovered-desc">
              操作手册里没有对应的说明，建议联系系统管理员或对应管理部门确认。
            </div>
            <div v-if="msg.gaps && msg.gaps.length" class="chat-gap-list">
              <div class="chat-gap-title">手册未覆盖的相关事项</div>
              <div v-for="gap in msg.gaps" :key="gap.topic" class="chat-gap-item">
                <span :class="['chat-risk', gap.risk === '中' ? 'is-mid' : '']">{{ gap.risk }}</span>
                <span><b>{{ gap.topic }}</b>：{{ gap.detail }}</span>
              </div>
            </div>
            <div v-if="msg.related && msg.related.length" class="chat-related">
              <div class="chat-related-title">你可能还想问</div>
              <button
                v-for="item in msg.related"
                :key="item.id"
                type="button"
                class="chat-related-item"
                @click="askEntry(item)"
              >
                {{ item.title }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="thinking" class="chat-row bot">
        <div class="chat-avatar">AI</div>
        <div class="chat-bubble chat-text chat-thinking">正在查手册…</div>
      </div>

      <!-- 首屏快捷提问 -->
      <div v-if="showSuggestions" class="chat-suggest">
        <div class="chat-suggest-title">你可以这样问</div>
        <button
          v-for="item in suggestions"
          :key="item.id"
          type="button"
          class="chat-suggest-item"
          @click="askEntry(item)"
        >
          {{ item.title }}
        </button>
      </div>
    </div>

    <div class="chat-input-bar">
      <input
        v-model="input"
        class="chat-input"
        type="text"
        :placeholder="'描述你遇到的问题，例如：' + examplePlaceholder"
        @keyup.enter="submit"
      />
      <button type="button" class="chat-send" :disabled="!input.trim() || thinking" @click="submit">发送</button>
    </div>
    <div class="chat-foot">回答依据手册原文并标注章节出处；手册没写的一次性说明白，不会编造。</div>
  </div>
</template>

<script>
import EntryCard from '@/components/EntryCard.vue'
import { searchHits, matchGaps } from '@/utils/manualSearch'

let seq = 0

export default {
  name: 'ManualChat',
  components: { EntryCard },
  props: {
    kb: { type: Object, required: true },
    role: { type: String, required: true },
    shotsOf: { type: Function, required: true }
  },
  data() {
    return {
      messages: [],
      input: '',
      thinking: false,
      lastQuestion: '',
      lastEntry: null
    }
  },
  computed: {
    roleEntries() {
      const role = this.role
      return this.kb.entries.filter(function (e) {
        return e.roles.indexOf(role) !== -1
      })
    },
    roleName() {
      const found = this.kb.roles.filter(r => r.id === this.role)[0]
      return found ? found.name : ''
    },
    suggestions() {
      const hot = this.roleEntries.filter(function (e) { return e.hot })
      const list = hot.length ? hot : this.roleEntries
      return list.slice(0, 4)
    },
    showSuggestions() {
      return this.messages.length <= 1 && !this.thinking
    },
    examplePlaceholder() {
      const sample = this.suggestions[0]
      return sample ? sample.title : '不知道怎么操作'
    }
  },
  watch: {
    role() {
      this.reset()
    }
  },
  mounted() {
    this.reset()
  },
  methods: {
    reset() {
      this.messages = [this.botMessage({
        type: 'text',
        text: '你好，我是' + (this.kb.title.split(' · ')[0] || '本系统') + '的操作答疑助手，当前角色：' + this.roleName +
          '。已收录 ' + this.roleEntries.length + ' 条操作答疑，直接用一句话描述你遇到的问题就行。'
      })]
      this.lastQuestion = ''
      this.lastEntry = null
      this.input = ''
      this.thinking = false
    },
    botMessage(payload) {
      seq += 1
      return Object.assign({ id: 'm' + seq, from: 'bot' }, payload)
    },
    userMessage(text) {
      seq += 1
      return { id: 'm' + seq, from: 'user', type: 'text', text: text }
    },
    submit() {
      const text = this.input.trim()
      if (!text || this.thinking) return
      this.input = ''
      this.ask(text)
    },
    askEntry(entry) {
      this.messages.push(this.userMessage(entry.title))
      this.lastQuestion = entry.title
      this.lastEntry = entry
      this.messages.push(this.botMessage({
        type: 'answer',
        entry: entry,
        related: this.pickRelated(entry)
      }))
      this.scrollToBottom()
    },
    ask(text) {
      this.messages.push(this.userMessage(text))
      this.thinking = true
      this.scrollToBottom()

      setTimeout(() => {
        // 先用原话检索
        let hits = searchHits(this.roleEntries, text)

        // 明细追问（“步骤呢/那这个在哪里点”）且原话没能查到像样的条目 → 回显上一条答案；
        // 但如果问句里带了新的业务名词（如“那监管账户怎么审”），继续走检索，避免答非所问
        if (this.lastEntry && this.isDetailFollowUp(text) && (!hits.length || hits[0].score < 6)) {
          this.messages.push(this.botMessage({
            type: 'answer',
            entry: this.lastEntry,
            gaps: [],
            related: this.pickRelated(this.lastEntry, [])
          }))
          this.lastQuestion = text
          this.thinking = false
          this.scrollToBottom()
          return
        }

        // 还是查不到，且像是追问时，拼接上一个问题再试一次
        if (!hits.length) {
          const enriched = this.enrichQuery(text)
          if (enriched !== text) hits = searchHits(this.roleEntries, enriched)
        }

        if (hits.length) {
          const top = hits[0].entry
          this.lastEntry = top
          this.messages.push(this.botMessage({
            type: 'answer',
            entry: top,
            // 命中了答案，但问题里还带出“手册没写”的部分（如比例标准、办理时限），一并提示
            gaps: matchGaps(this.kb.gaps, text, 2, 4, true),
            related: this.pickRelated(top, hits.slice(1).map(h => h.entry))
          }))
        } else {
          this.messages.push(this.botMessage({
            type: 'uncovered',
            gaps: matchGaps(this.kb.gaps, text, 3),
            related: this.pickRelated(null, [])
          }))
        }

        this.lastQuestion = text
        this.thinking = false
        this.scrollToBottom()
      }, 200)
    },
    /** 细节追问：只在问“这条怎么点/步骤/下一步”，不带新的业务名词 */
    isDetailFollowUp(text) {
      return /^(那|这|它|还有|再|然后|步骤|下一步|具体)/.test(text) ||
        /^(步骤|在哪里点|在哪点|怎么弄|怎么做|下一步|然后呢)/.test(text) ||
        (text.length <= 4 && /(呢|吗)$/.test(text))
    },
    /** 是否像追问：指代词开头，或很短的“步骤呢/在哪点”这类 */
    isFollowUp(text) {
      if (/^(这|那|它|他|她|还有|再|上一|刚刚|刚才|然后|步骤|下一步|具体)/.test(text)) return true
      return text.length <= 6 && /(呢|吗|怎么|哪里|在哪|步骤|然后|还有)/.test(text)
    },
    /** 追问增强：短句或带指代词时，把上一个问题拼进来再检索 */
    enrichQuery(text) {
      const prev = this.lastQuestion
      if (!prev) return text
      const isFollowUp = /^(这|那|它|他|她|还有|再|上一|刚刚|刚才|然后)/.test(text) || text.length <= 5
      return isFollowUp ? prev + ' ' + text : text
    },
    /** 相关问题：同一次检索的其它命中 + 同模块的其它问题 */
    pickRelated(entry, extra) {
      const pool = []
      const seen = {}
      if (entry) seen[entry.id] = 1
      ;(extra || []).forEach(function (e) {
        if (!seen[e.id]) {
          seen[e.id] = 1
          pool.push(e)
        }
      })
      if (entry) {
        this.roleEntries.forEach(function (e) {
          if (e.module === entry.module && !seen[e.id]) {
            seen[e.id] = 1
            pool.push(e)
          }
        })
      }
      if (!pool.length) {
        ;(this.suggestions || []).forEach(function (e) {
          if (!seen[e.id]) {
            seen[e.id] = 1
            pool.push(e)
          }
        })
      }
      return pool.slice(0, 3)
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const box = this.$refs.scroll
        if (box) box.scrollTop = box.scrollHeight
      })
    }
  }
}
</script>

<style lang="less" scoped>
.manual-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 420px;
  background: #f5f7fa;
}

.chat-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 8px;
}

.chat-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 14px;

  &.user {
    flex-direction: row-reverse;

    .chat-bubble-wrap {
      align-items: flex-end;
    }

    .chat-avatar {
      margin: 0 0 0 8px;
      background: #eaf1ff;
      color: #1a5fd0;
    }

    .chat-text {
      background: #1a5fd0;
      color: #fff;
      border-radius: 10px 2px 10px 10px;
    }
  }
}

.chat-avatar {
  flex: 0 0 30px;
  width: 30px;
  height: 30px;
  line-height: 30px;
  text-align: center;
  border-radius: 50%;
  background: #d6e4ff;
  color: #1a5fd0;
  font-size: 12px;
  font-weight: 600;
  margin: 0 8px 0 0;
}

.chat-bubble-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 90%;
}

.chat-bubble {
  border-radius: 2px 10px 10px 10px;
  font-size: 14px;
  line-height: 23px;
}

.chat-text {
  background: #fff;
  color: #1f2329;
  padding: 10px 14px;
  box-shadow: 0 1px 3px rgba(15, 32, 63, 0.06);
  max-width: 680px;
}

.chat-thinking {
  color: #86909c;
}

.chat-answer {
  background: #fff;
  padding: 14px 18px;
  box-shadow: 0 1px 3px rgba(15, 32, 63, 0.06);
  width: 100%;
}

.chat-uncovered {
  background: #fff;
  padding: 14px 18px;
  box-shadow: 0 1px 3px rgba(15, 32, 63, 0.06);
  width: 100%;
}

.chat-uncovered-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 6px;
}

.chat-uncovered-desc {
  color: #86909c;
  font-size: 13px;
  line-height: 22px;
}

.chat-gap-list {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #e8ecf2;
}

.chat-gap-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #4e5969;
}

.chat-gap-item {
  display: flex;
  align-items: flex-start;
  font-size: 13px;
  line-height: 21px;
  color: #4e5969;
  margin-bottom: 6px;
}

.chat-risk {
  flex: 0 0 auto;
  font-size: 12px;
  padding: 0 6px;
  height: 19px;
  line-height: 19px;
  border-radius: 3px;
  background: #ffece8;
  color: #d4380d;
  margin: 1px 8px 0 0;

  &.is-mid {
    background: #fff7e0;
    color: #b07800;
  }
}

.chat-gap-hint {
  margin-top: 12px;
  padding: 10px 12px;
  background: #fff8e6;
  border-left: 3px solid #f7b500;
  border-radius: 0 4px 4px 0;
}

.chat-related {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #e8ecf2;
}

.chat-related-title {
  font-size: 12px;
  color: #86909c;
  margin-bottom: 6px;
}

.chat-related-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  color: #1a5fd0;
  font-size: 13px;
  line-height: 26px;
  padding: 0;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.chat-suggest {
  margin: 4px 0 12px 38px;
}

.chat-suggest-title {
  font-size: 12px;
  color: #86909c;
  margin-bottom: 8px;
}

.chat-suggest-item {
  display: inline-block;
  margin: 0 8px 8px 0;
  padding: 6px 12px;
  border: 1px solid #d6e4ff;
  border-radius: 16px;
  background: #f5f9ff;
  color: #1a5fd0;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: #eaf1ff;
  }
}

.chat-input-bar {
  display: flex;
  gap: 10px;
  padding: 12px 20px 6px;
  background: #fff;
  border-top: 1px solid #e8ecf2;
}

.chat-input {
  flex: 1;
  height: 38px;
  padding: 0 14px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  outline: none;
  font-size: 14px;
  background: #fafbfc;

  &:focus {
    border-color: #3e7afc;
    background: #fff;
    box-shadow: 0 0 0 2px rgba(62, 122, 252, 0.12);
  }
}

.chat-send {
  flex: 0 0 76px;
  height: 38px;
  border: none;
  border-radius: 6px;
  background: #1a5fd0;
  color: #fff;
  font-size: 14px;
  cursor: pointer;

  &:disabled {
    background: #b7c8e3;
    cursor: not-allowed;
  }
}

.chat-foot {
  padding: 0 20px 10px;
  background: #fff;
  color: #a0a8b4;
  font-size: 12px;
  line-height: 18px;
}
</style>
