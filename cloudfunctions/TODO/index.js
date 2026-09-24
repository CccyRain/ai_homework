const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  try {
    const apiKey = process.env.ZHIPU_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: '没有找到 ZHIPU_API_KEY'
      };
    }

    const userMessage =
      event && event.message
        ? String(event.message).trim()
        : event && event.goal
          ? String(event.goal).trim()
          : '';

    if (!userMessage) {
      return {
        success: false,
        error: '请输入你的目标'
      };
    }

    const systemPrompt = `
你是“AI倒推助手”。

你的任务是把用户模糊的目标，主动转换成一份可以执行的倒推计划。

用户通常只知道自己想做什么，并不知道：
- 应该先做什么
- 有哪些重要事项
- 有没有DDL
- 需要准备什么材料
- 去哪里办理
- 什么时候开始准备

因此，不要像问卷一样连续询问用户。

你应该主动补全这些信息。

核心要求：

1. 理解用户目标。
2. 主动指出用户可能不知道的重要事项。
3. 列出关键行动。
4. 列出重要DDL或关键时间节点。
5. 列出需要准备的材料。
6. 列出有用的资源或办理渠道。
7. 必须生成完整的“我的倒推计划”。
8. 必须告诉用户“现在最应该做什么”。
9. 只有缺少一个真正关键的信息时，才提出一个问题。
10. 如果没有具体日期，不允许编造具体日期。
11. 没有日期时使用“现在”“第1个月”“考前1个月”等相对时间。
12. 如果用户提供具体日期，可以根据日期倒推。
13. 不要声称已经替用户完成报名、申请、预约等操作。
14. 涉及官方规定时，如果无法确认具体日期，就提醒用户去官方渠道确认。

“我的倒推计划”是最重要的部分。

计划应该从现在开始，一步一步走向最终目标。

例如：

阶段1｜了解现状
□ 完成一次模考
□ 分析当前水平

阶段2｜能力提升
□ 针对薄弱项训练
□ 定期检查进度

阶段3｜关键事项
□ 确认考试/申请时间
□ 完成报名或申请
□ 准备材料

阶段4｜最终准备
□ 最终检查
□ 准备证件
□ 确认地点

最后必须明确：
现在最应该做什么。

只返回JSON，不要使用Markdown代码块。

JSON格式：

{
  "understanding": "对用户目标的理解",
  "suggestions": [
    {
      "title": "事项标题",
      "description": "具体说明"
    }
  ],
  "importantActions": [
    {
      "title": "行动标题",
      "description": "具体说明",
      "priority": "high"
    }
  ],
  "deadlines": [
    {
      "title": "DDL或关键节点",
      "time": "时间",
      "description": "具体说明"
    }
  ],
  "materials": [
    {
      "name": "材料名称",
      "description": "用途或准备方式"
    }
  ],
  "resources": [
    {
      "name": "资源名称",
      "description": "在哪里使用"
    }
  ],
  "plan": [
    {
      "stage": "阶段1",
      "title": "阶段名称",
      "time": "时间",
      "tasks": [
        {
          "title": "任务名称",
          "description": "任务说明",
          "completed": false
        }
      ]
    }
  ],
  "currentStep": {
    "title": "现在最应该做什么",
    "description": "具体怎么做"
  },
  "nextQuestion": {
    "needAsk": false,
    "question": ""
  }
}

要求：
suggestions 至少2条。
importantActions 至少2条。
plan 至少3个阶段。
每个阶段至少包含2个任务。
currentStep不能为空。
`;

    const response = await fetch(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'glm-4-flash',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.3,
          max_tokens: 1600
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: '智谱API请求失败',
        status: response.status,
        detail: data
      };
    }

    let content = '';

    if (
      data &&
      data.choices &&
      data.choices[0] &&
      data.choices[0].message
    ) {
      content = data.choices[0].message.content || '';
    }

    if (!content) {
      return {
        success: false,
        error: '智谱没有返回内容'
      };
    }

    // 清理可能出现的Markdown
    content = content
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let result;

    try {
      result = JSON.parse(content);
    } catch (error) {
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');

      if (start === -1 || end === -1 || end <= start) {
        return {
          success: false,
          error: 'AI返回的内容无法解析',
          rawContent: content
        };
      }

      try {
        result = JSON.parse(
          content.substring(start, end + 1)
        );
      } catch (error2) {
        return {
          success: false,
          error: 'AI返回的JSON格式错误',
          rawContent: content
        };
      }
    }

    // 基础容错
    if (!result || typeof result !== 'object') {
      return {
        success: false,
        error: 'AI返回的数据格式错误'
      };
    }

    if (!result.understanding) {
      result.understanding = '我已经理解了你的目标。';
    }

    if (!Array.isArray(result.suggestions)) {
      result.suggestions = [];
    }

    if (!Array.isArray(result.importantActions)) {
      result.importantActions = [];
    }

    if (!Array.isArray(result.deadlines)) {
      result.deadlines = [];
    }

    if (!Array.isArray(result.materials)) {
      result.materials = [];
    }

    if (!Array.isArray(result.resources)) {
      result.resources = [];
    }

    if (!Array.isArray(result.plan)) {
      result.plan = [];
    }

    result.plan = result.plan.map((stage, index) => {
      if (!stage || typeof stage !== 'object') {
        return {
          stage: `阶段${index + 1}`,
          title: '准备阶段',
          time: '待确定',
          tasks: []
        };
      }

      if (!stage.stage) {
        stage.stage = `阶段${index + 1}`;
      }

      if (!stage.title) {
        stage.title = '准备阶段';
      }

      if (!stage.time) {
        stage.time = '待确定';
      }

      if (!Array.isArray(stage.tasks)) {
        stage.tasks = [];
      }

      stage.tasks = stage.tasks.map(task => {
        if (!task || typeof task !== 'object') {
          return {
            title: '待办事项',
            description: '',
            completed: false
          };
        }

        return {
          title: task.title || '待办事项',
          description: task.description || '',
          completed: task.completed === true
        };
      });

      return stage;
    });

    if (
      !result.currentStep ||
      typeof result.currentStep !== 'object'
    ) {
      result.currentStep = {
        title: '先完成第一项准备工作',
        description: '根据你的目标开始执行计划。'
      };
    }

    if (!result.currentStep.title) {
      result.currentStep.title = '开始执行计划';
    }

    if (!result.currentStep.description) {
      result.currentStep.description = '先完成当前最重要的准备工作。';
    }

    if (
      !result.nextQuestion ||
      typeof result.nextQuestion !== 'object'
    ) {
      result.nextQuestion = {
        needAsk: false,
        question: ''
      };
    }

    if (result.nextQuestion.needAsk !== true) {
      result.nextQuestion.needAsk = false;
      result.nextQuestion.question = '';
    }

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error('TODO云函数错误:', error);

    return {
      success: false,
      error: error && error.message
        ? error.message
        : String(error)
    };
  }
};