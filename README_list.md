# 智能挪车系统 (MoveCar)

基于 Cloudflare Workers + Bark + GitHub Pages 部署。

## 部署清单
1. **Cloudflare Workers**: 粘贴合并后的 `movecar.js`。
2. **KV 绑定**: 名称必须为 `MOVE_CAR_STATUS`。
3. **环境变量**:
   - `BARK_URL`: 你的 Bark 推送地址。
   - `SECRET_PATH`: 隐藏的 API 路径（如 `notify_888`）。
   - `PHONE_NUMBER`: 备用联系电话。
4. **GitHub Pages**: 开启此仓库的 Pages 服务，托管静态资源。
