# brief-v2 演示（GitHub Pages）

本目录由 `prepare_github_pages.py` 生成，含幻灯片 `index.html` 与可嵌入的 `frontend/` 原型（`app.html`、Accio `accio/index.html`）。

## 部署到 GitHub（[chenchen-stack](https://github.com/chenchen-stack)）

1. 在 GitHub 新建空仓库（例如 `brief-v2-presentation`），**不要**勾选添加 README。
2. 在本机进入本目录上一级，把生成物作为仓库根推送：

```bash
cd brief-v2-github-pages
git init
git add .
git commit -m "Add brief-v2 deck and frontend embeds for GitHub Pages"
git branch -M main
git remote add origin https://github.com/chenchen-stack/brief-v2-presentation.git
git push -u origin main
```

3. 仓库 **Settings → Pages**：Source 选 **Deploy from a branch**，Branch **main** / **/ (root)**，保存。
4. 约 1～2 分钟后访问：`https://chenchen-stack.github.io/brief-v2-presentation/`（公开仓库默认路径）。

## 说明

- 幻灯片内 iframe 加载同仓库下的 `frontend/app.html`、`frontend/accio/index.html`，需联网加载字体/CDN 资源；Accio 页若含 API Key 门槛，按页面提示仅本地保存密钥。
- 若 `PPT/assets/` 下无截图文件，部分页会以 iframe 实机或留空 fallback，属预期。
- 更新幻灯片后重新运行 `python prepare_github_pages.py` 再推送。

