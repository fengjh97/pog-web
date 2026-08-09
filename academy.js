"use strict"

/* 光荣之路 · 新手军校
 * 一个独立的、确定性教学战役。它不改动 rules.js，也不会向真实对局发送动作；
 * 结课后才启动一局由原规则引擎裁判的历史战役。
 */

;(function () {

var PROGRESS_KEY = "pog_academy_progress_v3"
var COMPLETE_KEY = "pog_academy_complete_v3"
var COACH_KEY = "pog_campaign_coach_v1"

function lab_step(target, title, instruction, why, done, reference, choices) {
	return {
		target: target,
		title: title,
		do: instruction,
		why: why,
		done: done,
		effect: "rule_mastered",
		reference: reference,
		choices: choices,
	}
}

var LESSONS = [
	{
		id: 1,
		chapter: "第一章 · 入门战役",
		title: "先知道怎么赢",
		short: "胜利目标",
		summary: "认出关键城市、VP 与一回合的基本循环。",
		reward: "侦察勋章",
		steps: [
			{
				target: "brussels",
				title: "找到这场教学战的目标",
				do: "点击地图上带金色旗帜的【布鲁塞尔】。",
				why: "《光荣之路》不是把所有敌军消灭才算赢。你要争夺关键城市、事件和国家，由 VP（战分）决定整场战争的胜负。",
				done: "目标已锁定：攻克布鲁塞尔。",
				effect: "objective",
			},
			{
				target: "flow",
				title: "记住一个行动的四步循环",
				do: "点击下方【一个行动怎么走】卡片。",
				why: "绝大多数时候你只需重复：选牌 → 选用途 → 在地图执行 → 结算。不要试图一次看懂整张地图。",
				done: "你已经知道每次只处理一个小行动。",
				effect: "flow",
			},
		],
	},
	{
		id: 2,
		chapter: "第一章 · 入门战役",
		title: "学会用一张牌",
		short: "卡牌用途",
		summary: "亲手把“八月炮火”作为事件打出。",
		reward: "作战计划章",
		steps: [
			{
				target: "guns_card",
				title: "选择本次行动的卡牌",
				do: "点击手牌中的【八月炮火】。",
				why: "每个行动轮从一张牌开始。卡牌左上角数字是 OPS；卡面正文是历史事件。发光的牌才是当前合法选择。",
				done: "已选中“八月炮火”。",
				effect: "select_card",
			},
			{
				target: "event_order",
				title: "决定这张牌怎么用",
				do: "在四种用途中点击【事件】。",
				why: "事件执行卡面历史效果；OPS 用来移动/进攻；SR 长距离调兵；RP 留到回合末补充。这里要摧毁列日要塞，所以用事件。",
				done: "用途正确：这张牌将作为事件结算。",
				effect: "choose_event",
			},
			{
				target: "resolve_event",
				title: "让历史事件改变地图",
				do: "点击【执行八月炮火】。",
				why: "事件不是抽象加分，它会直接改变地图、国家、部队或后续可用规则。现在列日要塞将被摧毁。",
				done: "列日要塞被摧毁，通往比利时的道路打开了。",
				effect: "resolve_event",
			},
		],
	},
	{
		id: 3,
		chapter: "第一章 · 入门战役",
		title: "把部队移到前线",
		short: "激活与移动",
		summary: "激活科布伦茨，把集团军推进列日。",
		reward: "机动勋章",
		steps: [
			{
				target: "koblenz",
				title: "先选部队所在的地区",
				do: "点击有德军集团军的【科布伦茨】。",
				why: "你不是直接拖棋子。先用 OPS 激活一个地区，再告诉系统这里的部队要移动还是进攻。",
				done: "科布伦茨已激活。",
				effect: "select_koblenz",
			},
			{
				target: "move_order",
				title: "给激活地区下命令",
				do: "点击【移动】命令。",
				why: "同一个地区不能在同一行动里既移动又进攻。移动用于占位和接敌；进攻用于打相邻敌军。",
				done: "已下达移动命令。",
				effect: "choose_move",
			},
			{
				target: "liege",
				title: "选择合法目的地",
				do: "点击金色脉冲的【列日】。",
				why: "集团军通常可移动 3 格。进入敌方控制地区会停下；每个地区最多堆叠 3 个单位。教学战只开放一个合法目的地。",
				done: "德军集团军抵达列日，下一步可以进攻布鲁塞尔。",
				effect: "move_liege",
			},
		],
	},
	{
		id: 4,
		chapter: "第一章 · 入门战役",
		title: "打一场必胜进攻",
		short: "战斗与推进",
		summary: "选择攻击者和目标，掷骰并推进占领。",
		reward: "布鲁塞尔战役勋章",
		steps: [
			{
				target: "liege",
				title: "选择参加进攻的部队",
				do: "点击列日的两个德军集团军。",
				why: "进攻先选攻击者。可以从多个相邻地区共同攻击，但本课只用一个堆叠。数字 5 是合计战斗力。",
				done: "攻击部队已选定：战斗力 5。",
				effect: "select_attackers",
			},
			{
				target: "attack_order",
				title: "把激活改为进攻命令",
				do: "点击【进攻】命令。",
				why: "移动和进攻使用同一套 OPS 激活逻辑。你已经选好攻击者，现在声明这次激活用于战斗。",
				done: "进攻命令已下达。",
				effect: "choose_attack",
			},
			{
				target: "brussels",
				title: "选择相邻的敌方目标",
				do: "点击红色脉冲的【布鲁塞尔】。",
				why: "系统会比较双方战斗力并查火力表。这里是 5 对 2，优势在你；真实对局还要考虑堑壕、地形和战斗牌。",
				done: "战斗已建立：德军 5 对比利时军 2。",
				effect: "target_brussels",
			},
			{
				target: "roll",
				title: "掷骰并读取战斗结果",
				do: "点击【掷战斗骰】。",
				why: "骰点不是直接等于伤害。系统会结合战斗力、火力表和修正自动算出损失，你只需按提示分配步损。教学战保证胜利。",
				done: "掷出 6！守军遭到 2 步损并被消灭。",
				effect: "roll_combat",
			},
			{
				target: "advance",
				title: "胜利后别忘了推进占领",
				do: "点击【推进并占领布鲁塞尔】。",
				why: "消灭或迫退守军后，攻击方通常可以推进。占领目标城市才会改变控制权和战分。",
				done: "布鲁塞尔已占领。教学战胜利！",
				effect: "advance_victory",
			},
		],
	},
	{
		id: 5,
		chapter: "第二章 · 系统基础",
		kind: "lab",
		title: "读懂棋子与堆叠",
		short: "棋子与堆叠",
		summary: "分清集团军、军级单位、要塞以及堆叠和多国激活成本。",
		reward: "军制识别章",
		steps: [
			lab_step("unit_army", "分清集团军、军与要塞", "选择代表大型野战兵团、并使用集团军火力表的棋子。", "战斗单位只有集团军和军级单位。集团军规模更大；要塞不是单位，只负责防守所在地区。", "正确：集团军只要参加战斗，本方通常就查集团军火力表。", "规则 2.2.1、12.2.8", [["unit_corps","军级单位","约 2–5 万人，使用军/要塞火力表。"],["unit_army","集团军","大型兵团，正反两面各代表一个步。"],["unit_fort","要塞","不是战斗单位，只能防守。"]]),
			lab_step("factor_loss", "看懂 CF、LF 与 MF", "选择决定“移除一个步可以吸收多少损失数”的数值。", "CF 是战斗力，LF 是损失系数，MF 是移动力。分配步损时不是数人头，而是用被翻面或消灭单位的 LF 去满足损失数。", "正确：LF 决定每移除一步能满足多少损失数。", "规则 2.2.1、12.4.1–12.4.3", [["factor_combat","CF · 战斗力","决定进入哪一个火力列。"],["factor_loss","LF · 损失系数","决定一个步吸收多少损失数。"],["factor_move","MF · 移动力","决定一次移动最多走几格。"]]),
			lab_step("stack_three", "记住堆叠上限", "选择一个地区通常最多能容纳的战斗单位数量。", "集团军和军级单位都各算一个单位。堆叠限制通常始终生效，不能故意超叠后再移走。", "正确：每个地区最多 3 个战斗单位。", "规则 10.1", [["stack_two","2 个","会把合法兵力限制得过低。"],["stack_three","3 个","集团军或军级单位都各算一个。"],["stack_four","4 个","超过通常堆叠上限。"]]),
			lab_step("activate_two", "计算多国堆叠的激活成本", "德国与奥匈单位同处一格时，选择激活这个地区通常需要的 OPS。", "激活成本取决于地区里不同国籍的数量，而不是棋子数量。单一国籍通常 1 OPS；两个国籍通常 2 OPS。", "正确：德军 + 奥匈军是两个国籍，通常花 2 OPS。", "规则 9.2.2–9.2.4", [["activate_one","1 OPS","只适用于单一国籍堆叠。"],["activate_two","2 OPS","两个不同国籍，各计一份激活成本。"],["activate_units","按棋子数付费","激活成本不是按单位数量计算。"]]),
		],
	},
	{
		id: 6,
		chapter: "第二章 · 系统基础",
		kind: "lab",
		title: "走完一个完整回合",
		short: "回合与强攻",
		summary: "掌握强制攻势、六个行动轮以及行动后的五个结算阶段。",
		reward: "总参流程章",
		steps: [
			lab_step("phase_mo", "回合从强制攻势开始", "选择每个回合首先结算的阶段。", "双方先掷强制攻势表，确定本回合哪个国家必须进攻。它是整回合的战略约束，不是立即打仗。", "正确：先确定强制攻势，再进入行动阶段。", "规则 6.0A、7.1", [["phase_cards","补满手牌","这是回合末的阶段。"],["phase_mo","强制攻势","双方各掷一次并记录目标国。"],["phase_siege","围城阶段","它发生在六轮行动之后。"]]),
			lab_step("rounds_six", "理解六个行动轮", "选择一个行动阶段中双方各自拥有的行动次数。", "行动阶段有 6 个行动轮。每轮同盟国先行动，协约国后行动，因此双方通常各做 6 次行动。", "正确：双方各 6 次，共交替完成 12 个行动。", "规则 6.0B、8.1", [["rounds_four","各 4 次","少于规则规定的行动轮。"],["rounds_six","各 6 次","每轮同盟国先、协约国后。"],["rounds_until_empty","一直打到手牌空","行动阶段不会无限延长。"]]),
			lab_step("mo_attack", "满足强制攻势", "选择满足某国强制攻势的基本方法。", "指定国家必须在本回合至少一次攻击敌方战斗单位；没有做到会让 VP 朝不利方向移动 1。部分国家还有地域与目标限制。", "正确：让指定国家完成一次符合条件的攻击。", "规则 7.1.3–7.1.7", [["mo_move","移动一次该国单位","只有移动不算强制攻势。"],["mo_event","打出该国事件","事件本身通常不算。"],["mo_attack","用该国进行合格攻击","完成后强制攻势标记转为已满足。"]]),
			lab_step("post_attrition", "行动结束先查断补给", "六轮行动全部完成后，选择首先发生的结算阶段。", "行动结束后先进入 Attrition：断补给单位会被消灭，断补给地区的控制权也可能改变。之后才检查围城。", "正确：先断补给，再围城。", "规则 6.0C–D、14.3", [["post_replacement","补充阶段","补充发生在战争状态之后。"],["post_attrition","断补给阶段","先处理 OOS 单位和地区。"],["post_draw","抽牌阶段","这是接近回合结束时的阶段。"]]),
			lab_step("turn_tail", "记住回合末四连结算", "选择围城之后的正确阶段顺序。", "围城后检查战争状态与胜负，再花 RP 补充单位，随后补牌，最后推进回合。未花的 RP 不会保留。", "正确顺序：战争状态 → 补充 → 抽牌 → 回合结束。", "规则 6.0E–H", [["turn_tail","战争状态 → 补充 → 抽牌 → 回合结束","完整回合的正确尾段。"],["turn_tail_wrong1","抽牌 → 围城 → 补充 → 战争状态","把阶段顺序打乱了。"],["turn_tail_wrong2","补充 → 行动 → 抽牌 → 围城","行动阶段只发生一次。"]]),
		],
	},
	{
		id: 7,
		chapter: "第二章 · 系统基础",
		kind: "lab",
		title: "掌握卡牌经济",
		short: "卡牌四用",
		summary: "理解 OPS、SR、RP、事件、星号移除和战斗牌的取舍。",
		reward: "资源调度章",
		steps: [
			lab_step("card_four", "一张牌有四种主要用途", "选择策略牌的四种标准用法。", "卡牌是行动、历史节奏与长期资源的共同货币。把高 OPS 牌拿来移动，可能就放弃了重要事件；每次都在做机会成本选择。", "正确：OPS、SR、RP 或事件。", "规则 9.1.3", [["card_four","OPS / SR / RP / 事件","四种主要用法。"],["card_three","移动 / 战斗 / 抽牌","不是卡牌的规则分类。"],["card_all","一张牌同时执行全部效果","每次通常只能选择一种用途。"]]),
			lab_step("card_ops", "OPS 用来激活地区", "你想在几个前线地区移动或进攻，选择最合适的用途。", "OPS 值转化为激活点。先付费激活地区并标记移动或进攻，再完成所有移动，最后结算所有战斗。", "正确：把牌作为 OPS 使用。", "规则 9.2", [["card_event","事件","只执行卡面历史效果。"],["card_ops","OPS","用于激活移动或进攻地区。"],["card_rp","RP","只记录补充点，当前行动不移动。"]]),
			lab_step("card_sr", "SR 是长距离调兵", "你要把有补给的军从后方快速调到另一片友方战区，选择用途。", "SR 沿友方控制且有补给的路线移动，军级单位花 1 SR，集团军花 4 SR；也能连接后备箱和部分港口。", "正确：SR 适合远距离重部署。", "规则 9.3、13.1", [["card_ops_short","OPS 移动","适合按 MF 一格格移动。"],["card_sr","SR","适合沿己方网络远距离调兵。"],["card_event_neutral","中立国事件","不会自动完成你的调兵。"]]),
			lab_step("card_rp", "RP 是回合末的修复预算", "你要为回合末恢复减员单位储备资源，选择用途。", "打 RP 牌时当前行动只记录各国补充点。补充阶段才花，且当回合没花完的 RP 会全部丢失。", "正确：RP 先记账，回合末再修复或重建。", "规则 9.4、17.1", [["card_rp","RP","记录到补充轨，回合末使用。"],["card_sr_repair","SR","只能调动，不能修复单位。"],["card_ops_repair","OPS","不能直接翻回满编面。"]]),
			lab_step("card_star_event", "星号牌何时永久移除", "选择带 * 的牌会永久离开游戏的情况。", "星号代表事件用完即退出历史舞台。若把同一张牌当 OPS、SR 或 RP，用完通常只进入弃牌堆。", "正确：只有作为事件打出时永久移除。", "规则 3.0、9.5.1.2", [["card_star_any","任何用途后都移除","会错误消耗卡牌。"],["card_star_event","作为事件打出后","星号事件永久移除。"],["card_star_never","永远不移除","忽略了星号。"]]),
			lab_step("card_cc_win", "战斗牌会留下还是弃掉", "选择战斗牌使用方赢得该场战斗后通常发生的事。", "胜方使用的战斗牌通常正面保留到回合末，并能在之后的合格战斗继续使用，但每张牌每个行动轮最多用一次；败方或平局双方通常弃掉。", "正确：获胜时通常正面保留到回合末。", "规则 9.5.4", [["card_cc_win","正面保留到回合末","之后每个行动轮至多再用一次。"],["card_cc_hand","立即回到手牌","战斗牌不会这样回手。"],["card_cc_permanent","永久持续整局","通常会在回合末清理。"]]),
		],
	},
	{
		id: 8,
		chapter: "第三章 · 地图与战斗",
		kind: "lab",
		title: "控制移动与堑壕",
		short: "移动与堑壕",
		summary: "掌握 MP、连接线、敌军阻挡、控制权与构筑堑壕。",
		reward: "战线工程章",
		steps: [
			lab_step("move_one_mp", "地图上每格通常花 1 MP", "选择进入一个相邻地区的通常移动成本。", "地形主要影响战斗，不会让普通移动多花 MP。单位仍必须沿连接线走，且不能超过自己的 MF。", "正确：相邻一格通常花 1 MP。", "规则 11.1.1–11.1.5", [["move_one_mp","1 MP","所有普通地区通常相同。"],["move_terrain_mp","按地形 1–3 MP","这是很多兵棋的做法，但不是本作。"],["move_free","不花 MP","仍受 MF 限制。"]]),
			lab_step("move_no_enemy", "敌军单位会挡住移动", "选择单位绝不能在普通移动中进入的地区。", "你可以进入敌控但空着的地区并取得控制，但不能直接走进有敌方战斗单位的地区；要进入那里必须通过战斗与推进。", "正确：有敌方战斗单位的地区不能靠移动进入。", "规则 11.1.7、11.1.14", [["move_enemy_control_empty","敌控但无敌军的地区","通常可进入并改变控制。"],["move_no_enemy","有敌方战斗单位的地区","必须先攻击，不能直接移动进入。"],["move_friendly","己方有补给地区","通常可以移动进入。"]]),
			lab_step("move_connection", "连接线也有规则", "选择虚线连接在地图上的含义。", "虚线不是装饰，它表示使用者或方向受地图文字与特殊规则限制；移动、攻击、SR 都要检查连接是否合法。", "正确：虚线连接带有额外限制。", "规则 2.1、11.1.3–11.1.4", [["move_connection","存在特殊使用限制","必须查看地图标注。"],["move_double","移动成本加倍","虚线不统一代表双倍 MP。"],["move_supply_only","只能追踪补给","有些虚线也能移动或攻击。"]]),
			lab_step("control_enter", "用进入地区改变控制权", "选择取得一个无敌军敌控地区的基本方法。", "多数单位进入后立刻取得控制；但完整敌方要塞仍能阻止你取得该地区及其 VP。", "正确：让己方单位合法进入该地区。", "规则 11.1.14、15.1.10", [["control_adjacent","站在相邻地区","相邻不会自动改变控制。"],["control_enter","合法进入地区","通常立即放置己方控制。"],["control_attack_only","只要宣布攻击","必须真正清空并进入或满足规则。"]]),
			lab_step("trench_army", "构筑堑壕需要集团军", "Entrench 事件已发生，选择能尝试挖壕的单位。", "一个为移动而激活的地区里，可以让一个集团军放弃移动并尝试挖壕；军级单位不能建，但之后可以享受壕沟防御。", "正确：由集团军在移动激活中尝试。", "规则 11.2.1、11.2.8", [["trench_corps","任意军级单位","军可以受益，但不能负责建造。"],["trench_army","集团军","放弃移动并在行动末掷骰。"],["trench_fort","要塞自动建造","要塞本身不会尝试挖壕。"]]),
			lab_step("trench_lf", "挖壕检定看 LF", "选择挖壕成功的判定。", "所有移动完成后掷骰；点数小于等于尝试集团军的 LF 就成功。先放 1 级，再成功一次升为 2 级，最高 2 级。", "正确：掷骰 ≤ 集团军 LF。", "规则 11.2.2–11.2.3", [["trench_cf","掷骰 ≤ CF","CF 用于战斗力。"],["trench_lf","掷骰 ≤ LF","成功建造或升级堑壕。"],["trench_mf","掷骰 ≤ MF","MF 用于移动。"]]),
		],
	},
	{
		id: 9,
		chapter: "第三章 · 地图与战斗",
		kind: "lab",
		title: "拆开完整战斗流程",
		short: "火力与侧翼",
		summary: "掌握指定战斗、火力表、地形修正、战斗牌和侧翼攻击。",
		reward: "火力协调章",
		steps: [
			lab_step("combat_one_target", "一场战斗只打一个地区", "选择合法的进攻组织方式。", "多个相邻地区的部队可以共同攻击，但每场战斗只有一个防守地区；同一单位在一个行动里不能攻击两次。", "正确：多个来源可以合击一个目标地区。", "规则 12.1", [["combat_one_target","多地攻击一个防守地区","合法的多方向合击。"],["combat_many_targets","一批单位同时攻击多个地区","必须拆成不同战斗。"],["combat_repeat","同一单位连续攻击两次","一个行动中不允许。"]]),
			lab_step("combat_army_table", "先决定使用哪张火力表", "本方参战单位中至少有一个集团军，选择使用的火力表。", "只要有一个集团军参战，即使它已经减员，也使用集团军表；全是军级单位或要塞才用军/要塞表。", "正确：使用集团军火力表。", "规则 12.2.8", [["combat_army_table","集团军火力表","至少一个集团军参战。"],["combat_corps_table","军/要塞火力表","仅在没有集团军时使用。"],["combat_both_tables","两张表结果相加","每方只选一张表。"]]),
			lab_step("combat_column", "战斗力先定位火力列", "选择地形与堑壕通常如何影响射击。", "先把参战 CF 相加定位火力列，再按防守地形与堑壕做列位移动；战斗牌常提供列移或骰点修正。", "正确：地形与堑壕通常造成火力列移动。", "规则 12.2.3、12.2.7–12.2.9", [["combat_column","移动火力列并应用 DRM","系统最后查表得到损失数。"],["combat_cancel_cf","直接删除攻击单位 CF","不是通用处理方式。"],["combat_extra_mp","提高移动成本","战斗阶段不再计算 MP。"]]),
			lab_step("combat_cards_after_flank", "战斗牌有固定时机", "选择普通战斗中战斗牌的主要使用时机。", "先处理取消堑壕的牌与侧翼尝试，再由攻击方、随后防守方选择其他合格战斗牌，最后汇总 DRM 和列移。", "正确：侧翼判定之后、确定 DRM 之前。", "规则 12.2.4–12.2.7", [["combat_cards_before_designate","宣布攻击前","此时战斗条件尚未建立。"],["combat_cards_after_flank","侧翼之后、DRM 之前","普通战斗牌的规则窗口。"],["combat_cards_after_losses","分配损失后","已经太晚。"]]),
			lab_step("flank_conditions", "判断能否尝试侧翼", "选择满足侧翼攻击基本条件的局面。", "必须从至少两个地区进攻，至少有一个集团军；目标不能是沼泽、山地、有堑壕或仅有空要塞。", "正确：多方向 + 集团军 + 合法地形。", "规则 12.3.1", [["flank_conditions","两地进攻、含集团军、目标无壕且非山地/沼泽","满足基本条件。"],["flank_one_space","单一地区的集团军进攻","缺少多方向。"],["flank_trench","攻击 2 级堑壕","未取消堑壕时不能侧翼。"]]),
			lab_step("flank_success", "侧翼成功会改变开火顺序", "侧翼检定修正后掷出 4，选择结果。", "修正后 4+ 成功：攻击方先完成 DRM、开火与造成损失，防守方剩余兵力再还击；3 以下失败则防守方先开火。", "正确：4+ 成功，攻击方先开火。", "规则 12.3.2–12.3.3", [["flank_success","成功，攻击方先开火","先造成的损失会削弱还击。"],["flank_simultaneous","仍然同时开火","侧翼的意义正是改变顺序。"],["flank_failure","失败，防守方先开火","只有修正后 3 以下才失败。"]]),
		],
	},
	{
		id: 10,
		chapter: "第三章 · 地图与战斗",
		kind: "lab",
		title: "处理步损、撤退与推进",
		short: "战后结算",
		summary: "会读损失数、替换集团军、判定胜负、撤退距离和推进资格。",
		reward: "战场裁决章",
		steps: [
			lab_step("loss_not_over", "损失数不是随便翻棋", "选择分配损失的核心原则。", "每移除一步用该单位 LF 满足损失数。必须尽可能满足，但不能让已支付 LF 总和超过损失数。", "正确：尽量精确满足，绝不超付。", "规则 12.4.1–12.4.3", [["loss_not_over","尽量满足且不能超过损失数","先检查有哪些合法组合。"],["loss_any","想翻谁就翻谁","可能少付或超付。"],["loss_equal_steps","损失数等于翻面棋子数量","不同单位 LF 不同。"]]),
			lab_step("loss_corps_replace", "集团军消灭后需要后备军", "减员集团军被消灭且后备箱有同国满编军，选择处理。", "通常立即用同国后备军替换；若没有合格军，该集团军可能永久消灭，之后不能用 RP 重建。", "正确：把同国满编军放到原地区。", "规则 12.4.4、12.4.7", [["loss_corps_replace","用同国后备军立即替换","继续承担剩余损失与撤退。"],["loss_army_box","把集团军放入普通可补充箱","忽略了后备军替换。"],["loss_nothing","什么都不放且总能重建","没有后备军时可能永久消灭。"]]),
			lab_step("winner_loss_number", "胜负看造成的损失数", "选择一场战斗的胜者判定。", "比较双方火力表得到的损失数，而不是最后剩余棋子或掷骰原点数。造成更高损失数者获胜；相同则双方都视为未胜。", "正确：比较造成给对方的损失数。", "规则 12.2.11", [["winner_loss_number","造成更高损失数的一方","决定战斗胜负与战斗牌去留。"],["winner_units","剩余单位更多的一方","不是规则判据。"],["winner_die","原始骰点更高的一方","还要结合火力列。"]]),
			lab_step("retreat_full_attacker", "不是每次战败都必须撤", "选择会迫使守军撤退的条件。", "攻击方必须获胜，而且至少还有一个满编攻击单位。若只剩减员攻击单位，即使造成更高损失数，也不会迫退守军。", "正确：攻击方获胜且至少一个满编攻击单位存活。", "规则 12.2.12、12.5.1", [["retreat_full_attacker","攻击方获胜且有满编单位存活","守军才需要撤退。"],["retreat_any_win","攻击方只要获胜","还缺少满编攻击单位条件。"],["retreat_any_loss","守军只要受损","受损不等于必须撤退。"]]),
			lab_step("retreat_distance", "损失差决定撤退距离", "攻击方造成损失数 4，守军造成 2，选择守军撤退距离。", "损失数差为 1 时撤 1 格；其他正差值通常撤 2 格。森林、山地、沙漠、沼泽或堑壕中的守军可用额外一步损尝试取消撤退。", "正确：差值为 2，所以撤退 2 格。", "规则 12.5.2–12.5.4", [["retreat_one","1 格","只适用于损失差正好为 1。"],["retreat_distance","2 格","差值不是 1 时通常撤两格。"],["retreat_choose","守军任意选择 1 或 2 格","不能自由选择。"]]),
			lab_step("advance_full", "只有满编攻击单位能推进", "守军已撤退，选择可以推进占领的单位。", "推进是攻击方的选择，只有仍为满编的参战攻击单位可以推进；防守方永远不会推进。", "正确：仍为满编的攻击单位。", "规则 12.2.13、12.7", [["advance_full","仍为满编的参战攻击单位","可以推进进入被清空地区。"],["advance_reduced","所有减员攻击单位","减员单位不能推进。"],["advance_defender","撤退后的防守单位","防守方永不推进。"]]),
		],
	},
	{
		id: 11,
		chapter: "第四章 · 战争全局",
		kind: "lab",
		title: "守住补给并处理要塞",
		short: "补给·SR·要塞",
		summary: "会追踪补给、判断 OOS、使用 SR、建立围城并结算投降。",
		reward: "后勤围城章",
		steps: [
			lab_step("supply_path", "补给要连回本方源头", "选择一条合法补给线的核心要求。", "单位需要沿友方控制、且没有敌方单位阻断的连接一路追溯到合格补给源；部分港口可连接海上补给。", "正确：友控连续路线通往本方补给源。", "规则 14.1–14.2", [["supply_path","沿友控路线通往合格补给源","补给线可以弯曲但不能穿敌军。"],["supply_distance","距离补给源三格以内","补给没有统一三格距离。"],["supply_adjacent","只要邻接友军","友军本身不是补给源。"]]),
			lab_step("oos_restrictions", "断补给会立刻限制行动", "选择 OOS 单位不能执行的一组行动。", "OOS 单位不能移动、进攻、SR 或挖壕，也不能获得大多数战斗牌帮助；但当次防守仍会战斗。", "正确：不能移动、攻击、SR 和构筑堑壕。", "规则 14.3.1–14.3.4", [["oos_restrictions","移动 / 攻击 / SR / 挖壕","这些都要求补给。"],["oos_defend_none","不能参与防守且立即消失","要到断补给阶段才消灭。"],["oos_only_sr","只有 SR 被禁止","限制远不止这一项。"]]),
			lab_step("oos_attrition", "断补给阶段会真正清场", "选择回合断补给阶段对 OOS 集团军的处理。", "OOS 战斗单位会被消灭。OOS 集团军通常永久移除，不能像普通战损那样拿后备军替换。部分孤立地区的控制也会翻转。", "正确：集团军永久消灭，并可能引发地区控制变化。", "规则 6.0C、14.3.5–14.3.6", [["oos_attrition","永久消灭 OOS 集团军","断补给是战略包围的致命结果。"],["oos_flip","只翻到减员面","处罚不足。"],["oos_wait","继续保留到下回合","断补给阶段立即处理。"]]),
			lab_step("sr_costs", "SR 的单位成本不同", "选择用 SR 调动一个集团军所需的 SR 点数。", "军级单位每个 1 SR；满编或减员集团军都要 4 SR。使用者必须有补给，路线只能通过友控地区。", "正确：集团军花 4 SR。", "规则 13.1.1–13.1.5", [["sr_one","1 SR","这是军级单位的成本。"],["sr_costs","4 SR","集团军无论满编或减员都一样。"],["sr_mf","等于单位 MF","SR 不按移动力收费。"]]),
			lab_step("fort_besiege", "进入敌方要塞必须能围住它", "选择围攻 LF 3 要塞的最低兵力之一。", "至少一个集团军，或数量等于要塞 LF 的军级单位，才能进入并停下建立围城。完整要塞即使被围也仍阻止敌方取得控制与 VP。", "正确：一个集团军或三个军级单位。", "规则 15.1–15.2", [["fort_besiege","1 个集团军或 3 个军级单位","满足 LF 3 要塞的围城门槛。"],["fort_one_corps","任意 1 个军级单位","不足以围住 LF 3 要塞。"],["fort_control","只放控制标记","完整要塞仍保持控制。"]]),
			lab_step("fort_siege_roll", "围城在专门阶段投降", "LF 2 要塞在围城阶段掷出 5，选择结果。", "每个被围要塞都掷骰；结果大于要塞 LF 时投降并永久摧毁。1914 年 8–9 月的围城骰还有 −2 修正。", "正确：5 大于 LF 2，要塞投降并摧毁。", "规则 15.3", [["fort_siege_roll","要塞投降并永久摧毁","放置摧毁标记。"],["fort_hold","要塞继续坚持","只有修正后点数不大于 LF 才坚持。"],["fort_reduce","要塞翻到减员面","要塞只有一步，没有减员面。"]]),
		],
	},
	{
		id: 12,
		chapter: "第四章 · 战争全局",
		kind: "lab",
		title: "看懂整场战争的成长与结束",
		short: "战争状态与胜负",
		summary: "理解战争投入、国家参战、增援、补充、美俄进程与最终胜负。",
		reward: "大战全局章",
		steps: [
			lab_step("war_levels", "战争状态解锁新牌组", "选择从动员进入有限战争、再进入总体战的个人战争状态阈值。", "双方从动员开始。战争状态达到 4 可升有限战争，达到 11 可升总体战；回合 1 不检查升级，升级后把新阶段牌加入牌库。", "正确：4 解锁有限战争，11 解锁总体战。", "规则 16.1", [["war_levels","4 / 11","分别对应有限战争与总体战。"],["war_3_6","3 / 6","低于规则阈值。"],["war_vp","由当前 VP 自动决定","战争状态与 VP 是不同轨道。"]]),
			lab_step("neutral_event", "多数中立国靠事件参战", "选择保加利亚、意大利或罗马尼亚通常如何进入战争。", "这些国家由各自中立国参战事件带入，并按卡面放置部队。一次行动通常只能打一个中立国参战事件。", "正确：打出对应参战事件。", "规则 9.5.2", [["neutral_event","打出对应中立国参战事件","随后按卡面放置单位。"],["neutral_move","直接移动进其领土","中立时不能进入。"],["neutral_war_status","战争状态到 4 自动全部参战","不同国家有各自事件与限制。"]]),
			lab_step("reinforcement_place", "增援事件把新部队送上战场", "选择集团军增援通常出现的位置。", "增援军级单位通常进入后备箱；集团军通常放在本国首都或卡面指定地点，并受首都控制、堆叠与特殊条件限制。", "正确：集团军通常进入合格首都或指定地点。", "规则 9.5.3", [["reinforcement_place","本国合格首都或卡面地点","集团军通常在这里入场。"],["reinforcement_any","任意己控前线地区","不能自由空投。"],["reinforcement_reserve_army","所有集团军都进后备箱","后备箱主要存放军级单位。"]]),
			lab_step("replacement_spend", "补充点必须当回合花掉", "选择补充阶段结束时未使用 RP 的处理。", "各国只能花对应类别的 RP，受首都与补给等条件限制。未花 RP 不会积累到下回合。", "正确：所有未花 RP 清零。", "规则 17.1.1–17.1.4", [["replacement_spend","清零，不能带到下回合","所以 RP 牌需要提前规划。"],["replacement_save","全部保留","规则明确禁止囤积。"],["replacement_convert","自动换成 VP","没有这种通用转换。"]]),
			lab_step("late_war_tracks", "美军参战与俄国崩溃是两条事件链", "选择对游戏后期最准确的描述。", "美国通过 Lusitania、Zimmermann Telegram、Over There 等步骤逐步进入；俄国则围绕关键 VP、沙皇倒台、布尔什维克革命与布列斯特和约逐步退出。", "正确：两条都由条件与事件逐步推进，而非某回合自动发生。", "规则 16.3–16.4", [["late_war_tracks","由前置条件和事件链逐步推进","会改变牌、部队与战略目标。"],["late_war_auto","固定在第 10 回合自动完成","并非只看回合数。"],["late_war_vp_only","只由 VP 一步决定","VP 只是部分前置条件。"]]),
			lab_step("victory_vp", "最终仍由 VP 轨道裁决", "选择战役胜负的主要判据。", "关键城市、事件、国家状态与回合结算都会推动 VP。达到自动胜利阈值会立即结束；否则在停战或剧本终局按对应表判定。", "正确：看当前 VP 与剧本对应的胜利条件。", "规则 5.1–5.7、6.0E", [["victory_vp","当前 VP 与剧本胜利表","把整场政治与军事成果汇总。"],["victory_units","消灭单位总数","没有单独的歼敌积分胜利。"],["victory_capital","先占一个首都即胜","首都重要但不总是立即结束。"]]),
			lab_step("campaign_loop", "把整套主干串起来", "选择你现在应该记住的完整决策循环。", "每回合先接受强制攻势约束，再用 6 张左右的行动规划卡牌机会成本；地图行动围绕补给、控制和兵力交换，回合末结算围城、战争状态、补充与补牌，直到 VP 判胜。", "正确：战略目标 → 卡牌行动 → 地图执行 → 回合结算 → VP。", "规则 5.0–17.0 主干", [["campaign_loop","目标与强攻 → 卡牌行动 → 地图执行 → 回合末结算 → VP","完整主干。"],["campaign_tactics","只要每回合进攻最弱目标","会忽略补给、卡牌和长期事件。"],["campaign_cards_only","只追求打出所有事件","会失去地图与 OPS 节奏。"]]),
		],
	},
]

var runtime = {
	screen: "home",
	lesson: 1,
	step: 0,
	completed: LESSONS.map(function () { return false }),
	chapterComplete: false,
	objectiveSeen: false,
	cardSelected: false,
	eventChosen: false,
	fortDestroyed: false,
	selectedSpace: "",
	order: "",
	unitsAt: "koblenz",
	targeted: false,
	roll: 0,
	enemyDefeated: false,
	victory: false,
}

var root = null
var feedbackTimer = null

function load_progress() {
	try {
		var saved = JSON.parse(window.localStorage.getItem(PROGRESS_KEY))
		if (saved && Array.isArray(saved.completed)) {
			runtime.completed = LESSONS.map(function (_, i) { return Boolean(saved.completed[i]) })
			runtime.lesson = Math.max(1, Math.min(LESSONS.length, Number(saved.lesson) || 1))
			runtime.step = Math.max(0, Number(saved.step) || 0)
		}
	} catch (error) {}
}

function save_progress() {
	try {
		window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({
			completed: runtime.completed,
			lesson: runtime.lesson,
			step: runtime.step,
		}))
		if (runtime.completed.every(Boolean))
			window.localStorage.setItem(COMPLETE_KEY, "1")
	} catch (error) {}
}

function lesson_markup(lesson) {
	return "<button type=\"button\" class=\"academy-lesson\" data-academy-lesson=\"" + lesson.id + "\">" +
		"<span class=\"academy-lesson-number\">" + lesson.id + "</span>" +
		"<span><em>" + lesson.chapter + "</em><b>" + lesson.short + "</b><small>" + lesson.summary + "</small></span>" +
		"<i aria-hidden=\"true\">✓</i>" +
	"</button>"
}

function build() {
	root = document.createElement("div")
	root.id = "pog_academy"
	root.hidden = true
	root.setAttribute("role", "dialog")
	root.setAttribute("aria-modal", "true")
	root.setAttribute("aria-labelledby", "academy_title")
	root.innerHTML =
		"<div class=\"academy-shell\">" +
			"<div class=\"academy-header\" role=\"banner\"><div class=\"academy-brand\"><span>✦</span><div><small>PATHS OF GLORY ACADEMY</small><b id=\"academy_title\">光荣之路 · 新手军校</b></div></div>" +
			"<div class=\"academy-xp\"><span>军校经验</span><b id=\"academy_xp\">0 / " + (LESSONS.length * 100) + "</b><i><u id=\"academy_xp_bar\"></u></i></div>" +
			"<button type=\"button\" id=\"academy_close\" aria-label=\"关闭军校\">×</button></div>" +
			"<div class=\"academy-layout\">" +
				"<nav id=\"academy_lessons\" class=\"academy-lessons\">" + LESSONS.map(lesson_markup).join("") + "</nav>" +
				"<div class=\"academy-main\" role=\"main\">" +
					"<section id=\"academy_home\" class=\"academy-home\">" +
						"<div class=\"academy-home-copy\"><small>十二节课 · 从开局讲到战争结束</small><h1>先赢一场小战。<br>再看懂整场大战。</h1><p>前四课带你亲手攻克布鲁塞尔；后八课沿 2022 版规则书主干，拆解回合、卡牌、堆叠、移动、堑壕、战斗、步损、补给、要塞、战争状态与胜负。</p>" +
						"<div class=\"academy-promise\"><span>约 45–60 分钟</span><span>59 次判断与操作</span><span>随时保存进度</span></div>" +
						"<button type=\"button\" id=\"academy_start\">开始第一课</button><button type=\"button\" id=\"academy_reset\">重新开始课程</button><a class=\"academy_manual\" href=\"info/rules.html\" target=\"_blank\" rel=\"noopener\">打开 2022 完整规则书 ↗</a></div>" +
						"<div class=\"academy-home-map\"><div class=\"academy-home-route\"><span>小战术</span><i>→</i><span>完整回合</span><i>→</i><strong>大战略</strong></div><div class=\"academy-medal\"><i aria-hidden=\"true\">✦</i><b>完整课程目标</b><span>独立打完整局</span></div></div>" +
					"</section>" +
					"<section id=\"academy_field\" class=\"academy-field\" hidden>" +
						"<div class=\"academy-stage\">" +
							"<div class=\"academy-stage-head\"><span id=\"academy_chapter\">第 1 课</span><b id=\"academy_stage_title\"></b><small id=\"academy_step_count\"></small></div>" +
							"<div id=\"academy_board\" class=\"academy-board\">" +
								"<div class=\"academy-front-label\">1914 · 西线训练战场</div><div class=\"academy-path path-one\"></div><div class=\"academy-path path-two\"></div>" +
								"<button type=\"button\" class=\"academy-city friendly\" data-academy-target=\"koblenz\" data-city=\"koblenz\"><small>德国</small><b>科布伦茨</b><span>KOBLENZ</span></button>" +
								"<button type=\"button\" class=\"academy-city contested\" data-academy-target=\"liege\" data-city=\"liege\"><small>比利时</small><b>列日</b><span>LIEGE</span><i id=\"academy_fort\">要塞 1</i></button>" +
								"<button type=\"button\" class=\"academy-city enemy\" data-academy-target=\"brussels\" data-city=\"brussels\"><small>目标 · 1 VP</small><b>布鲁塞尔</b><span>BRUSSELS</span><i class=\"academy-objective-flag\">⚑</i></button>" +
								"<div id=\"academy_armies\" class=\"academy-armies at-koblenz\"><span>GE 1</span><span>GE 2</span><b>战力 5</b></div>" +
								"<div id=\"academy_enemy\" class=\"academy-enemy-unit\"><span>BE</span><b>战力 2</b></div>" +
								"<div id=\"academy_dice\" class=\"academy-dice\" hidden><small>战斗骰</small><b>–</b></div>" +
							"</div>" +
							"<div id=\"academy_rule_lab\" class=\"academy-rule-lab\" hidden><div class=\"academy-rule-head\"><small id=\"academy_rule_chapter\"></small><b id=\"academy_rule_reference\"></b></div><div id=\"academy_rule_track\" class=\"academy-rule-track\"></div><div id=\"academy_rule_choices\" class=\"academy-rule-choices\"></div><div class=\"academy-rule-note\"><b>带走这一条</b><span id=\"academy_rule_takeaway\"></span></div></div>" +
							"<button type=\"button\" id=\"academy_flow_card\" class=\"academy-flow-card\" data-academy-target=\"flow\"><span>一个行动怎么走</span><b>① 选牌 → ② 选用途 → ③ 地图执行 → ④ 结算</b></button>" +
							"<div id=\"academy_hand\" class=\"academy-training-hand\" hidden><small>训练手牌</small><button type=\"button\" id=\"academy_guns_card\" data-academy-target=\"guns_card\"><i>3</i><b>八月炮火</b><span>摧毁列日要塞，打开通往比利时的道路。</span><em>SR 4 · 战争状态 +2</em></button></div>" +
							"<div id=\"academy_orders\" class=\"academy-orders\" hidden><button type=\"button\" data-academy-target=\"event_order\"><b>事件</b><span>执行卡面历史效果</span></button><button type=\"button\" data-academy-target=\"move_order\"><b>移动</b><span>将部队推进到相邻地区</span></button><button type=\"button\" data-academy-target=\"attack_order\"><b>进攻</b><span>攻击相邻敌军</span></button></div>" +
							"<div id=\"academy_resolve_zone\" class=\"academy-resolve-zone\"><button type=\"button\" data-academy-target=\"resolve_event\">执行八月炮火</button><button type=\"button\" data-academy-target=\"roll\">掷战斗骰</button><button type=\"button\" data-academy-target=\"advance\">推进并占领布鲁塞尔</button></div>" +
						"</div>" +
						"<section class=\"academy-brief\"><div class=\"academy-brief-progress\"><span id=\"academy_microdots\"></span><b id=\"academy_reward\"></b></div><small>现在只做一件事</small><h2 id=\"academy_task\"></h2><p id=\"academy_do\"></p><div class=\"academy-why\"><b>为什么？</b><p id=\"academy_why\"></p></div><button type=\"button\" id=\"academy_hint\">帮我指出要点哪里</button><div id=\"academy_feedback\" class=\"academy-feedback\" aria-live=\"polite\"></div><div id=\"academy_complete\" class=\"academy-complete\" hidden></div></section>" +
					"</section>" +
				"</div>" +
			"</div>" +
		"</div>"
	document.body.appendChild(root)

	root.addEventListener("click", on_click)
	root.querySelector("#academy_close").addEventListener("click", close)
	root.querySelector("#academy_start").addEventListener("click", start_next_lesson)
	root.querySelector("#academy_reset").addEventListener("click", reset_course)
	root.querySelector("#academy_hint").addEventListener("click", point_to_target)
	document.addEventListener("keydown", function (event) {
		if (event.key === "Escape" && root && !root.hidden) close()
	})
	load_progress()
	render_home()
}

function current_lesson() {
	return LESSONS[runtime.lesson - 1]
}

function current_step() {
	return current_lesson().steps[runtime.step]
}

function progress_points() {
	var completed = runtime.completed.filter(Boolean).length * 100
	if (!runtime.completed[runtime.lesson - 1] && runtime.screen === "field")
		completed += Math.round(100 * runtime.step / current_lesson().steps.length)
	return Math.min(LESSONS.length * 100, completed)
}

function next_incomplete() {
	var index = runtime.completed.indexOf(false)
	return index < 0 ? LESSONS.length : index + 1
}

function configure_for_lesson(number) {
	runtime.objectiveSeen = number > 1
	runtime.cardSelected = false
	runtime.eventChosen = false
	runtime.fortDestroyed = number > 2
	runtime.selectedSpace = ""
	runtime.order = ""
	runtime.unitsAt = number > 3 ? "liege" : "koblenz"
	runtime.targeted = false
	runtime.roll = 0
	runtime.enemyDefeated = false
	runtime.victory = false
}

function restore_effects(number, step) {
	configure_for_lesson(number)
	var steps = LESSONS[number - 1].steps
	for (var i = 0; i < Math.min(step, steps.length); ++i)
		apply_effect(steps[i].effect, true)
}

function render_home() {
	if (!root) return
	runtime.screen = "home"
	root.dataset.screen = "home"
	root.querySelector("#academy_home").hidden = false
	root.querySelector("#academy_field").hidden = true
	var next = next_incomplete()
	var all_done = runtime.completed.every(Boolean)
	var can_resume = !all_done && runtime.lesson === next && runtime.step > 0
	root.querySelector("#academy_start").textContent = all_done ? "重打第 " + LESSONS.length + " 课" : (can_resume ? "继续第 " + next + " 课 · 操作 " + (runtime.step + 1) : "开始第 " + next + " 课")
	root.querySelector("#academy_reset").hidden = !runtime.completed.some(Boolean) && runtime.step === 0
	update_nav()
	update_xp()
}

function update_nav() {
	var unlocked = next_incomplete()
	var current_button = null
	for (var button of root.querySelectorAll("[data-academy-lesson]")) {
		var number = Number(button.dataset.academyLesson)
		button.classList.toggle("completed", runtime.completed[number - 1])
		button.classList.toggle("current", runtime.screen === "field" && number === runtime.lesson)
		button.disabled = number > unlocked && !runtime.completed[number - 1]
		if (runtime.screen === "field" && number === runtime.lesson) current_button = button
	}
	if (current_button && window.matchMedia && window.matchMedia("(max-width: 800px)").matches)
		setTimeout(function () { try { current_button.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }) } catch (error) {} }, 30)
}

