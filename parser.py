"""
AP Calculus BC 真题 Markdown → JSON 解析器 v5
改进了 FRQ 区块定位：找到最后一个 \section*{Instructions}（FRQ 题目页开始）到 END OF EXAM。
"""
import re
import json
import os
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ─── 正则 ────────────────────────────────────────────────────
_RE_Q_LINE = re.compile(r'^(\d+)\.\s+[A-Za-z\$\(]')
_RE_OPT    = re.compile(r'\(([A-E])\)(?:\s*\n\s*|\s+)(.*?)(?=\([A-E]\)|$)', re.DOTALL)
_RE_SUB    = re.compile(r'\(([a-d])\)\s+(.*)', re.IGNORECASE)
_RE_IMG    = re.compile(r'!\[.*?\]\((.*?)\)')

# ─── 工具 ────────────────────────────────────────────────────
def md_html(text):
    text = _RE_IMG.sub(lambda m: f'<img src="{m.group(1)}" />', text)
    return text.replace('\n', '<br/>')

def wrap_s(t): return f'<p class="stem_paragraph">{t.strip()}</p>' if t.strip() else ''
def wrap_c(t): return f'<div class="choiceTxt">{t.strip()}</div>' if t.strip() else ''

# ─── MCQ 区块（使用 re.escape 处理特殊字符） ────────────────────
_HEADER_LITERAL = r'\section*{SECTION I: Multiple Choice}'
_END_LITERALS   = [r'\section*{END OF SECTION I}', r'\section*{END OF EXAM}']

