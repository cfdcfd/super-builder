"""会话提取脚本的行为测试。

覆盖常见记录格式、中文输出，以及不依赖 agentsview 的增量水位。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

import extract_sessions as ex  # noqa: E402


def run(argv: list[str]) -> tuple[int, dict | str]:
    from io import StringIO
    from contextlib import redirect_stderr, redirect_stdout

    stdout, stderr = StringIO(), StringIO()
    with redirect_stdout(stdout), redirect_stderr(stderr):
        code = ex.main(argv)
    text = stdout.getvalue()
    if text.strip().startswith("{") or text.strip().startswith("["):
        return code, json.loads(text)
    return code, text + stderr.getvalue()


def test_chinese_markdown_speakers():
    text = """# 登录讨论

## 用户

不要用 localStorage 存令牌。

## 助手

改成 httpOnly cookie。

用户：还有，报错原文保留。
助手：好。
"""
    messages = ex.parse_markdown(text)
    assert messages is not None
    assert [item["role"] for item in messages] == ["user", "assistant", "user", "assistant"]
    assert "localStorage" in messages[0]["content"]
    assert "报错原文保留" in messages[2]["content"]


def test_heading_without_speaker_is_not_a_turn():
    assert ex.parse_markdown("## 用户须知\n\n随便写点说明。\n") is None


def test_directory_skips_project_files_and_keeps_dialogue(tmp_path: Path):
    root = tmp_path / "repo"
    notes = root / "notes"
    notes.mkdir(parents=True)
    (root / "package.json").write_text('{"name":"demo","version":"1.0.0"}\n', encoding="utf-8")
    (root / "README.md").write_text("# 项目\n\n这是说明，不是对话。\n", encoding="utf-8")
    (notes / "登录.md").write_text("用户：登录不要用邮件。\n助手：只用短信验证码。\n", encoding="utf-8")
    (root / "garbage.bin").write_bytes(b"\x00\x01")
    state = tmp_path / "state"
    report = ex.ingest_path(root, state)
    assert report.new == 1
    assert report.recognized() == 1
    reasons = {item["原因"] for item in report.skipped}
    assert "不是会话" in reasons
    assert "没有说话人标记" in reasons
    sessions = ex.load_sessions(state)
    assert len(sessions) == 1
    assert sessions[0]["title"] == "登录不要用邮件。"
    assert sessions[0]["project"] == "notes"
    assert sessions[0]["source_kind"] == "markdown"


def test_explicit_plain_text_is_one_user_turn(tmp_path: Path):
    note = tmp_path / "备忘.txt"
    note.write_text("这是一整段备忘，没有说话人。\n", encoding="utf-8")
    code, payload = run(["ingest", str(note), "--state", str(tmp_path / "state")])
    assert code == 0
    assert payload["新写入"] == 1
    session = ex.load_sessions(tmp_path / "state")[0]
    assert session["source_kind"] == "text"
    assert session["messages"][0]["role"] == "user"
    assert "备忘" in session["messages"][0]["content"]


def test_claude_jsonl_drops_noise_and_keeps_tool_file(tmp_path: Path):
    raw = "\n".join(
        [
            json.dumps(
                {
                    "type": "system",
                    "message": {"role": "system", "content": "你是一个秘密系统提示"},
                },
                ensure_ascii=False,
            ),
            json.dumps(
                {
                    "type": "user",
                    "sessionId": "ses_1",
                    "timestamp": "2026-11-12T09:41:00Z",
                    "cwd": "/repo",
                    "message": {"role": "user", "content": "登录不要用邮件，改成短信验证码"},
                },
                ensure_ascii=False,
            ),
            json.dumps(
                {
                    "type": "assistant",
                    "sessionId": "ses_1",
                    "timestamp": "2026-11-12T09:42:00Z",
                    "message": {
                        "role": "assistant",
                        "content": [
                            {"type": "thinking", "thinking": "思维链不该出现"},
                            {"type": "text", "text": "好，只改短信。"},
                            {
                                "type": "tool_use",
                                "name": "Edit",
                                "input": {
                                    "file_path": "src/auth.ts",
                                    "old": "SHOULD_NOT_APPEAR_OLD_STRING",
                                },
                            },
                        ],
                    },
                },
                ensure_ascii=False,
            ),
            json.dumps(
                {
                    "type": "user",
                    "sessionId": "ses_1",
                    "message": {"role": "user", "content": [{"type": "tool_result", "content": "big log"}]},
                },
                ensure_ascii=False,
            ),
            "这行不是 json",
            json.dumps(
                {
                    "type": "user",
                    "sessionId": "ses_2",
                    "timestamp": "2026-11-13T08:00:00Z",
                    "message": {"role": "user", "content": "第二条会话"},
                },
                ensure_ascii=False,
            ),
        ]
    )
    path = tmp_path / "agent.jsonl"
    path.write_text(raw, encoding="utf-8")
    state = tmp_path / "state"
    assert ex.ingest_path(path, state).new == 2
    code, payload = run(["fetch", "--state", str(state), "--max-content", "2000"])
    assert code == 0
    assert payload["数量"] == 2
    blob = json.dumps(payload, ensure_ascii=False)
    assert "秘密系统提示" not in blob
    assert "思维链不该出现" not in blob
    assert "SHOULD_NOT_APPEAR_OLD_STRING" not in blob
    assert "短信验证码" in blob
    first = payload["日期"][0]["会话"][0]
    assert first["格式"] == "Claude 记录"
    assert first["文件"] == ["src/auth.ts"]
    assert any("Edit" in hint for hint in first["工具"])
    assert all(item["角色"] != "工具" for item in first["发言"])
    assert first["用户轮次"] == 1


def test_fetch_can_include_tools_and_clip_chinese(tmp_path: Path):
    path = tmp_path / "chat.jsonl"
    path.write_text(
        json.dumps({"role": "user", "content": "短信验证码要保留原文报错"}) + "\n",
        encoding="utf-8",
    )
    state = tmp_path / "state"
    ex.ingest_path(path, state)
    code, payload = run(["fetch", "--state", str(state), "--max-content", "4"])
    assert code == 0
    spoken = payload["日期"][0]["会话"][0]["发言"][0]
    assert spoken["角色"] == "用户"
    assert spoken["内容"] == "短信验证"
    assert spoken["被截断"] is True


def test_codex_and_chatgpt_exports(tmp_path: Path):
    codex = tmp_path / "rollout.jsonl"
    codex.write_text(
        "\n".join(
            [
                json.dumps(
                    {
                        "type": "event_msg",
                        "timestamp": "2026-11-12T01:00:00Z",
                        "payload": {"type": "user_message", "message": "把按钮文案改成确定"},
                    }
                ),
                json.dumps(
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "function_call",
                            "name": "shell",
                            "arguments": json.dumps({"command": "npm test"}),
                        },
                    }
                ),
                json.dumps(
                    {
                        "type": "event_msg",
                        "timestamp": "2026-11-12T01:05:00Z",
                        "payload": {"type": "agent_message", "message": "测试过了"},
                    }
                ),
            ]
        ),
        encoding="utf-8",
    )
    chatgpt = tmp_path / "conversations.json"
    chatgpt.write_text(
        json.dumps(
            [
                {
                    "title": "登录",
                    "mapping": {
                        "root": {"children": ["a"]},
                        "a": {
                            "children": ["b"],
                            "message": {
                                "author": {"role": "user"},
                                "content": {"parts": ["不要用邮件"]},
                                "create_time": 1762900000,
                            },
                        },
                        "b": {
                            "children": [],
                            "message": {
                                "author": {"role": "assistant"},
                                "content": {"parts": ["只用短信"]},
                            },
                        },
                    },
                },
                {
                    "title": "空对话",
                    "mapping": {"root": {"children": [], "message": None}},
                },
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    state = tmp_path / "state"
    report = ex.ingest_path(tmp_path, state)
    assert report.new == 2
    sessions = {item["source_kind"]: item for item in ex.load_sessions(state)}
    assert sessions["codex-jsonl"]["tool_hints"][0].startswith("[工具 shell]")
    assert "npm test" in sessions["codex-jsonl"]["tool_hints"][0]
    assert sessions["chatgpt-export"]["title"] == "登录"
    assert sessions["chatgpt-export"]["messages"][0]["content"] == "不要用邮件"


def test_incremental_watermark_and_chinese_timeline(tmp_path: Path):
    root = tmp_path / "记录"
    root.mkdir()
    target = root / "登录.md"
    target.write_text("用户：先用邮件验证码。\n助手：好。\n", encoding="utf-8")
    state = tmp_path / "state"
    assert run(["ingest", str(root), "--state", str(state)])[0] == 0
    code, fetched = run(["fetch", "--state", str(state), "--limit", "20"])
    assert code == 0
    assert fetched["数量"] == 1
    session_id = fetched["待提交"][0]

    target.write_text("用户：不要用邮件，改成短信。\n助手：已改。\n", encoding="utf-8")
    updated = run(["ingest", str(root), "--state", str(state)])[1]
    assert updated["更新"] == 1
    code, stale = run(["commit", "--state", str(state)])
    assert code == 1
    assert stale["内容已变"] == [session_id]

    code, refetched = run(["fetch", "--state", str(state)])
    assert refetched["数量"] == 1
    assert run(["commit", "--state", str(state)])[0] == 0
    code, again = run(["fetch", "--state", str(state)])
    assert again["数量"] == 0
    assert "没有新的会话" in again["提示"]
    timeline = run(["timeline", "--state", str(state)])[1]
    assert "不要用邮件，改成短信。" in timeline
    assert "记录：" in timeline
    assert "用户 1 轮" in timeline

    assert run(["reset", "--state", str(state)])[0] == 0
    assert run(["fetch", "--state", str(state)])[1]["数量"] == 1


def test_filters_subagents_dates_and_source(tmp_path: Path):
    root = tmp_path / "repo"
    (root / "subagents").mkdir(parents=True)
    (root / "可见.md").write_text("用户：主会话要留下来。\n助手：好。\n", encoding="utf-8")
    (root / "subagents" / "任务.jsonl").write_text(
        json.dumps(
            {
                "role": "user",
                "content": "子代理内部草稿",
                "timestamp": "2026-11-12T00:00:00Z",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    (root / "只有助手.jsonl").write_text(
        json.dumps({"role": "assistant", "content": "没人问我就先说了", "timestamp": "2026-11-12T00:00:00Z"})
        + "\n",
        encoding="utf-8",
    )
    state = tmp_path / "state"
    ex.ingest_path(root, state)
    status = run(["status", "--state", str(state)])[1]
    assert status["会话数"] == 1
    assert status["子代理"] == 1
    fetched = run(["fetch", "--state", str(state), "--source", "Markdown 对话"])[1]
    assert fetched["数量"] == 1
    assert "子代理内部草稿" not in json.dumps(fetched, ensure_ascii=False)
    included = run(["fetch", "--state", str(state), "--include-subagents", "--min-user-messages", "0"])[1]
    assert included["数量"] == 3
    dated = run(
        ["fetch", "--state", str(state), "--until", "2026-11-11", "--include-subagents", "--min-user-messages", "0"]
    )[1]
    assert dated["数量"] == 0


def test_prune_removed_file_and_ignore_state_dir(tmp_path: Path):
    root = tmp_path / "notes"
    root.mkdir()
    keep = root / "留下.md"
    drop = root / "删掉.md"
    keep.write_text("用户：留下这条。\n助手：好。\n", encoding="utf-8")
    drop.write_text("用户：这条会删。\n助手：好。\n", encoding="utf-8")
    state = root / ".session-extract"
    first = ex.ingest_path(root, state)
    assert first.new == 2
    drop.unlink()
    second = ex.ingest_path(root, state)
    assert second.removed == 1
    assert second.unchanged == 1
    assert len(ex.load_sessions(state)) == 1


def test_missing_path_bad_date_and_help(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    code, _payload = run(["ingest", str(tmp_path / "不存在"), "--state", str(tmp_path / "state")])
    assert code == 1
    code, message = run(["timeline", "--since", "昨天", "--state", str(tmp_path / "state")])
    assert code == 1
    assert "YYYY-MM-DD" in message
    with pytest.raises(SystemExit) as exc:
        ex.main(["-h"])
    assert exc.value.code == 0
    help_text = capsys.readouterr().out
    assert "不读取 agentsview" in help_text
    assert "聊天记录" in help_text


def test_does_not_need_an_agentsview_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AGENTSVIEW_DATA_DIR", str(tmp_path / "missing-db"))
    note = tmp_path / "对话.md"
    note.write_text("**用户**：今天只记这一件。\n**助手**：记下了。\n", encoding="utf-8")
    code, payload = run(["ingest", str(note), "--state", str(tmp_path / "state")])
    assert code == 0
    assert payload["新写入"] == 1
    shown = run(["show", "对话.md", "--state", str(tmp_path / "state")])[1]
    assert shown["发言"][0]["内容"] == "今天只记这一件。"


def test_oversized_and_non_utf8_are_skipped(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(ex, "MAX_BYTES", 20)
    root = tmp_path / "raw"
    root.mkdir()
    (root / "太大.md").write_text("用户：这封太长了，不应该读进来。\n", encoding="utf-8")
    (root / "乱码.txt").write_bytes("用户：乱码".encode("gbk"))
    report = ex.ingest_path(root, tmp_path / "state")
    assert report.new == 0
    assert {item["原因"] for item in report.skipped} == {"文件太大", "不是 UTF-8 文本"}
