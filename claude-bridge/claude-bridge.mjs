// claude-bridge —— 让 n8n 通过 HTTP 调用 Claude Code(Agent SDK 封装)
// 跑在 B 宿主机(非 Docker),自动加载 ~/.claude 里的技能与项目记忆。
// 启动: pm2 start claude-bridge.mjs   (先 npm install)
// 前置: export ANTHROPIC_API_KEY="sk-ant-..."

import express from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";

const app = express();
app.use(express.json({ limit: "20mb" }));

// 健康检查:n8n 或你手动 curl 确认服务在线
app.get("/health", (_req, res) => res.json({ ok: true, service: "claude-bridge" }));

/**
 * POST /agent
 * body: {
 *   prompt:       string   必填,给 Claude Code 的任务
 *   cwd:          string   工作目录(共享盘),默认 /media
 *   allowedTools: string[] 非交互放行的工具,默认 [Read,Write,Glob,Grep]
 *   resume:       string   上一步返回的 session_id,用于跨集续接系列圣经
 *   systemAppend: string   追加到系统提示(注入导演/编剧方法论)
 * }
 * 返回: { result, session_id, cost, num_turns }
 */
app.post("/agent", async (req, res) => {
  const {
    prompt,
    cwd = "/media",
    allowedTools = ["Read", "Write", "Glob", "Grep"],
    resume,
    systemAppend,
  } = req.body || {};

  if (!prompt) return res.status(400).json({ error: "prompt is required" });

  try {
    let result = "";
    let sessionId = null;
    let cost = null;
    let numTurns = null;

    for await (const msg of query({
      prompt,
      options: {
        cwd,
        allowedTools,
        permissionMode: "acceptEdits", // 非交互:自动放行文件写入
        appendSystemPrompt: systemAppend,
        ...(resume ? { resume } : {}),
      },
    })) {
      if (msg.type === "result") {
        result = msg.result ?? "";
        sessionId = msg.session_id ?? null;
        cost = msg.total_cost_usd ?? null;
        numTurns = msg.num_turns ?? null;
      }
    }

    res.json({ result, session_id: sessionId, cost, num_turns: numTurns });
  } catch (e) {
    console.error("agent error:", e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

const PORT = process.env.BRIDGE_PORT || 8787;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`claude-bridge listening on :${PORT}  (ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? "set" : "MISSING!"})`)
);
