# system-manual-song

统一承载各业务系统《用户手册 / 答疑知识库》的独立站点。

- 一个工程管所有系统的手册，按系统分目录，**截图、word 原件、审核表都跟着系统目录走**，不再散落在各业务系统工程里
- 打包一次 = 一个静态目录，丢到生产 nginx 任意路径即可，所有业务系统只需要记一个地址
- hash 路由，不依赖服务端 rewrite

## 目录结构

```
system-manual-song/
├── src/
│   ├── systems/                        # 各系统手册（新增系统只动这里）
│   │   ├── index.js                    # 自动发现 systems 下一级目录，无需手工注册
│   │   ├── _template/                  # 新系统接入模板（config.json.example / data/kb.example.json）
│   │   ├── stock/                      # 存量房网签备案系统
│   │   │   ├── config.json             # 系统名称、说明、word 与角色对应关系
│   │   │   ├── data/kb.json            # 答疑知识库（页面唯一数据源）
│   │   │   ├── screenshots/{jg,dt,gl}/ # 手册截图（按角色分目录）
│   │   │   ├── manual/*.docx           # word 版操作手册原件
│   │   │   └── 答疑知识库审核表.xlsx     # 审核表（脚本生成）
│   │   ├── bzzf/                       # 住房保障管理系统（34 条答疑 / 53 张图）
│   │   ├── presale/                    # 预售资金监管系统（58 条答疑 / 155 张图 / 2 角色）
│   │   └── jsns/                       # 新建商品房网签备案系统（71 条答疑 / 275 张图 / 3 角色）
│   ├── views/
│   │   ├── SystemList.vue              # 手册首页：列出已接入系统
│   │   └── ManualPage.vue              # 手册页：角色切换 / 检索 / 模块导航 / 截图预览
│   ├── router/index.js                 # hash 路由
│   ├── App.vue
│   └── main.js
├── public/index.html
├── tools/
│   ├── extract_manual_images.py        # docx → screenshots/，并导出图片清单
│   └── build_review_xlsx.py            # kb.json → 答疑知识库审核表.xlsx
├── vue.config.js
└── package.json
```

## 访问地址

| 场景 | 地址 |
|---|---|
| 手册首页（系统列表） | `http://<手册站点>/manual/#/` |
| 某系统手册（浏览） | `http://<手册站点>/manual/#/<系统标识>` |
| 某系统智能问答 | `http://<手册站点>/manual/#/<系统标识>?mode=qa` |
| 嵌入业务系统（隐藏页头） | `http://<手册站点>/manual/#/<系统标识>?embed=1` |
| 嵌入业务系统并直接进问答 | `http://<手册站点>/manual/#/<系统标识>?embed=1&mode=qa` |

当前已接入的系统标识：

| 标识 | 系统 | 角色 | 答疑 / 缺口 | 截图 |
|---|---|---|---|---|
| `stock` | 存量房网签备案系统 | 经纪机构 / 大厅窗口 / 中介管理科 | 70 / 18 | 185 |
| `bzzf` | 住房保障管理系统 | 住房保障管理（单角色） | 34 / 13 | 53 |
| `presale` | 预售资金监管系统 | 主管部门 / 开发企业 | 58 / 12 | 155 |
| `jsns` | 新建商品房网签备案系统 | 主管单位 / 开发企业 / 测绘机构 | 71 / 14 | 275 |

标识即 `src/systems/` 下的目录名，新增系统沿用同一规则。

## 开发与打包

```bash
yarn install          # 或 npm install
yarn run serve        # 本地 http://localhost:3100
yarn run build        # 产物在 dist/
```

产物 `dist/` 整个目录拷到生产静态目录即可，例如 nginx：

```
location /manual/ {
    alias /data/web/manual/;      # dist 内容
    index index.html;
    try_files $uri $uri/ /manual/index.html;
}
```

> 脚本里带了 `NODE_OPTIONS=--openssl-legacy-provider`（webpack4 + 新版 Node 需要），Windows 下直接 `yarn run build` 即可。
> 默认 `publicPath` 是相对路径 `./`，放在任何子目录都能跑；也可用环境变量 `VUE_APP_PUBLIC_PATH` 覆盖。

## 智能问答（第 1 层：本地检索式，不调大模型）

