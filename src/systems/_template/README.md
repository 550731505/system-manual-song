# 新系统手册接入模板

复制本目录为新系统目录（例如 `presale`），按下面四步改完即可，**不需要改任何代码**。

## 1. 目录结构

```
src/systems/presale/
├── config.json                 # 由 config.json.example 复制改名
├── data/kb.json                # 由 data/kb.example.json 复制改名
├── screenshots/<角色目录>/      # jg_01.jpg / jg_02.jpg …（角色目录 = kb.json 里 roles[].dir）
├── manual/*.docx               # word 版手册原件
└── 答疑知识库审核表.xlsx         # 由 tools/build_review_xlsx.py 生成
```

## 2. config.json

- `id`：目录名，也是访问地址里的标识（`#/presale`）
- `name` / `description` / `updated`：首页卡片展示用
- `order`：首页排序，数字小的在前
- `manuals`：word 原件与角色的对应关系，供 `tools/extract_manual_images.py` 抽图用

## 3. data/kb.json

字段说明见根目录 README。要点：

- `roles[].dir` 决定截图目录名和文件名前缀（`jg` → `jg_01.jpg`）
- 每条 `entries[].shots` 写该角色手册里的截图序号（从 1 开始，按图片在 docx 中出现顺序）
- 手册里没写、但用户一定会问的内容放 `gaps`，页面检索不到时会展示

## 4. 生成审核表与截图

```bash
# 从 manual/ 里的 docx 抽图到 screenshots/（压到宽 1100px）
python tools/extract_manual_images.py presale

# 生成/更新 答疑知识库审核表.xlsx
python tools/build_review_xlsx.py presale
```

最后 `yarn serve` 看效果，`yarn build` 打包。

后续更新（改答案、换新版手册、审核意见回写、发布上线）的完整流程见工程根目录 `README.md`
的「后续更新手册（日常操作）」。
