#!/bin/bash
# 趋势雷达数据看板 - 一键推送到 GitHub
# 使用方法：bash setup.sh
# 前提：已在 GitHub 创建名为 trend-radar 的 Public 仓库

set -e

REPO_URL="https://github.com/weiwoo-wl/trend-radar.git"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================="
echo "  趋势雷达数据看板 - 推送到 GitHub"
echo "========================================="
echo ""
echo "目标仓库: $REPO_URL"
echo "工作目录: $SCRIPT_DIR"
echo ""

# 检查 git 是否安装
if ! command -v git &> /dev/null; then
    echo "[错误] 未检测到 git，请先安装: https://git-scm.com/downloads"
    exit 1
fi

# 检查是否已有 .git
if [ -d "$SCRIPT_DIR/.git" ]; then
    echo "[提示] 已存在 git 仓库，执行增量推送..."
    git add .
    git commit -m "更新趋势雷达数据看板" || echo "[提示] 没有变更需要提交"
    git push origin main
else
    echo "[步骤1/4] 初始化 git 仓库..."
    git init

    echo "[步骤2/4] 添加所有文件..."
    git add .

    echo "[步骤3/4] 提交..."
    git commit -m "初始化趋势雷达数据看板"
    git branch -M main

    echo "[步骤4/4] 推送到 GitHub..."
    git remote add origin "$REPO_URL"
    git push -u origin main
fi

echo ""
echo "========================================="
echo "  推送完成！"
echo "========================================="
echo ""
echo "下一步："
echo "1. 打开 https://github.com/weiwoo-wl/trend-radar"
echo "2. Settings → Pages → 开启 (Branch: main, /root)"
echo "3. Pages → Custom domain → 填入 chinghuo.com"
echo "4. 配置 DNS（见 DEPLOY.md 第四步）"
echo "5. Actions → 启用工作流 → Run workflow 测试"
echo ""
echo "详细说明见 DEPLOY.md"