手册页右上角有「浏览手册 / 智能问答」切换，也可以直接用地址 `#/<系统标识>?mode=qa` 打开问答模式。

交互：欢迎语（带当前角色和收录条数）→ 快捷提问 → 用户一句话描述问题 → 直接给出最匹配的答案卡
（结论 + 操作步骤 + 注意事项 + 手册依据 + 可点开的手册原图）+「相关问题」；检索不到时明确回
「手册暂未覆盖」并列出相关缺口，不会编造答案。

实现要点：

| 项 | 说明 |
|---|---|
| 数据源 | 直接用 `data/kb.json`，与浏览页完全同源，改知识库即改问答 |
| 检索 | `src/utils/manualSearch.js`：2-gram + 关键词 + 模块名加权 + 同义词展开（待办/代办、经济机构/经纪机构、撤销/注销…） |
| 追问 | 短句或带「这个/那个/还有/上一…」时，自动拼接上一个问题再检索，支持「那这个呢」这类追问 |
| 兜底 | 分数低于阈值 → 命中 `gaps` 展示「手册未覆盖」，并给 3 条相关推荐 |
| 角色 | 沿用页面角色切换；切角色会重置会话 |
| 依赖 | 纯前端，不联网、不调模型，内网可用，响应毫秒级 |

需要调优检索效果时只改 `src/utils/manualSearch.js` 里的 `SYNONYMS`（同义词）和
`SCORE_THRESHOLD`（命中阈值），不用动页面。

### 问答回归（命中率自测）

`tools/eval_qa.js` 用 jsdom 驱动打包后的问答页，逐条提问并统计「是否命中」「top1 是否答对」。
默认读 `tools/qa-samples/<系统>.txt`，一行一条，`||` 后面写期望关键词，`#` 开头为注释：

```
监管协议怎么审||监管协议
审批意见在哪填||审批意见
```

```bash
yarn build
node tools/eval_qa.js stock
node tools/eval_qa.js presale tools/qa-samples/presale-gov.txt --role=gov
node tools/eval_qa.js jsns tools/qa-samples/jsns-svy.txt --role=svy --verbose
node tools/eval_qa.js jsns 12345工单.txt --role=org --min=0.85   # 低于门槛退出码 1
```

多角色系统必须带 `--role`（默认只跑第一个角色），否则会把别的角色的问法算成未命中。

当前基线（样本为项目自带的 119 条口语化问法，**不是**真实工单）：

| 系统 / 角色 | 命中 | top1 答对 |
|---|---|---|
| stock（经纪机构） | 26/26 | 26/26 |
| bzzf（单角色） | 20/20 | 20/20 |
| presale / 主管部门 | 12/12 | 12/12 |
| presale / 开发企业 | 18/18 | 18/18 |
| jsns / 主管单位 | 18/18 | 18/18 |
| jsns / 开发企业 | 18/18 | 18/18 |
| jsns / 测绘机构 | 7/7 | 7/7 |

> 这批样本是自己按手册写的，只能说明「口语化问法能稳定召回」；真实 12345 工单抓一批丢进
> `tools/qa-samples/` 再跑一遍，才知道现场口径差在哪，缺的补进同义词或对应条目的 `kw`。

### 问答行为约定

- 命中答案时，如果问题里还牵出「手册没写的事项」（如问“监管比例是多少”，而手册只写了审核流程），
  答案下方会额外挂一条黄色提示，指向对应的缺口说明
- “步骤呢 / 那这个在哪里点”这类细节追问，直接回显上一条答案（不会乱跳）
- 带了新业务名词的追问（“那监管账户怎么审”）按新问题检索
- 检索不到 → 「手册暂未覆盖」+ 相关缺口，不编造

## 业务系统怎么接

业务系统不再打包页面和图片，只保留「用户手册」页签，指向手册站点地址：

```js
// 建议放在环境变量里，例如 .env.development / .env.production
VUE_APP_MANUAL_URL=http://192.168.0.133:8834/manual/
```

```js
const manualUrl = process.env.VUE_APP_MANUAL_URL
// 页签内容用 iframe 打开（embed=1 隐藏手册页头，看起来像系统内页）
iframeSrc = manualUrl + '#/stock?embed=1'
```

