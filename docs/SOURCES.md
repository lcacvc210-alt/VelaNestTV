# 自行寻找、验证与配置来源

本项目不提供、推荐、托管或维护第三方点播 API、直播订阅及播放链接。仓库中的 example.invalid 等域名仅用于格式示例，不能播放。请自行寻找并确认有权访问的内容；搜索结果公开可见不等于获得授权。

## 搜索方法

优先从内容提供方的官方文档、自己管理的媒体服务或已获授权的服务商处获取接口。可使用以下通用关键词，不必搜索本项目的维护者配置：

- 点播：`Apple CMS provide/vod API 文档`、`兼容 JSON 采集接口 ac detail wd`、`自建媒体服务 API`。
- 直播：`官方频道 M3U 订阅 文档`、`授权 IPTV M3U XMLTV 配置`、`自建局域网 M3U`。
- 本地电影不需要在线源：将有权使用的文件放入 NAS_ROOT 即可。

查看更新日期、接口说明、内容授权、访问限制和服务条款。不要导入未知脚本、浏览器插件、要求关闭安全防护的安装包，或带他人账号、令牌的链接。不绕过付费、登录、地域限制或 DRM。项目维护邮箱不分发片源。

## 区分三类地址

| 地址 | 配置位置 | 说明 |
|---|---|---|
| provide/vod 兼容 API | DEFAULT_SOURCES | 返回 JSON 目录、搜索和详情，不是视频网站首页 |
| M3U 订阅 | DEFAULT_LIVE_SOURCES | 文本以 #EXTM3U 开头，包含频道及流地址 |
| 电脑文件夹 | NAS_ROOT | 本地绝对路径，不是网页 URL |

单部影片的 m3u8 不是点播目录 API；一个节目播放页也不是 M3U 订阅。XMLTV 是可选节目单，不是直播流。服务要求的鉴权如果不受本项目支持，不能仅靠填入 URL 来解决。

## 点播验证流程

先只配置一个来源，避免同时导入大量未知 API。把自己获取的端点放入 PowerShell 临时变量：

```powershell
$vodApi = Read-Host '输入你有权使用的兼容 API 地址'
$detailUri = $vodApi + $(if ($vodApi.Contains('?')) {'&'} else {'?'}) + 'ac=detail'
$result = Invoke-RestMethod -Uri $detailUri -TimeoutSec 10
$result.list | Select-Object -First 1 vod_id,vod_name,type_name
```

返回结果应有 list 数组；典型字段为 vod_id、vod_name、vod_pic、vod_play_url。搜索一般使用 `ac=detail&wd=片名`，详情使用 `ac=detail&ids=影片ID`，具体以接口文档为准。不识别的 JSON 格式不能保证兼容。

HTTP 200 只表示请求成功：还需在应用搜索、打开详情、实际播放，测试拖动、暂停和换源。建议对不同影片、不同时间段分别测试。区分 API 响应慢、播放 CDN 慢、视频编码不兼容和 Wi-Fi 带宽不足，不要仅凭一次请求给来源贴“永久稳定”标签。

## 配置格式

编辑 backend/.env.local，数组必须保持单行；用真实地址替换占位符：

```dotenv
DEFAULT_SOURCES=[{"name":"自定义点播","url":"https://example.invalid/api.php/provide/vod","isAdult":false}]
DEFAULT_LIVE_SOURCES=[{"name":"自定义直播","url":"https://example.invalid/channels.m3u"}]
```

直播订阅应包含 #EXTINF 和后续可访问的频道流地址。先用自己有权使用的一两个频道测试；验证节目单不代表播放流可用。只在信任私有网络订阅时启用 LIVE_ALLOW_PRIVATE=1，保持默认关闭更适合普通公网订阅。不要把带账号或访问令牌的订阅提交到 GitHub。

修改后重启电脑服务，再刷新电视连接／片单。仅在 LibreTV 网页里添加到浏览器本地存储的源，不一定会进入电视读取的 defaultSources；电视共享配置请使用环境变量。

## 自检与维护

```powershell
node scripts/doctor.mjs --config-only
# 启动服务后：
node scripts/doctor.mjs
```

自检只验证配置、登录和后台连接，不把每个来源的可播放性作为保证。失效来源先从数组移除，保存配置的私密备份，再尝试替换；不要将个人源列表、Cookie、签名播放地址或日志中的凭据附在公开问题中。

建议反馈信息：应用版本、电视型号、Android 版本、失败阶段、是否所有影片失败、脱敏后的错误码。不要发具体播放地址。没有在线源时仍可使用本地 NAS 功能。
