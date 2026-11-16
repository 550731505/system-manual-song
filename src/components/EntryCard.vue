<template>
  <div class="entry-card-inner">
    <h3 class="entry-title">{{ entry.title }}</h3>
    <div class="entry-answer">{{ entry.answer }}</div>

    <div v-if="entry.steps && entry.steps.length" class="entry-steps">
      <div class="steps-label">操作步骤</div>
      <ol class="step-list">
        <li v-for="(step, i) in entry.steps" :key="i">
          <span class="step-num">{{ i + 1 }}</span>
          <span class="step-text">{{ step }}</span>
        </li>
      </ol>
    </div>

    <div v-if="entry.note" class="entry-note">{{ entry.note }}</div>

    <div v-if="shots.length" class="entry-shots">
      <img
        v-for="(src, i) in shots"
        :key="i"
        class="entry-shot"
        :src="src"
        :alt="entry.title + ' 操作截图 ' + (i + 1)"
        loading="lazy"
        @click="preview(i)"
      />
    </div>

    <div v-if="entry.source" class="entry-source">手册依据：{{ entry.source }}</div>
  </div>
</template>

<script>
/** 单条答疑卡片：手册浏览页与问答助手共用 */
export default {
  name: 'EntryCard',
  props: {
    entry: { type: Object, required: true },
    role: { type: String, required: true },
    shotsOf: { type: Function, required: true }
  },
  computed: {
    shots() {
      return this.shotsOf(this.entry, this.role)
    }
  },
  methods: {
    preview(index) {
      this.$emit('preview', this.shots, index)
    }
  }
}
</script>

<style lang="less" scoped>
.entry-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  line-height: 22px;
  color: #1f2329;
}

.entry-answer {
  color: #4e5969;
  line-height: 24px;
  font-size: 14px;
}

.entry-steps {
  margin-top: 12px;
  background: #f7f9fc;
  border-radius: 6px;
  padding: 10px 14px;
}

.steps-label {
  font-size: 13px;
  color: #1a5fd0;
  font-weight: 600;
  margin-bottom: 6px;
}

.step-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.step-list li {
  display: flex;
  align-items: flex-start;
  margin-bottom: 6px;
  line-height: 22px;
  color: #4e5969;

  &:last-child {
    margin-bottom: 0;
  }
}

.step-num {
  flex: 0 0 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  border-radius: 50%;
  background: #d6e4ff;
  color: #1a5fd0;
  font-size: 12px;
  margin: 2px 8px 0 0;
}

.entry-note {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fff8e6;
  border-left: 3px solid #f7b500;
  color: #8a6d00;
  font-size: 13px;
  line-height: 21px;
  border-radius: 0 4px 4px 0;
}

.entry-shots {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 8px;
}

.entry-shot {
  width: 100%;
  height: 132px;
  object-fit: cover;
  object-position: top;
  border: 1px solid #e8ecf2;
  border-radius: 6px;
  cursor: zoom-in;
  background: #f7f9fc;
  transition: transform 0.15s;

  &:hover {
    transform: translateY(-2px);
    border-color: #3e7afc;
  }
}

.entry-source {
  margin-top: 10px;
  font-size: 12px;
  color: #86909c;
}
</style>
