#!/usr/bin/env node
/**
 * 手册页冒烟测试：用 jsdom 真实加载 dist 打包产物，校验数据渲染、检索、缺口兜底、嵌入模式。
 *
 * 前置：
 *   yarn build
 *   npm install --no-save jsdom --registry=https://registry.npmmirror.com
 *
 * 用法（在工程根目录执行）：
 *   node .opencode/skills/manual-from-word/scripts/smoke_test.js stock
 *   node .opencode/skills/manual-from-word/scripts/smoke_test.js bzzf
 *
 * 退出码非 0 表示有检查项失败。
 */
const fs = require('fs')
const path = require('path')

const systemId = process.argv[2]
if (!systemId) {
  console.error('用法：node scripts/smoke_test.js <系统标识>')
  process.exit(2)
}

const root = process.cwd()
const dist = path.join(root, 'dist')
const sysDir = path.join(root, 'src', 'systems', systemId)
const kbPath = path.join(sysDir, 'data', 'kb.json')
const configPath = path.join(sysDir, 'config.json')

let failures = 0
const failedNames = []
function check(name, ok, extra) {
  console.log('  ' + (ok ? '[OK]  ' : '[FAIL]') + ' ' + name + (extra ? '  -> ' + extra : ''))
  if (!ok) {
    failures++
    failedNames.push(name)
  }
}

const wait = ms => new Promise(r => setTimeout(r, ms))