function update_xp() {
	var points = progress_points()
	var maximum = LESSONS.length * 100
	root.querySelector("#academy_xp").textContent = points + " / " + maximum
	root.querySelector("#academy_xp_bar").style.width = (points / maximum * 100) + "%"
}

function start_next_lesson() {
	var next = next_incomplete()
	var all_done = runtime.completed.every(Boolean)
	if (!all_done && runtime.lesson === next && runtime.step > 0 && runtime.step < LESSONS[next - 1].steps.length) {
		runtime.screen = "field"
		runtime.chapterComplete = false
		restore_effects(next, runtime.step)
		root.dataset.screen = "field"
		root.querySelector("#academy_home").hidden = true
		root.querySelector("#academy_field").hidden = false
		render_field()
	} else {
		start_lesson(next)
	}
}

function start_lesson(number, replay) {
	var unlocked = next_incomplete()
	if (!replay && number > unlocked && !runtime.completed[number - 1]) return
	runtime.screen = "field"
	runtime.lesson = number
	runtime.step = 0
	runtime.chapterComplete = false
	configure_for_lesson(number)
	root.dataset.screen = "field"
	root.querySelector("#academy_home").hidden = true
	root.querySelector("#academy_field").hidden = false
	save_progress()
	render_field()
}

function render_field() {
	var lesson = current_lesson()
	var step = lesson.steps[Math.min(runtime.step, lesson.steps.length - 1)]
	var is_lab = lesson.kind === "lab"
	root.dataset.lesson = runtime.lesson
	root.dataset.kind = is_lab ? "lab" : "campaign"
	root.querySelector("#academy_chapter").textContent = lesson.chapter + " · 第 " + runtime.lesson + " 课"
	root.querySelector("#academy_stage_title").textContent = lesson.title
	root.querySelector("#academy_step_count").textContent = "操作 " + Math.min(runtime.step + 1, lesson.steps.length) + " / " + lesson.steps.length
	root.querySelector("#academy_reward").textContent = "奖励 · " + lesson.reward

	var dots = ""
	for (var i = 0; i < lesson.steps.length; ++i)
		dots += "<i class=\"" + (i < runtime.step ? "done" : (i === runtime.step ? "current" : "")) + "\"></i>"
	root.querySelector("#academy_microdots").innerHTML = dots

	root.querySelector("#academy_task").textContent = step.title
	root.querySelector("#academy_do").textContent = step.do
	root.querySelector("#academy_why").textContent = step.why
	root.querySelector("#academy_complete").hidden = true
	root.querySelector("#academy_hint").hidden = false

	var flow = root.querySelector("#academy_flow_card")
	var hand = root.querySelector("#academy_hand")
	var orders = root.querySelector("#academy_orders")
	root.querySelector("#academy_board").hidden = is_lab
	root.querySelector("#academy_rule_lab").hidden = !is_lab
	flow.hidden = is_lab || runtime.lesson !== 1
	hand.hidden = is_lab || runtime.lesson !== 2
	orders.hidden = is_lab || runtime.lesson < 2
	for (var button of orders.querySelectorAll("button")) button.hidden = true
	if (runtime.lesson === 2) orders.querySelector("[data-academy-target=event_order]").hidden = false
	if (runtime.lesson === 3) orders.querySelector("[data-academy-target=move_order]").hidden = false
	if (runtime.lesson === 4) orders.querySelector("[data-academy-target=attack_order]").hidden = false

	for (var action of root.querySelectorAll("#academy_resolve_zone button")) action.hidden = true
	if (step.target === "resolve_event") root.querySelector("[data-academy-target=resolve_event]").hidden = false
	if (step.target === "roll") root.querySelector("[data-academy-target=roll]").hidden = false
	if (step.target === "advance") root.querySelector("[data-academy-target=advance]").hidden = false
	if (is_lab) render_rule_lab(lesson, step)

	for (var target of root.querySelectorAll("[data-academy-target]"))
		target.classList.toggle("academy-target", !is_lab && target.dataset.academyTarget === step.target)

	render_scenario()
	update_nav()
	update_xp()
}

