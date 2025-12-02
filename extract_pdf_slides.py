import PyPDF2
from pathlib import Path


def pdf_to_markdown(input_pdf: str):
    """
    Extracts text from each page of a PDF (assumed to be PPT slides saved as PDF)
    and writes it to a .txt file with the same base name as the PDF.

    Example:
        input:  lecture1.pdf
        output: lecture1.txt
    """
    pdf_path = Path(input_pdf)
    reader = PyPDF2.PdfReader(str(pdf_path))

    lines = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = text.strip()
        if not text:
            continue

        lines.append(f"=== SLIDE {i} ===")
        lines.append(text)
        lines.append("")  # blank line between slides

    # output file has same name as the PDF, but with .txt extension
    out_path = pdf_path.with_suffix(".txt")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] {pdf_path.name} -> {out_path.name}")


if __name__ == "__main__":
    """
    Run from the terminal to convert **all PDF files in the current directory**.

    Example:
        cd "C:\\Documents\\Sam Files\\2025\\Finals_December"
        python extract_pdf_slides.py
    """
    cwd = Path(".").resolve()
    pdf_files = sorted(cwd.glob("*.pdf"))

    if not pdf_files:
        print(f"No PDF files found in {cwd}")
    else:
        print(f"Found {len(pdf_files)} PDF file(s) in {cwd}")
        for pdf in pdf_files:
            pdf_to_markdown(str(pdf))