存量房网签备案系统（`joinsoft-vue-stock-house`）已经按这种方式改造，见
`src/views/userManual/index.vue`。

## 新增一个系统的手册

1. 复制 `src/systems/_template/` 为 `src/systems/presale/`
2. `config.json.example` → `config.json`，改 `id/name/description/manuals`
3. `data/kb.example.json` → `data/kb.json`，按手册内容填问答与缺口
4. word 手册放进 `manual/`，执行 `python tools/extract_manual_images.py presale` 抽图
5. 执行 `python tools/build_review_xlsx.py presale` 生成审核表
6. 页面与首页卡片自动出现，无需改代码

## AI 助手 skill（从 word 到知识库）

工程内置了一个 OpenCode skill：`.opencode/skills/manual-from-word/`，把「拿到一份 word 手册 → 出页面 + 审核表」
的整套流程固化成可复用的操作步骤，接新系统（presale / jsns 等）或更新旧系统时直接让 AI 按它执行。

```
.opencode/skills/manual-from-word/
├── SKILL.md                        # 流程：确认输入 → 建目录 → 读手册 → 抽图 → 写 kb.json → 出审核表 → 自测
├── references/kb-schema.md         # kb.json 字段与答题写作规范
├── references/quality-checklist.md # 交付前验收清单
└── scripts/smoke_test.js           # 用 jsdom 实测打包产物（卡片/截图/检索/缺口兜底/嵌入模式）
```

用法：在 OpenCode 里把 word 路径和系统标识告诉它即可，例如「用 manual-from-word 把这份手册接进来：<路径>，系统标识 presale」。
也可以自己跑冒烟测试：

```bash
yarn build
node .opencode/skills/manual-from-word/scripts/smoke_test.js stock
```

## 后续更新手册（日常操作）

所有更新都在**本工程**里做，业务系统不用再打包任何手册内容；手册地址不变（`<站点>/#/系统标识`），
所以更新完只需要重新发布本工程的 `dist`。

命令都在工程根目录执行（`E:\code\owner\system-manual-song`），`<sys>` 换成系统目录名
（`stock` / `bzzf` / `presale` / `jsns`）。

### 0. 一次性准备

```bash
yarn install
pip install python-docx Pillow openpyxl -i https://mirrors.aliyun.com/pypi/simple/
```

### 1. 只改答案 / 补充问题（手册没换）

适用：业务方反馈某条答案不准确、要加一条新问题、要调整模块归类、要补缺口答案。

1. 直接改 `src/systems/<sys>/data/kb.json`（字段见文末「附录：kb.json 字段」）
2. 重新生成审核表，保持页面与审核表一致：
   ```bash
   python tools/build_review_xlsx.py <sys>
   ```
3. 本地自测：
   ```bash
   yarn serve      # http://localhost:3100/#/<sys>
   ```
4. 更新 `src/systems/<sys>/config.json` 的 `updated` 日期（首页卡片会显示）

> 只改 kb.json 时**不要**重跑 `extract_manual_images.py`，否则会白白覆盖一遍截图（内容一样但文件名哈希会变）。

### 2. 手册出了修订版（图片可能增删）

适用：业务方给了新版 word、新增了章节、增删了截图。

1. **先留底**：把旧的图片清单另存一份，方便待会儿比对序号有没有位移
   ```bash
   copy src\systems\<sys>\manual\图片清单.txt src\systems\<sys>\manual\图片清单-旧.txt
   ```
2. 用新版 word 覆盖 `src/systems/<sys>/manual/` 下的同名文件（文件名不一致时同步改 `config.json` 的 `manuals[].file`）
3. 重新抽图（会重建 `screenshots/<角色目录>/`，并把清单写到 `manual/图片清单.txt`）
   ```bash
   python tools/extract_manual_images.py <sys>
   ```
4. **比对图片清单**，看图片序号是否整体后移/前移（新增章节插在中间就会位移）
   ```bash
   # 工程纳入 git 时直接比对；否则打开 图片清单-旧.txt 与 图片清单.txt 对照
   git diff -- src/systems/<sys>/manual/图片清单.txt
   ```
