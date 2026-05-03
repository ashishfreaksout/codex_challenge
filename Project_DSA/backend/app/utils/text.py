import re


def normalize_spacing(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    cleaned = normalize_spacing(text.replace("\n", " "))
    if not cleaned:
        return []

    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    return [part.strip() for part in parts if part.strip()]


def clip_sentence(sentence: str, max_length: int) -> str:
    sentence = normalize_spacing(sentence)
    if len(sentence) <= max_length:
        return sentence

    clipped = sentence[: max_length - 3].rstrip()
    return f"{clipped}..."