function loadDist() {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  const scripts = []
  const re = /src=([^ >]+\.js)/g
  let m
  while ((m = re.exec(html))) scripts.push(m[1].replace(/^\.?\//, ''))
  return { html, scripts }
}

async function boot(ctx, hash) {
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM(ctx.html, {
    url: 'http://localhost/manual/#' + hash,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  })
  const win = dom.window
  win.scrollTo = function () {}
  win.matchMedia = win.matchMedia || function () {
    return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }
  }
  for (const s of ctx.scripts) {
    win.eval(fs.readFileSync(path.join(dist, s), 'utf8'))
  }
  await wait(400)
  return win
}

function textOf(win, sel) {
  const el = win.document.querySelector(sel)
  return el ? el.textContent.trim() : ''
}

function type(win, value) {
  const input = win.document.querySelector('.kb-search-input')
  if (!input) return false
  input.value = value
  input.dispatchEvent(new win.Event('input', { bubbles: true }))
  return true
}

;(async () => {
  console.log('手册冒烟测试：' + systemId)

  // ---------- 文件与数据 ----------
  check('dist 已构建', fs.existsSync(path.join(dist, 'index.html')))
  check('kb.json 存在', fs.existsSync(kbPath))
  check('config.json 存在', fs.existsSync(configPath))
  if (failures) process.exit(1)

  const kb = JSON.parse(fs.readFileSync(kbPath, 'utf8'))
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const roles = kb.roles || []
  const roleIds = roles.map(r => r.id)

  console.log('\n[1] 数据完整性')
  const ids = kb.entries.map(e => e.id)
  check('条目 id 无重复', new Set(ids).size === ids.length, ids.length + ' 条')
  check('每条都有 source', kb.entries.every(e => e.source), '')
  const missingImg = []
  kb.entries.forEach(e => {
    Object.keys(e.shots || {}).forEach(r => {
      const role = roles.filter(x => x.id === r)[0]
      if (!role || !roleIds.includes(r)) {
        missingImg.push(e.id + ' 角色不存在:' + r)
        return
      }
      ;(e.shots[r] || []).forEach(n => {
        const name = role.dir + '_' + (n < 10 ? '0' + n : String(n)) + '.jpg'
        const p = path.join(sysDir, 'screenshots', role.dir, name)
        if (!fs.existsSync(p)) missingImg.push(e.id + ' → ' + role.dir + '/' + name)
      })
    })
  })
  check('shots 引用的截图都存在', missingImg.length === 0, missingImg.slice(0, 3).join('; '))
  check('roles 覆盖了所有 entries.roles', kb.entries.every(e => e.roles.every(r => roleIds.includes(r))))

  // ---------- 页面渲染 ----------
  console.log('\n[2] 页面渲染（#/' + systemId + '）')
  const ctx = loadDist()
  const win = await boot(ctx, '/' + systemId)

  check('标题正确', textOf(win, '.kb-title') === kb.title, textOf(win, '.kb-title'))
  const cards = win.document.querySelectorAll('.kb-card').length
  check('渲染出答疑卡片', cards > 0, cards + ' 张')
  const shots = win.document.querySelectorAll('.entry-shot').length
  check('渲染出截图', shots > 0, shots + ' 张')
  const isImageSrc = s =>
    /^data:image\//.test(s || '') || /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(s || '')
  const badShot = Array.from(win.document.querySelectorAll('.entry-shot'))
    .filter(img => !isImageSrc(img.getAttribute('src')))
  check('截图地址都解析成功', badShot.length === 0, badShot.length + ' 个异常')

  const sideCount = win.document.querySelectorAll('.kb-side-item').length
  const moduleCount = new Set(kb.entries.filter(e => e.roles.includes(roles[0].id)).map(e => e.module)).size
  check('模块导航数量正确', sideCount === moduleCount + 1, sideCount + ' 项（含全部）')

  const roleBtns = win.document.querySelectorAll('.kb-role-btn').length
  const expectRoleBtn = roles.length > 1 ? roles.length : 0
  check(
    roles.length > 1 ? '角色切换条数量正确' : '单角色隐藏角色切换条',
    roleBtns === expectRoleBtn,
    roleBtns + ' 个'
  )

  // ---------- 检索 ----------
  console.log('\n[3] 检索')
  const sample = kb.entries.filter(e => e.hot)[0] || kb.entries[0]
  const keyword = (sample.kw && sample.kw[0]) || sample.title.slice(0, 4)
  type(win, keyword)
  await wait(500)
  const hits = win.document.querySelectorAll('.kb-card').length
  check('检索「' + keyword + '」有结果', hits > 0, hits + ' 条')

  // 纯符号查询：规范化后为空，保证一定匹配不到，用来验证「手册未覆盖」兜底
  type(win, '~~~###~~~')
  await wait(500)
  check('检索不到时提示手册未覆盖', !!win.document.querySelector('.kb-uncovered'))
  check('兜底给出推荐问题', win.document.querySelectorAll('.kb-recommend li').length > 0)

  // ---------- 嵌入模式 ----------
  console.log('\n[4] 嵌入模式（?embed=1）')
  const winEmbed = await boot(ctx, '/' + systemId + '?embed=1')
  check('页头隐藏', !winEmbed.document.querySelector('.kb-header'))
  check('内容照常渲染', winEmbed.document.querySelectorAll('.kb-card').length > 0)

  // ---------- 首页 ----------
  console.log('\n[5] 首页卡片')
  const winHome = await boot(ctx, '/')
  const names = Array.from(winHome.document.querySelectorAll('.sys-card-title')).map(e => e.textContent.trim())
  check('首页出现本系统', names.includes(config.name), names.join(' / '))

  // ---------- 智能问答 ----------
  console.log('\n[6] 智能问答（?mode=qa）')
  const winQa = await boot(ctx, '/' + systemId + '?mode=qa')
  check('进入问答模式', !!winQa.document.querySelector('.manual-chat'))
  const greet = winQa.document.querySelector('.chat-text')
  check('首屏有欢迎语', !!greet && greet.textContent.indexOf('操作答疑助手') !== -1,
    greet ? greet.textContent.slice(0, 40) : '')
  check('首屏有快捷提问', winQa.document.querySelectorAll('.chat-suggest-item').length > 0,
    winQa.document.querySelectorAll('.chat-suggest-item').length + ' 个')

  // 点快捷提问 → 直接出答案卡
  const chip = winQa.document.querySelector('.chat-suggest-item')
  if (chip) {
    chip.dispatchEvent(new winQa.Event('click', { bubbles: true }))
    await wait(300)
  }
  check('点快捷提问后出现答案', !!winQa.document.querySelector('.chat-answer .entry-title'),
    (winQa.document.querySelector('.chat-answer .entry-title') || {}).textContent || '')

  // 输入关键词提问
  const chatInput = winQa.document.querySelector('.chat-input')
  chatInput.value = keyword
  chatInput.dispatchEvent(new winQa.Event('input', { bubbles: true }))
  chatInput.dispatchEvent(new winQa.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
  await wait(500)
  check('输入问题后给出解答', winQa.document.querySelectorAll('.chat-answer').length >= 1,
    winQa.document.querySelectorAll('.chat-answer').length + ' 条答案')

  // 问手册没写的问题 → 未覆盖兜底
  chatInput.value = '~~~###~~~'
  chatInput.dispatchEvent(new winQa.Event('input', { bubbles: true }))
  chatInput.dispatchEvent(new winQa.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
  await wait(500)
  check('问答兜底提示手册未覆盖', !!winQa.document.querySelector('.chat-uncovered'))

  // 问答模式也要能看截图
  check('问答答案里有截图入口', winQa.document.querySelectorAll('.chat-answer .entry-shot').length > 0,
    winQa.document.querySelectorAll('.chat-answer .entry-shot').length + ' 张')

  console.log('\n' + (failures ? '[FAIL] 失败 ' + failures + ' 项：' + failedNames.join('、') : '[OK] 全部通过'))
  process.exit(failures ? 1 : 0)
})()
