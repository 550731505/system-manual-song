# -*- coding: utf-8 -*-
"""
生成《答疑知识库审核表.xlsx》。

数据源：src/systems/<系统标识>/data/kb.json
输出：  src/systems/<系统标识>/答疑知识库审核表.xlsx

用法：
    python tools/build_review_xlsx.py            # 重新生成全部已接入系统的审核表
    python tools/build_review_xlsx.py stock      # 只生成 stock

审核表三个 Sheet：问答审核表 / 手册缺口清单 / 怎么用。
改完 kb.json 重新执行本脚本，页面与审核表就不会对不上。
"""
import io
import json
import os
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYSTEMS_DIR = os.path.join(ROOT, "src", "systems")
OUT_NAME = "答疑知识库审核表.xlsx"

HEADER_FILL = PatternFill("solid", fgColor="2F5597")
HEADER_FONT = Font(name="微软雅黑", size=10, bold=True, color="FFFFFF")
BODY_FONT = Font(name="微软雅黑", size=10)
TITLE_FONT = Font(name="微软雅黑", size=14, bold=True, color="1F3864")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP_TOP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)


def read_json(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def discover_systems():
    """已接入的系统 = 同时存在 config.json 和 data/kb.json 的目录"""
    found = []
    for name in sorted(os.listdir(SYSTEMS_DIR)):
        sys_dir = os.path.join(SYSTEMS_DIR, name)
        if not os.path.isdir(sys_dir):
            continue
        if os.path.isfile(os.path.join(sys_dir, "config.json")) and \
                os.path.isfile(os.path.join(sys_dir, "data", "kb.json")):
            found.append(name)
    return found


def shot_count(entry):
    """配图数：取各角色版本中截图数量最多的一个"""
    shots = entry.get("shots") or {}
    if not shots:
        return 0
    return max(len(v) for v in shots.values())


def steps_text(entry):
    steps = entry.get("steps") or []
    return "\n".join("%d. %s" % (i + 1, s) for i, s in enumerate(steps))


def style_header(ws, row=1):
    for cell in ws[row]:
        if cell.value is None:
            break
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = CENTER
        cell.border = BORDER
    ws.row_dimensions[row].height = 26


def build_sheet_qa(wb, kb, role_name):
    ws = wb.active
    ws.title = "问答审核表"
    headers = [
        "序号", "适用角色", "所属模块", "问题", "标准答案", "操作步骤",
        "注意事项", "手册依据", "配图数", "答案是否准确", "需要怎么改",
    ]
    widths = [6, 20, 14, 34, 60, 58, 40, 24, 8, 14, 30]
    for i, (title, width) in enumerate(zip(headers, widths), 1):
        ws.cell(row=1, column=i, value=title)
        ws.column_dimensions[get_column_letter(i)].width = width
    style_header(ws)

    total = len(kb["entries"])
    for idx, entry in enumerate(kb["entries"], 1):
        row = idx + 1
        roles = "、".join(role_name.get(r, r) for r in entry.get("roles", []))
        values = [
            idx,
            roles,
            entry.get("module", ""),
            entry.get("title", ""),
            entry.get("answer", ""),
            steps_text(entry),
            entry.get("note", ""),
            entry.get("source", ""),
            shot_count(entry),
            "",
            "",
        ]
        for col, value in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=value)
            cell.font = BODY_FONT
            cell.border = BORDER
            cell.alignment = CENTER if col in (1, 9, 10) else WRAP_TOP

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = "A1:K%d" % (total + 1)

    dv = DataValidation(type="list", formula1='"准确,需修改,删除"', allow_blank=True,
                        showDropDown=False)
    dv.error = "请从下拉列表中选择"
    dv.prompt = "准确 / 需修改 / 删除"
    ws.add_data_validation(dv)
    dv.add("J2:J%d" % (total + 1))


