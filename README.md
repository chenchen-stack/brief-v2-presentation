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

3. 开启站点（任选其一，不要两个混用）：
   - **推荐**：仓库 **Settings → Pages → Build and deployment**，**Source** 选 **GitHub Actions**，保存。推送本仓库后，打开 **Actions** 页签，等 **Deploy GitHub Pages** 变绿。首次需在 **Settings → Actions → General** 里允许 **Read and write** 工作流权限（默认多数仓库已够）。
   - **或**：Source 选 **Deploy from a branch**，Branch 选 **main**，文件夹 **/ (root)**，保存；等 1～3 分钟再访问。
4. 线上地址：<https://chenchen-stack.github.io/brief-v2-presentation/>

### 若浏览器显示 404（There isn't a GitHub Pages site here）

- 多半是 **Pages 未开启** 或 **Source 未选对**。请再检查 **Settings → Pages**。
- 使用 **GitHub Actions** 时，必须能看到 **Actions** 里最近一次部署成功；失败时点进日志查看原因。
- 公开仓库一般几分钟内生效；可强制刷新或换无痕窗口。

## 说明

- 幻灯片内 iframe 加载同仓库下的 `frontend/app.html`、`frontend/accio/index.html`，需联网加载字体/CDN 资源；Accio 页若含 API Key 门槛，按页面提示仅本地保存密钥。
- 若 `PPT/assets/` 下无截图文件，部分页会以 iframe 实机或留空 fallback，属预期。
- 更新幻灯片后重新运行 `python prepare_github_pages.py` 再推送。

