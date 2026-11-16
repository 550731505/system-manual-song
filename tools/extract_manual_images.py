# -*- coding: utf-8 -*-
"""
从 word 版操作手册抽取全部截图，并输出「图片序号 → 图片内容（前一段文字）」清单，
方便在 data/kb.json 的 shots 字段里定位每道题该配哪几张图。

用法：
    python tools/extract_manual_images.py stock

依赖：
    pip install python-docx Pillow -i https://mirrors.aliyun.com/pypi/simple/

输入：
    src/systems/<系统标识>/config.json     里的 manuals：[{ "file": "xxx.docx", "role": "org" }]
    src/systems/<系统标识>/data/kb.json    里的 roles[].dir 决定图片目录/文件名前缀
    src/systems/<系统标识>/manual/*.docx   word 版手册
输出：
    src/systems/<系统标识>/screenshots/<dir>/<dir>_01.jpg …（宽 1100px，jpg）
    src/systems/<系统标识>/manual/图片清单.txt（序号 + 前一段文字，用于写 shots）
"""
import io
import json
import os
import sys

from docx import Document
from docx.oxml.ns import qn
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYSTEMS_DIR = os.path.join(ROOT, "src", "systems")

MAX_WIDTH = 1100
JPEG_QUALITY = 80


def read_json(path):
    with io.open(path, encoding="utf-8") as f:
        return json.load(f)


def extract_one(system_id):
    sys_dir = os.path.join(SYSTEMS_DIR, system_id)
    config = read_json(os.path.join(sys_dir, "config.json"))
    kb = read_json(os.path.join(sys_dir, "data", "kb.json"))

    role_dir = {r["id"]: r["dir"] for r in kb.get("roles", [])}
    manuals = config.get("manuals") or []
    if not manuals:
        print("config.json 里没有配置 manuals，跳过：%s" % system_id)
        return

    report = []
    for item in manuals:
        docx_name = item.get("file", "")
        role = item.get("role", "")
        prefix = role_dir.get(role)
        if not prefix:
            print("跳过 %s：kb.json 的 roles 里找不到角色 %s" % (docx_name, role))
            continue

        docx_path = os.path.join(sys_dir, "manual", docx_name)
        if not os.path.isfile(docx_path):
            print("跳过 %s：manual/ 下没有该文件" % docx_name)
            continue

        out_dir = os.path.join(sys_dir, "screenshots", prefix)
        os.makedirs(out_dir, exist_ok=True)

        doc = Document(docx_path)
        counter = 0
        last_text = ""
        report.append("=" * 30 + " %s（前缀 %s）" % (docx_name, prefix))

        for p in doc.paragraphs:
            text = p.text.strip()
            if text:
                last_text = text
            for blip in p._p.findall(".//" + qn("a:blip")):
                rid = blip.get(qn("r:embed"))
                if not rid:
                    continue
                counter += 1
                part = doc.part.related_parts[rid]
                blob = part.blob
                name = "%s_%02d.jpg" % (prefix, counter)
                try:
                    im = Image.open(io.BytesIO(blob))
                    if im.mode in ("P", "RGBA", "LA", "CMYK"):
                        im = im.convert("RGB")
                    w, h = im.size
                    if w > MAX_WIDTH:
                        im = im.resize((MAX_WIDTH, int(h * MAX_WIDTH / w)), Image.LANCZOS)
                    im.save(os.path.join(out_dir, name), "JPEG",
                            quality=JPEG_QUALITY, optimize=True, progressive=True)
                except Exception as exc:  # 极少数非位图资源，原样落盘
                    print("图片转换失败 %s：%s" % (name, exc))
                    with open(os.path.join(out_dir, name), "wb") as f:
                        f.write(blob)
                report.append("%s_%02d  | %s" % (prefix, counter, last_text[:90]))

        print("%s：抽取 %d 张 → screenshots/%s/" % (docx_name, counter, prefix))

    report_path = os.path.join(sys_dir, "manual", "图片清单.txt")
    with io.open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report))
    print("图片清单：%s" % report_path)


def main():
    system_id = sys.argv[1] if len(sys.argv) > 1 else ""
    if not system_id:
        print("用法：python tools/extract_manual_images.py <系统标识>，例如 stock")
        return
    extract_one(system_id)


if __name__ == "__main__":
    main()
