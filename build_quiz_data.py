import json
import re
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
QUESTIONS_DIR = BASE_DIR / "questions"
ANSWERS_DIR = BASE_DIR / "answers"
OUT_DIR = BASE_DIR / "web" / "quiz-data"


QUESTION_RE = re.compile(r"^Q(\d+)\.\s*(.+)")
OPTION_RE = re.compile(r"^([A-D])\.\s*(.+)")
ANSWER_KEY_LINE_RE = re.compile(r"^(\d+)-([A-D])$")
ANSWER_LINE_MD_RE = re.compile(r"^(\d+)\.\s+\*\*([A-D])\*\*\s+[\u2013\-]\s*(.+)")


def slugify(name: str) -> str:
    """Create a safe slug from a filename/topic."""
    return (
        re.sub(r"[^a-z0-9]+", "-", name.lower())
        .strip("-")
    )


def parse_questions_file(path: Path):
    """
    Parse a questions .txt file into:
    - questions: {id, stem, options}
    - answer_key: mapping {id: correct_letter}
    """
    text = path.read_text(encoding="utf-8").splitlines()

    questions = []
    current_q = None
    in_answer_key = False
    answer_key = {}

    for raw in text:
        line = raw.strip()
        if not line:
            continue

        # Detect start of answer key section
        if line.lower().startswith("answer key"):
            in_answer_key = True
            continue

        if in_answer_key:
            m_key = ANSWER_KEY_LINE_RE.match(line)
            if m_key:
                qid = int(m_key.group(1))
                letter = m_key.group(2)
                answer_key[qid] = letter
            continue

        # Question line
        m_q = QUESTION_RE.match(line)
        if m_q:
            # Save previous question if any
            if current_q is not None:
                questions.append(current_q)
            qid = int(m_q.group(1))
            stem = m_q.group(2).strip()
            current_q = {
                "id": qid,
                "stem": stem,
                "options": {}
            }
            continue

        # Option line
        m_opt = OPTION_RE.match(line)
        if m_opt and current_q is not None:
            letter = m_opt.group(1)
            text_opt = m_opt.group(2).strip()
            current_q["options"][letter] = text_opt
            continue

    if current_q is not None:
        questions.append(current_q)

    return questions, answer_key


def parse_answers_md(path: Path):
    """
    Parse a markdown answer file into mapping:
      { question_id: { "correct": "B", "explanation": "..." } }
    """
    lines = path.read_text(encoding="utf-8").splitlines()
    data = {}

    for raw in lines:
        line = raw.strip()
        m = ANSWER_LINE_MD_RE.match(line)
        if not m:
            continue
        qid = int(m.group(1))
        letter = m.group(2)
        explanation = m.group(3).strip()
        data[qid] = {
            "correct": letter,
            "explanation": explanation,
        }

    return data


def build_topic_from_files(q_path: Path, a_path: Path):
    questions, key_from_q = parse_questions_file(q_path)
    answers_data = parse_answers_md(a_path)

    # Merge correct letters and explanations
    for q in questions:
        qid = q["id"]
        # Prefer markdown answers (have explanation)
        if qid in answers_data:
            q["correct"] = answers_data[qid]["correct"]
            q["explanation"] = answers_data[qid]["explanation"]
        else:
            # Fall back to answer key in questions file if present
            letter = key_from_q.get(qid)
            q["correct"] = letter
            q["explanation"] = ""

        # Convert options dict to sorted list
        options = []
        for letter in ["A", "B", "C", "D"]:
            if letter in q["options"]:
                options.append({
                    "label": letter,
                    "text": q["options"][letter],
                })
        q["options"] = options

    # Derive topic name from filename (strip extension)
    topic_name = q_path.stem

    return {
        "topic": topic_name,
        "slug": slugify(topic_name),
        "questions": questions,
    }


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    topic_files = []

    for q_path in sorted(QUESTIONS_DIR.glob("*.txt")):
        # Match corresponding markdown answer by same stem
        a_path = ANSWERS_DIR / (q_path.stem + ".md")
        if not a_path.exists():
            print(f"[WARN] No markdown answer file for {q_path.name}, skipping.")
            continue

        topic = build_topic_from_files(q_path, a_path)
        out_file = OUT_DIR / f"{topic['slug']}.json"
        out_file.write_text(json.dumps(topic, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"[OK] {q_path.name} -> {out_file.name}")

        topic_files.append({
            "topic": topic["topic"],
            "slug": topic["slug"],
            "file": out_file.name,
            "numQuestions": len(topic["questions"]),
        })

    # Write index of topics
    index_path = OUT_DIR / "index.json"
    index_path.write_text(json.dumps({"topics": topic_files}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] index.json with {len(topic_files)} topic(s)")


if __name__ == "__main__":
    main()


