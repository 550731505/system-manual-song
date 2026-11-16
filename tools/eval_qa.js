#!/usr/bin/env node
/**
 * 问答命中率回归：用真实/口语化问法驱动 dist 里的问答页，统计命中情况。
 *
 * 用法（在工程根目录执行）：
 *   yarn build
 *   node tools/eval_qa.js bzzf                          # 用 tools/qa-samples/bzzf.txt
 *   node tools/eval_qa.js jsns tools/qa-samples/jsns.txt
 *   node tools/eval_qa.js jsns my-12345.txt --min=0.85  # 自定义文件 + 命中率门槛
 *   node tools/eval_qa.js stock --verbose                # 打印每条命中到的问题
 *
 * 问题文件格式：一行一条，# 开头为注释；行尾可用 || 期望关键词 标记参考答案。
 *   # 登录类
 *   手机收不到验证码怎么办
 *   系统一直说用户不存在||账号
 *
 * 判定口径：
 *   命中 = 页面给出了答疑卡（没落到“手册暂未覆盖”）
 *   命中准确 = 命中且标题/答案里出现期望关键词（没写期望的不参与准确率）
 */
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const systemId = args[0]
if (!systemId) {
  console.error('用法：node tools/eval_qa.js <系统标识> [问题文件] [--min=0.8] [--verbose]')
  process.exit(2)
}
const fileArg = args.slice(1).find(a => !a.startsWith('--'))
const minArg = args.find(a => a.startsWith('--min='))
const minHit = minArg ? parseFloat(minArg.split('=')[1]) : 0
const verbose = args.indexOf('--verbose') !== -1
const roleArg = args.find(a => a.startsWith('--role='))
const roleId = roleArg ? roleArg.split('=')[1] : ''

const root = process.cwd()
const dist = path.join(root, 'dist')
const questionsFile = fileArg || path.join(root, 'tools', 'qa-samples', systemId + '.txt')

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('请先执行 yarn build')
  process.exit(2)
}
if (!fs.existsSync(questionsFile)) {
  console.error('找不到问题文件：' + questionsFile)
  process.exit(2)
}

function parseQuestions(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const parts = l.split('||')
      return { question: parts[0].trim(), expect: (parts[1] || '').trim() }
    })
}

const { JSDOM } = require('jsdom')
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const scripts = []
const re = /src=static\/js\/([^ >]+\.js)/g
let m
while ((m = re.exec(html))) scripts.push(m[1])

const wait = ms => new Promise(r => setTimeout(r, ms))

async function boot() {
  const dom = new JSDOM(html, {
    url: 'http://localhost/manual/#' + systemId + '?mode=qa',
    runScripts: 'outside-only',
    pretendToBeVisual: true
  })
  const win = dom.window
  win.scrollTo = function () {}
  win.matchMedia = win.matchMedia || function () {
    return { matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }
  }
  for (const s of scripts) win.eval(fs.readFileSync(path.join(dist, 'static/js', s), 'utf8'))
  await wait(500)
  if (!win.document.querySelector('.manual-chat')) {
    throw new Error('没有进入问答模式，检查 dist 是否为最新构建（yarn build）')
  }
  if (roleId) {
    const kb = JSON.parse(fs.readFileSync(path.join(root, 'src/systems', systemId, 'data/kb.json'), 'utf8'))
    const role = (kb.roles || []).filter(r => r.id === roleId)[0]
    if (!role) throw new Error('kb.json 里没有角色：' + roleId)
    const btns = Array.from(win.document.querySelectorAll('.kb-role-btn'))
    const btn = btns.filter(b => b.textContent.trim() === role.name)[0]
    if (!btn) throw new Error('页面上没有角色按钮：' + role.name)
    btn.dispatchEvent(new win.Event('click', { bubbles: true }))
    await wait(300)
  }
  return win
}

async function ask(win, text) {
  const input = win.document.querySelector('.chat-input')
  input.value = text
  input.dispatchEvent(new win.Event('input', { bubbles: true }))
  input.dispatchEvent(new win.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
  await wait(320)
  const answers = win.document.querySelectorAll('.chat-answer')
  const uncovered = win.document.querySelectorAll('.chat-uncovered')
  if (!answers.length) return { hit: false, title: '', text: '' }
  const last = answers[answers.length - 1]
  return {
    hit: true,
    title: (last.querySelector('.entry-title') || {}).textContent || '',
    text: last.textContent || '',
    uncoveredCount: uncovered.length
  }
}

;(async () => {
  const questions = parseQuestions(questionsFile)
  console.log('问答回归：' + systemId + (roleId ? ' / 角色 ' + roleId : '') +
    '，共 ' + questions.length + ' 条问法（' + path.relative(root, questionsFile) + '）\n')

  const win = await boot()
  const rows = []
  for (const q of questions) {
    const r = await ask(win, q.question)
    let accurate = null
    if (r.hit && q.expect) {
      accurate = (r.title + r.text).indexOf(q.expect) !== -1
    }
    rows.push({ q: q.question, expect: q.expect, hit: r.hit, title: r.title, accurate: accurate })
  }

  const hitCount = rows.filter(r => r.hit).length
  const judged = rows.filter(r => r.accurate !== null)
  const accurateCount = judged.filter(r => r.accurate).length

  rows.forEach((r, i) => {
    const mark = r.hit ? (r.accurate === false ? '△' : '✓') : '✗'
    if (verbose || !r.hit || r.accurate === false) {
      console.log(mark + ' ' + String(i + 1).padStart(2) + '. ' + r.q)
      if (r.hit) console.log('       → ' + r.title + (r.accurate === false ? '（期望含：' + r.expect + '）' : ''))
      else console.log('       → 手册暂未覆盖')
    }
  })

  const miss = rows.filter(r => !r.hit)
  const wrong = judged.filter(r => !r.accurate)
  console.log('\n命中：' + hitCount + '/' + rows.length + '（' + ((hitCount / rows.length) * 100).toFixed(1) + '%）')
  if (judged.length) {
    console.log('命中且答对：' + accurateCount + '/' + judged.length + '（' + ((accurateCount / judged.length) * 100).toFixed(1) + '%）')
  }
  if (miss.length) {
    console.log('\n没命中的问法（补同义词/关键词的候选）：')
    miss.forEach(r => console.log('  - ' + r.q))
  }
  if (wrong.length) {
    console.log('\n命中了但答偏的问法：')
    wrong.forEach(r => console.log('  - ' + r.q + ' → ' + r.title))
  }

  const rate = hitCount / rows.length
  if (minHit && rate < minHit) {
    console.log('\n[FAIL] 命中率 ' + (rate * 100).toFixed(1) + '% 低于门槛 ' + (minHit * 100).toFixed(0) + '%')
    process.exit(1)
  }
  process.exit(0)
})().catch(e => {
  console.error(e.message)
  process.exit(2)
})
