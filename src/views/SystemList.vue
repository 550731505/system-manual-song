<template>
  <div class="sys-list">
    <div class="sys-header">
      <h1 class="sys-title">用户手册中心</h1>
      <p class="sys-subtitle">石河子市房产服务综合信息管理平台 · 各业务系统操作答疑</p>
    </div>

    <div class="sys-body">
      <div v-if="!systems.length" class="sys-empty">
        还没有接入任何系统手册，请参照 src/systems/_template 添加。
      </div>

      <div v-else class="sys-grid">
        <div v-for="item in systems" :key="item.id" class="sys-card">
          <div class="sys-card-head">
            <h2 class="sys-card-title">{{ item.name }}</h2>
            <span class="sys-card-tag">{{ item.id }}</span>
          </div>
          <p class="sys-card-desc">{{ item.description }}</p>
          <div class="sys-card-meta">
            <span>{{ item.kb.entries.length }} 条答疑</span>
            <span>{{ item.kb.roles.map(r => r.name).join(' / ') }}</span>
            <span v-if="item.updated">更新于 {{ item.updated }}</span>
          </div>
          <a class="sys-card-link" :href="'#/' + item.id">查看手册 →</a>
        </div>
      </div>

      <div class="sys-tip">
        业务系统集成方式：在系统中直接打开
        <code>{{ baseUrl }}#/系统标识</code>
        （嵌入 iframe 时加 <code>?embed=1</code> 隐藏页头）。
      </div>
    </div>
  </div>
</template>

<script>
import { systems } from '@/systems'

export default {
  name: 'SystemList',
  data() {
    return {
      systems: systems
    }
  },
  computed: {
    baseUrl() {
      return window.location.href.split('#')[0]
    }
  },
  mounted() {
    document.title = '用户手册'
  }
}
</script>

<style lang="less" scoped>
.sys-list {
  min-height: 100vh;
  background: #f5f7fa;
}

.sys-header {
  padding: 34px 32px 26px;
  background: linear-gradient(120deg, #1a5fd0 0%, #3e7afc 100%);
  color: #fff;
}

.sys-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 34px;
  color: #fff;
}

.sys-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  opacity: 0.9;
}

.sys-body {
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 32px 40px;
}

.sys-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.sys-card {
  background: #fff;
  border-radius: 10px;
  padding: 18px 20px;
  box-shadow: 0 1px 4px rgba(15, 32, 63, 0.06);
  display: flex;
  flex-direction: column;
}

.sys-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sys-card-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #1f2329;
}

.sys-card-tag {
  font-size: 12px;
  color: #1a5fd0;
  background: #eaf1ff;
  border-radius: 4px;
  padding: 2px 8px;
}

.sys-card-desc {
  margin: 10px 0 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 22px;
  flex: 1;
}

.sys-card-meta {
  margin-top: 12px;
  color: #86909c;
  font-size: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.sys-card-link {
  margin-top: 14px;
  color: #1a5fd0;
  font-size: 13px;
  text-decoration: none;
}

.sys-card-link:hover {
  text-decoration: underline;
}

.sys-empty {
  background: #fff;
  border-radius: 8px;
  padding: 30px;
  color: #86909c;
  text-align: center;
}

.sys-tip {
  margin-top: 22px;
  padding: 12px 16px;
  background: #eef2f8;
  border-radius: 6px;
  color: #86909c;
  font-size: 12px;
  line-height: 20px;
}

.sys-tip code {
  background: #dfe7f5;
  color: #1a5fd0;
  border-radius: 3px;
  padding: 1px 5px;
  margin: 0 2px;
}
</style>
