---
name: 手册答疑知识库生成
description: 把 word 版操作手册（.docx）整理成手册站点的答疑知识库：抽取截图、确定角色与模块、编写 data/kb.json、生成《答疑知识库审核表.xlsx》并自测。当用户提供新的操作手册 word，或要求新增/更新某个系统（stock / bzzf / presale / jsns）的用户手册内容时使用。
---

# 手册答疑知识库生成

把一份 word 操作手册变成页面可用的答疑知识库。全程只改 `src/systems/<系统标识>/`，
不改页面代码（页面自动发现系统）。

参考实现（照抄结构最省事）：

- `src/systems/stock/` —— 三本手册、三个角色，185 张图，70 条答疑
- `src/systems/bzzf/` —— 一本手册、单角色，53 张图，34 条答疑

命令都在**工程根目录**（`system-manual-song`）执行，`<sys>` = 系统目录名。

## 0. 先确认输入（缺一项就问，不要猜）

| 项 | 说明 |
|---|---|
| 系统标识 | 目录名，也是访问地址 `#/<sys>`；已知：`stock` `bzzf` `presale` `jsns` |
| 系统名称 | 首页卡片标题，例如「住房保障管理系统」 |
| word 路径 | 一份还是多份？多份通常对应多个角色（如经纪机构版 / 大厅版 / 管理科版） |
| 角色划分 | 手册按角色分册时：角色 id + 中文名 + 截图目录前缀（默认 `org/jg`、`hall/dt`、`gov/gl`，新系统可自定） |

单本手册 → **单角色**（页面会自动隐藏角色切换条），不要硬凑多个角色。

## 1. 建目录、放手册

```bash
mkdir src/systems/<sys>/data src/systems/<sys>/manual src/systems/<sys>/screenshots
copy <word 路径> src/systems/<sys>/manual/
```

写 `src/systems/<sys>/config.json`：

```json
{
  "id": "<sys>",
  "name": "系统名称",
  "description": "一句话说明用户范围",
  "updated": "2026-01-01",
  "order": 3,
  "manuals": [{ "file": "xxx操作手册.docx", "role": "staff" }]
}
```

- `manuals[].file` 必须与 `manual/` 下文件名完全一致
- `manuals[].role` 必须出现在 `data/kb.json` 的 `roles[]` 里
- `order` 决定首页排序

## 2. 读懂手册（先读，再写）

```bash
python tools/dump_docx.py src/systems/<sys>/manual/xxx.docx /tmp/<sys>-结构.txt
```

输出里每张图带顺序编号（`[图12-13]`），并保留了前一段文字 —— 章节层级、按钮名称、
表格字段都在这里，**答题文字只能来自这份内容**。

## 3. 抽图

```bash
python tools/extract_manual_images.py <sys>
```

产出 `screenshots/<角色目录>/<前缀>_01.jpg…` 和 `manual/图片清单.txt`（序号 ↔ 前一段文字）。
后面写 `shots` 就靠这份清单对号。

## 4. 定模块（左侧导航）

用手册的章/节标题当模块名，按手册出现顺序排列，别自创业务概念。例如 bzzf：
系统登录 / 房租配置维护 / 房源信息 / 小区权限分配 / 准入登记 / 配给管理 / 配后管理 / 维修管理 / 法务管理 / 统计分析。

## 5. 写 `data/kb.json`

字段与写作规范见 `references/kb-schema.md`，**动笔前先读**。

体量参考：**每个手册小节 2~5 条**，覆盖手册里 80% 以上的可操作点；
先覆盖“怎么做”，不要把“是什么/政策规定”写成答疑。

`shots` 规则：写该角色手册里的图片序号（`[1,2]` = 第 1、2 张图），
不确定就不写（空数组），**绝不能填一个跟内容对不上的序号** —— 串图比没图更糟。

## 6. 生成审核表

```bash
python tools/build_review_xlsx.py <sys>
```

产出 `src/systems/<sys>/答疑知识库审核表.xlsx`（问答审核表 / 手册缺口清单 / 怎么用）。
**不要手改这个 xlsx**，下次生成会覆盖；有意见回写 `kb.json`。

## 7. 自测（必做，别只 build 通过就交付）

```bash
yarn build
node .opencode/skills/manual-from-word/scripts/smoke_test.js <sys>
```

（jsdom 已在 devDependencies 里，`yarn install` 后即可用）

脚本基于 jsdom 真实加载打包产物，检查：标题、卡片数、缩略图数、模块计数、
检索命中、检索不到时的缺口兜底、单角色是否隐藏角色切换、图片是否全部解析到地址，
以及**智能问答模式**（`?mode=qa`：欢迎语、快捷提问、提问出答案、未覆盖兜底、答案里的截图）。
再把接口输出里的数字和 `kb.json` 对一遍。最后 `yarn serve` 人工点一遍
（缩略图点开看是否串图）。

问答效果另有一套回归（用真实问法量命中率）：

```bash
node tools/eval_qa.js <sys> [问题文件] --role=<角色>
```

问法放 `tools/qa-samples/`，一行一条，`||` 后写期望关键词；低于门槛加 `--min=0.85` 会让脚本返回失败，
适合接进流水线。新增系统时按角色各准备一份问法，别混在一起。

验收清单见 `references/quality-checklist.md`，逐条过。

## 8. 交付说明要写清

- 访问地址：`#/<sys>`（嵌入用 `#/<sys>?embed=1`）
- 条数：答疑 N 条 / 缺口 M 条 / 截图 K 张 / 覆盖模块列表
- 缺口里最该找业务方确认的 3~5 条（申请条件、审批时限、收费标准这类）
- 手册更新后的流程指向根目录 `README.md`「后续更新手册（日常操作）」

## 硬性约束

- **不编造**：手册没写的内容一律进 `gaps`，不写进 `answer`；页面对检索不到的问题会明确提示手册未覆盖
- **不动别人的系统**：只改 `src/systems/<sys>/`；公共脚本在 `tools/`，页面在 `src/views/`，非必要不改
- **不改截图文件名**：名字由脚本按顺序生成，手工改名会串图
- **保留手册原话里的按钮名**（【新增】【暂存】【提交申请】），别改写成同义词
- 手册里明显的笔误（如“我的代办/待办”“经济机构/经纪机构”）按界面实际菜名统一，不要照抄错别字
