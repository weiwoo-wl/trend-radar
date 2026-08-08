# 趋势雷达数据看板 - 部署指南

> **域名**：chinghuo.com
> **GitHub**：weiwoo-wl（邮箱 shwl3030@yahoo.com）

---

## 架构说明

```
GitHub仓库 (weiwoo-wl/trend-radar)
├── index.html          # 看板主页面
├── css/style.css       # 样式
├── js/data.js          # 数据文件（每天自动更新）
├── js/app.js           # 渲染逻辑
├── CNAME               # 自定义域名配置 → chinghuo.com
├── scripts/
│   ├── fetch_data.py   # 数据抓取脚本（AKShare）
│   └── requirements.txt
├── .github/workflows/
│   └── daily-update.yml # 定时任务（每天16:30 CST运行）
├── .nojekyll
└── DEPLOY.md           # 本文件
```

**工作流程：**
1. 每个交易日 16:30（北京时间），GitHub Actions 自动运行
2. 脚本用 AKShare 抓取当日收盘数据（指数、成交额、资金流向、融资融券等）
3. 重新生成 `js/data.js` 并自动提交
4. GitHub Pages 自动更新，chinghuo.com 上看到最新数据

---

## 部署步骤（照着做就行）

### 第一步：创建 GitHub 仓库

