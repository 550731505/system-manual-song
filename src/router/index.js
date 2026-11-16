import Vue from 'vue'
import Router from 'vue-router'
import SystemList from '@/views/SystemList.vue'
import ManualPage from '@/views/ManualPage.vue'

Vue.use(Router)

/**
 * hash 路由：静态目录部署不需要服务端 rewrite，dist 丢到任意目录即可访问
 *   首页        http://host/manual/#/
 *   某系统手册  http://host/manual/#/stock
 *   嵌入业务系统 http://host/manual/#/stock?embed=1
 */
export default new Router({
  mode: 'hash',
  routes: [
    {
      path: '/',
      name: 'systemList',
      component: SystemList,
      meta: { title: '用户手册' }
    },
    {
      path: '/:systemId',
      name: 'manual',
      component: ManualPage,
      props: route => ({
        systemId: route.params.systemId,
        embed: route.query.embed === '1',
        qa: route.query.mode === 'qa'
      })
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