5. 按新清单修正 `data/kb.json` 里每条 `entries[].shots` 的序号；手册删掉的内容，相应 `entries` 也要删或改写
6. 重新生成审核表，再本地自测（见第 5 步检查清单）

> 截图文件名由脚本按顺序生成（`bzzf_07.jpg` = 该本手册第 7 张图），**不要手工改名或替换**，否则页面会串图。

### 3. 业务方审核意见回写

审核表（`src/systems/<sys>/答疑知识库审核表.xlsx`）填完后按列处理：

| 审核表里的填写 | kb.json 怎么改 |
|---|---|
| 「答案是否准确」= 准确 | 不用动 |
| 「答案是否准确」= 需修改 + 「需要怎么改」 | 按意见改 `answer` / `steps` / `note` |
| 「答案是否准确」= 删除 | 删掉该 `entries` 项 |
| 直接改写了「标准答案」列 | 用新文字覆盖 `answer` |
| 缺口清单填了「由谁补充」「补充后的答案」 | 把该 `gaps` 项转成正式 `entries`（补 `module/title/answer/source/shots`），或把答复写进 `gaps.detail` 并填 `owner` |

改完重新执行 `python tools/build_review_xlsx.py <sys>`；不要直接手改 xlsx，下次生成会被覆盖。

### 4. 发布上线

```bash
yarn build                    # 产物 dist/
```

1. 备份线上旧目录（手册站点是纯静态，回滚就是把旧目录拷回来）
2. 把 `dist/` 内容整体覆盖到生产静态目录（例如 `/data/web/manual/`）
3. 浏览器打开 `http://<host>/manual/#/<sys>` 验证；业务系统侧无需改动、无需重新打包
4. 若本次只有某个系统更新，其它系统不受影响（同一个包，各系统数据独立）

### 5. 每次更新的检查清单

- [ ] `yarn serve` 打开 `#/<sys>`，默认视图能出卡片、左侧模块计数正常
- [ ] 随手搜 1 条改过的问题，答案是新版的
- [ ] 改过截图的条目点开缩略图，图片内容对得上（不是串图）
- [ ] 只有单角色的系统（如 bzzf）不显示角色切换条；多角色系统切一遍角色都正常
- [ ] 搜一个手册没写的问题，页面提示「手册暂未覆盖」并带出相关缺口
- [ ] `答疑知识库审核表.xlsx` 已重新生成，条数与 kb.json 一致
- [ ] `config.json` 的 `updated` 已更新
- [ ] `dist` 已发布，业务系统页签打得开

## 附录：数据流与 kb.json 字段

```
word 手册  ──extract_manual_images.py──▶  screenshots/*.jpg
     │                                        │
     ├──人工整理──▶ data/kb.json ◀──shots 序号──┘
                        │
                        ├──▶ 页面（实时读取 kb.json）
                        └──build_review_xlsx.py──▶ 答疑知识库审核表.xlsx（发给业务方审核）
```

```json
{
  "title": "存量房网签备案系统 · 操作答疑",
  "subtitle": "依据《存量房网签备案系统操作手册》整理",
  "disclaimer": "页面底部免责说明",
  "roles": [{ "id": "org", "name": "经纪机构", "dir": "jg", "manual": "经纪机构版操作手册" }],
  "entries": [{
    "id": "kb-001",
    "roles": ["org", "hall", "gov"],
    "module": "系统登录",
    "title": "问题",
    "answer": "标准答案",
    "steps": ["第一步", "第二步"],
    "note": "注意事项",
    "source": "第一章 1.1 系统登录",
    "kw": ["检索关键词"],
    "hot": true,
    "shots": { "org": [1, 2], "hall": [1] }
  }],
  "gaps": [{ "topic": "手册缺口话题", "risk": "高", "detail": "说明", "owner": "" }]
}
```

- `roles[].dir` = 截图目录名 = 文件名前缀（`jg` → `screenshots/jg/jg_01.jpg`）
- `entries[].shots` 写截图序号（docx 中图片出现顺序，从 1 开始），序号与内容对应关系见 `manual/图片清单.txt`
- 检索不到内容时展示 `gaps` 中匹配的条目，页面不会编造答案

## 工具脚本依赖

```bash
pip install python-docx Pillow openpyxl -i https://mirrors.aliyun.com/pypi/simple/
```