function render_rule_lab(lesson, step) {
	root.querySelector("#academy_rule_chapter").textContent = lesson.chapter
	root.querySelector("#academy_rule_reference").textContent = step.reference || "2022 规则书"
	root.querySelector("#academy_rule_takeaway").textContent = lesson.summary
	var track = ""
	for (var i = 0; i < lesson.steps.length; ++i) {
		var state = i < runtime.step ? "done" : (i === runtime.step ? "current" : "")
		track += "<span class=\"" + state + "\"><i>" + (i + 1) + "</i><b>" + lesson.steps[i].title + "</b></span>"
	}
	root.querySelector("#academy_rule_track").innerHTML = track
	var choices = ""
	for (var choice of step.choices || [])
		choices += "<button type=\"button\" data-academy-target=\"" + choice[0] + "\"><b>" + choice[1] + "</b><span>" + choice[2] + "</span></button>"
	root.querySelector("#academy_rule_choices").innerHTML = choices
}

function render_scenario() {
	var board = root.querySelector("#academy_board")
	board.classList.toggle("objective-seen", runtime.objectiveSeen)
	board.classList.toggle("fort-destroyed", runtime.fortDestroyed)
	board.classList.toggle("enemy-defeated", runtime.enemyDefeated)
	board.classList.toggle("victory", runtime.victory)
	board.dataset.selected = runtime.selectedSpace
	board.dataset.order = runtime.order
	root.querySelector("#academy_armies").className = "academy-armies at-" + runtime.unitsAt
	root.querySelector("#academy_guns_card").classList.toggle("selected", runtime.cardSelected)
	root.querySelector("[data-academy-target=event_order]").classList.toggle("selected", runtime.eventChosen)
	root.querySelector("[data-academy-target=move_order]").classList.toggle("selected", runtime.order === "move")
	root.querySelector("[data-academy-target=attack_order]").classList.toggle("selected", runtime.order === "attack")
	var dice = root.querySelector("#academy_dice")
	dice.hidden = runtime.roll === 0
	dice.querySelector("b").textContent = runtime.roll || "–"
}

