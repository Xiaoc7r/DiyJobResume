import type { Template } from "./flow";
import source from "./sample.md?raw";
export const skillLines = [
  "熟练掌握 Java、Python、C++，理解常用集合及数据结构、面向对象、异常、反射、泛型等；",
  "熟悉 MySQL 与 Redis，理解事务、索引、MVCC、锁、持久化、分布式锁及缓存常见问题；",
  "熟悉 JUC 与 JVM，理解线程池、锁、CAS、ThreadLocal、JMM、双亲委派及垃圾回收机制等；",
  "熟悉 RocketMQ 消息中间件，理解可靠传输、幂等去重、顺序消费、消息堆积问题及解决方案等；",
  "熟悉 SpringBoot、SpringCloud、MyBatis-Plus 等框架，理解 IOC、AOP、生命周期、循环依赖等；",
  "熟悉常见设计模式，如单例模式、工厂方法模式、代理模式、责任链模式、策略模式等。",
  "熟悉 AI Agent 基础知识，理解 ReAct、RAG、MCP、Memory、Harness、状态管理、可观测性等；",
  "熟练使用 Claude Code、Codex、Cursor 等工具，具备较强的 Prompt 编写与 AI Coding 能力。",
];
export function demoFor(_template: Template) {
  return _template === "blank" ? "" : source.trim();
}
