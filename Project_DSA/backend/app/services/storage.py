from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import json
from pathlib import Path
import secrets
import sqlite3
from typing import Any, Optional
from uuid import uuid4

from app.models.schemas import (
    AnalysisResponse,
    SavedAnalysisDetail,
    SavedAnalysisSummary,
    UserPreferences,
    UserProfile,
)

DATABASE_DIR = Path(__file__).resolve().parents[2] / "app_data"
DATABASE_PATH = DATABASE_DIR / "dont_sign_anything.sqlite3"
PASSWORD_ITERATIONS = 180_000


def init_database() -> None:
    DATABASE_DIR.mkdir(parents=True, exist_ok=True)
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                preferences_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS analyses (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                document_name TEXT NOT NULL,
                document_type TEXT NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_level TEXT NOT NULL,
                finding_count INTEGER NOT NULL,
                analysis_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )


def create_user(email: str, password: str) -> UserProfile:
    init_database()
    normalized_email = _normalize_email(email)
    salt = secrets.token_hex(16)
    password_hash = _hash_password(password, salt)
    preferences = UserPreferences()
    now = _now()

    try:
        with _connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (email, password_hash, salt, preferences_json, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    normalized_email,
                    password_hash,
                    salt,
                    preferences.model_dump_json(),
                    now,
                ),
            )
            user_id = int(cursor.lastrowid)
    except sqlite3.IntegrityError as exc:
        raise ValueError("An account already exists for that email.") from exc

    return UserProfile(id=user_id, email=normalized_email, preferences=preferences)


def authenticate_user(email: str, password: str) -> Optional[UserProfile]:
    init_database()
    user_row = _get_user_row_by_email(_normalize_email(email))
    if not user_row:
        return None

    expected_hash = _hash_password(password, user_row["salt"])
    if not hmac.compare_digest(expected_hash, user_row["password_hash"]):
        return None

    return _row_to_user_profile(user_row)


def create_session(user_id: int) -> str:
    init_database()
    token = secrets.token_urlsafe(32)
    with _connect() as connection:
        connection.execute(
            "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, _now()),
        )
    return token


def get_user_by_token(token: str) -> Optional[UserProfile]:
    init_database()
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT users.*
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()

    return _row_to_user_profile(row) if row else None


def update_user_preferences(user_id: int, preferences: UserPreferences) -> UserProfile:
    init_database()
    with _connect() as connection:
        connection.execute(
            "UPDATE users SET preferences_json = ? WHERE id = ?",
            (preferences.model_dump_json(), user_id),
        )
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    if not row:
        raise ValueError("User not found.")
    return _row_to_user_profile(row)


def save_analysis(user_id: int, analysis: AnalysisResponse, document_name: Optional[str]) -> SavedAnalysisDetail:
    init_database()
    now = _now()
    analysis_id = str(uuid4())
    resolved_name = (document_name or analysis.document_name or "Untitled agreement").strip()
    analysis_payload = analysis.model_dump()
    analysis_payload["document_name"] = resolved_name

    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO analyses (
                id, user_id, document_name, document_type, risk_score, risk_level,
                finding_count, analysis_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                analysis_id,
                user_id,
                resolved_name,
                analysis.document_type,
                analysis.risk_score,
                analysis.risk_level,
                len(analysis.detected_risks),
                json.dumps(analysis_payload),
                now,
                now,
            ),
        )

    return SavedAnalysisDetail(
        id=analysis_id,
        document_name=resolved_name,
        document_type=analysis.document_type,
        risk_score=analysis.risk_score,
        risk_level=analysis.risk_level,
        finding_count=len(analysis.detected_risks),
        created_at=now,
        updated_at=now,
        analysis=AnalysisResponse(**analysis_payload),
    )


def list_saved_analyses(user_id: int) -> list[SavedAnalysisSummary]:
    init_database()
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT id, document_name, document_type, risk_score, risk_level,
                   finding_count, created_at, updated_at
            FROM analyses
            WHERE user_id = ?
            ORDER BY updated_at DESC
            """,
            (user_id,),
        ).fetchall()

    return [_row_to_saved_summary(row) for row in rows]


def get_saved_analysis(user_id: int, analysis_id: str) -> Optional[SavedAnalysisDetail]:
    init_database()
    with _connect() as connection:
        row = connection.execute(
            "SELECT * FROM analyses WHERE user_id = ? AND id = ?",
            (user_id, analysis_id),
        ).fetchone()

    return _row_to_saved_detail(row) if row else None


def rename_saved_analysis(user_id: int, analysis_id: str, document_name: str) -> Optional[SavedAnalysisDetail]:
    init_database()
    existing = get_saved_analysis(user_id, analysis_id)
    if not existing:
        return None

    now = _now()
    updated_payload = existing.analysis.model_dump()
    updated_payload["document_name"] = document_name

    with _connect() as connection:
        connection.execute(
            """
            UPDATE analyses
            SET document_name = ?, analysis_json = ?, updated_at = ?
            WHERE user_id = ? AND id = ?
            """,
            (document_name, json.dumps(updated_payload), now, user_id, analysis_id),
        )

    return get_saved_analysis(user_id, analysis_id)


def delete_saved_analysis(user_id: int, analysis_id: str) -> bool:
    init_database()
    with _connect() as connection:
        cursor = connection.execute(
            "DELETE FROM analyses WHERE user_id = ? AND id = ?",
            (user_id, analysis_id),
        )
    return cursor.rowcount > 0


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _get_user_row_by_email(email: str) -> Optional[sqlite3.Row]:
    with _connect() as connection:
        return connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def _row_to_user_profile(row: sqlite3.Row) -> UserProfile:
    return UserProfile(
        id=int(row["id"]),
        email=row["email"],
        preferences=UserPreferences(**json.loads(row["preferences_json"])),
    )


def _row_to_saved_summary(row: sqlite3.Row) -> SavedAnalysisSummary:
    return SavedAnalysisSummary(
        id=row["id"],
        document_name=row["document_name"],
        document_type=row["document_type"],
        risk_score=int(row["risk_score"]),
        risk_level=row["risk_level"],
        finding_count=int(row["finding_count"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _row_to_saved_detail(row: sqlite3.Row) -> SavedAnalysisDetail:
    summary = _row_to_saved_summary(row)
    analysis_data: dict[str, Any] = json.loads(row["analysis_json"])
    return SavedAnalysisDetail(**summary.model_dump(), analysis=AnalysisResponse(**analysis_data))


def _hash_password(password: str, salt: str) -> str:
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        PASSWORD_ITERATIONS,
    )
    return password_hash.hex()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
