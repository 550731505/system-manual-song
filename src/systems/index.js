/**
 * 系统注册表：自动发现 src/systems 下的一级目录
 *
 * 每个系统目录约定：
 *   systems/<系统标识>/
 *     ├── config.json              系统名称、说明、排序等（必需）
 *     ├── data/kb.json             答疑知识库数据（必需）
 *     ├── screenshots/<角色目录>/  手册截图，文件名 <角色目录>_01.jpg（必需）
 *     ├── manual/*.docx            word 版手册原件（仅保留，供后续重新抽取）
 *     └── 答疑知识库审核表.xlsx     审核表（由 tools/build_review_xlsx.py 生成）
 *
 * 新增系统只需复制一个目录并改 config.json，页面与路由会自动出现，无需改代码。
 */

const configContext = require.context('./', true, /^\.\/[^/]+\/config\.json$/)
const kbContext = require.context('./', true, /^\.\/[^/]+\/data\/kb\.json$/)
const shotContext = require.context('./', true, /^\.\/[^/]+\/screenshots\/.+\.(jpg|jpeg|png)$/)

function moduleValue(module) {
  return module && module.__esModule && module.default ? module.default : module
}

/** 取某个系统的全部截图地址：{ 'jg/jg_01.jpg': 'static/img/jg_01.xxx.jpg' } */
function collectShots(systemId) {
  const shots = {}
  shotContext.keys().forEach(function (key) {
    const parts = key.replace(/^\.\//, '').split('/')
    if (parts[0] !== systemId) return
    shots[parts.slice(2).join('/')] = shotContext(key)
  })
  return shots
}

export const systems = configContext
  .keys()
  .map(function (key) {
    const dir = key.replace(/^\.\//, '').split('/')[0]
    const config = moduleValue(configContext(key))
    return {
      id: config.id || dir,
      name: config.name || dir,
      description: config.description || '',
      updated: config.updated || '',
      order: typeof config.order === 'number' ? config.order : 999,
      manuals: config.manuals || [],
      kb: moduleValue(kbContext('./' + dir + '/data/kb.json')),
      shots: collectShots(dir)
    }
  })
  .sort(function (a, b) {
    return a.order - b.order || (a.id < b.id ? -1 : 1)
  })

export function getSystem(systemId) {
  return systems.filter(function (s) {
    return s.id === systemId
  })[0]
}