def build_sheet_gaps(wb, kb):
    ws = wb.create_sheet("手册缺口清单")
    headers = ["序号", "缺口话题", "风险等级", "问题说明", "目前能不能答", "由谁补充",
               "补充后的答案（请填这里）"]
    widths = [6, 26, 10, 70, 14, 16, 60]
    for i, (title, width) in enumerate(zip(headers, widths), 1):
        ws.cell(row=1, column=i, value=title)
        ws.column_dimensions[get_column_letter(i)].width = width
    style_header(ws)

    for idx, gap in enumerate(kb["gaps"], 1):
        row = idx + 1
        values = [
            idx,
            gap.get("topic", ""),
            gap.get("risk", ""),
            gap.get("detail", ""),
            "不能",
            gap.get("owner", ""),
            "",
        ]
        for col, value in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=value)
            cell.font = BODY_FONT
            cell.border = BORDER
            cell.alignment = CENTER if col in (1, 3, 5) else WRAP_TOP

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = "A1:G%d" % (len(kb["gaps"]) + 1)

    risk_dv = DataValidation(type="list", formula1='"高,中,低"', allow_blank=True,
                             showDropDown=False)
    ws.add_data_validation(risk_dv)
    risk_dv.add("C2:C%d" % (len(kb["gaps"]) + 1))

    ans_dv = DataValidation(type="list", formula1='"不能,能"', allow_blank=True,
                            showDropDown=False)
    ws.add_data_validation(ans_dv)
    ans_dv.add("E2:E%d" % (len(kb["gaps"]) + 1))


def build_sheet_help(wb, kb, system_id, system_name):
    ws = wb.create_sheet("怎么用")
    ws.column_dimensions["A"].width = 26
    ws.column_dimensions["B"].width = 100

    rows = [
        ("%s · 答疑知识库审核表" % system_name, ""),
        ("", ""),
        ("用途",
         "这份表是手册站点里「%s」页面（#/%s）的全部知识来源，页面上的问答、截图、章节出处都按本表生成。"
         "审核定稿后按表更新页面数据即可。" % (system_name, system_id)),
        ("数据来源", "本目录 manual/ 下的 word 版操作手册。"),
        ("", ""),
        ("Sheet1 问答审核表",
         "%d 条问题，全部能从手册正文中找到依据，每条都标了「手册依据」章节和「配图数」（手册原图张数）。"
         % len(kb["entries"])),
        ("  怎么填",
         "在「答案是否准确」列选 准确 / 需修改 / 删除；在「需要怎么改」列写修改意见，或直接改写「标准答案」列。"),
        ("  配图数", "该问题在手册里对应的操作截图张数，页面上会一并展示；为 0 的条目只有文字说明。"),
        ("", ""),
        ("Sheet2 手册缺口清单",
         "%d 个手册里没写明、但用户大概率会问的问题，页面检索不到内容时会给出提示，不会编造答案。"
         % len(kb["gaps"])),
        ("  怎么填", "在「由谁补充」列填负责部门，在「补充后的答案」列写标准答复；补充一条，页面就能答一条。"),
        ("  风险等级", "高 = 上线首周大概率被问到；中 = 会被问到但频率较低。"),
        ("", ""),
        ("Sheet3 怎么用", "本页。"),
        ("", ""),
        ("维护方式",
         "修改 src/systems/%s/data/kb.json 后，执行 python tools/build_review_xlsx.py %s 重新生成本表；"
         "页面与审核表始终一致。" % (system_id, system_id)),
    ]
    for r, (key, value) in enumerate(rows, 1):
        c1 = ws.cell(row=r, column=1, value=key)
        c2 = ws.cell(row=r, column=2, value=value)
        c1.font = TITLE_FONT if r == 1 else Font(name="微软雅黑", size=10, bold=True, color="1F3864")
        c2.font = BODY_FONT
        c1.alignment = WRAP_TOP
        c2.alignment = WRAP_TOP
        if r == 1:
            ws.row_dimensions[r].height = 26


def build_one(system_id):
    sys_dir = os.path.join(SYSTEMS_DIR, system_id)
    kb_path = os.path.join(sys_dir, "data", "kb.json")
    kb = read_json(kb_path)

    config = {}
    config_path = os.path.join(sys_dir, "config.json")
    if os.path.isfile(config_path):
        config = read_json(config_path)
    system_name = config.get("name", kb.get("title", system_id))

    role_name = {r["id"]: r["name"] for r in kb.get("roles", [])}

    wb = Workbook()
    build_sheet_qa(wb, kb, role_name)
    build_sheet_gaps(wb, kb)
    build_sheet_help(wb, kb, system_id, system_name)

    out = os.path.join(sys_dir, OUT_NAME)
    wb.save(out)
    print("生成完成：%s（问答 %d 条，缺口 %d 条）"
          % (out, len(kb["entries"]), len(kb["gaps"])))


def main():
    args = sys.argv[1:]
    targets = args if args else discover_systems()
    if not targets:
        print("没有发现已接入的系统（src/systems/<id>/ 下需同时有 config.json 和 data/kb.json）")
        return
    for system_id in targets:
        build_one(system_id)


if __name__ == "__main__":
    main()
