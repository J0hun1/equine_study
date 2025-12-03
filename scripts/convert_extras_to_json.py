import json
import re
from pathlib import Path


def parse_questions_file(filepath: Path):
    """Parse questions and answer key from questions.txt."""
    content = filepath.read_text(encoding="utf-8")

    questions = []
    answer_key = {}

    # Extract answer key section
    answer_key_match = re.search(r"Answer key:\s*\n((?:\d+-[A-D]\s*\n?)+)", content, re.MULTILINE)
    if answer_key_match:
        for line in answer_key_match.group(1).strip().splitlines():
            if "-" in line:
                num_str, ans = line.strip().split("-", 1)
                num_str = num_str.strip()
                ans = ans.strip()
                if num_str.isdigit():
                    answer_key[int(num_str)] = ans

    # Parse Q blocks
    q_pattern = r"Q(\d+)\.\s*(.+?)(?=Q\d+\.|Answer key:|$)"
    for m in re.finditer(q_pattern, content, re.DOTALL):
        q_id = int(m.group(1))
        block = m.group(2).strip()
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        stem = lines[0]
        options = []
        for ln in lines[1:]:
            opt_m = re.match(r"^([A-D])\.\s+(.+)$", ln)
            if opt_m:
                label = opt_m.group(1)
                text = opt_m.group(2).strip()
                options.append({"label": label, "text": text})
        if stem and len(options) == 4:
            questions.append(
                {
                    "id": q_id,
                    "stem": stem,
                    "options": options,
                    "correct": answer_key.get(q_id, ""),
                    "explanation": "",
                }
            )

    return questions, answer_key


def parse_answers_file(filepath: Path):
    """Parse explanations from answers.txt."""
    content = filepath.read_text(encoding="utf-8")
    explanations = {}

    # Pattern like: 1. **B** – explanation...
    pattern = r"(\d+)\.\s+\*\*([A-D])\*\*\s*–\s*(.+?)(?=\n\d+\.\s+\*\*[A-D]\*\*|\Z)"
    for m in re.finditer(pattern, content, re.DOTALL):
        q_id = int(m.group(1))
        explanation = m.group(3).strip()
        explanations[q_id] = explanation

    return explanations


def main():
    base = Path(__file__).parent.parent
    q_path = base / "questions.txt"
    a_path = base / "answers.txt"
    out_dir = base / "docs" / "quiz-data"
    out_dir.mkdir(parents=True, exist_ok=True)

    questions, answer_key = parse_questions_file(q_path)
    explanations = parse_answers_file(a_path)

    # Merge explanations
    for q in questions:
        q_id = q["id"]
        if q_id in explanations:
            q["explanation"] = explanations[q_id]

    data = {
        "topic": "Extras",
        "slug": "extras",
        "questions": questions,
    }

    extras_file = out_dir / "extras.json"
    extras_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # Insert Extras at top of index.json
    index_path = out_dir / "index.json"
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        index = {"topics": []}

    topics = index.get("topics", [])

    # Remove existing extras entry if any
    topics = [t for t in topics if t.get("slug") != "extras"]

    extras_topic = {
        "topic": "Extras",
        "slug": "extras",
        "file": "extras.json",
        "numQuestions": len(questions),
    }

    topics.insert(0, extras_topic)
    index["topics"] = topics

    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Created extras.json with {len(questions)} questions and updated index.json")


if __name__ == "__main__":
    main()