def _build_mcq_pattern(content):
    h = re.escape(_HEADER_LITERAL)
    for e in [re.escape(end) for end in _END_LITERALS]:
        pat = h + r'.*?' + e
        m = re.search(pat, content, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group()
    return None

# ─── 块切分 ──────────────────────────────────────────────────
def split_blocks(text):
    lines = text.split('\n')
    blocks, cur = [], []
    for line in lines:
        if _RE_Q_LINE.match(line.strip()):
            if cur:
                blocks.append('\n'.join(cur))
            cur = [line]
        else:
            cur.append(line)
    if cur:
        blocks.append('\n'.join(cur))
    return blocks

# ─── MCQ 解析 ─────────────────────────────────────────────────
def extract_mcq(block):
    """
    解析单个选择题块。
    题干：通过检查行首的 (A)/(B)/(C)/(D)/(E) 来判断是否为选项行，
    题干内容为第一个选项行之前的所有内容。
    """
    lines = block.split('\n')
    # 找第一个选项行（(A) 可能和内容同行，也可能在内容之前单独一行）
    opt_start_idx = -1
    for i, line in enumerate(lines):
        # (A) content（在同行）
        if re.match(r'\s*\([A-E]\)\s+\S', line):
            opt_start_idx = i
            break
        # (A)\nnextline — 检查当前行是否只有 (A) 及其变体，且下一行以非空白开头
        if re.match(r'\s*\([A-E]\)\s*$', line) and i + 1 < len(lines):
            next_line = lines[i + 1]
            if re.match(r'\s*\S', next_line):
                opt_start_idx = i
                break
    if opt_start_idx < 0:
        return None
    # 题干 = 第一行（题号行）之后、选项行之前的所有行
    stem_lines = lines[:opt_start_idx]
    stem_text = ' '.join(stem_lines).strip()
    stem = wrap_s(md_html(stem_text))
    # 选项
    rest = '\n'.join(lines[opt_start_idx:])
    opts = []
    for om in _RE_OPT.finditer(rest):
        opts.append({
            "optionSign": om.group(1),
            "optionContent": wrap_c(md_html(om.group(2).strip())),
            "isExclude": 0
        })
    if len(opts) not in (4, 5):
        return None
    return {"questionType": 0, "choiceQuestionContent": stem, "optionList": opts}

def parse_mcq(text):
    res = []
    for b in split_blocks(text):
        q = extract_mcq(b)
        if q:
            res.append(q)
        else:
            print(f"  [MCQ 失败] {b[:70].replace(chr(10),' | ')}")
    return res

# ─── FRQ 解析 ─────────────────────────────────────────────────
def extract_frq(block):
    lines = block.split('\n')
    stem_lines, subs = [], []
    cur_part, cur_content = None, []
    for line in lines:
        sm = _RE_SUB.match(line)
        if sm:
            if cur_part:
                subs.append((cur_part, ' '.join(cur_content).strip()))
            cur_part = sm.group(1).lower()
            cur_content = [sm.group(2)]
        elif cur_part:
            cur_content.append(line)
        else:
            stem_lines.append(line)
    if cur_part:
        subs.append((cur_part, ' '.join(cur_content).strip()))
    stem_txt = re.sub(r'^\d+\.\s*', '', ' '.join(stem_lines)).strip()
    return {
        "questionType": 2,
        "choiceQuestionContent": wrap_s(md_html(stem_txt)) if stem_txt else '',
        "subjectiveList": [
            {"partSign": l, "partContent": wrap_s(md_html(c))}
            for l, c in subs
        ]
    }

def parse_frq(text):
    res = []
    for b in split_blocks(text):
        has_sub = bool(_RE_SUB.search(b))
        has_opt = bool(re.search(r'\([A-E]\)', b))
        if has_sub and not has_opt:
            res.append(extract_frq(b))
        else:
            print(f"  [跳过] {b[:60].replace(chr(10),' | ')}")
    return res

# ─── FRQ 区块定位 ─────────────────────────────────────────────
_BACKSLASH = '\\'  # one literal backslash

# 已知的 FRQ 第一题题干开头（用于定位）
_FREQ_Q1_PATTERNS = [
    '1. Let $R$ be the shaded region',
    '1. The temperature of water',
    '1. A planetary rover travels',
    '1. The twice-differentiable function',
    '1. Consider the function $f$ given',
    '1. Ruth rode her bicycle',
    '1. The temperature of water',
]

def extract_frq_text(content):
    """
    找到 FRQ 题目区：\section*{Instructions}（FRQ 题目页开始）到 END OF EXAM。
    通过搜索已知的 FRQ 第一题模式定位起点。
    """
    end_pos = content.find('END OF EXAM')
    if end_pos == -1:
        return ''

    # 找到 FRQ 第一题的位置
    q1_pos = -1
    for pat in _FREQ_Q1_PATTERNS:
        idx = content.find(pat)
        if idx != -1 and (q1_pos == -1 or idx < q1_pos):
            q1_pos = idx

    if q1_pos == -1:
        return ''

    # 找 q1_pos 之前的最后一个 \section*{
    marker = _BACKSLASH + 'section*{'
    search_end = q1_pos
    frq_start = -1
    search_pos = 0
    while True:
        idx = content.find(marker, search_pos)
        if idx == -1 or idx >= search_end:
            break
        frq_start = idx
        search_pos = idx + 1

    if frq_start == -1:
        return ''

    return content[frq_start:end_pos + len('END OF EXAM}')]

# ─── 主解析 ───────────────────────────────────────────────────
def parse_file(md_path, json_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # MCQ
    mcq_txt = _build_mcq_pattern(content)
    ql = []
    if mcq_txt:
        mcqs = parse_mcq(mcq_txt)
        print(f"[MCQ]  {len(mcqs)} 道题")
        for i, q in enumerate(mcqs, 1):
            q['sort'] = i
            ql.append(q)
    else:
        print("[MCQ]  未匹配到区块！")

    mc = len(ql)

    # FRQ
    frq_txt = extract_frq_text(content)
    if frq_txt:
        frqs = parse_frq(frq_txt)
        print(f"[FRQ]  {len(frqs)} 道大题")
        for i, q in enumerate(frqs, 1):
            q['sort'] = mc + i
            ql.append(q)
    else:
        print("[FRQ]  未找到 FRQ 区块！")

    total = len(ql)
    print(f"[汇总] 总计 {total} 题")

    result = {
        "data": {
            "examName": os.path.splitext(os.path.basename(md_path))[0],
            "subjectName": "Calculus BC",
            "totalQuestion": total,
            "questionList": ql
        }
    }
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"[输出] {json_path}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("用法: python parser.py <md路径> [json路径]")
        sys.exit(1)
    md = sys.argv[1]
    js = sys.argv[2] if len(sys.argv) > 2 else md.replace('.md', '.json')
    print(f"\n{'='*50}\n文件: {md}\n{'='*50}\n")
    parse_file(md, js)
