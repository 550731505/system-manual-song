/**
 * 答疑检索：手册浏览页和问答助手共用
 * 纯前端、无依赖；中文按 2-gram + 关键词加权打分，命中不到就交给调用方兜底。
 */

// 疑问词 / 口语词，检索前先剥离
const QUESTION_WORDS = [
  '怎么办', '怎么', '怎样', '如何', '为什么', '为何', '能否', '能不能',
  '可不可以', '可以吗', '是否', '请问一下', '请问', '一下', '帮我', '我想',
  '呢', '吗', '吧', '啊', '呀'
]

// 2-gram 停用词，避免虚词误命中
const STOP_GRAMS = {
  怎么: 1, 么办: 1, 怎样: 1, 如何: 1, 什么: 1, 为何: 1, 能否: 1, 是否: 1,
  可以: 1, 能不: 1, 不能: 1, 哪些: 1, 哪里: 1, 在哪: 1, 一下: 1, 请问: 1,
  帮我: 1, 我的: 1, 我要: 1, 需要: 1, 应该: 1, 了吗: 1, 了吧: 1, 的呢: 1,
  这个: 1, 那个: 1, 我们: 1, 你们: 1, 他们: 1, 问题: 1
}

// 打分低于该值视为“手册没覆盖”
export const SCORE_THRESHOLD = 3

// 同义词归一：用户口语 ↔ 手册用词（只做检索用，不改展示文字）
const SYNONYMS = [
  ['待办', '代办'],
  ['经纪机构', '中介', '经济机构', '机构'],
  ['开发企业', '开发公司', '企业'],
  ['测绘机构', '测绘公司'],
  ['监管账户', '资金账户'],
  ['备案', '登记', '报备'],
  ['撤销', '注销', '作废'],
  ['核验', '校验'],
  ['登录', '登陆'],
  ['密码', '口令'],
  ['退回', '打回', '驳回'],
  ['公示', '公告'],
  ['房屋', '房子', '房源'],
  ['合同修改', '改合同', '修改合同']
]

export function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[，。！？、；：,.!?;:"'“”‘’（）()【】[\]《》<>·—\-_\/\\|~`@#$%^&*+=]/g, '')
}

export function stripQuestion(str) {
  let s = str
  QUESTION_WORDS.forEach(function (w) {
    s = s.split(w).join('')
  })
  return s || str
}

export function makeGrams(str) {
  const grams = []
  const seen = {}
  for (let i = 0; i < str.length - 1; i++) {
    const g = str.substr(i, 2)
    if (STOP_GRAMS[g] || seen[g]) continue
    seen[g] = 1
    grams.push(g)
  }
  return grams
}

/** 把用户口语里的词展开成手册用词，提升召回（只影响检索文本） */
export function expandSynonyms(str) {
  let out = str
  SYNONYMS.forEach(function (group) {
    const hit = group.some(function (w) {
      return str.indexOf(w) !== -1
    })
    if (!hit) return
    group.forEach(function (w) {
      if (out.indexOf(w) === -1) out += w
    })
  })
  return out
}

function scoreEntry(entry, q, grams) {
  const title = normalize(entry.title)
  const answer = normalize(entry.answer)
  const steps = normalize((entry.steps || []).join(''))
  const module = normalize(entry.module)
  const kws = (entry.kw || []).map(normalize).filter(Boolean)
  let score = 0

  if (q) {
    if (title.indexOf(q) !== -1) score += 5
    let kwMax = 0
    kws.forEach(function (k) {
      if (k === q) {
        kwMax = Math.max(kwMax, 4)
      } else if (k.length >= 3 && (k.indexOf(q) !== -1 || q.indexOf(k) !== -1)) {
        kwMax = Math.max(kwMax, 3)
      }
    })
    score += kwMax
    // 问句与标题开头是同一名词（如“宗地怎么提交备案” ↔ “宗地出让信息怎么维护和提交”）
    if (q.length >= 2 && title.slice(0, 2) === q.slice(0, 2)) score += 3
    if (module.indexOf(q) !== -1) score += 1.5
    if (answer.indexOf(q) !== -1) score += 1
    if (steps.indexOf(q) !== -1) score += 1
  }

  grams.forEach(function (g) {
    if (title.indexOf(g) !== -1) score += 2
    else if (kws.some(function (k) { return k.indexOf(g) !== -1 })) score += 1.5
    else if (module.indexOf(g) !== -1) score += 1.2
    else if (answer.indexOf(g) !== -1) score += 0.75
    else if (steps.indexOf(g) !== -1) score += 0.75
  })

  return score
}

/**
 * 检索
 * @param {Array} entries 候选条目
 * @param {string} rawQuery 用户原话
 * @returns {{ hits: Array<{entry, score}>, query: string }}
 */
export function searchEntries(entries, rawQuery) {
  const base = stripQuestion(normalize(rawQuery))
  const expanded = expandSynonyms(normalize(rawQuery))
  const grams = makeGrams(base).concat(makeGrams(expanded))
  const seenGrams = {}
  const merged = grams.filter(function (g) {
    if (seenGrams[g]) return false
    seenGrams[g] = 1
    return true
  })

  const scored = (entries || []).map(function (entry, idx) {
    return {
      entry: entry,
      idx: idx,
      score: Math.max(scoreEntry(entry, base, merged), scoreEntry(entry, expanded, merged) * 0.9)
    }
  })

  return {
    query: base,
    hits: scored
      .filter(function (x) { return x.score > 0 })
      .sort(function (a, b) {
        return b.score - a.score || a.idx - b.idx
      })
      .map(function (x) {
        return { entry: x.entry, score: x.score }
      })
  }
}

/** 只返回够格的命中 */
export function searchHits(entries, rawQuery) {
  return searchEntries(entries, rawQuery).hits.filter(function (h) {
    return h.score >= SCORE_THRESHOLD
  })
}

/**
 * 匹配手册缺口（用于告诉用户“这块手册没写”）
 * @param {number} limit 最多返回条数
 * @param {number} minScore 最低分，默认 0（检索不到时用 0）
 * @param {boolean} topicOnly 只按话题名匹配（答案下方的补充提示用，避免正文蹭词）
 */
export function matchGaps(gaps, rawQuery, limit, minScore, topicOnly) {
  const q = normalize(rawQuery)
  const qc = stripQuestion(q)
  const grams = makeGrams(qc)
  const max = limit || 3
  const floor = minScore || 0
  return (gaps || [])
    .map(function (gap, idx) {
      const text = normalize(topicOnly ? gap.topic : gap.topic + gap.detail)
      let score = 0
      if (q && text.indexOf(q) !== -1) score += 10
      if (qc && text.indexOf(qc) !== -1) score += 8
      grams.forEach(function (g) {
        if (text.indexOf(g) !== -1) score += 2
      })
      return { gap: gap, idx: idx, score: score }
    })
    .filter(function (x) { return x.score > floor })
    .sort(function (a, b) {
      return b.score - a.score || a.idx - b.idx
    })
    .slice(0, max)
    .map(function (x) { return x.gap })
}
