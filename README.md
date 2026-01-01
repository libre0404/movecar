🚗 MoveCar - 智能隐私挪车通知系统
基于 Cloudflare Workers 的智能挪车系统。扫码通知，隐私隔离，通过 Serverless 架构实现零成本、高可用的挪车方案。

✨ 核心优化功能 (Enhanced!)
在原版基础上，本版本引入了更严格的隐私保护与安全机制：

🛡️ 5分钟隐私保护期：通知发出后，系统会自动隐藏手机号并开启 300秒倒计时。有效防止对方在未尝试等待的情况下直接拨打电话，降低骚扰频率。

🔒 后端数据脱敏：手机号不再硬编码在前端脚本中。只有当“时间到”或“车主主动确认”时，后端接口才会安全地下发真实号码。

📍 双向位置感知：请求者共享位置以证明确实在车旁；车主确认后亦可共享实时位置，缓解双方等待焦虑。

🚫 恶意扫描防护：内置地理位置过滤（仅限 CN 访问）、IP 访问限频以及 UserAgent 反爬虫逻辑。

📖 使用流程
1. 对于请求者（需挪车的人）
扫码：扫描车窗二维码，进入通知页面。

留言/定位：填写留言并授权定位（如不授权，通知将延迟发送以防骚扰）。

通知：点击发送，界面进入 5 分钟安全保护倒计时。

联系：保护期结束后，或车主在后台点击“确认”后，拨号按钮将自动显现。

2. 对于车主
接收：通过 Bark 立即收到高优先级推送（支持勿扰模式穿透）。

确认：点击推送进入页面，查看对方位置，点击“🚀 我已知晓，正在前往”。

同步：系统立即告知请求者您已出发，并提前开放电话拨打权限。

🏗️ 构建说明 (Deployment)
第一步：准备环境
注册 Cloudflare 账号。

在 iOS 设备上安装 Bark 并获取您的专属 API URL（安卓用户可更换为推送服务如 Pushplus）。

第二步：创建 Worker 与 KV 存储
新建 Worker：命名为 movecar，删除默认代码并粘贴项目中的 movecar.js。

创建 KV 空间：

在 Cloudflare 侧边栏进入 KV，创建一个 Namespace 名为 MOVE_CAR_STATUS。

绑定 KV：

进入 movecar Worker -> Settings -> Bindings。

添加 KV Namespace Binding：变量名为 MOVE_CAR_STATUS，空间选择刚才创建的那个。

第三步：配置环境变量
在 Worker 的 Settings -> Variables 中添加：

BARK_URL：您的 Bark API 链接（如 https://api.day.app/你的密钥）。

PHONE_NUMBER：您的真实手机号。

SECRET_PATH：自定义推送 API 路径（例如填 callme，对应的请求路径将变为 /api/callme）。

🛡️ 安全设置（强烈推荐）
为防止境外恶意流量攻击及骚扰，请务必设置 WAF：

进入 Cloudflare Dashboard -> 您的域名 -> Security -> WAF。

创建规则 (Create rule)：

Rule name: Block non-CN traffic

If incoming requests match: Country does not equal China

Action: Block (拦截) 或 JS Challenge (验证码)。

🎨 制作挪车码
生成链接：使用您的 Worker 域名（如 https://movecar.xxx.workers.dev）。

生成二维码：使用草料二维码等工具生成。

美化排版：

推荐使用 Nanobanana Pro 等 AI 绘画工具生成具有艺术感的汽车内饰或风景背景。

文案建议：“扫码挪车，隐私保护”。

打印安装：建议彩色打印并进行过塑处理，放置在挡风玻璃明显处。

🙏 鸣谢
特别感谢原作者提供的核心思路与开源贡献。本项目在原版基础上针对隐私安全保护、倒计时逻辑以及后端数据验证进行了深度二次开发。

📄 开源协议
本项目基于 MIT License 开源。您可以自由修改、商用，但请保留原作者的版权声明。
