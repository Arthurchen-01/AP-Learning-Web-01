/**
 * AP 14天冲刺学习计划面板
 * 在 dashboard 中显示今日任务、5分率、时间分配
 */

// ========== 学习计划数据 ==========
const STUDY_PLAN_DATA = [
  {
    "day": 1,
    "phase": "第一阶段：全面唤醒",
    "successRate": 10,
    "tasks": [
      { "subject": "微积分BC", "title": "看题不计算：唤醒极限与导数本能", "duration": 2.5, "color": "#3b82f6" },
      { "subject": "统计", "title": "背诵：假设检验万能答题模板", "duration": 2.5, "color": "#f97316" }
    ],
    "tips": [
      "微积分：看到 Rate of change，立刻反射出求导公式。",
      "统计：别管底层数学证明，先把 State, Plan, Do, Conclude 的八股文格式默写出来。"
    ]
  },
  {
    "day": 2,
    "phase": "第一阶段：全面唤醒",
    "successRate": 20,
    "tasks": [
      { "subject": "物理C力学", "title": "牛顿定律 + 能量守恒：经典模型过一遍", "duration": 2.5, "color": "#8b5cf6" },
      { "subject": "CSA", "title": "数组/ArrayList + for循环：写3道基础题", "duration": 2.5, "color": "#10b981" }
    ],
    "tips": [
      "力学：FBD 画出来，问题就解决了一半。",
      "CSA：记住 i < arr.length 而不是 i <= arr.length。"
    ]
  },
  {
    "day": 3,
    "phase": "第一阶段：全面唤醒",
    "successRate": 30,
    "tasks": [
      { "subject": "物理C电磁", "title": "库仑定律 + 电场：把公式写在手背上", "duration": 2.5, "color": "#ef4444" },
      { "subject": "微积分BC", "title": "积分技巧：分部积分 + 换元法", "duration": 2.5, "color": "#3b82f6" }
    ],
    "tips": [
      "电磁：E = kQ/r² 是你最好的朋友。",
      "微积分：分部积分 LIATE 口诀 — Log, Inverse trig, Algebra, Trig, Exponential。"
    ]
  },
  {
    "day": 4,
    "phase": "第二阶段：靶向突破",
    "successRate": 40,
    "tasks": [
      { "subject": "统计", "title": "卡方检验 + 回归分析：FRQ 模板演练", "duration": 2.0, "color": "#f97316" },
      { "subject": "物理C力学", "title": "转动 + 力矩：τ = Iα 系列", "duration": 1.5, "color": "#8b5cf6" },
      { "subject": "CSA", "title": "继承 + 多态：写一个 Animal 类族", "duration": 1.5, "color": "#10b981" }
    ],
    "tips": [
      "统计：回归分析 FRQ 必写 — scatterplot, r², residual plot 三件套。",
      "CSA：@Override 标注会让你不迷路。"
    ]
  },
  {
    "day": 5,
    "phase": "第二阶段：靶向突破",
    "successRate": 50,
    "tasks": [
      { "subject": "微积分BC", "title": "级数：收敛判别法全部过一遍", "duration": 2.5, "color": "#3b82f6" },
      { "subject": "物理C电磁", "title": "高斯定律 + 电势：做3道FRQ", "duration": 2.5, "color": "#ef4444" }
    ],
    "tips": [
      "级数：比值判别法 < 1 收敛，> 1 发散，= 1 不确定。",
      "电磁：闭合曲面内电荷总量 / ε₀ = 电通量，记住。"
    ]
  },
  {
    "day": 6,
    "phase": "第二阶段：靶向突破",
    "successRate": 55,
    "tasks": [
      { "subject": "物理C力学", "title": "简谐运动 + 万有引力：公式默写 + 应用", "duration": 2.0, "color": "#8b5cf6" },
      { "subject": "统计", "title": "置信区间 + 假设检验：完整 FRQ 练习", "duration": 2.0, "color": "#f97316" },
      { "subject": "CSA", "title": "递归 + 2D数组：写矩阵遍历", "duration": 1.0, "color": "#10b981" }
    ],
    "tips": [
      "力学：T = 2π√(m/k) 和 T = 2π√(L/g) 要分清。",
      "CSA：递归三要素 — 基准条件、递归调用、返回值。"
    ]
  },
  {
    "day": 7,
    "phase": "第二阶段：靶向突破",
    "successRate": 60,
    "tasks": [
      { "subject": "物理C电磁", "title": "RC/RL/LC 电路：时间常数 + 微分方程", "duration": 2.5, "color": "#ef4444" },
      { "subject": "微积分BC", "title": "参数方程 + 极坐标：弧长和面积", "duration": 2.5, "color": "#3b82f6" }
    ],
    "tips": [
      "电路：τ = RC，充电 V = V₀(1-e^(-t/τ))，放电 V = V₀e^(-t/τ)。",
      "微积分：极坐标面积 = ½∫r²dθ，弧长 = ∫√(r²+(dr/dθ)²)dθ。"
    ]
  },
  {
    "day": 8,
    "phase": "第二阶段：靶向突破",
    "successRate": 65,
    "tasks": [
      { "subject": "CSA", "title": "2D数组 + ArrayList 综合 FRQ", "duration": 2.0, "color": "#10b981" },
      { "subject": "物理C力学", "title": "FRQ 专项：3道完整大题", "duration": 3.0, "color": "#8b5cf6" }
    ],
    "tips": [
      "CSA：FRQ 第3题通常是 2D数组，重点练行列遍历。",
      "力学：FRQ 必写公式 + 代入 + 单位，三步走。"
    ]
  },
  {
    "day": 9,
    "phase": "第三阶段：模拟冲刺",
    "successRate": 70,
    "tasks": [
      { "subject": "微积分BC", "title": "计时模拟：Section I 45分钟", "duration": 2.5, "color": "#3b82f6" },
      { "subject": "物理C电磁", "title": "计时模拟：Section I 45分钟", "duration": 2.5, "color": "#ef4444" }
    ],
    "tips": [
      "微积分：计算器部分可以偷懒，但不能依赖。",
      "电磁：右手定则考试前在手心写一遍。"
    ]
  },
  {
    "day": 10,
    "phase": "第三阶段：模拟冲刺",
    "successRate": 75,
    "tasks": [
      { "subject": "统计", "title": "计时模拟：完整考试", "duration": 2.5, "color": "#f97316" },
      { "subject": "CSA", "title": "计时模拟：Section I 90分钟", "duration": 2.5, "color": "#10b981" }
    ],
    "tips": [
      "统计：计算器里提前存好 ANOVA, χ², 回归三个程序。",
      "CSA：如果一段代码超过10行还没写完，大概率走错路了。"
    ]
  },
  {
    "day": 11,
    "phase": "第三阶段：模拟冲刺",
    "successRate": 80,
    "tasks": [
      { "subject": "微积分BC", "title": "FRQ 专项：6道大题计时", "duration": 2.5, "color": "#3b82f6" },
      { "subject": "物理C力学", "title": "FRQ 专项：3道大题计时", "duration": 2.5, "color": "#8b5cf6" }
    ],
    "tips": [
      "微积分：FRQ 第6题一定是级数/参数方程，必拿分。",
      "力学：量纲检查是最后的救命稻草。"
    ]
  },
  {
    "day": 12,
    "phase": "第三阶段：模拟冲刺",
    "successRate": 85,
    "tasks": [
      { "subject": "物理C电磁", "title": "FRQ 专项：3道大题计时", "duration": 2.5, "color": "#ef4444" },
      { "subject": "全科", "title": "错题本复盘：只看错题，不做新题", "duration": 2.5, "color": "#6b7280" }
    ],
    "tips": [
      "电磁：FRQ 画图题 — 用尺子画，标注方向。",
      "错题：如果同一类错误犯了3次以上，写一张 cheat sheet 贴墙上。"
    ]
  },
  {
    "day": 13,
    "phase": "第三阶段：考前封箱",
    "successRate": 90,
    "tasks": [
      { "subject": "全科", "title": "公式表默写 + 易错点扫盲", "duration": 3.0, "color": "#6b7280" },
      { "subject": "全科", "title": "最后的错题快速过一遍", "duration": 2.0, "color": "#6b7280" }
    ],
    "tips": [
      "今天不要做任何新题。",
      "把每个科目的公式表默写一遍，写不出来的就是你的薄弱点。"
    ]
  },
  {
    "day": 14,
    "phase": "第三阶段：考前封箱",
    "successRate": 95,
    "tasks": [
      { "subject": "微积分BC", "title": "泰勒级数/极坐标公式默写", "duration": 1.5, "color": "#3b82f6" },
      { "subject": "物理C", "title": "力学/电磁学经典FRQ模型重温", "duration": 2.0, "color": "#8b5cf6" },
      { "subject": "CSA", "title": "数组/列表越界易错点最后扫盲", "duration": 1.5, "color": "#10b981" }
    ],
    "tips": [
      "今天停止做任何新题，只看错题本和公式。",
      "保持手感，保证考场上的第一反应是肌肉记忆。"
    ]
  }
];

