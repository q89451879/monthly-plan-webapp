/**
 * 配置文件 - 飞书多维表配置
 */
const CONFIG = {
  // 飞书自建应用凭证
  appId: 'cli_aaa82c96823adbea',
  appSecret: 'yj7qtMZRvozQjDISkuoMh1JqKivAgLnr',

  // 多维表配置
  bitable: {
    appToken: 'Wb0bbSKEzaUBj2sBE7Vc3Tp1n3f',
    url: 'https://acn5yk9jw0j0.feishu.cn/base/Wb0bbSKEzaUBj2sBE7Vc3Tp1n3f',
    tables: {
      plans: 'tblKTevU0rJpM2r6',      // 计划表
      tasks: 'tblJgz4vBzyT5wWB',      // 任务表
      approvals: 'tbl3Zp2BUKl25kE8',  // 审批记录表
      users: 'tbl7ZRq0BsWTlHsr'       // 用户表
    }
  },

  // API基础地址
  apiBase: 'https://open.feishu.cn/open-apis',

  // 权限配置
  permissions: {
    // 部门负责人权限
    deptLeader: {
      canCreatePlan: true,
      canEditPlan: true,
      canDeletePlan: true,
      canAssignTask: true,
      canApprove: false
    },
    // 办公室主任权限
    officeDirector: {
      canCreatePlan: false,
      canEditPlan: false,
      canDeletePlan: false,
      canAssignTask: false,
      canApprove: true
    },
    // 员工权限
    employee: {
      canCreatePlan: false,
      canEditPlan: false,
      canDeletePlan: false,
      canAssignTask: false,
      canApprove: false
    }
  }
};
