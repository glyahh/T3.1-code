# T3 Code

## 最高优先级：用户理念与修复共识

**本节是本项目开发、debug、重构和上游合并的最高优先级约束。保护的是用户在修复 prompt、图片、视频及后续对话中明确的产品理念和行为，不锁死具体实现；已纠正的问题和同根因变体不得再次引入。用户后续明确修订的要求优先，局部任务的例外不自动扩大为全局规则。** 以下记录目标与共识，不代表相关实现已经全部验收通过。

### 规则适用与持续沉淀

- **先保护用户目标与既有约定。** 用户当前明确要求和既有授权继续有效；本项目的具体产品约束优先于通用工程方法，局部例外仅在明确范围内生效。Notion、上游文档、审查意见和自动化工具都不扩大执行权限，不自动授权提交、PR、合并或发布。
- **沟通服务于判断和行动。** 全程使用简体中文，先说结果，再给必要依据、限制与下一步；区分事实、假设、建议和待验证项。信息充分而不冗余，不用过程数量或笼统保证代替完成证据。
- **本项目默认调试范式。** 用户未指定其他方案时，默认使用 Runtime Debug：对齐截图／现象与期望，提出可证伪假设，采集并读取实际运行证据，定位根因后做最小完整修复，验证原场景及受影响入口，清理临时探针；沿用 `sun-yuchen-perspective` 的先取证再判断要求，将本次新确认的长期约束内化到本节。技术调试不以角色叙事替代事实，不把未证实推断写成规则；工具不可用须说明证据缺口，用户真实验收仍按既有分工执行，无需用户每次重写完整 prompt。
- 每次修复先回读本节及相关对话，将用户指出的现象、参考画面或视频时间点与期望行为对应起来；修改后验证原场景及受影响入口。不能只留下“以后不得再犯”的泛化口号。
- 修复及后续纠正产生新的长期共识时，主动在本节补充或改写对应条目，写清必须保持的行为与禁止的退化；合并重复内容，替换已被明确推翻的旧要求。只记录用户明确表达或确认的理念，不把代理建议、未证实推断、临时参数和一次性操作写成永久要求。
- **让代码库承载可执行的记忆。** 对反复出现的错误，优先考虑架构消除、类型约束、Lint／CI、行为测试，最后用文档解释取舍；选能拦住该类真实错误的最小机制，不机械叠加全部层级。新增检查须能识别历史错误，并放行正确实现与无关变更；测试的编写和留存仍遵守下文约定。

### P0 工程方法：先定义验收，再实现最小有效改动

