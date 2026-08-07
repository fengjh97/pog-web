# 光荣之路 · Paths of Glory 单机网页版

《Paths of Glory》(GMT Games, Ted Raicer 设计) 的浏览器单机版：规则引擎直接在浏览器里运行，内置启发式 AI 对手，界面汉化，无需服务器。

- **对 AI**：选协约国或同盟国，AI 执对面
- **热座**：一人双方推演，自动换座
- 规则自动裁判、撤销、回放、存档（localStorage）、补给显示、战分总览

## 本地运行

```sh
python3 -m http.server 8091
# 打开 http://localhost:8091/
```

（必须通过 http 访问，直接双击 index.html 不行——引擎通过 fetch 加载。）

## 实现

基于 [Rally the Troops](https://rally-the-troops.com) 的开源实现改造：

- `rules.js` / `data.js` — 完整规则引擎（RTT 官方模块，未改动）
- `common/client.js` — RTT 客户端（改动：相对路径 + 少量文案汉化）
- `local.js` — 本项目新增：用假 WebSocket 在浏览器内模拟 RTT 服务端协议（存档/快照/回放），并驱动内置 AI（贪心一步搜索 + 局面评估：VP、兵力、战争状态、补给）
- `zh.js` — 本项目新增：自动生成的汉化层（271 条界面/日志模板 + 130 张卡牌译名）

## 版权

- 游戏规则与美术素材 © GMT Games, LLC（1999–2018）
- 数字实现源码 © 2025 Nathan Forget & Tor Andersson（Rally the Troops，经 GMT 授权在 rally-the-troops.com 发布）
- 本仓库为个人学习与自用改造，**非商用**。请购买支持[实体版](https://www.gmtgames.com/p-1182-paths-of-glory-deluxe-edition-3rd-printing.aspx)。如版权方要求，将立即下架。
