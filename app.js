/**
 * app.js - 主应用逻辑
 */
class App {
  constructor() {
    this.userInfo = null;
    this.currentPage = 'plans';
    this.currentFilter = 'all';
    this.plans = [];
    this.tasks = [];
    this.approvals = [];
  }

  async init() {
    try {
      // 初始化飞书 JSAPI
      await this.initFeishuJSAPI();

      // 获取用户信息
      await this.getUserInfo();

      // 显示主界面
      this.showMain();

      // 加载数据
      await this.loadData();

      // 绑定事件
      this.bindEvents();
    } catch (error) {
      console.error('[App] 初始化失败:', error);
      this.showLoginTip();
    }
  }

  /**
   * 初始化飞书 JSAPI
   */
  async initFeishuJSAPI() {
    return new Promise((resolve, reject) => {
      if (typeof window.h5sdk === 'undefined') {
        reject(new Error('飞书 JSAPI 未加载'));
        return;
      }

      window.h5sdk.ready(() => {
        console.log('[App] 飞书 JSAPI 已就绪');
        resolve();
      });

      // 超时处理
      setTimeout(() => {
        reject(new Error('飞书 JSAPI 初始化超时'));
      }, 10000);
    });
  }

  /**
   * 获取用户信息
   */
  async getUserInfo() {
    return new Promise((resolve, reject) => {
      window.h5sdk.biz.util.getUserInfo({
        success: (res) => {
          console.log('[App] 获取用户信息成功:', res);
          this.userInfo = {
            id: res.id,
            name: res.name,
            avatar: res.avatar,
            department: res.department || '未知部门'
          };

          // 从用户表查询角色
          this.loadUserRole().then(() => {
            this.updateUserUI();
            resolve();
          }).catch(reject);
        },
        fail: (err) => {
          console.error('[App] 获取用户信息失败:', err);
          // 使用默认用户（测试用）
          this.userInfo = {
            id: 'user_001',
            name: '张三',
            role: '部门负责人',
            department: '研发部'
          };
          this.updateUserUI();
          resolve();
        }
      });
    });
  }

  /**
   * 从多维表加载用户角色
   */
  async loadUserRole() {
    try {
      const users = await bitableAPI.query('users', { '用户ID': this.userInfo.id });
      if (users.length > 0) {
        this.userInfo.role = users[0]['角色'] || '员工';
        this.userInfo.department = users[0]['部门'] || this.userInfo.department;
      } else {
        // 新用户，添加到用户表
        this.userInfo.role = '员工';
        await bitableAPI.create('users', {
          '用户ID': this.userInfo.id,
          '姓名': this.userInfo.name,
          '部门': this.userInfo.department,
          '角色': '员工',
          '状态': '启用'
        });
      }
    } catch (error) {
      console.error('[App] 加载用户角色失败:', error);
      this.userInfo.role = '员工';
    }
  }

  /**
   * 更新用户界面
   */
  updateUserUI() {
    document.getElementById('user-name').textContent = this.userInfo.name;
    document.getElementById('user-role').textContent = this.userInfo.role;

    // 根据角色显示/隐藏功能
    if (this.userInfo.role === '部门负责人') {
      document.getElementById('btn-create-plan').style.display = 'flex';
    }

    if (this.userInfo.role === '办公室主任') {
      document.getElementById('nav-approvals').style.display = 'inline-block';
    } else {
      document.getElementById('nav-approvals').style.display = 'none';
    }
  }

