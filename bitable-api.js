/**
 * bitable-api.js - 飞书多维表 API 封装
 * 前端直接调用飞书 OpenAPI（无需服务器）
 */
class BitableAPI {
  constructor() {
    this.appToken = CONFIG.bitable.appToken;
    this.tables = CONFIG.bitable.tables;
    this.apiBase = CONFIG.apiBase;
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  /**
   * 获取 tenant_access_token
   * 注意：在生产环境中，应该通过服务器代理获取，避免暴露 appSecret
   * 这里为了演示"无服务器"架构，直接在前端获取（仅用于测试环境）
   */
  async getToken() {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpireTime - 60000) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.apiBase}/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: CONFIG.appId,
          app_secret: CONFIG.appSecret
        })
      });
      const data = await response.json();
      if (data.code === 0) {
        this.accessToken = data.tenant_access_token;
        this.tokenExpireTime = now + (data.expire || 7200) * 1000;
        return this.accessToken;
      } else {
        throw new Error(`获取token失败: ${data.msg}`);
      }
    } catch (error) {
      console.error('[BitableAPI] 获取token失败:', error);
      throw error;
    }
  }

  /**
   * 通用 API 请求
   */
  async request(method, path, body = null) {
    const token = await this.getToken();
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.apiBase}${path}`, options);
    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(`API错误: ${data.msg} (code: ${data.code})`);
    }
    return data;
  }

  // ========== 记录操作 ==========

  /**
   * 查询记录
   * @param {string} tableKey - 表名: plans|tasks|approvals|users
   * @param {Object} filter - 筛选条件
   */
  async query(tableKey, filter = {}) {
    const tableId = this.tables[tableKey];
    if (!tableId) throw new Error(`未知表: ${tableKey}`);

    const allRecords = [];
    let pageToken = null;

    do {
      const params = new URLSearchParams();
      params.append('page_size', '500');
      if (pageToken) params.append('page_token', pageToken);

      const data = await this.request(
        'GET',
        `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records?${params.toString()}`
      );

      const items = data.data?.items || [];
      allRecords.push(...items.map(item => ({
        recordId: item.record_id,
        ...item.fields
      })));

      pageToken = data.data?.page_token;
      if (!data.data?.has_more) break;
    } while (pageToken);

    // 本地筛选
    if (filter && Object.keys(filter).length > 0) {
      return allRecords.filter(record => {
        return Object.entries(filter).every(([key, value]) => {
          if (Array.isArray(value)) {
            return value.includes(record[key]);
          }
          return record[key] === value;
        });
      });
    }

    return allRecords;
  }

  /**
   * 创建记录
   */
  async create(tableKey, fields) {
    const tableId = this.tables[tableKey];
    if (!tableId) throw new Error(`未知表: ${tableKey}`);

    const data = await this.request(
      'POST',
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records`,
      { fields }
    );

    return {
      recordId: data.data?.record?.record_id,
      ...fields
    };
  }

  /**
   * 更新记录
   */
  async update(tableKey, recordId, fields) {
    const tableId = this.tables[tableKey];
    if (!tableId) throw new Error(`未知表: ${tableKey}`);

    const data = await this.request(
      'PUT',
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/${recordId}`,
      { fields }
    );

    return {
      recordId: data.data?.record?.record_id,
      ...fields
    };
  }

  /**
   * 删除记录
   */
  async delete(tableKey, recordId) {
    const tableId = this.tables[tableKey];
    if (!tableId) throw new Error(`未知表: ${tableKey}`);

    await this.request(
      'DELETE',
      `/bitable/v1/apps/${this.appToken}/tables/${tableId}/records/${recordId}`
    );
    return { success: true };
  }

  // ========== 业务辅助方法 ==========

  async getPlanById(planId) {
    const plans = await this.query('plans', { '计划ID': planId });
    return plans[0] || null;
  }

  async getTaskById(taskId) {
    const tasks = await this.query('tasks', { '任务ID': taskId });
    return tasks[0] || null;
  }

  async getTasksByUser(userName) {
    return this.query('tasks', { '执行人': userName });
  }

  async getPlansByDepartment(dept) {
    return this.query('plans', { '部门': dept });
  }

  async getPendingApprovals() {
    return this.query('approvals', { '审批结果': '待审批' });
  }

  async getUserById(userId) {
    const users = await this.query('users', { '用户ID': userId });
    return users[0] || null;
  }

  async getUserByName(name) {
    const users = await this.query('users', { '姓名': name });
    return users[0] || null;
  }
}

// 创建全局实例
const bitableAPI = new BitableAPI();
