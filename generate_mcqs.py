import os
from pathlib import Path
from textwrap import dedent

import openai  # pip install openai


# Configure your OpenAI API key via environment variable:
#   set OPENAI_API_KEY=sk-...
openai.api_key = os.getenv("OPENAI_API_KEY")


def decide_num_questions(text: str) -> int:
    """
    Decide how many questions to generate based on content length.
    Minimum 15, maximum 25.
    """
    # Rough heuristic: ~1 question per 12 non-empty lines.
    lines = [ln for ln in text.splitlines() if ln.strip()]
    estimated = max(15, min(25, len(lines) // 12))
    return estimated


def build_prompt(topic_name: str, source_text: str, num_questions: int) -> str:
    """
    Build a structured prompt asking the model to generate MCQs plus
    a detailed answer key with explanations.
    """
    return dedent(
        f"""
        You are an expert veterinary medicine exam writer.
        Create high‑quality multiple‑choice questions for DVM students
        based on the content below about: "{topic_name}".

        Requirements:
        - Generate EXACTLY {num_questions} single‑best‑answer MCQs.
        - 4 options per question (A–D).
        - Only ONE correct option per question.
        - Vary difficulty: some basic recall, some application/clinical reasoning.
        - Use precise, clinically accurate wording.

        OUTPUT FORMAT IS CRITICAL. Follow it EXACTLY:

        [QUESTIONS]
        Q1. <question stem>
        A. <option>
        B. <option>
        C. <option>
        D. <option>

        Q2. <question stem>
        A. ...
        B. ...
        C. ...
        D. ...

        ...

        Answer key:
        1-<letter>
        2-<letter>
        ...
        {num_questions}-<letter>
        [/QUESTIONS]

        [ANSWERS]
        1. <letter> - <1–3 sentence explanation why this is correct and why the others are not best>
        2. <letter> - <explanation>
        ...
        {num_questions}. <letter> - <explanation>
        [/ANSWERS]

        Do NOT add any extra commentary before, between, or after these blocks.

        SOURCE CONTENT (slides text):
        ----
        {source_text}
        ----
        """
    ).strip()


def call_openai(prompt: str) -> str:
    """
    Call OpenAI ChatCompletion with the given prompt.
    Uses gpt-4o-mini by default (adjust model if desired).
    """
    if not openai.api_key:
        raise RuntimeError(
            "OPENAI_API_KEY environment variable is not set. "
            "Set it before running this script."
        )

    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a precise, concise exam item writer."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )
    return response.choices[0].message["content"]


def split_questions_and_answers(full_output: str) -> tuple[str, str]:
    """
    Split the model output into questions and answers sections by markers.
    """
    start_q = full_output.find("[QUESTIONS]")
    end_q = full_output.find("[/QUESTIONS]")
    start_a = full_output.find("[ANSWERS]")
    end_a = full_output.find("[/ANSWERS]")

    if min(start_q, end_q, start_a, end_a) == -1:
        raise ValueError("Model output missing one of the required markers.")

    questions_block = full_output[start_q + len("[QUESTIONS]") : end_q].strip()
    answers_block = full_output[start_a + len("[ANSWERS]") : end_a].strip()
    return questions_block, answers_block


def process_single_source_file(source_path: Path, questions_dir: Path, answers_dir: Path):
    text = source_path.read_text(encoding="utf-8")
    num_questions = decide_num_questions(text)

    topic_name = source_path.stem  # filename without extension
    prompt = build_prompt(topic_name, text, num_questions)

    print(f"Generating {num_questions} questions for: {source_path.name}")
    raw_output = call_openai(prompt)

    questions_block, answers_block = split_questions_and_answers(raw_output)

    # Use same base filename in questions/ and answers/ directories
    q_out = questions_dir / source_path.name
    a_out = answers_dir / source_path.name

    q_out.write_text(questions_block + "\n", encoding="utf-8")
    a_out.write_text(answers_block + "\n", encoding="utf-8")

    print(f"  -> Questions saved to: {q_out}")
    print(f"  -> Answers  saved to: {a_out}")


def main():
    base_dir = Path(__file__).resolve().parent
    parsed_dir = base_dir / "parsed"
    questions_dir = base_dir / "questions"
    answers_dir = base_dir / "answers"

    questions_dir.mkdir(exist_ok=True)
    answers_dir.mkdir(exist_ok=True)

    if not parsed_dir.is_dir():
        raise FileNotFoundError(f"Parsed directory not found: {parsed_dir}")

    txt_files = sorted(parsed_dir.glob("*.txt"))
    if not txt_files:
        print(f"No .txt files found in {parsed_dir}")
        return

    print(f"Found {len(txt_files)} source file(s) in {parsed_dir}")

    for src in txt_files:
        try:
            process_single_source_file(src, questions_dir, answers_dir)
        except Exception as e:
            print(f"[ERROR] Failed on {src.name}: {e}")


if __name__ == "__main__":
    main()


