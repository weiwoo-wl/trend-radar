#!/usr/bin/env bash
# 趋势雷达看板 - 阿里云 ECS 一键部署脚本
# 适用系统：Ubuntu 22.04 / Alibaba Cloud Linux 3
# 备案前用公网 IP 访问；备案后修改 nginx server_name 并加 HTTPS
# 用法：把本文件上传到 ECS，执行  sudo bash aliyun-setup.sh
set -e

REPO="https://github.com/weiwoo-wl/trend-radar.git"
WWW="/var/www/trend-radar"

echo "==> [1/5] 安装系统依赖 (nginx/python3/git/cron)"
sudo apt-get update -y
sudo apt-get install -y nginx python3 python3-pip python3-venv git cron

echo "==> [2/5] 克隆看板代码到 $WWW"
sudo mkdir -p "$WWW"
if [ ! -d "$WWW/.git" ]; then
  sudo git clone "$REPO" "$WWW"
else
  echo "    已存在，跳过 clone（如需强制更新请手动 rm -rf $WWW）"
fi

echo "==> [3/5] 安装 Python 依赖（akshare/tushare/pandas，约需几分钟）"
sudo python3 -m pip install --upgrade pip
sudo python3 -m pip install -r "$WWW/scripts/requirements.txt"

echo "==> [4/5] 配置 nginx"
sudo cp "$WWW/deploy/nginx-trend-radar.conf" /etc/nginx/conf.d/trend-radar.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "==> [5/5] 配置定时任务（每交易日 16:35 拉最新代码 + 抓数据写 data.js）"
CRON_LINE="35 16 * * 1-5 cd $WWW && /usr/bin/git pull --ff-only >> $WWW/cron.log 2>&1 && /usr/bin/python3 scripts/fetch_data.py >> $WWW/cron.log 2>&1"
( sudo crontab -l 2>/dev/null | grep -v "trend-radar" || true; echo "$CRON_LINE" ) | sudo crontab -

echo "==> 立即跑一次，验证数据抓取"
cd "$WWW" && sudo python3 scripts/fetch_data.py

echo ""
echo "==================================================="
echo "部署完成！"
echo "备案前：浏览器访问  http://<ECS公网IP>"
echo "备案后："
echo "  1) 阿里云控制台 DNS 把 chinghuo.com 的 A 记录指向本机公网 IP"
echo "  2) 修改 /etc/nginx/conf.d/trend-radar.conf 的 server_name 为 chinghuo.com www.chinghuo.com"
echo "  3) 用 certbot 申请免费 HTTPS 证书并监听 443，再 reload nginx"
echo "==================================================="