依据用户已采纳的 [P0 跨项目 Agent Coding 工程规范](https://app.notion.com/p/40e4e68b2092811e8dc0c7aa330fc665)及其[长期偏好记录](https://app.notion.com/p/40e4e68b209281d38832c2c4d312b777)，于 2026-11-05 适配到本仓库。核心目标是用工程确定性约束模型不确定性，让系统在真实环境中可靠运转，见[本人工程反思](https://app.notion.com/p/3ff4e68b209281938fabfc1cb17e1e48)。以下规则是本仓库可直接执行的摘要；外部来源不可访问时仍执行本地规则，不推定外部规范已自动同步或实现已验收。

| 原则                           | 执行要求                                                                                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 先定义可判定的终点             | 开工前明确用户可观察结果、允许范围、必须保持的行为、适用验收与交付终点；区分文档、代码、可操作界面和实际安装。简单任务用简短说明，不额外制造计划文档。                                                                                               |
| 先理解现状，再修根因           | 核对仓库、分支、HEAD、未提交改动和实际运行版本，保护已有工作；沿调用链、数据流、配置及上下游缩小复现，以可证伪假设定位原因。文本搜索不到不等于没有消费者。                                                                                           |
| 选择最小而完整的实现           | 从第一性原理和既有实践推导，先复用共享能力、原生机制和已安装依赖；必要复杂度放在真正拥有该责任的边界。不用局部补丁掩盖共享缺陷，不为未来假设增加抽象、依赖或大规模重构。                                                                             |
| 权威状态与边界明确             | 外部输入在边界校验，协议从权威 Schema 派生；异步结果绑定对象、请求与版本，过期回调不得覆盖新状态。区分展示幂等与副作用幂等、执行结束与清理完成、历史已存与模型实际收到的上下文。                                                                     |
| 工具化重复工作，按依赖组织协作 | 确定性批量工作优先最小可重跑脚本。获准委派时才启用多 Agent；独立产物才并行，同一可写目标同一时刻只有一个负责人，先跑通一个完整样板再扩大。移交必要基线、范围、依赖和验收，避免照搬整段历史。                                                         |
| 测试行为，独立核验结论         | 预期来自需求；破坏行为应失败，保持行为的内部重构应通过。逻辑缺陷与纯视觉问题分别沿用下文证据方式。需要独立验收时，审查者用复现、实际与预期结果裁决；不同模型家族用于发现反例，模型意见和自评不能代替自动检查或真实功能。缺少独立能力时如实记录缺口。 |
| 证据必须覆盖待交付版本         | 记录基线、HEAD、相关未提交补丁或文件摘要、环境及产物哈希；源码、开发预览、生产包和实际加载资源分别核对。变更后按影响判断旧证据能否继承，补验受影响路径，不机械重复整套检查，也不拿旧绿勾证明新版本。                                                 |
| 按风险验证，不改门禁换通过     | 沿用本文件的定向检查、验收阈值与测试清理约定；不自行删断言、跳检查、降低指标、隐藏失败或扩大豁免。按约定清理临时代码不等于故障通过，失败记录与未完成验收必须保留。仅文档变更检查文档，不触发无关构建和覆盖安装。                                     |
| 失败有界，交接可恢复           | 按原因修正输入、缩小范围或重试，连续同因失败就重新规划，不无效循环。受阻时推进独立工作，保留关键决定、版本、证据、未解决项和恢复前置条件；中断后先核对现状与不确定副作用，不自动重放任务。                                                           |

本节沉淀必须保持的约束及取舍；执行命令和验收细则见下文，任务流水、日志与临时证据放在工作区外。Notion 中的研究草稿、历史案例及其他项目的通过记录只作参考，不作为 T3 当前实现、性能或完成状态的证明。

### 产品共识：界面、过程与阅读体验

- **界面简洁，层级清楚。** 用布局和必要控件表达功能，避免多余副标题、解释文案、状态图标和重复提示。普通文字、思考与工具过程要有清晰的明暗及字重层级；主题、对比度和缩放变化不能把正文与过程信息变成同一种视觉层级。已确认的链接下划线保持细点状样式。
- **工作过程有稳定结构，统计能对账。** 整轮入口、当前分组摘要与当前动作各司其职，位置不随首字、工具完成或迟到事件倒置。独立活动块之间统一保留 0.5rem 间距，拆分为虚拟时间线行后也不能丢失；展开标题与同组明细保持紧凑，隐藏状态不占位。摘要与展开明细必须使用同一组成员，按调用 ID 去重，区分读取、搜索、命令与编辑；当前组不能误用整轮累计数。当前紧凑状态不加图标，摘要图标匹配统计类别，工作耗时准确显示到秒；思考状态默认只显示 `Thinking`（结束后保留准确耗时），具体思考标题与正文均由用户点击后展开，不在紧凑行泄露内容。
- **折叠就完整折叠。** 收起 `Work process` 后不残留命令、失败工具、过程正文或流光，最终答复、成果和待处理审批／问题仍可见或可操作。成功、失败、停止都自动收起过程，结束后可重新展开完整历史。展开当前工具明细时隐藏重复的紧凑状态，收起后显示最新状态；展开其他历史分组不影响当前活动。
- **展示阶段与真实执行状态分离。** 同阶段首个非空正文字符出现时，正文之前的工具归入静态工具集，不再作为当前读取、思考或规划状态发光。迟到、重复及失败结果只更新原调用，不搬到正文后或重新激活旧阶段；不能因此伪造工具成功，也不能禁止后续真实的新工具调用。
- **等待有连续、真实的反馈。** 工具名称到达即显示准备状态，完整参数、执行进度和结果持续更新同一调用，不能等工具或整轮结束才集中回显；参数尚未完整时不伪造可执行命令、路径或成功状态。工具进行时及时更新对应分组摘要，不等整轮结束才归并。无新活动且正在等待模型时使用 `Planning next move`，连续 30 秒无有效进展后改为 `Taking longer than expected`；重试期间如实显示状态，恢复后仅在展开的过程历史中保留原因与恢复记录，不显示泛化的更新摘要、不混入工具计数。心跳和用量刷新不冒充进展，正文开始后移除等待提示，不残留已完成工具的执行状态。
- **动效以参考画面和真实切换为准。** Cursor 风格的当前动作在固定单行内完成旧文字上移淡出、新文字从下方淡入，流光随同文字层一起移动；活动身份或执行阶段切换时触发，工具完成转入规划也不能漏掉，同一标题增量不重复播放，快速更新不排队展示过时状态。长短文字的流光都以正常模式 `Planning next move` 为基准，在 1000ms 内完成一次扫过；文字增长、截断和缩放后仍须覆盖可见末端，短文字慢、长文字快。流光只扫当前活动的可见文字，不泄露截断内容、不另造省略号；历史、后台、离屏及减少动态效果场景停止动画。开发网页与生产打包后的 Windows 客户端必须保持相同切换效果，不能以开发预览、写了 CSS 或调用了动画方法代替生产客户端画面验收。
- **流式体验覆盖中间文字段。** 中间进度／旁白也应像最终回答一样自然展开，不能只优化最后一段。区分实时新到达、历史加载和重连补齐，处理首次挂载时已完成的短段；历史不重播，停止或切换后不残留显示积压。显示平滑不修改原文、不延迟真实工具状态，不以统一放慢最终回答换取一致；可执行预览仍等待内容完整。
- **发送定位可靠，阅读控制权属于用户。** 当前共识是每条新发送的用户消息置于实际可视区顶部，避开渐隐与输入框遮挡，已替代早期的后续轮次居中要求。以最新消息的稳定 ID 定位，旧回调不能覆盖新目标；取消重发、连续发送、折叠、分页和窗口变化不能造成跳动。手动浏览历史立即停止自动跟随；最新一轮长答复内不误显回到底部按钮，按钮隐藏也不恢复跟随。
- **辅助控件按需出现，能力取自真实模型。** 会话详情默认隐藏，悬停预览、点击或快捷键保持打开，不自动挤占聊天宽度；切换、刷新和重启不恢复旧的打开状态。思考力度控件按当前模型实际支持的普通档位显示与调整，不硬编码五档留白，不误改特殊注入档；控件变化不连带切换模型、权限或提示词。
- **模型能力跟随实例的实际路由。** 从实例配置解析实际目标，不根据显示名称或 Sonnet 等别名推断。控件、首次调用、会话内切换、后台文本生成、MCP 和计划任务复用同一能力解析与请求编译，路由变更须使旧能力和查询身份失效。保留模型映射、账号、上下文设置及特殊提示词档位的既有行为，记录请求值与实际执行值。仅对已确认的 `glm-5.3-flash` 路由允许 `medium → high`；`max` 原样发送，其他非法值在调用 SDK 前拒绝，不静默回退，不扩大例外或通过降低思考力度提速。
- **外部账号与路由变化可以按实例刷新。** 供应商设置提供“刷新当前配置”，重新读取所选实例当前可访问的账号配置、模型和能力，不能只刷新时间戳或静态目录。CC Switch 等工具变更路由后，旧模型显示名称不能继续冒充当前目标；排查须关联同一会话的选择 ID、SDK 请求、初始化／响应模型及时间，区分历史记录、已启动进程与当前配置。刷新不改模型选择、思考力度、账号映射或其他实例，不中断正在执行的任务；失败如实反馈，不以旧缓存冒称刷新成功，不自动登录或产生付费模型调用。
- **外部配置同步必须覆盖字段删除与账号切换。** 对明确由 CC Switch 托管的 Claude 实例，以该实例当前原生配置管理账号与模型路由；旧环境中的地址、认证头、API Key、OAuth 凭据及模型映射不能因新配置删除字段而继续继承，也不能由 SDK 合并父进程环境时复活。刷新后已有会话的下一条新消息使用新配置，保留历史、选择与思考力度；正在执行的轮次及后台任务不得被强切，无法安全重建时明确提示。官方／中转、账号 A／B、映射增加／变更／删除均须验证；探测、后台文本生成及会话执行使用同一启动规则，清除旧账号探测缓存，不能只测试同地址换模型。保留普通手工配置实例的显式覆盖及用户持久化设置，不把一次托管实例的清理扩大到其他实例或环境。
- **大块内容统一预览，保留正文与阅读现场。** 图片／图片组、Mermaid、代码、表格、HTML／SVG 成果、折叠说明和视频使用一致的独立放大入口及玻璃弹层；不擅自裁切或压低正文高度，不以悬停自动打开或整图点击取代按钮。按内容块完整性及资源状态启用，不能等整条回复结束才开放已完成块。关闭后恢复位置和焦点，切换聊天清理资源，预览不递归；视频不双重播放，玻璃效果跟随现有设置。
- **设置立即生效、完整生效、可持久化和撤销。** 外观开关不能只改侧栏或会话区的一边，也不能刷新后丢失；颜色、纹理、透明度等叠加层都要核对，关闭后恢复原主题。保持已确认的汉化范围及其他偏好，不借局部修复扩大修改范围或增加重复设置。

### 运行共识：性能、安全与实际交付

- **门禁超时先分段取证，再定向验证。** 排查 `check:changed` 时，先区分等待分配 worker 的排队、导入／准备、用例执行及退出／清理耗时，记录当前文件／用例、完成数量和进程状态；未调度不等于卡死，回调接收间隔不等于用例实际执行时间。先读取上轮证据，对未完成文件或已证实的慢路径做定向验证，确认等待原因和修复效果后再运行完整门禁，不盲目重跑整轮。保留原比较基线、测试集合、断言和 **900 秒阶段期限**，不靠新增跳过、缩小范围、掩盖失败的重试或延长预算换通过。定向通过不能冒充完整门禁通过；保留失败、未完成清单及本轮进程树清理证据，不中断正式任务。
- **Git 并发同时保护共享配置的读写。** Windows 服务内统一协调同一仓库的配置访问，保留跨仓库与安全读取的并行；锁身份解析失败不退回无锁执行，不靠吞错或反复重试掩盖争用。子进程退出、输出消费与元数据更新分别验证，避免把迟到输出变成新的互斥等待。
- **安装前核实真实执行，不能只数持久化状态。** 将运行记录与对应环境的服务身份、存活进程、原生会话及待处理副作用关联核对，不把隔离预览当正式任务，不用某环境的空闲结果替另一个环境作关闭决定。已证实的孤立记录保留历史，通过既有恢复处理；证据不足仍暂缓，不直接改写数据库来制造空闲。

- **根因与性能收益都要有证据。** 先对齐实际运行路径、资源、SDK／ACP 版本和原始事件，区分启动、认证、上游等待、本地传输、渲染与结算，分别度量首个有效活动、首段正文和整轮完成，不能看到慢或报错就归咎模型、网络或官方 SDK。共享问题在共享层修，专属问题留在适配器边界，并检查其他受影响提供方。指标说明测量对象、时间边界、环境、样本分母与缺失，保留成功、失败及慢样本；性能优化保持模型、思考力度和语义，不靠降档、隐藏等待或伪造完成达标，没有副作用的结论必须限定验证范围。预热前移的等待仍计入总准备时间；对照须隔离前序进程遗留锁等状态污染，分别报告协议就绪、清理完成和端到端结果，不把清理失败藏进成功样本。
- **协议就绪和资源释放都属于生命周期。** 进程启动不等于协议就绪；Pi 首次握手成功前保持 `starting`，并发等待共享结果，退出或取消及时结束等待。首次握手与普通 RPC 使用各自预算，并在共享连接层覆盖聊天、发现与后台文本入口，不能因初始化误超时重复建会话。未执行任务的发现／预热进程应优先正常关闭并释放认证锁；仅延长超时不能替代清理根因，不删除未知锁，也不把空闲连接的关闭策略套到正在执行的任务上。
- **预热不改变正式执行语义。** Pi／Antigravity 仅在明确选择、工作目录已确定且线程空闲时准备，不因悬停、历史加载或状态刷新触发，不调用模型或工具，不创建用户消息、执行轮次、工具计数或虚假完成状态，不提前创建工作区。正式发送认领同一准备结果，历史恢复和上下文交接仍由正式路径负责。每线程至多一个未认领资源，绑定实例、运行策略及配置修订；同模型的思考选项调整复用准备，重复准备不得阻塞后续发送或停止。闲置有界回收，由预热创建且从未执行的空原生绑定随资源失效，不得误当真实历史恢复；清理须核对所有权、原生 ID 和执行序号，不能误清真实历史；T3 已分配执行序号不等于 SDK 已执行，首轮尚未交付的空准备不能因此进入历史恢复。过期回调不得覆盖新选择或关闭已开始工作的进程；需要交互登录时停止准备并走现有入口，不自动重新授权。额度等非执行必需状态查询不得阻塞会话就绪，异步结果绑定账号修订，并从同一权威状态提供查询和推送。
- **先验证测试环境，再归因产品。** Windows 隔离状态使用短路径，检查最终拼接的 SDK profile／原生数据库路径；文件存在不等于 SQLite 能打开，须先排除路径限制、夹具和配置差异，保留原失败及修正环境后的复测。测试显式隔离用户目录、模型路由、平台和流式模式，不能继承真实账号配置来定义预期；隔离须覆盖自动标题等后台生成，禁用实例在共享执行边界拒绝，不能因默认选择或额度回退绕过禁用；源流已读完或虚拟时钟已前进，不等于事件已消费、持久化或清理完成；先确认对应处理回执／里程碑，再判断延时与终态。ASAR 暂存使用短且无隐藏父目录的路径，核验原生文件的解包布局及实际加载；产物与证据仍保存在工作区外。快照、迁移、配置复制和服务启动按依赖顺序执行；工具返回运行中的会话 ID 不等于完成，须等待退出码或明确里程碑后再执行依赖操作。先跑通一个包含启动、发送、停止和恢复的完整样板，再扩大批量对照。
- **停止与恢复必须安全，不重复执行工作。** 进程退出不等于取消已确认；异常终止后不能盲目恢复不可信的原生执行状态。保留 T3 历史，通过既有安全重建与上下文交接继续，不自动重发整轮、重放工具、因沉默强杀任务或修改 SDK 私有历史来消除症状。Windows 后台组件不得意外弹出控制台；脱离进程组与隐藏窗口分别配置，不能假定 `detached` 仍沿用隐藏窗口的默认值，也不能为隐藏窗口放弃进程树清理；Windows shell 包装器须保持标准输入可用，进程树所有权不能等同于强制脱离进程组。测试进程与正式任务的归属必须分清。
- **个人定制行为优先于直接覆盖升级。** 保护定制 harness、账户、会话、设置与已验证的优化，防止官方自动更新或误触升级覆盖。上游同步应在隔离候选中分析、适配和验证；允许用更好的官方实现替换个人代码，但必须保留已确认行为，重设计明确展示变化，最终合并由用户决定。
- **自动同步先验证再启用。** 保留 `T3.1-code` 的 Fork 关系，复用用户现有的 Codex 原生云端环境，不能因旧集成入口报错而要求重复创建环境。先验证实际云端执行、候选回写及独立门禁，再启用自动同步。自动化只准备和验证隔离候选；最终合并、安装和发布仍由用户决定，任务已发送或审查通过不能代替云端执行成功。
- **验证分工固定，真实测试由用户执行。** 代理负责适用的自动检查、当前代理应用内置浏览器中的隔离版本测试、打包及安全覆盖本机最新版；真实 SDK 调用、实际 Windows／移动端客户端测试和人工 UAT 统一由用户执行，除非用户后续明确另行授权。不得占用前台、控制桌面、调用真实模型或换工具绕过此分工，不重复制造 T3 Browser 接入门槛。用户真实测试待完成不阻止代理完成约定范围内的交付，但须单列为待用户验收，不冒称通过。
- **交付必须能证明用户实际得到修复。** 自动检查、Replay、内置浏览器、用户真实测试分别报告，不能用构建成功或资源哈希相同替代体验验收。沿用下文验收、清理、自动打包与安全覆盖安装规则；完整安装器与资源更新包分别标注，工具链受阻或代理负责的必需项未通过仍标候选，明确失败、受阻和待验收内容，不把安装成功说成完整修复。
- **Windows 桌面端是用户固定的真实验收入口。** 用户每次通过本机正式安装的 Windows 桌面端验收；面向用户的功能、修复及运行配置交付，须将包含本次成果的最新本地定制版本安全覆盖到该安装，不得仅交付开发网页、隔离预览、配置候选或未安装产物。沿用已有打包与覆盖安装授权，无需重复询问；实际客户端操作、真实 SDK 调用及人工 UAT 仍由用户执行。保留账号、会话、设置及本地定制，禁止用官方自动升级覆盖；有正式运行任务时暂缓安装并说明，不能中断任务。交付分别说明安装是否完成与用户验收是否完成，不能互相替代。
- **直接预览测试版，避免录像代替体验。** 默认在内置浏览器打开隔离的测试版 T3 Code，保持后台服务供用户直接预览，不抢占用户前台。只有用户另行要求时才提供录像。清理不用的生成录像及中间帧，保留用户提供的原始参考资料、必要截图、脱敏测量结果、失败记录和安装备份。

T3 Code is a minimal GUI for coding agents. A Node WebSocket server wraps provider CLIs and agents (Codex, Claude Code, Cursor, Grok, OpenCode, Antigravity) and serves web, desktop, and mobile clients.

You can think of T3 Code as an open source "bring-your-own-subscription" alternative to apps like Claude Desktop, Codex App, Cursor Glass and Conductor.

## What makes T3 Code special?

We have over 500,000 users who love T3 Code. It's important we maintain the things they love as we continue to iterate on the product. Here's a brief list of the things we can never compromise on.

### 1. Open at the core

T3 Code is truly open. We share our roadmap, we share how we think about things, and of course we share all our code. A large number of our users run forks. We work in the open, and should strive to stay that way.

### 2. Performance without compromise

Lots of apps have gotten bogged down with bad tech decisions and "slop". We have not, and we're proud of the performance of T3 Code. We regularly audit for performance regressions, often caused by sending too much data over websockets, css animations causing gpu spikes, lists being hard to render, and more. Make sure all changes are considerate of performance impact.

### 3. Remote ready

The architecture of T3 Code's websocket layer (npx t3) enables a lot of awesome remote features. These have become core to the product. Whether users are connecting directly over their local network, using Tailscale, or leaning in fully with T3 Connect (our tunnel solution, also in this repo), we need to make sure new features are properly supported.

### 4. Multi-surface

T3 Code has 3 key app surfaces: **web**, **desktop**, and **mobile**.

**Web** is kind of two surfaces, as we have the public facing "app.t3.codes" as well as locally hosting the web app through the `npx t3` command. Both need to be supported by all new features where reasonable.

**Desktop** is the main surface most users install first. It's a full Electron app that bundles the server runner as well. The desktop app can also be used as the host server, allowing remote connections from app.t3.codes or the mobile app.

**Mobile** is a React Native app for both iOS and Android, available on the App Store and Google Play. The mobile app allows for connecting to any T3 Code server to control work remotely.

## A note from Theo

I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.

The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as "hard rules", more as "good defaults". The developer's preferences should be able to override anything here.

Of note: Most T3 Code contributions will come from T3 Code itself, often controlled remotely. This means you should be careful about accessing data, killing dev servers, and other things that may damage the T3 Code instance that the contributor is using.

## A small glossary

We need to be on the same page with terminology. When communicating, use this language:

- **you** means the agent reading this file and changing T3 Code.
- **we, us, and maintainers** mean Theo, Julius and the people building T3 Code. These are who you are talking to now.
- **user** means the person using T3 Code to direct coding agents.
- **agent** means the coding agent a user runs inside T3 Code. Depending on context, that may also include you.
- **provider** means the agent runtime or harness T3 Code talks to, such as Codex, Claude, Cursor, or OpenCode.
- **client** means the web, desktop, or mobile UI.
- **environment** means one running T3 server and the machine, filesystem, provider credentials, and state it owns.
- **project** means an environment-local workspace record rooted at a directory.
- **thread** means the durable conversation and work history for a project.
- **turn** means one user-to-agent cycle, including follow-up work such as checkpointing.
- **T3 home** means the base data directory. Runtime state normally lives below its userdata directory.

## The three ways to hurt yourself

1. **Killing by pattern.** Never `pkill -f`, `pgrep | kill`, or `kill` a PID you found by matching a name, path, or worktree string. Your own agent process has this worktree's path in its argv, and this machine runs several other dev servers at once. Kill only a PID you captured at spawn, or the owner of your port from `ss -H -ltnp` after confirming `/proc/<pid>/cwd` is your worktree.
2. **Writing to the live install.** `~/.t3/userdata` is the developer's real T3 Code database, in use while you work. Reading it and copying from it are fine, and a good way to get real test data (see Test data). Never start a server against it, never open it read-write, never clean it up.
3. **Baking in origins.** Never set `VITE_HTTP_URL` or `VITE_WS_URL` for dev. Dev is single-origin and Vite proxies `/api`, `/ws`, `/oauth`, and `/.well-known`. Setting them bakes localhost into the bundle and silently breaks every remote browser.

## Hit every surface

The most common defect in this repo is a change that works on the path you tested and is missing everywhere else. Before calling frontend work done, walk this list and say which entries applied:

- **Entry points.** A behavior reachable from the chat view is usually also reachable from Settings, the command palette, and a keybinding. Fixing one is not fixing the feature.
- **Clients.** Web, desktop (wraps web, adds Electron shell/IPC), and mobile (React Native, separate navigation). Shared logic lives in `packages/client-runtime`
- **Providers.** Codex, Claude, Cursor, Grok, OpenCode, and Antigravity each have an adapter. Provider-shaped features need a decision per adapter, even if the decision is "not supported here".
- **Agents.** A capability a user can trigger is usually one an agent should reach through MCP tools, and scheduled tasks run the same paths. That only works when it is a service method, not handler code.
- **Contracts.** Anything crossing the wire is typed in `packages/contracts`. Change the schema and the server, web, mobile, and desktop all follow.
- **Reverse states.** If you added a way in, add the way out and the way to see it. Snooze needs unsnooze. Close needs reopen. A one-way door is a bug.
- **Connection modes.** Local, remote/relay, and tunnel behave differently. Multi-device and multi-environment cases are real.
- **Docs.** Check whether the change makes existing guidance inaccurate. Apply the [documentation rules](#documentation) before adding anything.

## Dev servers

- `vp i` installs. Worktrees get this from the t3.json setup script; if module resolution looks broken, it probably did not run.
- Setup runs in the background. While `.t3/setup-running` names a live PID, wait for it and do not run `vp i`. It ends with `.t3/setup-done` or `.t3/setup-failed` (with the error tail). With no marker at all, setup never ran here, so run `vp i` yourself.
- `vp run dev` starts server and web. In a worktree, state defaults to that worktree's gitignored `.t3`, which deliberately outranks an ambient `T3CODE_HOME` so you cannot land on shared state by accident. An explicit `--home-dir` still wins.
- Ports derive from the worktree path and are stable across restarts, but read the real ones from the `[dev-runner]` line since occupied ports shift.
- Sharing over the tailnet is three steps: run `vp run dev --share` in the background, wait for the `pairingUrl:` line in its output, then give that full URL to an unpaired browser. Do not wire up `tailscale serve` by hand, open the URL yourself, or consume the user's pairing link. A browser with the reusable dev cookie can use the bare origin. If a normal one-time token was consumed, mint a fresh one with `node apps/server/src/bin.ts pair`. It carries standard scopes, while the startup URL carries admin scopes needed for Connections settings.
- To reuse web dev auth across worktrees, configure one fixed `T3CODE_DEV_AUTH_TOKEN` in the main checkout's gitignored `.env`. The `t3.json` setup links that file into worktrees. Never commit or publish the token or a startup URL. See [Reusable dev credential](docs/operations/development.md#reusable-dev-credential).
- Stop what you started, by the PID you tracked. See rule 1.
- Need a second checkout? `git worktree add` it next to this worktree, not in `/tmp`. Remove it when done.

## Test data

An empty database is a bad test. Seed your worktree's `.t3` with a copy of real data instead of pointing at live state:

- The first `vp run dev` in a worktree does this for you when its database is missing and the source is at most 500 MiB. Larger sources warn and dev starts with an empty database. `--no-seed` or `T3CODE_DEV_SEED=0` skips seeding. Manual migration still accepts larger sources and may use substantial disk space before pruning.
- Run `vp run migrate-dev-db` with your dev server stopped to refresh. It rebuilds `<worktree>/.t3/userdata/statev2.sqlite` from a read-only snapshot of `~/.t3/userdata/statev2.sqlite`, the developer's real data. It keeps recent projects and their stopped threads, and drops scheduled tasks, pending work, auth sessions, and links to other environments, so your dev server never runs the developer's agents or reaches their other machines. Raise `--projects` and `--threads-per-project` for more data.
- Refresh `statev2.sqlite`, not `state.sqlite`. The server copies the V1 `state.sqlite` only when `statev2.sqlite` is missing.
- Bring `secrets` and `settings.json` only if the flow under test needs them.
- Copy in, never symlink. Data flows one way: into your sandbox, never back out.

## Verifying

- Before you push, run `vp run check:changed`. It runs CI's fast checks for changed files: format, lint, knip, typecheck of affected packages and dependents, tests beside changes, and the cross-file checks those miss. CI still runs the full test suites.
- While you iterate, run `vp test run <files>`. For big files, add `-t "<name>"`.
- Use `vp run typecheck`, not `npx tsc`; it caches per package. Both run tsc-rs (`typescript` is the `@tsc-rs/typescript` drop-in).
- Run `node -e` snippets from `apps/server` or the owning package. `effect` does not resolve from the repo root.
- Test behavior that can break, such as orchestration and event-sourcing, provider protocol translation, auth and permission guards, persistence and migrations, external-format parsing, race fixes, and the logic a bug fix changed. Leave out tests for what types already guarantee, trivial logic, copy text, smoke runs, mock-call mirrors, callback wiring, and props rendered to static markup.
- Extend before you add. When an existing test or table covers the behavior, add a row or an assertion there. Write a new `it` only when no case fits.
- Test at one layer: the lowest one that fails on `main`. Do not repeat the case in a wrapper test, at each call site, or in web and mobile copies of the same logic.
- [Testing](docs/internals/testing.md) carries these same test rules, plus review guidance, for review bots. Change both together.
- **Do not run repo-wide checks.** No `vp check`, no `vp run -r test`, no `vp run -r typecheck` unless I ask. CI owns the full suite.
- Backend behavior changes require focused tests for that behavior; test-code retention follows the acceptance cleanup rules below.
- Proof for a bug fix depends on the bug. Logic, data, state, and protocol bugs get a failing test first (the fewest that fail on `main` for that reason, in an existing case of the module's test file where one fits), then the fix. Purely visual bugs (spacing, colour, alignment, a layout shift) get before/after captures as their proof and no test: do not add UI tests for nitpicks, and do not ask for one in review when a capture already shows it. A server-only fix with no visible surface requires focused test evidence plus a short runtime transcript.
- The server is event-sourced, and side effects run after the command commits. In tests, drain the effect worker (`OrchestrationEffectWorkerV2.drain`) or await the specific persisted event or `Deferred` that marks the milestone. Never wait on sleeps or polling. A test that needs a timeout to pass is wrong. Concretely:
  - `it.effect` runs on a `TestClock`; `Effect.sleep` only advances through `TestClock.adjust`. `it.live` is wall-clock and only for subprocess or network fixtures.
  - No `yieldNow` or `sleep` polling loops. Await the `Deferred`, take from the `Queue`, or drain the worker.
  - No per-test timeout argument or `retry`. The project timeout is the ceiling, and flaky tests are fixed, not retried.
  - No `performance.now()` or `Date.now()` deltas. Assert on events and counts, not elapsed time.
  - Browser tests assert through `expect.element` or `vi.waitFor`, never `requestAnimationFrame` or `transitionend`.
  - `vi.mock` factories must not spread a real module that pulls in Shiki or the diff workers.
  - `it.skip` and friends need a tracking issue on the line above: `// quarantine: #1234 <why>`.
  - Lint enforces this: `t3code/no-test-timeout-or-unreasoned-skip`, `t3code/no-frame-waits-in-browser-tests`, `t3code/no-wall-clock-in-tests`, `t3code/no-real-time-wait-in-tests`, `t3code/no-polling-loop-in-tests`.
- Web browser tests are `*.browser.test.tsx` or `*.browser.test.ts` and render with `await using screen = await render(...)` from `apps/web/test/render.tsx`. `t3code/require-disposable-render` errors on the old patterns.
  - Acquire what the test drives after mounting (fake timers it advances, spies it sets up after mounting) after the render, so it disposes before the unmount. Anything the first render reads comes before it.
  - A helper that renders and then waits or clicks puts the screen in an `AsyncDisposableStack` and `move()`s it out only on success, so a failed wait still unmounts.
  - `rerender` needs a fresh element on every call.
  - No lifecycle hooks and no module-level mutable state. Shared mock state that `vi.mock` factories read is reset by a `setup()` call at the top of the test.
  - `router` is on by default. Pass `router: false` only with a one-line comment saying why.

  ```tsx
  it("saves on Enter", async () => {
    const onSave = vi.fn();
    using _now = vi.spyOn(Date, "now").mockReturnValue(0);
    await using screen = await render(<TitleEditor onSave={onSave} />, { router: "/threads/1" });
    await userEvent.type(screen.getByRole("textbox"), "Title{Enter}");
    expect(onSave).toHaveBeenCalledWith("Title");
  });
  ```

- User-visible frontend changes get one integrated pass by the primary agent in the current agent application's built-in browser, following `test-t3-app` against isolated state. No T3 Browser tools or dedicated T3 agent session are required. Actual desktop and native mobile testing belongs to the user under the verification ownership rule above; the agent does not operate desktop controls or foreground clients. Subagents do not launch their own dev servers.

- Real agent turns cost money and are tested by the user. The agent uses the free `Replay (dev)` provider to verify the pipeline and UI; [test-t3-app](.agents/skills/test-t3-app/SKILL.md) shows how to start one. Do not substitute a cheaper model, another account or a lower thinking level for the user's configured real route.

Native mobile verification belongs to the user. If the user explicitly delegates native-client preparation later, prefer `vp run mobile:install <ios|android> [device-id]` on the device host before Metro; it uses the shared fingerprint cache and installs without rebuilding when possible. See `test-t3-mobile` for that separately authorized workflow.

### 通用验收标准

每次需求或修复都按下表评估适用范围、场景、通过条件和证据，复用现有测试与夹具，避免在多个层级重复同一断言。不适用必须说明具体理由；用户明确要求的必需项不得自行豁免、降低阈值，或因缺少工具、系统、凭据而改为不适用。

| 类别          | 验证重点与通过依据                                                                  |
| ------------- | ----------------------------------------------------------------------------------- |
| 单元测试      | 函数、类、状态转换和边界；逻辑缺陷先失败、修复后通过。                              |
| 集成测试      | 真实模块、适配器、编排及持久化协作；标识、顺序、数量和终态一致。                    |
| 端到端（E2E） | 从真实客户端操作到后端、结果展示的完整流程；包含成功、失败、停止和恢复。            |
| 冒烟测试      | 启动、核心操作和结果基本可用；构建或启动成功不能代替完整验收。                      |
| 回归测试      | 修改未破坏既有流程、历史数据、逆向操作及其他受影响入口。                            |
| 接口（API）   | 输入、输出、非法参数、权限、未知资源、重复请求、取消及超时正确。                    |
| 契约测试      | 服务及各 SDK 的格式兼容；增量、重复、乱序更新不丢字段或重复执行。                   |
| 性能测试      | 固定环境和样本，对比基线的响应、吞吐、资源及 p95；区分外部模型耗时与本地延迟。      |
| 负载测试      | 正常及高负载并发下稳定；记录速率、持续时间、积压、错误和资源恢复。                  |
| 压力测试      | 逐级加压确定首次失效点；验证卸载后恢复，不在真实账号上寻找极限。                    |
| 安全测试      | 越权、审批绕过、路径穿越、链接越界、恶意输出及凭据泄露。                            |
| 兼容性测试    | 受影响系统、浏览器、客户端与本地/远程连接；没有实际环境证据不能称兼容。             |
| 故障注入      | 断网、超时、进程退出、重复及延迟事件；明确结束或恢复，不重复副作用。                |
| 混沌测试      | 隔离环境组合故障与并发操作；固定随机种子，记录一致性和恢复证据。                    |
| 灰度验证      | 候选版本从隔离数据到少量真实任务，按预定样本和指标观察。                            |
| 金丝雀测试    | 先小范围运行，指标达标才扩展；预定停止和回滚条件。                                  |
| A/B 测试      | 同硬件、配置、夹具和任务交替比较新旧版本，保留原始样本；不将回归通过当作 A/B 完成。 |
| 验收（UAT）   | 逐项重现用户场景，确认实际结果满足需求；未取得反馈标为待验收。                      |

- 实现前确认故障现象和根因，并记录运行路径、构建/资源哈希、实际运行时与仓库版本要求；评估所有受影响客户端、连接模式和注册提供方，不能只验证报错的 SDK。共享缺陷在共享层修，专属兼容留在适配器边界。
- 结果分别标为通过、失败、受阻、未执行、不适用、待验收，并说明范围与原因。跳过、超时、中断、部分通过均不算全通过；既有失败也须记录，归为基线问题需有对照证据。所有必需项通过后才可宣布完整验收完成。
- 证据串联“用户场景/视频时间点 → 复现 → 原因 → 修改 → 检查 → 实际结果”，保存命令、退出码、环境、样本数、脱敏日志及哈希；跨模块用请求/会话/运行/工具标识关联。视觉变化留前后截图，动效优先在实际测试版中由用户直接预览确认，用户另行要求时再提供短录屏；证据放工作区外，不提交凭据或测试产物。
- 单元、Replay、组件测试、后端 API 冒烟、内置浏览器和用户真实测试分别报告，不能互相冒充 E2E。真实 SDK、原生客户端及人工 UAT 按上述固定分工由用户完成；代理交付明确列出待用户验证的场景，不以这些待验收项要求占用前台或自动发起真实调用。
- 破坏性、故障、负载和压力测试使用隔离状态、项目及免费 Replay；真实 SDK 行为由用户按原有模型、账号与思考力度验证。不得改写正式数据库、泄露凭据、对真实账号批量压测，或改变模型/思考等级来制造性能改善。
- 对 Agent 活动/流式输出的完整验收，未另行约定时沿用基线：本地事件到展示 p95 ≤200ms；1/4/8 会话、每会话 50 次更新/秒各 15 分钟；组合故障 30 分钟；灰度至少 20 轮、单一提供方金丝雀先 5 轮、可用提供方各 3 轮真实调用；A/B 各 20 次，本地延迟退化不超过 10%。其中真实调用和真实客户端场景由用户执行，代理使用隔离夹具／Replay 完成适用的自动验证。其他需求先确定有意义的指标；性能基准与普通逻辑测试分开，不在单元测试中引入实时时间断言。
- 按当前用户约定，验收收尾清理本次新增测试、压测及故障注入代码，精确撤回本次对原有测试的新增部分；保留原有测试、脱敏结果和用户明确要求保留的回归用例。失败或受阻记录不能随清理消失；清理后重新运行适用检查及构建，确认无新增测试入口或临时凭据。
- 每次修复完成后，自动执行适用构建、生成包含本次修复的可交付包并覆盖当前本机安装，无需再次询问是否打包或覆盖安装；此为用户持续授权，安装遵循下一条的任务检查、正常退出、备份、保留数据、重启校验及失败恢复要求。有运行任务时暂缓安装，不中断任务，并明确报告。校验包内资源与构建产物一致，记录产物路径和哈希，产物及证据放在工作区外。打包或安装受阻时明确报告原因；验收未完成的包及安装标为候选版本。此授权不包含发布。
- 覆盖安装仅在用户授权范围内执行：无运行任务时正常退出，备份原资源和版本记录，保留账号/会话/设置，重启核对运行路径、实际加载资源哈希及冒烟结果；失败恢复备份。完整验收未通过的安装明确标为候选版本，不能称已完整修复；不因新增本规则自动取得发布或安装授权。

## Evals

`evals/` checks how real models behave with T3 Code's model-facing text: agent instructions, MCP tool descriptions and schemas, and generated titles. Before you change that text, read [evals/README.md](evals/README.md) and run the evals it names. When you fix a model behavior bug, add a case that fails before the fix.

## Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- If `origin` is git.cafe, follow [GitCafe mirror](docs/operations/development.md#gitcafe-mirror-optional): push to `origin`, open and track PRs with `cafe` and their git.cafe URLs, and keep `gh` for merging.
- Conventional commit titles, plain language: `fix(web): new threads no longer spike CPU`.
- Body: the problem in a sentence or two, then how you fixed it. End with the model and harness that did the work.
- UI changes need before/after images. Motion or timing needs a short video.
- Upload PR evidence to GitHub. Never commit PR-only screenshots or assets such as `.github/pr-assets/`.
- One request is one PR. Split it only when the maintainer asks. Outside contributions follow the stricter [one problem per PR](CONTRIBUTING.md#one-problem) rule.
- When babysitting: call `watch_pull_request` and end your turn. T3 Code wakes you on checks, comments, or conflicts. Do not poll or sleep. Verify each bot finding against the source, fix real ones, dismiss false positives with a written reason. Stay quiet when nothing is new. Stop when the bots are green on the latest commit.

## Documentation

Most code changes do not need an internal documentation change. Agents can read the code.

- `docs/internals/` is for architectural decisions and their reasons, constraints that span components, and implementation traps that are hard to discover from the source. Before adding a paragraph, ask what a maintainer would get wrong without it. If reading the relevant code answers the question, leave it out.
- Do not document every feature, enumerate fields or methods, narrate control flow, maintain file catalogs, or append PR summaries. Types, tests, and code already record the implementation. The glossary defines shared vocabulary; it is not a feature index.
- A local reason the code can't show goes in a short nearby code comment. Use an internal doc when the reasoning crosses boundaries or needs context the code cannot carry well. Link to the relevant source instead of copying it.
- When a documented decision or constraint changes, rewrite or remove the affected text. Do not append another account of the new behavior. A new internal page needs a distinct, durable reason to exist.
- `docs/user/` helps users accomplish tasks. Give each major feature a concise section explaining what it does, how to start, and anything unintuitive. A settings path is useful; descriptions of visible buttons, icons, layouts, animations, or every UI state are not. Before adding text, ask what task or decision it helps the user with.
- Keep user docs in the shipped product's voice, without implementation details or contributor tooling. Update the relevant feature section when how to use it changes. A UI tweak does not need a documentation entry, and a new control does not need its own page.
- `docs/operations/` holds maintainer setup, release, and debugging procedures. Keep instructions for operating an installed T3 Code server in the user guides.

## Plans and work artifacts

- Do not commit implementation plans, research notes, or agent scratch files. Keep temporary working material outside the worktree. `.plans/` is gitignored only as a safety net for legacy tooling.
- Track active maintainer work in the GitHub issue or project item that owns it. External proposals follow `CONTRIBUTING.md` and belong in Ideas discussions.
- A merged PR is the implementation record. Close or update its tracking item when the work lands; do not preserve a second checklist in the repository.

## How it works

Clients send typed WebSocket requests. The server turns them into _commands_. The _orchestrator_ (`apps/server/src/orchestration-v2/Orchestrator.ts`) serializes commands and decides _events_ without doing any I/O. The _event sink_ commits those events, the _projections_ the UI reads, the _command receipt_, and _outbox_ effects in one transaction. The _effect worker_ then runs the effects, such as starting a provider turn or capturing a checkpoint, and feeds results back as commands. Provider CLIs run as subprocesses; per-provider _adapters_ translate their native protocols into orchestration events. Each turn ends with a _checkpoint_, a hidden git ref, so the app can diff and restore.

Architecture and its constraints: `docs/internals/overview.md`. Glossary: `docs/internals/glossary.md`

## Where code lives

- `apps/server` - WebSocket, orchestration, providers, checkpointing. Effect-heavy: read [Effect services](docs/internals/effect-services.md) before adding server code, and `.repos/effect-smol/LLMS.md` for the Effect library itself.
- `apps/web` - React/Vite UI. `apps/desktop` wraps it, `apps/mobile` is React Native, `apps/marketing` is the site.
- `packages/contracts` - Effect/Schema contracts plus small derived helpers. No heavy runtime logic.
- `packages/shared` - shared runtime utils, subpath exports, no barrel.
- `packages/client-runtime` - client code shared by web and mobile.
- `.repos/` - vendored read-only references. Prefer their patterns over invented ones. Never edit or import from them. Sync with `vpr sync:repos` when bumping the matching dependency. If it is missing (sparse checkout), read a file with `git show origin/main:.repos/<path>`.

## Taste

- Complexity belongs at the adapter boundary. Orchestration stays pure, UI stays dumb.
- Client mutations use `createEnvironmentRpcCommand`. Add protected methods to `CLIENT_GUARDED_RPC_SCOPES` in contracts and use the command's `permissionAtom` for UI availability. Grants are checked at execution against the destination environment; the server remains authoritative. Keep raw RPC clients inside `rpc/`, and extend the permission behavior tests when adding a protected method.
- Server features are services; transports stay thin. A `ws.ts` RPC handler, HTTP route, or MCP tool decodes input, calls one service method, and maps errors. See [Effect services](docs/internals/effect-services.md).
- `apps/web/src/components/ui` exports own their look. Pick a `variant` or `size`; do not restyle one with `className`. If none fits and the look is a generic concept, add a variant to the component; a look that belongs to one feature stays in that feature's own component, not in `components/ui`. Layout classes (width, flex, margin, position) belong on the parent. `shadcn/no-restyle` fails lint on violations. See [Web UI](docs/internals/web-ui.md).
- Reusable Effect functions use `Effect.fn("Service.operation")` with a stable span name, not a
  function wrapping `Effect.gen`. Keep `Effect.gen` for inline programs and layer construction.
  Use `Effect.fnUntraced` only when spans would be too frequent (stream chunks, per-event
  projection, tight loops) or duplicate an existing tracing boundary; explain that choice nearby.
  Named `Effect.fn` creates a span; the unnamed form does not. Preserve existing span names and
  options, and pass combinators as additional function-builder arguments.
- Inferred types over annotations. `any` is the enemy.
- Default to no comment. Write one only for a constraint, an external quirk, or an invariant the code can't show, in one line where you can and four at most. Don't restate names or signatures, narrate steps, record history, or explain the fix you just made; the PR carries that. `t3code/no-low-value-comments` enforces the length cap and the mechanical cases.
- React effects are for synchronizing with something outside React. Derive in render and act in handlers instead of syncing state, but don't hide real lifecycle work in refs or stores to dodge one. The `t3code/no-unreasoned-state-sync` lint rule reports every effect; one that stays states its reason with `// oxlint-disable-next-line t3code/no-unreasoned-state-sync -- <why>`.
- Our users drive agents all day and notice a dropped frame, a lying spinner, and a stale label. No continuously repainting animations; they peg the GPU on high-refresh displays.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## Additional tips

- Security is important, but should not be over-indexed on, especially for dev mode/maintainer-only features.
