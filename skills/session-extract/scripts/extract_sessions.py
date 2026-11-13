#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""把任意会话记录整理成可增量阅读的结构化文本。

不读取 agentsview，也不依赖某一种产品的数据库。调用方给出文件或目录，
脚本负责识别常见记录格式、跳过噪音、按内容哈希做增量水位。
哪些话值得长期记住，由 SKILL.md 决定，并且用简体中文写下来。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

MAX_BYTES = 32 * 1024 * 1024
MAX_MESSAGE_CHARS = 100_000
SUFFIXES = {".jsonl", ".json", ".md", ".markdown", ".txt"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".session-extract"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SPEAKER_HEADING = re.compile(
    r"^#{1,6}\s*(用户|助手|系统|user|assistant|human|ai|system)\s*[:：]?\s*$",
    re.IGNORECASE,
)
SPEAKER_LINE = re.compile(
    r"^(?:\*\*|__)?(用户|助手|系统|user|assistant|human|ai|system)(?:\*\*|__)?\s*[:：]\s*(.*)$",
    re.IGNORECASE,
)
FILE_ARG = re.compile(r"(?:file_path|path|file|target)=([^\s]+)")
ROLE_ALIASES = {
    "user": "user",
    "human": "user",
    "用户": "user",
    "assistant": "assistant",
    "ai": "assistant",
    "bot": "assistant",
    "model": "assistant",
    "助手": "assistant",
    "system": "system",
    "系统": "system",
    "tool": "tool",
    "function": "tool",
    "工具": "tool",
}
ROLE_ZH = {"user": "用户", "assistant": "助手", "tool": "工具", "system": "系统"}
KIND_ZH = {
    "markdown": "Markdown 对话",
    "text": "纯文本",
    "messages": "消息列表",
    "claude-jsonl": "Claude 记录",
    "codex-jsonl": "Codex 记录",
    "chatgpt-export": "ChatGPT 导出",
    "jsonl": "JSONL",
}
TOOL_KEYS = ("command", "cmd", "file_path", "path", "file", "target", "query", "pattern", "url")


@dataclass
class Parsed:
    messages: list[dict[str, Any]]
    source_kind: str
    external_id: str | None = None
    title: str | None = None
    cwd: str | None = None
    started_at: str | None = None


@dataclass
class View:
    since: str | None = None
    until: str | None = None
    project: str | None = None
    source: str | None = None
    min_user_messages: int = 1
    include_subagents: bool = False
    limit: int | None = None
    max_content: int = 2000
    include_tools: bool = False


@dataclass
class IngestReport:
    new: int = 0
    updated: int = 0
    unchanged: int = 0
    removed: int = 0
    skipped: list[dict[str, str]] = field(default_factory=list)

    def summary(self) -> str:
        return (
            f"新写入 {self.new} 个会话，更新 {self.updated} 个，"
            f"未变化 {self.unchanged} 个，移除 {self.removed} 个，"
            f"跳过 {len(self.skipped)} 个。"
        )

    def recognized(self) -> int:
        return self.new + self.updated + self.unchanged


def normalize_role(role: Any) -> str | None:
    if role is None:
        return None
    text = str(role).strip()
    return ROLE_ALIASES.get(text.lower()) or ROLE_ALIASES.get(text)


def normalize_ts(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        stamp = float(value)
        if stamp > 10_000_000_000:
            stamp /= 1000
        return datetime.fromtimestamp(stamp, timezone.utc).isoformat(timespec="seconds")
    if not isinstance(value, str):
        return None
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.isoformat(timespec="seconds")


def clip_text(text: str, limit: int) -> tuple[str, bool]:
    if limit <= 0 or len(text) <= limit:
        return text, False
    return text[:limit], True


def clip_one_line(text: str, limit: int) -> str:
    flat = " ".join(text.split())
    clipped, _ = clip_text(flat, limit)
    return clipped


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def message(role: str, content: str, timestamp: str | None) -> dict[str, Any]:
    text = content.strip()
    if len(text) > MAX_MESSAGE_CHARS:
        text = text[:MAX_MESSAGE_CHARS]
    return {"role": role, "content": text, "timestamp": timestamp}


def summarize_tool_input(value: Any) -> str:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return ""
        try:
            value = json.loads(stripped)
        except json.JSONDecodeError:
            return clip_one_line(stripped, 180)
    if isinstance(value, dict):
        parts = []
        for key in TOOL_KEYS:
            item = value.get(key)
            if item:
                parts.append(f"{key}={clip_one_line(str(item), 120)}")
        if parts:
            return " ".join(parts[:4])
        return clip_one_line(json.dumps(value, ensure_ascii=False), 180)
    if value is None:
        return ""
    return clip_one_line(str(value), 180)


def split_content(content: Any) -> tuple[str, list[str]]:
    """把一条内容拆成可读正文，以及一行一个的工具摘要。思维链和工具输出丢掉。"""
    if content is None:
        return "", []
    if isinstance(content, str):
        return content.strip(), []
    if isinstance(content, (int, float)):
        return str(content), []
    if isinstance(content, dict):
        parts = content.get("parts")
        if isinstance(parts, list):
            texts = [part.strip() for part in parts if isinstance(part, str) and part.strip()]
            return "\n".join(texts), []
        if isinstance(content.get("text"), str):
            return content["text"].strip(), []
        return "", []
    if isinstance(content, list):
        texts: list[str] = []
        tools: list[str] = []
        for block in content:
            if isinstance(block, str):
                if block.strip():
                    texts.append(block.strip())
                continue
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            if block_type in {"thinking", "reasoning", "tool_result"}:
                continue
            if block_type == "tool_use":
                name = str(block.get("name") or "tool")
                tools.append(f"[工具 {name}] {summarize_tool_input(block.get('input'))}".strip())
                continue
            if isinstance(block.get("text"), str) and block["text"].strip():
                texts.append(block["text"].strip())
        return "\n".join(texts).strip(), tools
    return "", []


def turns_from_record(obj: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    meta: dict[str, Any] = {}
    if isinstance(obj.get("cwd"), str):
        meta["cwd"] = obj["cwd"]

    if obj.get("type") == "event_msg" and isinstance(obj.get("payload"), dict):
        meta["kind"] = "codex"
        payload = obj["payload"]
        timestamp = normalize_ts(obj.get("timestamp"))
        event_type = payload.get("type")
        if event_type == "user_message":
            text = payload.get("message") if isinstance(payload.get("message"), str) else ""
            return ([message("user", text, timestamp)] if text.strip() else []), meta
        if event_type == "agent_message":
            text = payload.get("message") if isinstance(payload.get("message"), str) else ""
            return ([message("assistant", text, timestamp)] if text.strip() else []), meta
        return [], meta

    if obj.get("type") == "response_item" and isinstance(obj.get("payload"), dict):
        meta["kind"] = "codex"
        payload = obj["payload"]
        timestamp = normalize_ts(obj.get("timestamp"))
        if payload.get("type") == "function_call":
            name = str(payload.get("name") or "tool")
            line = f"[工具 {name}] {summarize_tool_input(payload.get('arguments'))}".strip()
            return [message("tool", line, timestamp)], meta
        if payload.get("type") == "message":
            return emit_role_content(payload.get("role") or "assistant", payload.get("content"), timestamp), meta
        return [], meta

    wrapped = obj.get("message") if isinstance(obj.get("message"), dict) else None
    if obj.get("type") in {"user", "assistant", "system"} and wrapped is not None:
        meta["kind"] = "claude"
        timestamp = normalize_ts(obj.get("timestamp"))
        role = wrapped.get("role") or obj.get("type")
        return emit_role_content(role, wrapped.get("content"), timestamp), meta

    role = normalize_role(obj.get("role") or obj.get("type"))
    if role is None:
        return [], meta
    meta["kind"] = "plain"
    timestamp = normalize_ts(obj.get("timestamp") or obj.get("time") or obj.get("created_at"))
    content = obj.get("content")
    if content is None:
        content = obj.get("text") if "text" in obj else obj.get("message")
    return emit_role_content(role, content, timestamp), meta


def emit_role_content(role: Any, content: Any, timestamp: str | None) -> list[dict[str, Any]]:
    normalized = normalize_role(role)
    text, tools = split_content(content)
    out: list[dict[str, Any]] = []
    if text and normalized and normalized != "system":
        out.append(message(normalized, text, timestamp))
    out.extend(message("tool", tool, timestamp) for tool in tools if tool)
    return out


def parse_jsonl(text: str) -> list[Parsed]:
    groups: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    kinds = {"claude": False, "codex": False}

    def bucket(key: str) -> dict[str, Any]:
        if key not in groups:
            groups[key] = {
                "messages": [],
                "cwd": None,
                "started_at": None,
                "external_id": key or None,
            }
            order.append(key)
        return groups[key]

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(obj, dict):
            continue
        turns, meta = turns_from_record(obj)
        if not turns:
            continue
        key = str(obj.get("sessionId") or obj.get("session_id") or "")
        current = bucket(key)
        kind = meta.get("kind")
        if kind in kinds:
            kinds[kind] = True
        if meta.get("cwd") and not current["cwd"]:
            current["cwd"] = meta["cwd"]
        for turn in turns:
            if turn.get("timestamp") and not current["started_at"]:
                current["started_at"] = turn["timestamp"]
            current["messages"].append(turn)

    if not order:
        return []
    if kinds["claude"]:
        source_kind = "claude-jsonl"
    elif kinds["codex"]:
        source_kind = "codex-jsonl"
    else:
        source_kind = "jsonl"
    multiple = len(order) > 1
    parsed: list[Parsed] = []
    for key in order:
        current = groups[key]
        if not current["messages"]:
            continue
        parsed.append(
            Parsed(
                messages=current["messages"],
                source_kind=source_kind,
                external_id=current["external_id"] if multiple else None,
                cwd=current["cwd"],
                started_at=current["started_at"],
            )
        )
    return parsed


def is_message_dict(obj: Any) -> bool:
    if not isinstance(obj, dict):
        return False
    role = normalize_role(obj.get("role") or obj.get("type"))
    return role is not None and any(key in obj for key in ("content", "text", "message"))


def messages_from_dicts(items: list[Any]) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        turns, _meta = turns_from_record(item)
        messages.extend(turns)
    return messages


def messages_from_chatgpt_mapping(mapping: Any) -> list[dict[str, Any]]:
    if not isinstance(mapping, dict):
        return []
    nodes = {key: value for key, value in mapping.items() if isinstance(value, dict)}
    if not nodes:
        return []
    child_ids = set()
    for node in nodes.values():
        for child in node.get("children") or []:
            child_ids.add(child)
    roots = [key for key in nodes if key not in child_ids] or list(nodes)[:1]
    messages: list[dict[str, Any]] = []
    seen: set[str] = set()

    def walk(node_id: str) -> None:
        if node_id in seen or node_id not in nodes:
            return
        seen.add(node_id)
        node = nodes[node_id]
        raw = node.get("message")
        if isinstance(raw, dict):
            author = raw.get("author") if isinstance(raw.get("author"), dict) else {}
            role = normalize_role(author.get("role"))
            content = raw.get("content")
            text, _tools = split_content(content)
            if text and role in {"user", "assistant"}:
                messages.append(message(role, text, normalize_ts(raw.get("create_time"))))
        for child in node.get("children") or []:
            if isinstance(child, str):
                walk(child)

    for root in roots:
        walk(root)
    return messages


def message_list_of(obj: dict[str, Any]) -> list[Any] | None:
    for key in ("messages", "conversation", "transcript"):
        value = obj.get(key)
        if isinstance(value, list) and all(is_message_dict(item) for item in value):
            return value
    return None


def parse_json_value(data: Any) -> list[Parsed]:
    if isinstance(data, list):
        if not data:
            return []
        if all(isinstance(item, dict) and "mapping" in item for item in data):
            parsed = []
            for index, item in enumerate(data, start=1):
                messages = messages_from_chatgpt_mapping(item.get("mapping"))
                if not messages:
                    continue
                title = item.get("title") if isinstance(item.get("title"), str) else None
                external = str(index) if len(data) > 1 else None
                if external and title:
                    external = f"{index}-{clip_one_line(title, 40)}"
                parsed.append(Parsed(messages, "chatgpt-export", external_id=external, title=title))
            return parsed
        if all(isinstance(item, dict) and message_list_of(item) is not None for item in data):
            parsed = []
            multiple = len(data) > 1
            for index, item in enumerate(data, start=1):
                messages = messages_from_dicts(message_list_of(item) or [])
                if not messages:
                    continue
                title = item.get("title") if isinstance(item.get("title"), str) else None
                parsed.append(
                    Parsed(
                        messages,
                        "messages",
                        external_id=str(index) if multiple else None,
                        title=title,
                    )
                )
            return parsed
        if all(is_message_dict(item) for item in data):
            messages = messages_from_dicts(data)
            return [Parsed(messages, "messages")] if messages else []
        return []
    if isinstance(data, dict):
        if isinstance(data.get("mapping"), dict):
            messages = messages_from_chatgpt_mapping(data.get("mapping"))
            if not messages:
                return []
            title = data.get("title") if isinstance(data.get("title"), str) else None
            return [Parsed(messages, "chatgpt-export", title=title)]
        listed = message_list_of(data)
        if listed is not None:
            messages = messages_from_dicts(listed)
            if not messages:
                return []
            title = data.get("title") if isinstance(data.get("title"), str) else None
            return [Parsed(messages, "messages", title=title)]
    return []


def parse_json_text(text: str) -> list[Parsed]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    return parse_json_value(data)


def parse_markdown(text: str) -> list[dict[str, Any]] | None:
    role: str | None = None
    buffer: list[str] = []
    messages: list[dict[str, Any]] = []
    found = False

    def flush() -> None:
        nonlocal buffer
        if role is None:
            buffer = []
            return
        body = "\n".join(buffer).strip()
        buffer = []
        if body and role != "system":
            messages.append(message(role, body, None))

    for raw in text.splitlines():
        line = raw.strip()
        heading = SPEAKER_HEADING.match(line)
        spoken = None if heading else SPEAKER_LINE.match(line)
        if heading or spoken:
            found = True
            flush()
            label = heading.group(1) if heading else spoken.group(1)
            role = normalize_role(label)
            buffer = []
            if spoken and spoken.group(2).strip():
                buffer = [spoken.group(2).strip()]
            continue
        if role is not None:
            buffer.append(raw)
    flush()
    if not found:
        return None
    return messages


def read_text(path: Path) -> str | None:
    data = path.read_bytes()
    if b"\x00" in data[:4096]:
        return None
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return None


def parse_transcript_file(path: Path, *, explicit: bool) -> tuple[list[Parsed], str | None]:
    if path.stat().st_size > MAX_BYTES:
        return [], "文件太大"
    text = read_text(path)
    if text is None:
        return [], "不是 UTF-8 文本"
    if not text.strip():
        return [], "没有可提取的发言"
    suffix = path.suffix.lower()

    def from_markdown() -> list[Parsed]:
        messages = parse_markdown(text or "")
        if messages:
            return [Parsed(messages, "markdown")]
        if messages is None and explicit and text.strip():
            return [Parsed([message("user", text, None)], "text")]
        return []

    if suffix == ".jsonl":
        parsed = parse_jsonl(text)
        return (parsed, None) if parsed else ([], "没有可提取的发言")
    if suffix == ".json":
        parsed = parse_json_text(text) or parse_jsonl(text)
        return (parsed, None) if parsed else ([], "不是会话")
    if suffix in {".md", ".markdown", ".txt"}:
        parsed = from_markdown()
        if parsed:
            return parsed, None
        return [], "没有说话人标记"
    if explicit:
        parsed = parse_json_text(text) or parse_jsonl(text) or from_markdown()
        if parsed:
            return parsed, None
        if text.strip():
            return [Parsed([message("user", text, None)], "text")], None
    return [], "不是会话"


def content_hash(messages: list[dict[str, Any]]) -> str:
    payload = [{"role": item["role"], "content": item["content"]} for item in messages]
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def derive_title(messages: list[dict[str, Any]], fallback: str, explicit: str | None) -> str:
    if explicit and explicit.strip():
        return clip_one_line(explicit, 80)
    for item in messages:
        if item["role"] == "user" and item["content"].strip():
            return clip_one_line(item["content"], 80)
    for item in messages:
        if item["content"].strip():
            return clip_one_line(item["content"], 80)
    return fallback


def files_from_messages(messages: list[dict[str, Any]]) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for item in messages:
        if item["role"] != "tool":
            continue
        for match in FILE_ARG.finditer(item["content"]):
            value = match.group(1).rstrip(",.;)")
            if value not in seen:
                seen.add(value)
                found.append(value)
            if len(found) >= 8:
                return found
    return found


def tool_hints(messages: list[dict[str, Any]]) -> list[str]:
    hints: list[str] = []
    seen: set[str] = set()
    for item in messages:
        if item["role"] != "tool":
            continue
        hint = clip_one_line(item["content"], 180)
        if hint and hint not in seen:
            seen.add(hint)
            hints.append(hint)
        if len(hints) >= 12:
            break
    return hints


def is_subagent_path(display_path: str) -> bool:
    parts = {part.lower() for part in display_path.split("/")}
    return bool(parts & {"subagent", "subagents"})


def display_path_for(path: Path, root: Path) -> str:
    if root.is_file():
        return path.name
    try:
        relative = path.resolve().relative_to(root.resolve())
    except ValueError:
        relative = Path(path.name)
    return relative.as_posix()


def project_name(display_path: str, root: Path) -> str:
    parts = display_path.split("/")
    if len(parts) > 1:
        return parts[0]
    return root.parent.name if root.is_file() else root.name


def file_mtime_iso(path: Path) -> str:
    """没有自带时间的记录，按本机本地时间归天，避免日记跨过零点对不上。"""
    return datetime.fromtimestamp(path.stat().st_mtime).astimezone().isoformat(timespec="seconds")


def make_session_id(display_path: str, external_id: str | None) -> str:
    if external_id:
        return f"{display_path}::{external_id}"
    return display_path


def build_session(path: Path, root: Path, parsed: Parsed) -> dict[str, Any]:
    display_path = display_path_for(path, root)
    messages = parsed.messages
    user_count = sum(1 for item in messages if item["role"] == "user")
    assistant_count = sum(1 for item in messages if item["role"] == "assistant")
    return {
        "id": make_session_id(display_path, parsed.external_id),
        "display_path": display_path,
        "source_path": str(path.resolve()),
        "source_root": str(root.resolve()),
        "source_kind": parsed.source_kind,
        "external_id": parsed.external_id,
        "project": project_name(display_path, root),
        "title": derive_title(messages, path.stem, parsed.title),
        "cwd": parsed.cwd or "",
        "started_at": parsed.started_at or file_mtime_iso(path),
        "content_hash": content_hash(messages),
        "subagent": is_subagent_path(display_path),
        "user_message_count": user_count,
        "assistant_message_count": assistant_count,
        "files": files_from_messages(messages),
        "tool_hints": tool_hints(messages),
        "messages": messages,
    }


def resolve_state(override: str | None) -> Path:
    if override:
        return Path(override).expanduser()
    env = os.environ.get("SESSION_EXTRACT_HOME")
    if env:
        return Path(env).expanduser()
    return Path.cwd() / ".session-extract"


def sessions_dir(state: Path) -> Path:
    return state / "sessions"


def watermark_path(state: Path) -> Path:
    return state / "watermark.json"


def pending_path(state: Path) -> Path:
    return state / "pending.json"


def session_file(state: Path, session_id: str) -> Path:
    digest = hashlib.sha256(session_id.encode("utf-8")).hexdigest()[:20]
    return sessions_dir(state) / f"{digest}.json"


def atomic_write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def load_json(path: Path, default: Any) -> Any:
    if not path.is_file():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def load_watermark(state: Path) -> dict[str, Any]:
    data = load_json(watermark_path(state), {"processed": {}, "last_run": None})
    if not isinstance(data, dict):
        data = {"processed": {}, "last_run": None}
    if not isinstance(data.get("processed"), dict):
        data["processed"] = {}
    data.setdefault("last_run", None)
    return data


def load_pending(state: Path) -> dict[str, str]:
    data = load_json(pending_path(state), {"pending": {}})
    pending = data.get("pending") if isinstance(data, dict) else {}
    if not isinstance(pending, dict):
        return {}
    return {str(key): str(value) for key, value in pending.items()}


def load_sessions(state: Path) -> list[dict[str, Any]]:
    folder = sessions_dir(state)
    if not folder.is_dir():
        return []
    sessions = []
    for path in sorted(folder.glob("*.json")):
        data = load_json(path, None)
        if isinstance(data, dict) and isinstance(data.get("id"), str):
            sessions.append(data)
    return sessions


def iter_source_files(root: Path, state: Path) -> Iterable[Path]:
    if root.is_file():
        yield root
        return
    state_resolved = state.resolve()
    for dirpath, dirnames, filenames in os.walk(root):
        current = Path(dirpath).resolve()
        if current == state_resolved or state_resolved in current.parents:
            dirnames.clear()
            continue
        dirnames[:] = [
            name
            for name in dirnames
            if name not in SKIP_DIRS
            and not name.startswith(".")
            and (Path(dirpath) / name).resolve() != state_resolved
        ]
        for name in filenames:
            if name.startswith("."):
                continue
            path = Path(dirpath) / name
            if path.suffix.lower() in SUFFIXES:
                yield path


def under_root(source: Path, root: Path) -> bool:
    root_resolved = root.resolve()
    source_resolved = source.resolve()
    if root.is_file():
        return source_resolved == root_resolved
    try:
        source_resolved.relative_to(root_resolved)
    except ValueError:
        return False
    return True


def ingest_path(root: Path, state: Path) -> IngestReport:
    state.mkdir(parents=True, exist_ok=True)
    report = IngestReport()
    seen: set[str] = set()
    existing = {item["id"]: item for item in load_sessions(state)}
    for path in iter_source_files(root, state):
        parsed_list, reason = parse_transcript_file(path, explicit=root.is_file())
        if not parsed_list:
            report.skipped.append({"路径": str(path), "原因": reason or "不是会话"})
            continue
        for parsed in parsed_list:
            session = build_session(path, root, parsed)
            seen.add(session["id"])
            previous = existing.get(session["id"])
            if previous and previous.get("content_hash") == session["content_hash"]:
                report.unchanged += 1
                continue
            atomic_write(session_file(state, session["id"]), session)
            if previous:
                report.updated += 1
            else:
                report.new += 1
    for session in existing.values():
        source = Path(str(session.get("source_path") or ""))
        if session["id"] in seen or not under_root(source, root):
            continue
        path = session_file(state, session["id"])
        if path.is_file():
            path.unlink()
            report.removed += 1
    return report


def session_day(session: dict[str, Any]) -> str:
    started = str(session.get("started_at") or "")
    if DATE_RE.match(started[:10]):
        return started[:10]
    return "未知日期"


def normalize_source_filter(value: str | None) -> str | None:
    if value is None:
        return None
    aliases = {label: key for key, label in KIND_ZH.items()}
    aliases.update({key: key for key in KIND_ZH})
    return aliases.get(value, value)


def is_processed(session: dict[str, Any], watermark: dict[str, Any]) -> bool:
    record = watermark.get("processed", {}).get(session["id"])
    return isinstance(record, dict) and record.get("hash") == session.get("content_hash")


def matches(session: dict[str, Any], view: View) -> bool:
    if session.get("subagent") and not view.include_subagents:
        return False
    if int(session.get("user_message_count") or 0) < view.min_user_messages:
        return False
    if view.project and session.get("project") != view.project:
        return False
    if view.source and session.get("source_kind") != view.source:
        return False
    day = session_day(session)
    if view.since or view.until:
        if not DATE_RE.match(day):
            return False
        if view.since and day < view.since:
            return False
        if view.until and day > view.until:
            return False
    return True


def sort_sessions(sessions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(sessions, key=lambda item: (str(item.get("started_at") or ""), str(item["id"])))


def select_sessions(
    sessions: list[dict[str, Any]],
    view: View,
    watermark: dict[str, Any] | None = None,
    *,
    unprocessed_only: bool = False,
) -> list[dict[str, Any]]:
    chosen = [item for item in sessions if matches(item, view)]
    if unprocessed_only:
        watermark = watermark or {"processed": {}}
        chosen = [item for item in chosen if not is_processed(item, watermark)]
    chosen = sort_sessions(chosen)
    if view.limit is not None:
        return chosen[: view.limit]
    return chosen


def public_session(session: dict[str, Any], view: View) -> dict[str, Any]:
    messages = []
    for item in session.get("messages") or []:
        if item.get("role") == "tool" and not view.include_tools:
            continue
        if item.get("role") == "system":
            continue
        text, truncated = clip_text(str(item.get("content") or ""), view.max_content)
        messages.append(
            {
                "角色": ROLE_ZH.get(item.get("role"), item.get("role")),
                "内容": text,
                "时间": item.get("timestamp"),
                "被截断": truncated,
            }
        )
    return {
        "编号": session["id"],
        "标题": session.get("title") or "",
        "项目": session.get("project") or "",
        "格式": KIND_ZH.get(session.get("source_kind"), session.get("source_kind")),
        "路径": session.get("display_path") or "",
        "开始时间": session.get("started_at"),
        "工作目录": session.get("cwd") or "",
        "用户轮次": session.get("user_message_count") or 0,
        "助手轮次": session.get("assistant_message_count") or 0,
        "文件": session.get("files") or [],
        "工具": session.get("tool_hints") or [],
        "发言": messages,
    }


def group_days(sessions: list[dict[str, Any]], view: View, *, newest_first: bool) -> list[dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    ordered = sort_sessions(sessions)
    if newest_first:
        ordered = list(reversed(ordered))
    for session in ordered:
        buckets[session_day(session)].append(public_session(session, view))
    days = sorted(buckets, reverse=newest_first)
    return [{"日期": day, "会话": buckets[day]} for day in days]


def render_timeline(sessions: list[dict[str, Any]]) -> str:
    if not sessions:
        return "（没有匹配的会话）\n"
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for session in reversed(sort_sessions(sessions)):
        buckets[session_day(session)].append(session)
    lines: list[str] = []
    for day in sorted(buckets, reverse=True):
        lines.append(f"## {day}")
        lines.append("")
        for session in buckets[day]:
            kind = KIND_ZH.get(session.get("source_kind"), session.get("source_kind"))
            lines.append(
                f"- **{session.get('project') or '未命名'}** {session.get('title') or session['id']}"
                f"（{kind}，用户 {session.get('user_message_count') or 0} 轮）"
            )
            detail = f"  - 记录：{session.get('display_path') or session['id']}"
            started = str(session.get("started_at") or "")
            if "T" in started and len(started) >= 16:
                detail += f"；开始于 {started[11:16]}"
            lines.append(detail)
            files = session.get("files") or []
            if files:
                lines.append("  - 提到的文件：" + "、".join(files[:8]))
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def dump(payload: Any) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def fail(message: str) -> int:
    print(message, file=sys.stderr)
    return 1


def check_date(value: str | None, label: str) -> str | None:
    if value is None or DATE_RE.match(value):
        return None
    return f"{label}请写成 YYYY-MM-DD，例如 2026-11-12。"


def view_from_args(args: argparse.Namespace) -> View | str:
    since_error = check_date(getattr(args, "since", None), "开始日期")
    if since_error:
        return since_error
    until_error = check_date(getattr(args, "until", None), "结束日期")
    if until_error:
        return until_error
    return View(
        since=getattr(args, "since", None),
        until=getattr(args, "until", None),
        project=getattr(args, "project", None),
        source=normalize_source_filter(getattr(args, "source", None)),
        min_user_messages=getattr(args, "min_user_messages", 1),
        include_subagents=getattr(args, "include_subagents", False),
        limit=getattr(args, "limit", None),
        max_content=getattr(args, "max_content", 2000),
        include_tools=getattr(args, "include_tools", False),
    )


def cmd_ingest(args: argparse.Namespace) -> int:
    root = Path(args.path).expanduser()
    if not root.exists():
        return fail(f"找不到路径：{root}")
    state = resolve_state(args.state)
    report = ingest_path(root, state)
    dump(
        {
            "摘要": report.summary(),
            "新写入": report.new,
            "更新": report.updated,
            "未变化": report.unchanged,
            "移除": report.removed,
            "跳过": report.skipped,
            "状态目录": str(state),
        }
    )
    if report.recognized():
        return 0
    return 1


def cmd_status(args: argparse.Namespace) -> int:
    state = resolve_state(args.state)
    sessions = load_sessions(state)
    watermark = load_watermark(state)
    view = View(include_subagents=args.include_subagents)
    visible = select_sessions(sessions, view, watermark)
    processed = [item for item in visible if is_processed(item, watermark)]
    payload: dict[str, Any] = {
        "状态目录": str(state),
        "会话数": len(visible),
        "已处理": len(processed),
        "待处理": len(visible) - len(processed),
        "子代理": sum(1 for item in sessions if item.get("subagent")),
        "上次运行": watermark.get("last_run"),
    }
    if not sessions:
        payload["提示"] = "还没有会话。请先把记录文件或目录交给 ingest。"
    dump(payload)
    return 0


def touch_last_run(state: Path) -> dict[str, Any]:
    watermark = load_watermark(state)
    watermark["last_run"] = now_iso()
    atomic_write(watermark_path(state), watermark)
    return watermark


def cmd_fetch(args: argparse.Namespace) -> int:
    view = view_from_args(args)
    if isinstance(view, str):
        return fail(view)
    state = resolve_state(args.state)
    sessions = load_sessions(state)
    watermark = load_watermark(state)
    chosen = select_sessions(sessions, view, watermark, unprocessed_only=True)
    payload: dict[str, Any] = {
        "生成时间": now_iso(),
        "状态目录": str(state),
        "数量": len(chosen),
        "待提交": [item["id"] for item in chosen],
        "日期": group_days(chosen, view, newest_first=False),
    }
    if not sessions:
        payload["提示"] = "还没有会话。请先把记录文件或目录交给 ingest。"
    elif not chosen:
        payload["提示"] = "没有新的会话。进度已赶上，或筛选条件把它们排除了。"
    atomic_write(pending_path(state), {"pending": {item["id"]: item["content_hash"] for item in chosen}})
    touch_last_run(state)
    dump(payload)
    return 0


def cmd_timeline(args: argparse.Namespace) -> int:
    view = view_from_args(args)
    if isinstance(view, str):
        return fail(view)
    state = resolve_state(args.state)
    chosen = select_sessions(load_sessions(state), view)
    print(render_timeline(chosen), end="")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    view = view_from_args(args)
    if isinstance(view, str):
        return fail(view)
    state = resolve_state(args.state)
    found = next((item for item in load_sessions(state) if item["id"] == args.id), None)
    if found is None:
        return fail(f"没有这个会话：{args.id}")
    dump(public_session(found, view))
    return 0


def cmd_commit(args: argparse.Namespace) -> int:
    state = resolve_state(args.state)
    pending = load_pending(state)
    if not pending:
        return fail("没有待提交的会话。请先运行 fetch。")
    sessions = {item["id"]: item for item in load_sessions(state)}
    watermark = load_watermark(state)
    committed: list[str] = []
    stale: list[str] = []
    missing: list[str] = []
    for session_id, presented_hash in pending.items():
        session = sessions.get(session_id)
        if session is None:
            missing.append(session_id)
            continue
        if session.get("content_hash") != presented_hash:
            stale.append(session_id)
            continue
        watermark["processed"][session_id] = {
            "hash": presented_hash,
            "processed_at": now_iso(),
        }
        committed.append(session_id)
    watermark["last_run"] = now_iso()
    atomic_write(watermark_path(state), watermark)
    atomic_write(pending_path(state), {"pending": {}})
    parts = [f"已提交 {len(committed)} 个会话。"]
    if stale:
        parts.append(f"{len(stale)} 个会话内容已变，没有提交。")
    if missing:
        parts.append(f"{len(missing)} 个会话已经不在库里。")
    dump({"摘要": "".join(parts), "已提交": committed, "内容已变": stale, "找不到": missing})
    return 0 if committed else 1


def cmd_reset(args: argparse.Namespace) -> int:
    state = resolve_state(args.state)
    atomic_write(watermark_path(state), {"processed": {}, "last_run": None})
    atomic_write(pending_path(state), {"pending": {}})
    dump({"摘要": "已清空处理进度。会话原文还在，下次 fetch 会重新给出。"})
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="extract_sessions.py",
        description="把任意会话记录整理成可增量提取的结构化文本。不读取 agentsview。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "示例：\n"
            "  python extract_sessions.py ingest ./聊天记录\n"
            "  python extract_sessions.py fetch --limit 20\n"
            "  python extract_sessions.py timeline --since 2026-11-01\n"
            "  python extract_sessions.py commit\n"
        ),
    )
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--state", help="状态目录，默认是当前目录下的 .session-extract")
    sub = parser.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", parents=[common], help="读入一个文件或目录")
    ingest.add_argument("path", help="会话文件或目录")
    ingest.set_defaults(func=cmd_ingest)

    status = sub.add_parser("status", parents=[common], help="查看已读入、已处理和待处理的数量")
    status.add_argument("--include-subagents", action="store_true", help="把子代理会话也算进来")
    status.set_defaults(func=cmd_status)

    def add_filters(command: argparse.ArgumentParser, *, with_limit: bool) -> None:
        command.add_argument("--since", help="只看这一天和之后，格式 YYYY-MM-DD")
        command.add_argument("--until", help="只看这一天和之前，格式 YYYY-MM-DD")
        command.add_argument("--project", help="只看这个项目名")
        command.add_argument("--source", help="只看这种格式，例如 markdown、Claude 记录")
        command.add_argument("--min-user-messages", type=int, default=1, help="至少几条用户发言，默认 1")
        command.add_argument("--max-content", type=int, default=2000, help="每条发言最多保留多少字，0 表示不截断")
        command.add_argument("--include-subagents", action="store_true", help="包含路径里带 subagents 的会话")
        command.add_argument("--include-tools", action="store_true", help="发言里附带工具摘要")
        if with_limit:
            command.add_argument("--limit", type=int, help="最多给出多少个会话，按时间从旧到新")

    fetch = sub.add_parser("fetch", parents=[common], help="给出还没处理的会话，供抽取使用")
    add_filters(fetch, with_limit=True)
    fetch.set_defaults(func=cmd_fetch)

    timeline = sub.add_parser("timeline", parents=[common], help="按日期输出中文时间线，不看处理进度")
    add_filters(timeline, with_limit=True)
    timeline.set_defaults(func=cmd_timeline)

    show = sub.add_parser("show", parents=[common], help="查看一个会话")
    show.add_argument("id", help="fetch 里给出的编号")
    add_filters(show, with_limit=False)
    show.set_defaults(func=cmd_show)

    commit = sub.add_parser("commit", parents=[common], help="把最近一次 fetch 给出的会话标成已处理")
    commit.set_defaults(func=cmd_commit)

    reset = sub.add_parser("reset", parents=[common], help="清空处理进度，不删除已读入的会话")
    reset.set_defaults(func=cmd_reset)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
