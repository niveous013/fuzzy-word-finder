# 听音查词

一个面向中文学习者的英文听音查词网页。用户输入猜测拼写，先推测读音，再按音素相似度寻找候选；可选的大语言模型会结合反馈、语境及本机学习摘要继续检索。

## 已实现的第一版能力

- 随网站发布约 9,400 个带美式读音的单词及常见短语；每批 8 个，可继续检索，不用无关词凑数。
- `breeth` 首选应为 `breathe`；同时显示待核对的 IPA 音标和候选的读音。
- “都不是”后可反馈元音、辅音、重音或音节问题，修改 IPA 或语境后重新推测。
- 用“元音、尾音、不发音字母、重复字母、词形”线索重新排序。
- 查询词典的音标、词性、英文释义、例句与可用发音。
- 查看词义后，必须明确点击“确认就是这个词”才加入学习记录。旧版仅查看产生的记录保留，但不纳入新学习档案。
- 本机学习档案按元音字母混淆、辅音／其他字母混淆、多写和漏写归类，并归纳正确词的可能领域；统计对排序只作有限加权。
- 不要求注册，最近 200 条记录只存在浏览器，可逐条或一键清除；删除后重新计算全部统计。自由文本语境不保存。

## 本地运行

在 **PowerShell** 中进入项目目录后运行：

```powershell
pnpm install
pnpm dev
```

终端会显示一个本地网址（通常是 `http://localhost:5173`）。打开它，输入 `becos` 并勾选“元音没听清”，应能看到 `because` 候选。

常用检查命令：

```powershell
pnpm test
pnpm build
```

**学习卡片｜环境变量**：环境变量是部署平台保管的配置值。公开的浏览器配置可以 `VITE_` 开头；任何密钥都不能这样命名，否则会被打包给所有访问者。

## 可选：免费模型辅助检索

DeepL 只负责翻译，不能用来推理音标或候选。可以先试 [Groq Free Plan](https://console.groq.com/docs/rate-limits)，额度按模型和账号限制，保持免费方案即可；超过额度会降级到本机检索。免费模型、地区可用性和额度可能变化，以服务商控制台为准。

1. 在 [Groq API Keys](https://console.groq.com/keys) 注册并创建密钥，不要发到聊天或提交到 Git。
2. 在 Vercel 当前项目的 Environment Variables 中添加以下变量，并勾选 Production（如要测试预览，也勾选 Preview）：

| 变量 | 值 |
| --- | --- |
| `LLM_API_KEY` | 在 Groq 创建的密钥 |
| `LLM_API_URL` | `https://api.groq.com/openai/v1/chat/completions` |
| `LLM_MODEL` | `openai/gpt-oss-20b`，若不可用，从控制台选择当前支持的模型 |

3. 重新部署后，在网站勾选“使用模型辅助检索”，输入 `breeth` 搜索；状态应明确显示模型已参与，而不是降级提示。
4. 模型未配置、超时、限流、无效响应时，页面明确提示并保留本机检索。模型建议需要核对词典，不能保证正确。

接口兼容常见 Chat Completions JSON 格式；更换服务商时只修改上表三个服务端变量，并确认该模型支持 JSON object 响应及 `max_completion_tokens`。

启用模型前，用户在页面主动勾选。浏览器经 `/api/refine` 发送本次猜测、读音、语境和聚合错误／领域摘要；不发送原始查询历史或已选词列表。不建云端用户数据库，但 Vercel 和模型商可能保留请求或日志，保留政策需分别查看。

普通 `pnpm dev` 仅运行前端，不能运行 Vercel 函数；离线搜索可完整使用，模型请求会提示降级。完整服务端联调可使用 Vercel CLI 的 `vercel dev`，或部署 Preview 进行验证。

## 配置中文翻译

1. 注册 [DeepL API](https://www.deepl.com/pro-api)，创建 API Free 密钥。
2. 在本地，将 `.env.example` 复制为 `.env.local`，填写 `DEEPL_AUTH_KEY`；不要把该文件提交到 Git。
3. 在 Vercel 的 Project Settings → Environment Variables 中填入相同的 `DEEPL_AUTH_KEY`。

该变量只由 `/api/lookup` 服务端接口读取，浏览器永远拿不到它。未配置时，英文词典仍可用，中文短释义会显示为不可用。

## 部署到 Vercel

1. 将项目推送到自己的 Git 仓库，并在 Vercel 导入该仓库。
2. 在 Vercel Environment Variables 填入 `DEEPL_AUTH_KEY`；如需模型辅助，再填上述三个 LLM 变量。
3. 部署预览版本，依次验证：候选搜索、公开词典、中文短释义、发音播放、删除本机记录。
4. `main` 是 Production 分支时，推送 `main` 会更新正式网站；推送其他分支通常生成 Preview。环境变量变化需要重新部署才生效。

本次更新检查：`pnpm test` 覆盖听音排序、继续检索、读音修正、领域加权、确认才学习、旧记录兼容、清空，以及模型接口降级与输出校验；`pnpm build` 同时检查前端和 API 的 TypeScript 类型。

## 数据来源和能力边界

- 发音来源：[CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict)，转换为宽式美式 IPA；保留 [原许可证](src/data/licenses/CMUDICT.txt)。这不是人工音标校订或英美全口音词典，重音分音节采用近似规则。
- 词汇筛选／词频参考：[google-10000-english](https://github.com/first20hours/google-10000-english)，与 CMU 数据交集并补充部分常见词，共 9,407 条带发音词目。保留 [频率表许可声明](src/data/licenses/FREQUENCY.md)。该来源许可对商业用途有约束，本项目用于学习研究，商业发布前需替换或单独确认授权。
- 可读领域词表和常见短语位于 `src/data/lexicon.ts`。本机领域推断基于词表标签和关键词，未知词不会强行分类；模型启用后可扩展候选并推断领域。
- 词表不涵盖所有英语词，规则不能唯一确定未知拼写的发音，重音和音节反馈也只是尝试另一种假设。候选标签解释可能的差异，不能证明用户实际听错了什么。
- `scripts/build-lexicon.mjs <原始数据目录>` 读取 `fuzzy-cmudict.txt` 和 `fuzzy-frequency.txt`，重新生成提交在仓库里的 `src/data/pronunciations.ts`；正常安装和部署无需联网下载数据。

本次开发尚未用真实模型密钥完成联网验收；自动化测试使用模拟服务响应，不消耗模型额度。

> 公开词典接口和免费翻译额度适合学习与小流量试用。正式商用前，请独立确认数据授权、稳定性、成本和隐私政策。
