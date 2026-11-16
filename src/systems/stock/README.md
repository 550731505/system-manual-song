# stock（存量房网签备案系统）· 已接入

| 项 | 内容 |
|---|---|
| 访问地址 | `#/stock`（嵌入业务系统用 `#/stock?embed=1`） |
| word 手册 | `manual/` 下三本：经纪机构版、大厅版、中介管理科版 |
| 答疑数据 | `data/kb.json`：70 条答疑 + 18 条手册缺口 |
| 角色 | `org` 经纪机构（jg）、`hall` 大厅窗口（dt）、`gov` 中介管理科（gl） |
| 截图 | `screenshots/{jg,dt,gl}/`，共 185 张（82 / 61 / 42） |
| 图片清单 | `manual/图片清单.txt`（三本手册的序号 ↔ 图片内容） |
| 审核表 | `答疑知识库审核表.xlsx`（脚本生成） |

## 说明

- 三本手册分别对应三个角色，`kb.json` 里 `roles[].dir` 决定截图目录与文件名前缀；
  同一条答疑在不同角色手册里的配图不同，按 `shots` 里的角色分别写序号。
- 页面默认打开「经纪机构」，可通过顶部角色切换看另外两个角色。
- 业务系统侧（`joinsoft-vue-stock-house`）通过 `VUE_APP_MANUAL_URL` + `#/stock?embed=1` 内嵌本页。

## 重新生成

```bash
python tools/extract_manual_images.py stock   # 手册更新后重抽截图 + 图片清单
python tools/build_review_xlsx.py stock       # 重生成审核表
```

完整的手册更新流程（改答案、换新版手册、审核意见回写、发布上线、检查清单）见工程根目录 `README.md`
的「后续更新手册（日常操作）」。
