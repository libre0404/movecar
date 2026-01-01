# 🚗 MoveCar - 智能隐私挪车通知系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare%20Workers-orange)](https://workers.cloudflare.com/)
[![Deployment: Serverless](https://img.shields.io/badge/Deployment-Serverless-blue)](https://workers.cloudflare.com/)

基于 Cloudflare Workers 的智能挪车解决方案。通过隐私隔离技术，在不暴露车主真实手机号的前提下，实现高效、安全的挪车通知。

---

## ✨ 核心优化功能

在原版基础上，本版本引入了更严格的隐私保护与安全拦截机制：

* **🛡️ 5分钟隐私保护期**：发起通知后自动开启 **300秒倒计时**，期间强制隐藏手机号，引导请求者优先等待。
* **🔒 后端数据脱敏**：手机号通过后端逻辑控制，仅在“保护期满”或“车主确认”后才向前端下发，物理杜绝抓包泄露。
* **📍 双向位置共享**：请求者需共享位置以证真实性；车主点击确认后，双方均可查看实时动态，大幅缓解等待焦虑。
* **🚫 恶意行为拦截**：内置 CN 地域过滤、IP 访问频率限制（1小时5次）以及 UA 反爬虫过滤。
* **⏳ 无位置延迟机制**：若请求者拒绝分享位置，系统将强制延迟 30 秒发送通知，增加骚扰成本。

---

## 📖 使用流程



### 1. 对于请求者 (需挪车的人)
1.  **扫码**：扫描车窗二维码，进入移动端适配的交互页面。
2.  **留言/定位**：填写留言并授权位置信息（授权可跳过延迟发送逻辑）。
3.  **发送**：点击“一键通知”，界面进入安全保护倒计时。
4.  **联系**：倒计时结束，或车主点击“正在前往”后，拨号按钮自动解锁显现。

### 2. 对于车主
1.  **接收**：通过 Bark 收到带有留言和位置的高优先级推送。
2.  **确认**：进入管理页查看对方位置，点击“🚀 我已知晓，正在前往”。
3.  **响应**：系统即刻通知对方您已出发，并开放电话联系权限。

---

## 🏗️ 构建说明 (Deployment)

### 第一步：创建 Worker
1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  点击 **Workers & Pages** -> **Create Worker**，命名为 `movecar`。
3.  复制本项目中的 `movecar.js` 内容并覆盖默认代码，点击 **Deploy**。

### 第二步：创建 KV 存储
1.  在左侧菜单点击 **KV** -> **Create a namespace**，名称填 `MOVE_CAR_STATUS`。
2.  回到 Worker 设置页 -> **Settings** -> **Bindings**。
3.  点击 **Add** -> **KV Namespace**：
    * **Variable name**: `MOVE_CAR_STATUS`
    * **KV namespace**: 选择刚才创建的空间。

### 第三步：配置环境变量
在 Worker 的 **Settings** -> **Variables** 中添加：
| 变量名 | 说明 | 示例 |
| :--- | :--- | :--- |
| `BARK_URL` | Bark API 完整链接 | `https://api.day.app/你的Key` |
| `PHONE_NUMBER` | 挪车联系电话 | `13800138000` |
| `SECRET_PATH` | 自定义 API 接口路径 | `notify` (可选) |

---

## 🛡️ 安全策略 (Recommended)

为防止境外流量攻击，建议开启 **Cloudflare WAF**：
1.  进入域名管理 -> **Security** -> **WAF** -> **Create rule**。
2.  **If incoming requests match**: `Country` does not equal `China`。
3.  **Then**: `Block`。

---

## 🎨 制作挪车牌

1.  **生成二维码**：将您的 Worker 域名（如 `https://movecar.xxx.workers.dev`）转换为二维码。
2.  **设计美化**：
    * 推荐使用 **Nano Banana** 或其他 AI 绘画工具生成精美的装饰背景。
    * 搭配文案：“扫码挪车 · 隐私通话”。
3.  **打印安装**：建议彩色打印并过塑，放置在挡风玻璃下。

---

## 🙏 鸣谢

特别感谢原作者提供的核心思路。本版本针对**隐私保护倒计时**、**后端 API 脱敏**以及**交互体验**进行了深度二次开发。

## 📄 开源协议

本项目基于 **[MIT License](https://opensource.org/licenses/MIT)** 开源。

---
