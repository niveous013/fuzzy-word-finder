# 听音查词

一个面向中文学习者的电脑版英文“模糊查词”网页。用户输入自己猜测的拼写，系统用拼写接近度、简化读音规则和听辨线索给出可解释的候选词。

## 已实现的第一版能力

- 输入猜测单词或常见短语，返回最多 8 个候选与原因。
- 用“元音、尾音、不发音字母、重复字母、词形”线索重新排序。
- 查询词典的音标、词性、英文释义、例句与可用发音。
- 匿名查询记录只保存在当前浏览器，可删除；语境不保存。
- 不要求注册：查询历史和轻量偏好只保存在当前浏览器，可逐条或一键清除。

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

## 配置中文翻译

1. 注册 [DeepL API](https://www.deepl.com/pro-api)，创建 API Free 密钥。
2. 在本地，将 `.env.example` 复制为 `.env.local`，填写 `DEEPL_AUTH_KEY`；不要把该文件提交到 Git。
3. 在 Vercel 的 Project Settings → Environment Variables 中填入相同的 `DEEPL_AUTH_KEY`。

该变量只由 `/api/lookup` 服务端接口读取，浏览器永远拿不到它。未配置时，英文词典仍可用，中文短释义会显示为不可用。

## 部署到 Vercel

1. 将项目推送到自己的 Git 仓库，并在 Vercel 导入该仓库。
2. 在 Vercel Project Settings → Environment Variables 填入唯一的 `DEEPL_AUTH_KEY`。
3. 部署预览版本，依次验证：候选搜索、公开词典、中文短释义、发音播放、删除本机记录。
4. 验证完成后部署 Production。后续每次推送代码，Vercel 会创建预览；确认无误后合并即可更新正式网站。

> 公开词典接口和免费翻译额度适合学习与小流量试用。正式商用前，请独立确认数据授权、稳定性、成本和隐私政策。