function on_click(event) {
	var lesson_button = event.target.closest("[data-academy-lesson]")
	if (lesson_button) {
		start_lesson(Number(lesson_button.dataset.academyLesson), true)
		return
	}
	var target = event.target.closest("[data-academy-target]")
	if (!target || runtime.screen !== "field" || runtime.chapterComplete) return
	handle_target(target.dataset.academyTarget)
}

function handle_target(key) {
	var step = current_step()
	if (key !== step.target) {
		show_feedback("先完成当前小目标：" + step.do, false)
		root.classList.remove("academy-shake")
		void root.offsetWidth
		root.classList.add("academy-shake")
		return
	}
	apply_effect(step.effect, false)
	show_feedback("✓ " + step.done, true)
	render_scenario()
	setTimeout(function () {
		++runtime.step
		if (runtime.step >= current_lesson().steps.length)
			finish_lesson()
		else {
			save_progress()
			render_field()
			focus_current_target()
		}
	}, 620)
}

function focus_current_target() {
	if (!window.matchMedia || !window.matchMedia("(max-width: 800px)").matches) return
	var target = root.querySelector("[data-academy-target=\"" + current_step().target + "\"]")
	if (!target) return
	setTimeout(function () {
		var rect = target.getBoundingClientRect()
		if (rect.top < 116 || rect.bottom > window.innerHeight - 12) {
			try { target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }) } catch (error) {}
		}
	}, 70)
}

