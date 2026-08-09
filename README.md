# 光荣之路 · Paths of Glory 单机网页版

《Paths of Glory》(GMT Games, Ted Raicer 设计) 的浏览器单机版：规则引擎与 B-full 强化学习 AI 都直接在浏览器里运行，界面汉化，无需服务器。

- **对 AI**：选协约国或同盟国，默认对手是完整 20 回合战役自对弈训练的 B-full 循环 PPO；也可选择启发式对手
- **热座**：一人双方推演，自动换座
- 规则自动裁判、逐步 AI 行动与棋子动画、撤销、回放、存档（含 GRU 记忆）、补给显示、战分总览
- 大战指挥界面：固定战略地图 + 军情仪表 + 按键呼出的手牌、行动、战况和战报面板；卡牌带可用金边与指针倾斜，棋子具备抬起、空中移动、落位回弹、减员翻面和伤亡退场的 3D 动画
- 十二节互动军校以 59 次判断与操作覆盖 2022 规则书的游戏主干，结课后由“新手陪玩”继续逐步引导完整对局

在线版：<https://fengjh97.github.io/pog-web/>

模型摘要：<https://fengjh97.github.io/pog-web/ai-report.html>

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
- `local.js` — 用假 WebSocket 在浏览器内模拟 RTT 服务端协议（存档/快照/回放），并逐步调度 AI
- `rl2/browser-agent.js` / `rl2/jsnn.js` — B-full 的 603 维观测、20 维合法候选编码、128 维 GRU 与指针策略推理；只使用正常玩家视角
- `rl2/models/bf_cur.json` — B-full 完整战役 checkpoint（arm B，iteration 80）
- `zh.js` — 本项目新增：自动生成的汉化层（271 条界面/日志模板 + 130 张卡牌译名）

完整训练设计、消融结果与限制见 [`rl2/REPORT.md`](rl2/REPORT.md)，后续实验议程见 [`rl2/NEXT.md`](rl2/NEXT.md)。B-full 在报告的 60 局完整战役竞技场中对启发式为 55–5；这是单随机种子结果，不代表已验证达到人类水平。

## 版权

- 游戏规则与美术素材 © GMT Games, LLC（1999–2018）
- 数字实现源码 © 2025 Nathan Forget & Tor Andersson（Rally the Troops，经 GMT 授权在 rally-the-troops.com 发布）
- 本仓库为个人学习与自用改造，**非商用**。请购买支持[实体版](https://www.gmtgames.com/p-1182-paths-of-glory-deluxe-edition-3rd-printing.aspx)。如版权方要求，将立即下架。