1. 登录 [github.com](https://github.com)（用 shwl3030@yahoo.com 登录）
2. 点击右上角 `+` → `New repository`
3. 仓库名称：`trend-radar`
4. 选择 **Public**（免费账户 Pages 必须选 Public）
5. **不要**勾选 `Add a README file`（我们会推送完整文件）
6. 点击 `Create repository`

### 第二步：推送文件到 GitHub

在本地打开终端（Git Bash / PowerShell 都行），执行：

```bash
cd C:\Users\shwl3\WorkBuddy\2026-08-07-17-03-17\dashboard

# 初始化 git 仓库
git init
git add .
git commit -m "初始化趋势雷达数据看板"
git branch -M main

# 关联远程仓库并推送
git remote add origin https://github.com/weiwoo-wl/trend-radar.git
git push -u origin main
```

> 如果提示输入账号密码，GitHub 已不支持密码登录，需要用 Personal Access Token：
> 1. 打开 https://github.com/settings/tokens
> 2. `Generate new token (classic)` → 勾选 `repo` 权限 → 生成
> 3. 推送时密码栏粘贴 Token

### 第三步：开启 GitHub Pages

1. 进入仓库 `Settings` → `Pages`
2. `Source` 选择 `Deploy from a branch`
3. `Branch` 选择 `main`，文件夹选 `/ (root)`
4. 点击 `Save`
5. 等 1-2 分钟，页面顶部显示：`Your site is live at https://weiwoo-wl.github.io/trend-radar/`

### 第四步：绑定域名 chinghuo.com

**在 GitHub 这边：**
1. 进入仓库 `Settings` → `Pages`
2. 在 `Custom domain` 输入框填入 `chinghuo.com`
3. 点击 `Save`
4. 勾选 `Enforce HTTPS`（等 DNS 生效后才能勾，GitHub 免费提供 SSL 证书）

**在域名服务商那边配置 DNS（关键！）：**

去你买 chinghuo.com 的地方（阿里云/腾讯云/Namesilo/GoDaddy 等），添加以下 DNS 记录：

| 记录类型 | 主机记录 | 记录值 | 说明 |
|---------|---------|--------|------|
| A | @ | 185.199.108.153 | GitHub Pages IP 1 |
| A | @ | 185.199.109.153 | GitHub Pages IP 2 |
| A | @ | 185.199.110.153 | GitHub Pages IP 3 |
| A | @ | 185.199.111.153 | GitHub Pages IP 4 |
| CNAME | www | weiwoo-wl.github.io | www 子域名跳转 |

> **说明**：4 条 A 记录都要加，把 chinghuo.com 直接指向 GitHub Pages。
> CNAME 的 www 记录让 www.chinghuo.com 也能访问。
> DNS 生效时间：通常几分钟，最长 24 小时。

### 第五步：启用 GitHub Actions（每天自动更新数据）

1. 进入仓库 `Actions` 标签页
2. 如果提示 `Workflows aren't being run`，点击 `I understand my workflows, go ahead and enable them`
3. 左侧能看到 `每日数据更新` 工作流
4. 点进去，右上角 `Run workflow` → `Run workflow` 手动测试一次
5. 等 2-3 分钟运行完成，去仓库看 `js/data.js` 是否有新提交 `data: auto-update xxx`

### 第六步：验证

- ✅ 打开 `https://chinghuo.com` 看看看板是否正常显示
- ✅ 在 GitHub 仓库的 `Commits` 中，应能看到自动提交记录
- ✅ 每个交易日 16:30 后检查数据是否更新
- ✅ 浏览器里按 `Ctrl+Shift+R` 强制刷新，避免缓存

---

## 自动更新的数据范围

**每天自动更新（AKShare 抓取）：**

| 数据 | 来源 | 频率 |
|------|------|------|
| 9大指数行情（收盘价/涨跌幅/成交额） | 东方财富 | 每日 |
| 指数5日平均成交额 | 东方财富历史数据 | 每日 |
| 31个申万一级行业主力资金流向 | 东方财富 | 每日 |
| 融资融券余额 | 上交所/深交所 | 每日（T+1） |
| 北向资金净流入 | 东方财富 | 每日 |
| 国债收益率（中美） | 中债登 | 每日 |
| 商品价格（黄金/铜/原油） | 新浪财经 | 每日 |
| 市场广度（涨跌家数/涨停数） | 东方财富 | 每日 |
| 指数周涨跌幅 | 东方财富历史数据 | 每日计算 |

**需要手动更新（低频）：**

| 数据 | 原因 | 建议频率 |
|------|------|---------|
| 宏观经济数据（GDP/PMI/CPI等） | 月度发布，需人工判断 | 每月 |
| 行业景气度判断 | 定性分析 | 每周/每月 |
| 中观结构层评级 | 需人工分析 | 每周 |
| 行业表现原因描述 | 需人工撰写 | 每日（可选） |

---

## 本地测试

```bash
# 测试模式（不联网，验证脚本逻辑）
python scripts/fetch_data.py --test

# 正常模式（抓取真实数据，需要联网）
pip install -r scripts/requirements.txt
python scripts/fetch_data.py
```

---

## 常见问题

**Q: 推送时提示需要密码？**
GitHub 已不支持密码登录，需要 Personal Access Token：
- https://github.com/settings/tokens → 生成 Token（勾 repo 权限）→ 推送时粘贴 Token 作为密码

**Q: GitHub Actions 没有自动运行？**
- 检查仓库 `Settings` → `Actions` → `General` → 确保勾选 `Allow all actions`
- 免费账户定时任务有延迟（通常 5-15 分钟），属正常
- 仓库超过 60 天没活动会暂停定时任务，需手动重新启用

**Q: 数据没更新？**
- 进入 `Actions` 页面查看最近一次运行是否有报错
- 常见原因：AKShare 接口变更 → 更新 `pip install akshare --upgrade`
- 某数据源失败时脚本会跳过该数据继续运行

**Q: chinghuo.com 打不开？**
- 检查 DNS：`nslookup chinghuo.com` 应解析到 185.199.108-111.153
- 等待 GitHub Pages 生效（首次绑定需 10 分钟-1 小时）
- 确认 HTTPS 证书已签发（Settings → Pages 底部看证书状态）

**Q: 想改用子域名（如 radar.chinghuo.com）？**
1. 改 `CNAME` 文件内容为 `radar.chinghuo.com`
2. DNS 只留一条：`CNAME  radar  weiwoo-wl.github.io`
3. GitHub Pages 设置里改 Custom domain

**Q: 想修改更新时间？**
- 编辑 `.github/workflows/daily-update.yml` 中的 `cron` 值
- 格式：`分 时 * * 1-5`（UTC 时间）
- 北京时间 16:30 = UTC 08:30 → `30 8 * * 1-5`
- 北京时间 17:00 = UTC 09:00 → `0 9 * * 1-5`
