import type { Template } from "./flow";
import source from "./sample.md?raw";
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
export function demoFor(_template: Template) {
  return source.trim();
}
