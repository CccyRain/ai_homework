const API_URL =
  "https://todo.gaoyunfei0417.workers.dev/";

Page({
  data: {
    goal: "",

    loading: false,

    showResult: false,

    understanding: "",

    suggestions: [],

    importantActions: [],

    deadlines: [],

    materials: [],

    resources: [],

    plan: {
      stages: []
    },

    currentStep: "",

    nextQuestion: "",

    showQuestion: false,

    answerInput: "",

    conversation: [],

    saved: false,

    errorMessage: ""
  },

  // ==============================
  // 页面加载
  // ==============================

  onLoad() {
    this.loadSavedPlan();
  },

  // ==============================
  // 输入目标
  // ==============================

  onGoalInput(e) {
    this.setData({
      goal: e.detail.value
    });
  },

  // ==============================
  // 开始规划
  // ==============================

  async startPlanning() {
    const goal =
      this.data.goal.trim();

    if (!goal) {
      wx.showToast({
        title: "请先告诉我你的目标",
        icon: "none"
      });

      return;
    }

    this.setData({
      loading: true,
      showResult: false,
      errorMessage: "",
      understanding: "",
      suggestions: [],
      importantActions: [],
      deadlines: [],
      materials: [],
      resources: [],
      plan: {
        stages: []
      },
      currentStep: "",
      nextQuestion: "",
      showQuestion: false,
      answerInput: "",
      conversation: [],
      saved: false
    });

    await this.callAI(
      goal,
      []
    );
  },

  // ==============================
  // 调用 AI
  // ==============================

  async callAI(
    userMessage,
    oldConversation
  ) {
    this.setData({
      loading: true,
      errorMessage: ""
    });

    try {
      const conversation =
        Array.isArray(oldConversation)
          ? oldConversation
          : [];

      const response =
        await new Promise(
          (resolve, reject) => {
            wx.request({
              url: API_URL,

              method: "POST",

              header: {
                "content-type":
                  "application/json"
              },

              data: {
                goal: userMessage,

                conversation:
                  conversation
              },

              success: resolve,

              fail: reject
            });
          }
        );

      if (
        response.statusCode !== 200
      ) {
        throw new Error(
          "服务器返回错误：" +
            response.statusCode
        );
      }

      const data =
        response.data;

      if (
        !data ||
        !data.success
      ) {
        throw new Error(
          data?.error ||
            "AI 请求失败"
        );
      }

      const result =
        data.result || {};

      const newConversation = [
        ...conversation,

        {
          role: "user",
          content: userMessage
        },

        {
          role: "assistant",
          content:
            JSON.stringify(result)
        }
      ];

      const importantActions =
        Array.isArray(
          result.important_actions
        )
          ? result.important_actions.map(
              (item) => ({
                title:
                  item?.title ||
                  "待完成事项",

                reason:
                  item?.reason ||
                  "",

                priority:
                  item?.priority ||
                  "medium",

                completed: false
              })
            )
          : [];

      const plan =
        result.plan || {
          stages: []
        };

      const stages =
        Array.isArray(
          plan.stages
        )
          ? plan.stages
          : [];

      this.setData({
        showResult: true,

        understanding:
          result.understanding ||
          "",

        suggestions:
          Array.isArray(
            result.suggestions
          )
            ? result.suggestions
            : [],

        importantActions:
          importantActions,

        deadlines:
          Array.isArray(
            result.deadlines
          )
            ? result.deadlines
            : [],

        materials:
          Array.isArray(
            result.materials
          )
            ? result.materials
            : [],

        resources:
          Array.isArray(
            result.resources
          )
            ? result.resources
            : [],

        plan: {
          stages
        },

        currentStep:
          result.current_step ||
          "",

        nextQuestion:
          result.next_question ||
          "",

        showQuestion:
          !!(
            result.next_question &&
            result.next_question.trim()
          ),

        conversation:
          newConversation,

        loading: false,

        saved: false,

        errorMessage: ""
      });

      wx.pageScrollTo({
        scrollTop: 0,
        duration: 300
      });

    } catch (error) {
      console.error(
        "AI 请求失败：",
        error
      );

      this.setData({
        loading: false,

        errorMessage:
          error.message ||
          "请求失败，请稍后再试"
      });

      wx.showToast({
        title: "AI 请求失败",
        icon: "none"
      });
    }
  },

  // ==============================
  // 输入补充信息
  // ==============================

  onAnswerInput(e) {
    this.setData({
      answerInput:
        e.detail.value
    });
  },

  // ==============================
  // 提交回答
  // ==============================

  async submitAnswer() {
    const answer =
      this.data.answerInput.trim();

    if (!answer) {
      wx.showToast({
        title: "请输入回答",
        icon: "none"
      });

      return;
    }

    const conversation =
      this.data.conversation;

    this.setData({
      showQuestion: false,
      answerInput: "",
      loading: true
    });

    await this.callAI(
      answer,
      conversation
    );
  },

  // ==============================
  // 不知道
  // ==============================

  async skipQuestion() {
    const conversation =
      this.data.conversation;

    this.setData({
      showQuestion: false,
      answerInput: "",
      loading: true
    });

    await this.callAI(
      "这个信息我目前还不知道，也还没有决定。请按照合理的默认情况继续规划，并告诉我之后什么时候需要确定这个信息。",
      conversation
    );
  },

  // ==============================
  // 完成关键事项
  // ==============================

  toggleImportantAction(e) {
    const index =
      Number(
        e.currentTarget.dataset.index
      );

    const actions = [
      ...this.data.importantActions
    ];

    if (!actions[index]) {
      return;
    }

    actions[index].completed =
      !actions[index].completed;

    this.setData({
      importantActions:
        actions,

      saved: false
    });
  },

  // ==============================
  // 完成计划任务
  // ==============================

  toggleTask(e) {
    const stageIndex =
      Number(
        e.currentTarget.dataset.stageIndex
      );

    const taskIndex =
      Number(
        e.currentTarget.dataset.taskIndex
      );

    const plan = {
      ...this.data.plan
    };

    if (
      !plan.stages ||
      !plan.stages[stageIndex]
    ) {
      return;
    }

    if (
      !plan.stages[stageIndex]
        .tasks ||
      !plan.stages[stageIndex]
        .tasks[taskIndex]
    ) {
      return;
    }

    plan.stages[stageIndex]
      .tasks[taskIndex]
      .completed =
      !plan.stages[stageIndex]
        .tasks[taskIndex]
        .completed;

    this.setData({
      plan: plan,
      saved: false
    });
  },

  // ==============================
  // 保存计划
  // ==============================

  savePlan() {
    if (!this.data.showResult) {
      wx.showToast({
        title: "还没有计划",
        icon: "none"
      });

      return;
    }

    const savedPlan = {
      goal:
        this.data.goal,

      understanding:
        this.data.understanding,

      suggestions:
        this.data.suggestions,

      importantActions:
        this.data.importantActions,

      deadlines:
        this.data.deadlines,

      materials:
        this.data.materials,

      resources:
        this.data.resources,

      plan:
        this.data.plan,

      currentStep:
        this.data.currentStep,

      nextQuestion:
        this.data.nextQuestion,

      savedAt:
        new Date().toISOString()
    };

    wx.setStorageSync(
      "ai_backward_plan",
      savedPlan
    );

    this.setData({
      saved: true
    });

    wx.showToast({
      title: "计划已保存",
      icon: "success"
    });
  },

  // ==============================
  // 加载计划
  // ==============================

  loadSavedPlan() {
    try {
      const plan =
        wx.getStorageSync(
          "ai_backward_plan"
        );

      if (
        !plan ||
        !plan.goal
      ) {
        return;
      }

      this.setData({
        goal:
          plan.goal,

        understanding:
          plan.understanding ||
          "",

        suggestions:
          Array.isArray(
            plan.suggestions
          )
            ? plan.suggestions
            : [],

        importantActions:
          Array.isArray(
            plan.importantActions
          )
            ? plan.importantActions
            : [],

        deadlines:
          Array.isArray(
            plan.deadlines
          )
            ? plan.deadlines
            : [],

        materials:
          Array.isArray(
            plan.materials
          )
            ? plan.materials
            : [],

        resources:
          Array.isArray(
            plan.resources
          )
            ? plan.resources
            : [],

        plan:
          plan.plan || {
            stages: []
          },

        currentStep:
          plan.currentStep ||
          "",

        nextQuestion:
          plan.nextQuestion ||
          "",

        showQuestion: false,

        showResult: true,

        saved: true
      });

    } catch (error) {
      console.error(
        "加载计划失败",
        error
      );
    }
  },

  // ==============================
  // 删除计划
  // ==============================

  clearSavedPlan() {
    wx.showModal({
      title: "删除计划",

      content:
        "确定删除当前保存的计划吗？",

      success: (res) => {
        if (!res.confirm) {
          return;
        }

        wx.removeStorageSync(
          "ai_backward_plan"
        );

        this.resetPlanning();

        wx.showToast({
          title: "已删除",
          icon: "success"
        });
      }
    });
  },

  // ==============================
  // 重新开始
  // ==============================

  resetPlanning() {
    this.setData({
      goal: "",

      showResult: false,

      understanding: "",

      suggestions: [],

      importantActions: [],

      deadlines: [],

      materials: [],

      resources: [],

      plan: {
        stages: []
      },

      currentStep: "",

      nextQuestion: "",

      showQuestion: false,

      answerInput: "",

      conversation: [],

      saved: false,

      errorMessage: ""
    });

    wx.pageScrollTo({
      scrollTop: 0,
      duration: 300
    });
  }
});