// ========== 渲染函数 ==========
function renderStudyPlan() {
  const container = document.getElementById('study-plan-panel');
  if (!container) return;

  // 从 localStorage 读取当前天数
  let currentDay = parseInt(localStorage.getItem('AP_STUDY_DAY') || '1', 10);
  if (currentDay < 1) currentDay = 1;
  if (currentDay > 14) currentDay = 14;

  const todayData = STUDY_PLAN_DATA.find(d => d.day === currentDay) || STUDY_PLAN_DATA[0];
  const totalDuration = todayData.tasks.reduce((sum, t) => sum + t.duration, 0);

  // 计算5分率颜色
  const rateColor = todayData.successRate >= 80 ? '#10b981' :
                    todayData.successRate >= 50 ? '#f59e0b' : '#ef4444';

  container.innerHTML = `
    <!-- 头部 -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--line);">
      <div>
        <h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:var(--text);">AP 冲刺行动面板</h2>
        <p style="margin:0;color:var(--text-soft);font-size:14px;">${todayData.phase}</p>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;color:var(--text-soft);margin-bottom:4px;">5分就绪率</div>
        <div style="font-size:32px;font-weight:900;color:${rateColor};">${todayData.successRate}%</div>
      </div>
    </div>

    <!-- 天数滑动条 -->
    <div style="margin-bottom:24px;">
      <label style="display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">
        当前进度：第 <strong>${currentDay}</strong> 天 / 14 天
      </label>
      <input type="range" min="1" max="14" value="${currentDay}"
        id="study-day-slider"
        style="width:100%;height:6px;accent-color:#f97316;cursor:pointer;"
      />
    </div>

    <!-- 时间分配条 -->
    <div style="margin-bottom:24px;">
      <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0 0 12px;">
        今日时间分配 (共 ${totalDuration} 小时)
      </h3>
      <div style="display:flex;height:24px;border-radius:12px;overflow:hidden;background:var(--line);">
        ${todayData.tasks.map(t => `
          <div style="width:${(t.duration / totalDuration) * 100}%;background:${t.color};
            display:flex;align-items:center;justify-content:center;
            font-size:11px;color:#fff;font-weight:600;transition:width 0.3s;"
            title="${t.subject}: ${t.duration}h">
            ${t.duration}h
          </div>
        `).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:8px;font-size:12px;flex-wrap:wrap;">
        ${todayData.tasks.map(t => `
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="width:10px;height:10px;border-radius:50%;background:${t.color};display:inline-block;"></span>
            <span style="color:var(--text-soft);">${t.subject}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 任务清单 + 避坑指南 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <!-- 任务列表 -->
      <div style="background:rgba(255,255,255,0.6);border:1px solid var(--line);border-radius:var(--radius-md);padding:20px;">
        <h3 style="font-size:15px;font-weight:700;color:var(--text);margin:0 0 12px;">执行清单</h3>
        <ul style="list-style:none;padding:0;margin:0;">
          ${todayData.tasks.map((t, i) => `
            <li style="display:flex;align-items:flex-start;gap:8px;margin-bottom:10px;">
              <input type="checkbox" id="task-${i}"
                style="margin-top:3px;width:16px;height:16px;accent-color:#f97316;"
                ${localStorage.getItem(`AP_TASK_D${currentDay}_${i}`) === 'done' ? 'checked' : ''}
              />
              <div>
                <div style="font-weight:600;font-size:14px;color:var(--text);">[${t.subject}] ${t.duration}小时</div>
                <div style="font-size:13px;color:var(--text-soft);">${t.title}</div>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>

      <!-- 避坑指南 -->
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:var(--radius-md);padding:20px;">
        <h3 style="font-size:15px;font-weight:700;color:#c2410c;margin:0 0 12px;">教练提示</h3>
        <ul style="padding-left:16px;margin:0;">
          ${todayData.tips.map(tip => `
            <li style="font-size:13px;color:#9a3412;margin-bottom:6px;line-height:1.5;">${tip}</li>
          `).join('')}
        </ul>
      </div>
    </div>
  `;

  // 绑定滑动条事件
  const slider = document.getElementById('study-day-slider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      localStorage.setItem('AP_STUDY_DAY', e.target.value);
      renderStudyPlan();
    });
  }

  // 绑定 checkbox 事件
  todayData.tasks.forEach((_, i) => {
    const cb = document.getElementById(`task-${i}`);
    if (cb) {
      cb.addEventListener('change', () => {
        localStorage.setItem(`AP_TASK_D${currentDay}_${i}`, cb.checked ? 'done' : '');
      });
    }
  });
}

// ========== 自动初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  // 等 dashboard.js 渲染完再加载
  setTimeout(renderStudyPlan, 200);
});
