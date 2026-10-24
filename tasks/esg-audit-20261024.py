"""Recheck the local ESG bank against the original answer PDFs (PyMuPDF required)."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
PDF_ROOT = ROOT / "考古題/永續發展11301-11504"
BANK = ROOT / "教材/永續發展基礎能力重點教材/questions.json"
OUT = ROOT / "tasks/esg-audit-20261024.json"


def is_answer_file(path: Path) -> bool:
    return path.name.endswith("a.pdf") or "答案" in path.name or path.name.endswith("-2.pdf")


def parse_answers(path: Path) -> dict[int, set[int]]:
    text = "\n".join(page.get_text(sort=True) for page in pymupdf.open(path))
    result: dict[int, set[int]] = {}
    if "標準答案" in text:
        for match in re.finditer(r"(?m)^\s*題號\s+([^\n]+)\n\s*標準答案\s+([^\n]+)", text):
            numbers = [int(value) for value in re.findall(r"\b\d{1,3}\b", match[1])]
            answers = match[2].split()
            if numbers and min(numbers) > 80:
                continue
            if len(numbers) != len(answers):
                raise ValueError(f"answer row lengths: {path}: {numbers} / {answers}")
            for number, answer in zip(numbers, answers):
                if number <= 80:
                    digits = {int(value) - 1 for value in re.findall(r"[1-4]", answer)}
                    if not digits:
                        raise ValueError(f"unreadable answer: {path}: {number} {answer}")
                    result[number] = digits
    elif re.search(r"(?m)^\s*\d{1,2}\s+[A-D]", text):
        for number, answer in re.findall(r"(?m)(?<!\d)(\d{1,2})\s+([A-D])(?!\w)", text):
            result[int(number)] = {ord(answer) - ord("A")}
        if "11301a.pdf" == path.name:
            result[73] = set(range(4))  # Final official correction: every answer accepted.
    else:
        for line in text.splitlines():
            match = re.fullmatch(r"\s*(\d{1,2})\s+([1-4]|更正為[1-4]|凡作答一律給分)\s*", line)
            if not match:
                continue
            number = int(match[1])
            result[number] = set(range(4)) if "一律" in match[2] else {int(match[2][-1]) - 1}
    if set(result) != set(range(1, 81)):
        raise ValueError(f"expected 80 official answers: {path}: missing {sorted(set(range(1,81)) - set(result))}")
    return result


def compact(value: str) -> str:
    return re.sub(r"[^\w]", "", value).lower()


def question_pdf(answer_pdf: Path) -> Path:
    if answer_pdf.name.endswith("a.pdf"):
        return answer_pdf.with_name(answer_pdf.name[:-5] + ".pdf")
    return answer_pdf.with_name(answer_pdf.name.replace("答案", "試題").replace("-2.pdf", "-1.pdf"))


def run() -> None:
    sources: dict[tuple[str, str], tuple[Path, dict[int, set[int]]]] = {}
    for folder in sorted(path for path in PDF_ROOT.glob("*/*") if path.is_dir()):
        term = f"{folder.parent.name}-{folder.name}"
        for path in sorted(folder.glob("*.pdf")):
            if is_answer_file(path):
                variant = "kaohsiung" if "高雄" in path.name else "main"
                key = (term, variant)
                if key in sources:
                    raise ValueError(f"duplicate answer source: {key}")
                sources[key] = (path, parse_answers(path))
    source_text = {}
    for key, (answer_pdf, _) in sources.items():
        if key[0] != "114-4":
            continue
        pdf = question_pdf(answer_pdf)
        if not pdf.exists():
            raise FileNotFoundError(pdf)
        paper = "\n".join(page.get_text(sort=True) for page in pymupdf.open(pdf))
        boundaries = list(re.finditer(r"(?m)^\s*(\d{1,2})\.\s", paper))
        chunks = {int(match[1]): compact(paper[match.end():boundaries[i + 1].start() if i + 1 < len(boundaries) else len(paper)]) for i, match in enumerate(boundaries) if 1 <= int(match[1]) <= 80}
        source_text[key] = chunks
    questions = json.loads(BANK.read_text(encoding="utf-8"))["questions"]
    issues = []
    coverage: dict[str, dict[str, int]] = defaultdict(lambda: {"bank": 0, "matched": 0, "missing": 0})
    seen_ids = set()
    for question in questions:
        if question["id"] in seen_ids:
            issues.append({"id": question["id"], "reason": "duplicate_id"})
        seen_ids.add(question["id"])
        if len(question["options"]) != 4 or not all(isinstance(value, str) and value.strip() for value in question["options"]) or question["answer"] not in range(4):
            issues.append({"id": question["id"], "reason": "invalid_question_structure"})
        match = re.fullmatch(r"esg-(\d{3}-\d+)-(\d+)(?:-(\d+))?", question["id"])
        if not match:
            continue
        term, number, suffix = match.groups()
        stem = compact(question["question"].split("】")[-1])
        if term == "114-4":
            hits = [variant for variant in ("main", "kaohsiung") if stem[:min(len(stem), 18)] in source_text[(term, variant)].get(int(number), "")]
            if not hits:
                issues.append({"id": question["id"], "reason": "source_text_unmatched"})
            if len(hits) == 2 and sources[(term, "main")][1][int(number)] != sources[(term, "kaohsiung")][1][int(number)]:
                issues.append({"id": question["id"], "reason": "ambiguous_source_with_different_keys"})
            variant = hits[0] if hits else ("kaohsiung" if suffix else "main")
        else:
            variant = "main"
        key = (term, variant)
        coverage["/".join(key)]["bank"] += 1
        if key not in sources:
            issues.append({"id": question["id"], "reason": "missing_source"})
            continue
        official = sources[key][1][int(number)]
        if question["answer"] in official and len(official) == 1:
            coverage["/".join(key)]["matched"] += 1
        else:
            reason = "multiple_accepted" if question["answer"] in official else "wrong_answer"
            issues.append({"id": question["id"], "reason": reason, "bank_answer": question["answer"] + 1, "official_answers": [value + 1 for value in sorted(official)], "source": str(sources[key][0].relative_to(ROOT))})
    result = {"bank_count": len(questions), "official_papers": len(sources), "coverage": dict(coverage), "issues": issues}
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("bank", len(questions), "sources", len(sources), "issues", len(issues))
    for reason in sorted({issue["reason"] for issue in issues}):
        print(reason, sum(issue["reason"] == reason for issue in issues))
    print("report", OUT)
    if issues:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
