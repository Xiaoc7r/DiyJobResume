import type { Template } from "./flow";

// Wording supplied by the user. Only inline emphasis is added; skills are not rewritten.
export const skillLines = [
  "熟练掌握 JavaSE 核心知识，理解常用集合及数据结构、面向对象、异常、反射、泛型等；",
  "熟悉 MySQL，理解事务、隔离级别、索引、MVCC、三大日志、锁机制、慢SQL优化等；",
  "熟悉 Redis，理解其5种核心数据结构、持久化策略、分布式锁、缓存穿透、击穿、雪崩及解决方案等；",
  "熟悉 RocketMQ 消息中间件，理解可靠传输、幂等去重、顺序消费、消息堆积和延迟解决方案等；",
  "熟悉 JUC 并发编程，了解线程池、ThreadLocal、Synchronized、CAS、JMM等；",
  "熟悉 JVM 内存结构，了解垃圾回收机制、双亲委派机制、类生命周期、常见问题的定位与分析等；",
  "熟悉 SpringBoot、MyBatis-Plus 等常用框架的使用，了解 IOC、AOP、Spring事务等；",
  "熟悉 IDEA、Maven、Git 等配置协作工具，熟悉 Claude Code、Codex 等新兴AI编程工具。",
];
const skills = skillLines.map(
  (text) =>
    "- " +
    text
      .replace(/(理解|了解)(.*)([；。])$/, "$1**$2**$3")
      .replace("Claude Code、Codex", "**Claude Code、Codex**"),
);
// Explicit fictional internship examples; not claims about the user's employment.
const header = `# 炒肉多
123 4567 8910 | xxiaocr@gmail.com | [github.com/Xiaoc7r](https://github.com/Xiaoc7r)
## 教育背景
### 吉林大学 \`985\` \`211\` \`双一流\` | 2019.09 - 2023.06
**计算机科学与技术**
## 工作经历
### 星河科技 · 电商平台事业群 | 后端开发工程师 | 2023.07 - 2026.07
**职责范围：**负责交易履约与营销基础服务，从需求评审、方案设计、核心开发到灰度发布与线上值守，推动跨团队交付。
- **交易一致性：**设计订单状态机、幂等键与本地消息表，配合消息重试、补偿任务和对账机制，处理支付回调与超时关单的并发冲突。
- **高并发治理：**拆分热点缓存与数据库访问路径，落地限流、隔离和降级；通过容量评估与全链路压测确定资源水位，支撑活动流量峰值。
- **稳定性建设：**围绕接口耗时、消息积压和业务成功率建立监控与告警，完善故障演练、灰度验证及回滚预案，推动问题复盘与长期修复。
- **工程协作：**推进接口契约、自动化回归与代码评审，沉淀通用组件及排障手册，参与新人带教和跨业务系统的技术方案评审。
## 项目经历`;
export const cityhub = `### CityHub——智能生活服务平台 | 2024.03 - 2024.08
**技术栈：** \`SpringBoot\` \`MySQL\` \`Redis\` \`Lua\` \`MyBatis-Plus\` \`RocketMQ\`
项目简介：CityHub 是一个本地生活服务平台，提供商家信息查询、优惠券秒杀、推广优惠信息等功能。针对秒杀场景下的性能瓶颈，基于 **缓存架构** 与 **消息队列** 进行了性能深度优化，显著提升高并发场景下的系统稳定性。
- 设计 **Redis + Lua** 实现高并发库存扣减与一人一单校验，解决超卖问题，保障数据一致性。
- 引入 **RocketMQ** 将秒杀链路中的下单流程异步解耦，实现核心接口流量削峰并提升秒杀场景并发性能。
- 使用逻辑过期方案防止 Redis 热点 Key 的 **缓存击穿** 问题，使用缓存空值方案解决 Redis Key 的 **缓存穿透** 问题。
- 更新数据库后删除缓存，删除失败采取 **RocketMQ** 补偿重试，结合 TTL 兜底共同确保数据 **最终一致性**。
- 基于 JDK 代理 + AOP + 注解实现 **滑动窗口限流**，支持全局/IP/用户多维度，防止系统过载、刷券、爬虫。
- 基于 **延迟队列** 实现分钟级定时任务，精准扫描并自动关闭超时未支付订单，有效释放被占用的库存资源。
- 使用 **乐观锁** 解决支付回调与超时关单状态下的并发问题，确保订单状态流转的准确性与数据一致性。`;
export const dovideo = `### DoVideoAI——AI视频解析平台 | 2024.09 - 2025.02
**技术栈：** \`SpringBoot\` \`MySQL\` \`Redis\` \`RocketMQ\` \`MyBatis-Plus\` \`MinIO\` \`LangChain4j\` \`Vue\`
项目简介：一个集成用户鉴权、视频上传、提取音频文字及 AI 自动总结的全链路视频内容理解平台。针对视频处理中“长耗时阻塞”与“高并发资源冲突”痛点，基于 **RocketMQ + Redisson + 分片续传** 重构了系统架构，实现了大文件的 **稳定传输与异步处理**。
- 引入 **RocketMQ** 将视频处理相关长耗时任务全链路异步化，将 **60s+** 上传接口响应时间压缩至 **50ms 以内**。
- 设计 **Redisson + WatchDog** 分布式锁，基于 MD5 实现 **内容级去重**。解决视频转码长耗时导致的锁过期问题，在测试并发场景下成功拦截重复提交，有效避免算力浪费，节省不必要的 AI Token 开销。
- 采取 **分片上传与断点续传** 机制，通过 Redis 记录分片上传状态，解决弱网环境下的连接中断超时问题，确保 GB 级大文件在不稳定网络下的传输可靠性。
- 基于 Redis 实现 **令牌桶限流**，设置每秒请求上限，遏制恶意请求带来的高昂 AI Token 开销，保障服务可用性。
- 应对三方 API 网络抖动使用 **指数退避重试机制**，兜底第三方 API 调用失败场景，显著提升任务执行成功率。
- 接入硅基流动平台大模型，使用 Redis 支持会话记忆，基于 **Function Calling** 实现查询信息和精准总结。`;
export function demoFor(_template: Template) {
  return header + "\n" + dovideo + "\n## 专业技能\n" + skills.join("\n");
}