function apply_effect(effect, silent) {
	switch (effect) {
	case "objective": runtime.objectiveSeen = true; break
	case "flow": break
	case "select_card": runtime.cardSelected = true; break
	case "choose_event": runtime.eventChosen = true; break
	case "resolve_event": runtime.fortDestroyed = true; break
	case "select_koblenz": runtime.selectedSpace = "koblenz"; break
	case "choose_move": runtime.order = "move"; break
	case "move_liege": runtime.unitsAt = "liege"; runtime.selectedSpace = ""; runtime.order = ""; break
	case "select_attackers": runtime.selectedSpace = "liege"; break
	case "choose_attack": runtime.order = "attack"; break
	case "target_brussels": runtime.targeted = true; break
	case "roll_combat": runtime.roll = 6; runtime.enemyDefeated = true; break
	case "advance_victory": runtime.unitsAt = "brussels"; runtime.victory = true; break
	case "rule_mastered": break
	}
}

function finish_lesson() {
	runtime.completed[runtime.lesson - 1] = true
	runtime.chapterComplete = true
	runtime.step = current_lesson().steps.length
	save_progress()
	update_nav()
	update_xp()
	var box = root.querySelector("#academy_complete")
	root.querySelector("#academy_hint").hidden = true
	box.hidden = false
	if (runtime.lesson < LESSONS.length) {
		box.innerHTML = "<span class=\"academy-reward-icon\">✦</span><small>第 " + runtime.lesson + " 课完成</small><h2>获得“" + current_lesson().reward + "”</h2><p>你已经学会：" + current_lesson().summary + "</p><button type=\"button\" id=\"academy_next\">进入第 " + (runtime.lesson + 1) + " 课</button>"
		box.querySelector("#academy_next").addEventListener("click", function () { start_lesson(runtime.lesson + 1) })
	} else {
		box.innerHTML = "<span class=\"academy-reward-icon victory\">★</span><small>完整军校毕业</small><h2>你已经掌握整局游戏的主干</h2><p>你会从 VP 目标出发，规划卡牌与六个行动轮，处理移动、堑壕、战斗、步损、补给、SR、要塞和回合末结算。下一局使用完整规则，“新手陪玩”仍会每次只提示当前一步。</p><ul><li>12 节课程完成</li><li>59 次判断与操作</li><li>1200 / 1200 军校经验</li></ul><button type=\"button\" id=\"academy_real_game\">开启我的第一局完整战役</button><button type=\"button\" id=\"academy_stay\">稍后再开，回到当前游戏</button>"
		box.querySelector("#academy_real_game").addEventListener("click", start_real_game)
		box.querySelector("#academy_stay").addEventListener("click", close)
	}
	if (window.matchMedia && window.matchMedia("(max-width: 800px)").matches)
		setTimeout(function () { try { box.scrollIntoView({ block: "center", behavior: "smooth" }) } catch (error) {} }, 80)
}

