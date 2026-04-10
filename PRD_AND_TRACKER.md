# PRD & 功能追踪文档 — AP-Learning-Web-01

> 本文档跟踪 AP-Learning-Web-01 的所有产品需求与开发状态。
> 生成时间：2026-04-09
> 当前状态：核心功能可用，精细化功能待完善

---

## 一、核心功能现状评估

| 模块 | 状态 | 说明 |
|------|------|------|
| 首页加载 | ✅ 可用 | 无404，无控制台错误 |
| 套题列表（v2/exam/） | ✅ 可用 | 正常显示所有科目试卷 |
| 做题系统（v2/exam/paper.html） | ✅ 可用 | MCQ选项点击正常，next题正常 |
| Dashboard | ✅ 可用 | 统计数据正常，最近练习显示正常 |
| AP题库目录（ap/） | ✅ 可用 | catalog加载正常 |
| 数学公式渲染（KaTeX） | ✅ 可用 | LaTeX公式已支持 |
| 主题色系统 | ✅ 可用 | v1暖色/v2深色双主题 |

---

## 二、待开发功能清单

### 阶段一：核心体验补全

- [x] **P1.1 - v2顶部导航栏重构**：✅ 已完成（2026-04-10）
  - 修复了 `v2/index.html` 的导航链接，从 `href="v2/"` 改为使用 `window.sitePath()` 动态计算
  - 解决了 GitHub Pages 上 `/v2/v2/` 的错误路径问题
  - 3次测试 0 报错，导航链接全部正确

- [x] **P1.2 - MCQ即时反馈机制**：✅ 已完成（2026-04-10）
  - 选中答案后立即显示绿色（正确）或红色（错误）高亮动画
  - 答错时同时高亮正确选项（绿色）
  - 显示反馈Banner："✅ Correct!" 或 "❌ Incorrect + 正确答案"
  - 已在 calc-bc-2018-intl 试卷上验证 Q1/Q2 多题，3次连续测试 0 报错

- [x] **P1.3 - FRQ得分点核对模式**：✅ 已完成（2026-04-10）
  - 实现了 FRQ 得分点自检 UI（`subjectiveList` 渲染为勾选清单）
  - 每题显示 (a)(b)(c) 小问及进度 "1/3" 格式
  - 用户勾选后自动保存到 `section.selfAssessment[]` 并持久化
  - CSS 已包含绿/红/动画样式，与 MCQ 即时反馈视觉一致
  - 注意：当前考试数据无 FRQ Section（2013Intl 的 FRQ 题目 section_id 不匹配 exam_packet），代码已验证无报错，待 FRQ 题目数据完善后自动生效

- [ ] **P1.4 - 做题结果页增强**：当前showResults()只显示总分。需要补充：按Section分析正确率、按知识点分析薄弱环节、推荐复习Topic

### 阶段二：用户体验优化

- [x] **P2.1 - 全站Dark Mode切换**：✅ 已完成（2026-04-09）
  - `assets/site-base.js` 添加主题管理函数 `__getTheme`、`__setTheme`、`toggleTheme`、`__applyTheme`
  - 主题切换前 CSS 加载（IIFE）防止闪烁
  - `assets/site.css` 添加 `[data-theme="dark"]` 覆盖（v1暖色→深色）
  - v2 各页面添加 `[data-theme="light"]` 覆盖（深色→暖色）
  - 所有 v1/v2 页面顶部导航栏添加主题切换按钮
  - 3次连续测试 0 报错

- [ ] **P2.2 - 移动端适配审计**：当前CSS主要针对桌面端。需要逐页面检查touch target、字体大小、滚动交互

- [ ] **P2.3 - 做题进度自动保存**：当前刷新页面会丢失未提交的做题状态（虽然选了答案但没点submit）。需要debounced自动保存

- [ ] **P2.4 - 题目收藏/笔记功能**：用户可以收藏某道题并添加笔记，保存到localStorage

### 阶段三：数据与可扩展性

- [ ] **P3.1 - 题目分类标签系统**：exam JSON中补充知识点标签（knowledge_points数组），前端按标签筛选题目

- [ ] **P3.2 - 错题本功能**：自动收集答错题目，生成错题本练习模式

- [ ] **P3.3 - 班级排行榜（BaaS）**：接入Firebase或Supabase，实现简单登录+班级刷题量排行榜（可选，非核心）

### 阶段四：内容充实

- [ ] **P4.1 - 更多科目试卷**：补充Physics C、Psychology、CSA等科目的完整试卷

- [ ] **P4.2 - 示例题目录入模板**：手把手录入2道复杂公式示例题目到data.json，确认模板可用

---

## 三、技术债务

- [ ] **T1 - 静态服务器路由**：目前使用file-based routing，需确认GitHub Pages所有子路径（直接在地址栏输入`/v2/exam/`）都能正确加载，避免刷新404

- [ ] **T2 - v2/index.html导航**：v2首页缺少返回主站导航栏，用户容易迷路

- [ ] **T3 - 单元测试覆盖**：无任何测试文件，建议补充Playwright测试覆盖核心做题流程

---

## 四、Git提交记录（本次会话）

| 序号 | Commit | 内容 |
|------|--------|------|
| 1 | 2af8af8 | Fix site-base.js path in ap/exam (../../ not ../) |
| 2 | dad0960 | Fix site-base.js paths: ap/ and ap/start/ need ../../ |
| 3 | 3ba23ec | Revert: ap/index.html uses assets/site-base.js (WRONG REVERT) |
| 4 | 03304c7 | Fix site-base.js path: ap/index.html needs ../../assets/ |
| 5 | 77a1ab1 | Fix site-base.js loading: use document.write with window._b |
| 6 | 7f1d6e6 | Fix JS absolute paths: use window.sitePath for mock-data |
| 7 | 727d6b6 | Fix path fixer: skip already-prefixed hrefs |
| 8 | dc806c8 | Fix hero image: use absolute CDN URL in CSS var |

---

## 五、下一阶段执行计划

**Phase 2 优先任务（P1.1 → P1.2 → P1.3）：**

1. 先为 `v2/index.html` 补全顶部导航栏（学科切换 + 页面导航）
2. 接着实现 MCQ 即时反馈机制
3. 再实现 FRQ 得分点核对模式

