# 歷史工具：禁止載入或執行，以免覆寫已核對的 canonical 題庫。
raise SystemExit("歷史腳本已停用；請使用 npm run build:ui，以教材/ 的 canonical 題庫建置。")

# -*- coding: utf-8 -*-
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

dir_path = Path(r"C:\Users\ehack\OneDrive\文件\Agent\Study Pack Compiler\教材\金融科技力重點教材")

for md in sorted(dir_path.glob("*.md")):
    name = md.name
    ch_num = name[:2]
    ch_id = f"c{ch_num}"

    txt = md.read_text(encoding='utf-8')
    if not txt.startswith("---"):
        new_txt = f"---\nid: {ch_id}\n---\n\n" + txt
        md.write_text(new_txt, encoding='utf-8')
        print(f"Added frontmatter id: {ch_id} to {name}")
    else:
        print(f"Already has frontmatter: {name}")
