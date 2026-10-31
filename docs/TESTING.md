# 测试与部署自检

## 开发检查

在根目录执行：

```powershell
npm ci --prefix backend
npm ci --prefix companion
npm run typecheck --prefix backend
npm test --prefix backend
npm run build --prefix backend
node --test scripts/smoke.test.mjs
```

smoke.test.mjs 使用临时目录、自制测试字节和隔离的随机端口，验证登录、未授权请求、限时 NAS 链接、GET/HEAD、Range、越界范围、签名篡改、目录穿越拒绝和 UDP 发现。它使用模拟后台，不访问真实片源，也不占用现有 8080/8090 服务。fixture.mp4 仅为 HTTP 测试字节，不是可解码影片，不能据此宣称电视播放验证完成。

实际后端 production API 检查：先 npm run build，再执行 `node --test scripts/backend-smoke.test.mjs`。它在随机端口启动真实 Next.js 后台，用临时密码检查状态、错误密码、登录和搜索接口，不连接片源。

## 配置与启动后检查

```powershell
node scripts/doctor.mjs --config-only
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
node scripts/doctor.mjs
```

前者检查必需变量、密码匹配、数组结构与占位域名；后者增加后台登录、伴随服务健康及已认证 NAS 列表请求。不会打印密码或源地址。自检不会保证每个片源流畅。

## 可选测试变量

伴随服务支持 COMPANION_PORT、DISCOVERY_PORT、BIND_HOST、COMPANION_DATA_DIR、EXTERNAL_METADATA。默认分别为 8090、45831、0.0.0.0、companion/data、开启外部元数据。EXTERNAL_METADATA=false 可关闭伴随服务的外部联想与推荐请求，不关闭后台或客户端的全部网络行为。

这些覆盖主要用于隔离测试。正式电视客户端仍固定使用 8090/45831，随意改变端口会导致连接失败。Windows 启动脚本也以这两个默认端口进行检查，不支持自定义端口部署。

## 电视验收

用同签名 APK 覆盖安装，检查遥控器焦点和返回、保存配置、首字母和全名搜索、选集换源、暂停快进、源失败时的切换源按钮；NAS 使用自制或获授权样片检查拖动、音轨和字幕。无可用内嵌轨道时应明确提示，不显示假选项。

电脑重启后重新启动服务，确认电视恢复连接。新设备及公开版迁移配置需独立实测，自动测试不能代替真实电视验证。提交反馈时附版本、系统、步骤、错误码和脱敏日志，不上传密钥、源地址或私人媒体。