function show_feedback(message, good) {
	var box = root.querySelector("#academy_feedback")
	box.textContent = message
	box.className = "academy-feedback " + (good ? "good" : "bad")
	clearTimeout(feedbackTimer)
	feedbackTimer = setTimeout(function () { box.className = "academy-feedback" }, 1900)
}

function point_to_target() {
	var target = root.querySelector("[data-academy-target=\"" + current_step().target + "\"]")
	if (!target) return
	target.classList.remove("academy-point")
	void target.offsetWidth
	target.classList.add("academy-point")
	try { target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }) } catch (error) {}
	show_feedback("金色脉冲的位置就是下一步。", true)
}

function reset_course() {
	if (!window.confirm("要清空军校进度并从第一课重新开始吗？")) return
	runtime.completed = LESSONS.map(function () { return false })
	runtime.lesson = 1
	runtime.step = 0
	runtime.chapterComplete = false
	try {
		window.localStorage.removeItem(PROGRESS_KEY)
		window.localStorage.removeItem(COMPLETE_KEY)
	} catch (error) {}
	start_lesson(1)
}

function start_real_game() {
	var has_save = false
	try { has_save = Boolean(window.localStorage.getItem("pog_local_save")) } catch (error) {}
	if (has_save && !window.confirm("开启第一局会覆盖当前单机存档。确定开始吗？")) return
	try {
		window.localStorage.setItem(COMPLETE_KEY, "1")
		window.localStorage.setItem(COACH_KEY, "1")
	} catch (error) {}
	var query = new URLSearchParams()
	query.set("game", "local")
	query.set("new", "1")
	query.set("scenario", "Historical")
	query.set("role", "Central Powers")
	query.set("ai", "bfull")
	query.set("coach", "1")
	query.set("seed", "191408")
	window.location.href = "play.html?" + query.toString()
}

function open() {
	if (!root) return
	if (window.POG_UI && typeof window.POG_UI.close === "function") window.POG_UI.close()
	var old = document.getElementById("hq_tutorial")
	if (old) old.hidden = true
	render_home()
	root.hidden = false
	document.body.classList.add("pog-academy-open")
}

function close() {
	if (!root) return
	root.hidden = true
	document.body.classList.remove("pog-academy-open")
	save_progress()
}

window.POG_ACADEMY = {
	open: open,
	close: close,
	startRealGame: start_real_game,
}

window.addEventListener("load", build)

})()
