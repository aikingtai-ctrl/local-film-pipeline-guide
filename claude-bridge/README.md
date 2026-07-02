# claude-bridge

让 n8n 通过 HTTP 调用 **Claude Code**,为影视流水线的创作环节(小说→剧本、剧本→分镜、粗剪质检)服务。

## 为什么跑在宿主机而不是 Docker

Claude Code 会加载 `~/.claude` 下的**技能**(如 `documentary-director`)和**项目记忆**(《锦衣少年行》《故宫之下》设定)。
让 bridge 以你本人身份在 B 宿主机原生运行,这些资产自动生效——这正是它比本地 vLLM 强的地方。
n8n(在 Docker 里)通过 `http://宿主机IP:8787` 调它即可。

## 安装 & 启动

```bash
# 1) 配置认证(从 platform.claude.com 获取)
export ANTHROPIC_API_KEY="sk-ant-..."      # 建议写进 ~/.bashrc

# 2) 安装依赖
npm install

# 3) 常驻运行(需先 npm i -g pm2)
pm2 start claude-bridge.mjs
pm2 save

# 4) 冒烟测试
curl -X POST localhost:8787/agent \
  -H 'content-type: application/json' \
  -d '{"prompt":"说你好并列出你能看到的技能"}'
```

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/health` | 健康检查 |
| POST | `/agent` | 执行一次 Claude Code 任务 |

### POST /agent 请求体

```json
{
  "prompt": "读 /media/proj01/novel.txt 改编成短剧剧本,写到 screenplay.md",
  "cwd": "/media/proj01",
  "allowedTools": ["Read", "Write"],
  "resume": "上一集返回的 session_id(可选,跨集续接)",
  "systemAppend": "你是资深短剧编剧,遵循用户的创作范式(可选)"
}
```

### 响应

```json
{ "result": "……", "session_id": "uuid", "cost": 0.0123, "num_turns": 4 }
```

把 `session_id` 存进 n8n,下一集请求带上 `resume` 即可保持系列圣经连续性。

## 注意

- Claude Code 调用 Anthropic **云 API**。上云的只有**文本**(小说/剧本/分镜),所有画面/视频/声音始终本地。
- 生产建议加反向代理限制来源 IP、加 API token 校验。