  /**
   * 显示主界面
   */
  showMain() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login-tip').style.display = 'none';
    document.getElementById('main').style.display = 'flex';
  }

  /**
   * 显示登录提示
   */
  showLoginTip() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('login-tip').style.display = 'flex';
    document.getElementById('main').style.display = 'none';
  }

  /**
   * 加载数据
   */
  async loadData() {
    await Promise.all([
      this.loadPlans(),
      this.loadTasks(),
      this.loadApprovals()
    ]);
  }

  /**
   * 加载计划列表
   */
  async loadPlans() {
    try {
      this.plans = await bitableAPI.query('plans');
      this.renderPlans();
    } catch (error) {
      console.error('[App] 加载计划失败:', error);
      this.showError('加载计划失败');
    }
  }

  /**
   * 加载任务列表
   */
  async loadTasks() {
    try {
      if (this.userInfo.role === '员工') {
        this.tasks = await bitableAPI.getTasksByUser(this.userInfo.name);
      } else {
        this.tasks = await bitableAPI.query('tasks');
      }
      this.renderTasks();
    } catch (error) {
      console.error('[App] 加载任务失败:', error);
    }
  }

  /**
   * 加载审批列表
   */
  async loadApprovals() {
    try {
      if (this.userInfo.role === '办公室主任') {
        this.approvals = await bitableAPI.getPendingApprovals();
        this.renderApprovals();
      }
    } catch (error) {
      console.error('[App] 加载审批失败:', error);
    }
  }

  /**
   * 渲染计划列表
   */
  renderPlans() {
    const container = document.getElementById('plans-list');
    let plans = this.plans;

    if (this.currentFilter !== 'all') {
      plans = plans.filter(p => p['状态'] === this.currentFilter);
    }

    if (plans.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无计划</div>';
      return;
    }

    container.innerHTML = plans.map(plan => `
      <div class="list-item" data-id="${plan['计划ID']}">
        <div class="item-header">
          <span class="item-title">${plan['计划标题'] || plan['计划名称'] || '未命名计划'}</span>
          <span class="badge ${this.getStatusClass(plan['状态'])}">${plan['状态'] || '草稿'}</span>
        </div>
        <div class="item-meta">
          <span>${plan['部门'] || '未知部门'}</span>
          <span>${plan['年份'] || ''}年${plan['月份'] || ''}月</span>
        </div>
        <div class="item-footer">
          <span>负责人: ${plan['负责人'] || '未分配'}</span>
          <span>${plan['创建时间'] ? new Date(plan['创建时间']).toLocaleDateString() : ''}</span>
        </div>
      </div>
    `).join('');

    // 绑定点击事件
    container.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        const planId = item.dataset.id;
        this.showPlanDetail(planId);
      });
    });
  }

  /**
   * 渲染任务列表
   */
  renderTasks() {
    const container = document.getElementById('tasks-list');

    if (this.tasks.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无任务</div>';
      return;
    }

    container.innerHTML = this.tasks.map(task => `
      <div class="list-item" data-id="${task['任务ID']}">
        <div class="item-header">
          <span class="item-title">${task['任务标题'] || task['任务名称'] || '未命名任务'}</span>
          <span class="badge ${this.getTaskStatusClass(task['状态'])}">${task['状态'] || '未开始'}</span>
        </div>
        <div class="item-meta">
          <span>执行人: ${task['执行人'] || '未分配'}</span>
          <span>优先级: ${task['优先级'] || '普通'}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${task['进度百分比'] || 0}%"></div>
        </div>
        <div class="item-footer">
          <span>截止: ${task['截止日期'] ? new Date(task['截止日期']).toLocaleDateString() : '未设置'}</span>
          <button class="btn-small" onclick="app.updateTaskProgress('${task['任务ID']}')">更新进度</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * 渲染审批列表
   */
  renderApprovals() {
    const container = document.getElementById('approvals-list');

    if (this.approvals.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无待审批计划</div>';
      return;
    }

    container.innerHTML = this.approvals.map(approval => `
      <div class="list-item" data-id="${approval['审批ID']}">
        <div class="item-header">
          <span class="item-title">审批申请 #${approval['审批ID']}</span>
          <span class="badge badge-warning">待审批</span>
        </div>
        <div class="item-meta">
          <span>申请人: ${approval['申请人'] || '未知'}</span>
          <span>申请时间: ${approval['申请时间'] ? new Date(approval['申请时间']).toLocaleDateString() : ''}</span>
        </div>
        <div class="item-footer">
          <span>原因: ${approval['申请原因'] || '无'}</span>
          <button class="btn-small btn-primary" onclick="app.showApprovalModal('${approval['计划ID']}')">审批</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * 显示计划详情
   */
  async showPlanDetail(planId) {
    const plan = this.plans.find(p => p['计划ID'] === planId);
    if (!plan) return;

    const content = document.getElementById('plan-detail-content');
    content.innerHTML = `
      <div class="detail-section">
        <label>计划标题</label>
        <p>${plan['计划标题'] || plan['计划名称'] || '未命名'}</p>
      </div>
      <div class="detail-section">
        <label>计划内容</label>
        <p>${plan['计划内容'] || '无内容'}</p>
      </div>
      <div class="detail-row">
        <div class="detail-section">
          <label>部门</label>
          <p>${plan['部门'] || '未知'}</p>
        </div>
        <div class="detail-section">
          <label>负责人</label>
          <p>${plan['负责人'] || '未分配'}</p>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-section">
          <label>年份</label>
          <p>${plan['年份'] || ''}年</p>
        </div>
        <div class="detail-section">
          <label>月份</label>
          <p>${plan['月份'] || ''}月</p>
        </div>
      </div>
      <div class="detail-section">
        <label>状态</label>
        <p><span class="badge ${this.getStatusClass(plan['状态'])}">${plan['状态'] || '草稿'}</span></p>
      </div>
      ${plan['审批人'] ? `
      <div class="detail-section">
        <label>审批信息</label>
        <p>审批人: ${plan['审批人']}</p>
        <p>审批时间: ${plan['审批时间'] ? new Date(plan['审批时间']).toLocaleString() : ''}</p>
        <p>审批意见: ${plan['审批意见'] || '无'}</p>
      </div>
      ` : ''}
      <div class="form-actions">
        ${this.canEditPlan(plan) ? `<button class="btn-submit" onclick="app.editPlan('${planId}')">编辑</button>` : ''}
        ${this.canApprovePlan(plan) ? `<button class="btn-primary" onclick="app.showApprovalModal('${planId}')">审批</button>` : ''}
      </div>
    `;

    this.showModal('modal-plan-detail');
  }

  /**
   * 判断是否可以编辑计划
   */
  canEditPlan(plan) {
    if (plan['状态'] === '已批准') return false;
    if (this.userInfo.role === '部门负责人') return true;
    if (plan['创建人ID'] === this.userInfo.id) return true;
    return false;
  }

  /**
   * 判断是否可以审批计划
   */
  canApprovePlan(plan) {
    return this.userInfo.role === '办公室主任' && plan['状态'] === '待审批';
  }

  /**
   * 显示创建计划弹窗
   */
  showCreatePlanModal() {
    const now = new Date();
    document.getElementById('plan-year').value = now.getFullYear();
    document.getElementById('plan-month').value = now.getMonth() + 1;
    this.showModal('modal-create-plan');
  }

  /**
   * 创建计划
   */
  async createPlan(formData) {
    try {
      const planId = 'PLAN_' + Date.now();
      const now = new Date().toISOString();

      await bitableAPI.create('plans', {
        '计划ID': planId,
        '计划标题': formData.title,
        '计划名称': formData.title,
        '计划内容': formData.content,
        '年份': parseInt(formData.year),
        '月份': parseInt(formData.month),
        '部门': this.userInfo.department,
        '负责人': this.userInfo.name,
        '创建人': this.userInfo.name,
        '创建人ID': this.userInfo.id,
        '创建人部门': this.userInfo.department,
        '状态': '草稿',
        '创建时间': now,
        '更新时间': now
      });

      this.hideModal('modal-create-plan');
      this.showSuccess('计划创建成功');
      await this.loadPlans();
    } catch (error) {
      console.error('[App] 创建计划失败:', error);
      this.showError('创建计划失败: ' + error.message);
    }
  }

  /**
   * 显示审批弹窗
   */
  showApprovalModal(planId) {
    document.querySelector('#form-approval input[name="planId"]').value = planId;
    this.showModal('modal-approval');
  }

  /**
   * 提交审批
   */
  async submitApproval(formData) {
    try {
      const plan = this.plans.find(p => p['计划ID'] === formData.planId);
      if (!plan) throw new Error('计划不存在');

      const now = new Date().toISOString();

      // 更新计划状态
      await bitableAPI.update('plans', plan.recordId, {
        '状态': formData.result === '已通过' ? '已批准' : '已驳回',
        '审批人': this.userInfo.name,
        '审批时间': now,
        '审批意见': formData.comment,
        '更新时间': now
      });

      // 创建审批记录
      await bitableAPI.create('approvals', {
        '审批ID': 'APR_' + Date.now(),
        '计划ID': formData.planId,
        '关联计划': formData.planId,
        '审批人': this.userInfo.name,
        '审批结果': formData.result,
        '审批意见': formData.comment,
        '审批时间': now,
        '审批类型': '计划审批',
        '申请人': plan['创建人'],
        '申请时间': plan['创建时间'],
        '审批状态': '已完成'
      }));

      this.hideModal('modal-approval');
      this.showSuccess('审批提交成功');
      await this.loadPlans();
      await this.loadApprovals();
    } catch (error) {
      console.error('[App] 审批失败:', error);
      this.showError('审批失败: ' + error.message);
    }
  }

  /**
   * 显示任务进度更新弹窗
   */
  updateTaskProgress(taskId) {
    const task = this.tasks.find(t => t['任务ID'] === taskId);
    if (!task) return;

    document.querySelector('#form-task-progress input[name="taskId"]').value = taskId;
    document.querySelector('#form-task-progress input[name="progress"]').value = task['进度百分比'] || 0;
    document.getElementById('progress-value').textContent = (task['进度百分比'] || 0) + '%';
    document.querySelector('#form-task-progress select[name="status"]').value = task['状态'] || '未开始';

    this.showModal('modal-task-progress');
  }

  /**
   * 提交任务进度更新
   */
  async submitTaskProgress(formData) {
    try {
      const task = this.tasks.find(t => t['任务ID'] === formData.taskId);
      if (!task) throw new Error('任务不存在');

      const now = new Date().toISOString();
      const updateData = {
        '进度百分比': parseInt(formData.progress),
        '状态': formData.status,
        '备注': formData.remark,
        '完成时间': formData.status === '已完成' ? now : task['完成时间']
      };

      await bitableAPI.update('tasks', task.recordId, updateData);

      this.hideModal('modal-task-progress');
      this.showSuccess('进度更新成功');
      await this.loadTasks();
    } catch (error) {
      console.error('[App] 更新进度失败:', error);
      this.showError('更新进度失败: ' + error.message);
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 导航切换
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        this.switchPage(page);
      });
    });

    // 筛选按钮
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderPlans();
      });
    });

    // 创建计划按钮
    document.getElementById('btn-create-plan').addEventListener('click', () => {
      this.showCreatePlanModal();
    });

    // 创建计划表单
    document.getElementById('form-create-plan').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      this.createPlan({
        title: formData.get('title'),
        content: formData.get('content'),
        year: formData.get('year'),
        month: formData.get('month')
      });
    });

    // 审批表单
    document.getElementById('form-approval').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      this.submitApproval({
        planId: formData.get('planId'),
        result: formData.get('result'),
        comment: formData.get('comment')
      });
    });

    // 任务进度表单
    document.getElementById('form-task-progress').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      this.submitTaskProgress({
        taskId: formData.get('taskId'),
        progress: formData.get('progress'),
        status: formData.get('status'),
        remark: formData.get('remark')
      });
    });

    // 进度条
    document.querySelector('#form-task-progress input[name="progress"]').addEventListener('input', (e) => {
      document.getElementById('progress-value').textContent = e.target.value + '%';
    });

    // 弹窗关闭按钮
    document.querySelectorAll('.modal-close, .btn-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) {
          modal.style.display = 'none';
        }
      });
    });

    // 点击弹窗外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  /**
   * 切换页面
   */
  switchPage(page) {
    this.currentPage = page;

    // 更新导航状态
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.page === page);
    });

    // 显示对应页面
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    // 加载数据
    if (page === 'plans') this.loadPlans();
    if (page === 'tasks') this.loadTasks();
    if (page === 'approvals') this.loadApprovals();
  }

  /**
   * 显示弹窗
   */
  showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
  }

  /**
   * 隐藏弹窗
   */
  hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
  }

  /**
   * 获取状态样式类
   */
  getStatusClass(status) {
    const map = {
      '草稿': 'badge-default',
      '待审批': 'badge-warning',
      '已批准': 'badge-success',
      '已驳回': 'badge-danger'
    };
    return map[status] || 'badge-default';
  }

  /**
   * 获取任务状态样式类
   */
  getTaskStatusClass(status) {
    const map = {
      '未开始': 'badge-default',
      '进行中': 'badge-warning',
      '已完成': 'badge-success'
    };
    return map[status] || 'badge-default';
  }

  /**
   * 显示成功提示
   */
  showSuccess(message) {
    if (window.h5sdk) {
      window.h5sdk.biz.util.toast({
        type: 'success',
        text: message
      });
    } else {
      alert(message);
    }
  }

  /**
   * 显示错误提示
   */
  showError(message) {
    if (window.h5sdk) {
      window.h5sdk.biz.util.toast({
        type: 'error',
        text: message
      });
    } else {
      alert(message);
    }
  }
}

// 初始化应用
const app = new App();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
