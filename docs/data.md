# 合成资料约定

比例为十进制字符串；所有金额为分；workLines.id 标识一份独立劳动签认，signed=false 不能当作本人已同意；fundReceipts 是待核验银行资料，不能仅因导入就当到账。

| 集合 | 记录数 |
| --- | --- |
| projects | 2 |
| workers | 2 |
| accounts | 3 |
| workLines | 3 |
| fundReceipts | 1 |
| actors | 4 |
| sourceChanges | 5 |

同一集合中的 id 唯一，跨集合关联只使用对应字段，不能根据名称合并。日期与完整时间字符串保持各自语义，不用导入时间替换发生时间。字段缺失表示未提供，null 表示明确没有关联；两者均不自动变成已确认状态。actors 是合成角色资料，身份认证和业务接口形式没有现存兼容约束。sourceChanges 是未处理的来源申请或观察，不规定业务执行顺序，也不含预计算结论。

relations.json 中 table/field 指向 target 集合的 id，nullable 表示允许空引用。原始资料可包含尚未复核的状态、待办申请及互相矛盾的主张，应保留提出方和发生时间。文书、意见与决定的效力由有权限的业务人员确认，不能将文件存在本身当作批准。
