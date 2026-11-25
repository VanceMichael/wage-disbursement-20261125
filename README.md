# 人工费专户下的工资核准与银行逐笔回执

本仓库保存该业务的合成登记资料、原始变更资料及工资代发银行的本地协议服务。所有机构、人员、金额和文书均为虚构，不连接真实业务系统。当前可运行内容是合作方协议服务及其检查，业务应用不在此发行内容中。

## 运行环境

使用 Node.js 22.23.4。没有第三方 npm 依赖，package-lock.json 锁定当前依赖清单。

```bash
npm ci --ignore-scripts
npm run build
npm test
npm run start:partner
```

合作方默认监听 4317 端口，GET /health 可查询存活状态。PORT 可更换端口，PARTNER_STATE 可指定持久状态文件，默认 .local/partner.json。停止进程后用同一状态文件启动会保留合作方流水。

也可以使用 Docker 启动合作方：

```bash
docker build -t wage-disbursement:local .
docker run --rm -p 4317:4317 wage-disbursement:local
```

容器要保留状态时，将可写目录挂载到 /app/.local；该目录需允许容器 node 用户写入。测试使用临时目录与随机本地端口，可独立运行。npm test 只验证资料和合作方协议，不表示业务功能已经完成。

## 资料

fixtures/records.json 是业务原始资料，sourceChanges 保存后续收到的变更或申请，均没有自动导入成已批准决定。fixtures/relations.json 声明登记资料的关联字段，docs/data.md 解释计量和身份语义。fixtures/partner.json 定义合作方接口名称及字段。support/peer.mjs 提供合作方行为，docs/partner.md 是实际协议；tests 检查该协议和资料关系。
