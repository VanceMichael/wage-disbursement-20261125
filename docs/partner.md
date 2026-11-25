# 工资代发银行协议

此服务仅模拟独立合作方的收件、查单和状态确认，不负责委托方的授权、资源分配或业务资格。仅用于本地合成资料，控制接口应只在本机使用。每个服务实例使用独立持久文件。

POST /salary/batches 使用 JSON 请求体，请求头 Batch-Request-Id 为本次提交的稳定键，主体例如：

```json
{
  "lines": [
    {
      "salaryInstruction": "local-001",
      "reference": "synthetic-record"
    }
  ]
}
```

每批一至一百项，salaryInstruction 是逐项稳定编号，允许字母、数字和 _.:-，长度一至一百。其余字段原样留在 input。服务不自行判断金额、品种或业务权限。首次受理返回 202 和 results；每项有 id、status、input、revision。默认状态 accepted 只表示合作方受理，不表示付款到账、资格通过、签署生效、物流送达或责任解除。

相同请求键及相同逐项资料重发返回 200，逐项编号跨批重复且资料相同也只形成一项合作方流水。相同请求键或逐项编号对应不同资料返回 409。重复键比较 JSON 中的逐项内容及顺序，因此重送应保留原资料。编号不可使用 __proto__、constructor 或 prototype。

GET /salary/batches/编号 查询单项，404 表示当前没有该编号的受理；请求超时本身不代表未受理。pending 表示尚在处理中，accepted 表示已受理待最终核实，rejected 表示未通过。confirmed 表示合作方最终确认，returned 表示合作方确认退回；各自 details 中的业务凭证仍应按所属业务解释，收件受理不是最终业务结论。revision 是本合作方持久流水的递增序号，不是委托方业务版本。

## 本地控制

PUT /control/rules 接收 {"id":"local-001","mode":"accepted_disconnect"}。模式 accepted 正常受理、rejected 拒绝、pending 持续待处理、accepted_disconnect 先持久受理再断开连接。规则按逐项编号生效，同一批可出现不同状态；已受理流水不会因修改规则重新执行。

POST /control/settle 接收 id、status（confirmed/rejected/returned）和可选 details，形成有版本的最终记录。相同终态内容重复提交不重复变化，冲突终态返回 409；更正应使用新的业务资料引用原事实，而非覆写旧终态。GET /control/state 返回本地合作方原始状态用于核对。所有控制能力均限合作方替身，不代表委托业务有同名接口。
