# -*- coding: utf-8 -*-
"""
导出 docx 手册结构：段落（标题样式标记）+ 表格 + 图片按出现顺序编号，并附前一段文字。

写答疑知识库时先跑这个，看清章节层级、按钮文字和图片落在哪句话后面。

用法：
    python tools/dump_docx.py <docx 路径> [输出 txt 路径]
默认输出到同目录同名 .txt（与 docx 同目录时不污染 manual 目录的话请显式给输出路径）。
"""
import io
import os
import sys

from docx import Document
from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_blocks(doc):
    for child in doc.element.body.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, doc)
        elif child.tag == qn('w:tbl'):
            yield Table(child, doc)


def para_text(p):
    text = p.text.strip()
    imgs = len(p._p.findall('.//' + qn('a:blip')))
    if imgs:
        return (text + ' ' if text else '') + '[图片x%d]' % imgs
    return text


def dump(src, out):
    doc = Document(src)
    lines = ['FILE: %s' % os.path.basename(src)]
    lines.append('段落数: %d' % len(doc.paragraphs))
    img_no = 0
    for block in iter_blocks(doc):
        if isinstance(block, Paragraph):
            txt = para_text(block)
            if not txt:
                continue
            try:
                style = block.style.name or ''
            except Exception:
                style = ''
            prefix = '[%s] ' % style if style.lower().startswith('heading') else ''
            if '[图片' in txt:
                n = len(block._p.findall('.//' + qn('a:blip')))
                img_no += n
                txt = txt.replace('[图片x%d]' % n, '[图%d-%d]' % (img_no - n + 1, img_no))
            lines.append(prefix + txt)
        else:
            lines.append('<TABLE>')
            for row in block.rows:
                cells = []
                seen = set()
                for c in row.cells:
                    if id(c._tc) in seen:
                        continue
                    seen.add(id(c._tc))
                    cells.append(' '.join(x.text.strip() for x in c.paragraphs).strip())
                lines.append('  ' + ' | '.join(cells))
            lines.append('</TABLE>')
    lines.append('图片总数: %d' % img_no)
    with io.open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print('已导出：%s（图片 %d 张，行数 %d）' % (out, img_no, len(lines)))


def main():
    if len(sys.argv) < 2:
        print('用法：python tools/dump_docx.py <docx 路径> [输出 txt 路径]')
        return
    src = sys.argv[1]
    if len(sys.argv) > 2:
        out = sys.argv[2]
    else:
        out = os.path.splitext(src)[0] + '-结构.txt'
    dump(src, out)


if __name__ == '__main__':
    main()
