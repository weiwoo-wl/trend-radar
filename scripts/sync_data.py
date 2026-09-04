#!/usr/bin/env python3
"""
每日数据更新 - 数据源决策脚本

决策逻辑：
1. 读取本地（GitHub 仓库）js/data.js 的 reportDate
2. 通过 Gitee 内容 API 读取 Gitee 仓库 js/data.js 的 reportDate
3. Gitee 日期更新 -> 采用 Gitee 数据（国内 IP 抓取，含东方财富，完整度更高）
4. Gitee 日期未前进，或读取失败 -> 输出 SELF_FETCH，由 workflow 自抓兜底

这样保证：
- Gitee 链路正常时，用的是完整的国内抓取数据
- Gitee 卡住时，GitHub 自抓兜底，数据日期仍会前进（不冻结）
- 任何情况下都不会用旧数据覆盖新数据（防回退由 workflow 兜底）

标准输出最后一行是决策结果：
  USE_GITEE <date>   已用 Gitee 数据覆盖本地文件
  SELF_FETCH         需要 workflow 自抓
"""

import base64
import json
import os
import re
import urllib.parse
import urllib.request

OWNER = "wyweiwoo"
REPO = "trend-radar"

# 需要同步的数据文件（相对仓库根目录）
FILES = [
    "js/data.js",
    "js/policy-funds-data.js",
    "js/earnings-data.js",
]

# 匹配 "reportDate": "2026-09-04"
DATE_RE = re.compile(r'"reportDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"')


def read_local_date(path="js/data.js"):
    """读取本地 data.js 的 reportDate，读不到返回空字符串。"""
    if not os.path.exists(path):
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            m = DATE_RE.search(f.read())
        return m.group(1) if m else ""
    except Exception as e:
        print("读取本地 {} 失败: {}".format(path, e))
        return ""


def gitee_get(path, token):
    """通过 Gitee 内容 API 读取文件，返回 (sha, bytes)。"""
    url = "https://gitee.com/api/v5/repos/{}/{}/contents/{}?access_token={}".format(
        OWNER, REPO, urllib.parse.quote(path, safe=""), token
    )
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "trend-radar-sync")
    with urllib.request.urlopen(req, timeout=60) as r:
        info = json.loads(r.read().decode("utf-8"))
    return info.get("sha"), base64.b64decode(info["content"])


def adopt_gitee(token, gitee_data_bytes):
    """采用 Gitee 的数据文件，覆盖本地。返回成功写入的文件数。"""
    written = 0
    for path in FILES:
        try:
            if path == "js/data.js":
                content = gitee_data_bytes
            else:
                _, content = gitee_get(path, token)
            directory = os.path.dirname(path)
            if directory:
                os.makedirs(directory, exist_ok=True)
            with open(path, "wb") as f:
                f.write(content)
            print("  已采用 Gitee 文件: {}".format(path))
            written += 1
        except Exception as e:
            print("  拉取失败，保留本地版本: {} ({})".format(path, e))
    return written


def main():
    token = os.environ.get("GITEE_TOKEN", "").strip()
    local_date = read_local_date()
    print("本地（GitHub）数据日期: {}".format(local_date or "(无)"))

    if not token:
        print("未配置 GITEE_TOKEN，改为自抓")
        print("SELF_FETCH")
        return

    # 读取 Gitee 侧数据日期
    try:
        _, gitee_bytes = gitee_get("js/data.js", token)
        m = DATE_RE.search(gitee_bytes.decode("utf-8", "replace"))
        gitee_date = m.group(1) if m else ""
    except Exception as e:
        print("从 Gitee 读取 data.js 失败: {}".format(e))
        print("SELF_FETCH")
        return

    print("Gitee 数据日期: {}".format(gitee_date or "(无)"))

    # 日期为 YYYY-MM-DD 格式，字符串比较等价于时间比较
    if gitee_date and gitee_date > local_date:
        print("Gitee 数据更新（{} > {}），采用 Gitee 数据".format(gitee_date, local_date))
        adopt_gitee(token, gitee_bytes)
        print("USE_GITEE {}".format(gitee_date))
    else:
        print("Gitee 数据未前进（{} <= {}），改为自抓兜底".format(
            gitee_date or "(无)", local_date or "(无)"))
        print("SELF_FETCH")


if __name__ == "__main__":
    main()
