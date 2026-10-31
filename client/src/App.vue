<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from './api.js';
import Dashboard from './views/Dashboard.vue';
import Todos from './views/Todos.vue';
import Expenses from './views/Expenses.vue';
import Events from './views/Events.vue';
import Journal from './views/Journal.vue';
import Notes from './views/Notes.vue';
import Exams from './views/Exams.vue';
import Meals from './views/Meals.vue';
import Workouts from './views/Workouts.vue';

const navGroups = [
  { label: '', items: [{ key: 'dashboard', label: '总览', icon: '◈' }] },
  {
    label: '记录',
    items: [
      { key: 'todos', label: '待办', icon: '☑' },
      { key: 'expenses', label: '记账', icon: '¥' },
      { key: 'events', label: '日程', icon: '◷' },
      { key: 'journal', label: '日记', icon: '✎' },
    ],
  },
  {
    label: '生活',
    items: [
      { key: 'notes', label: '笔记', icon: '▤' },
      { key: 'exams', label: '考试', icon: '✧' },
      { key: 'meals', label: '饮食', icon: '◍' },
      { key: 'workouts', label: '运动', icon: '⬢' },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);
const views = { dashboard: Dashboard, todos: Todos, expenses: Expenses, events: Events, journal: Journal, notes: Notes, exams: Exams, meals: Meals, workouts: Workouts };

const view = ref('dashboard');
const summary = ref(null);
const error = ref('');

const validKeys = allItems.map((t) => t.key);

function viewFromHash() {
  const key = window.location.hash.replace('#', '');
  return validKeys.includes(key) ? key : 'dashboard';
}

const current = computed(() => views[view.value]);

const openTodos = computed(() => summary.value?.todos?.open ?? 0);
const todayExpense = computed(() => summary.value?.expenses?.today ?? 0);
const todayCalories = computed(() => summary.value?.meals?.todayCalories ?? 0);
const weekMinutes = computed(() => summary.value?.workouts?.weekMinutes ?? 0);
const nextExam = computed(() => summary.value?.exams?.next ?? null);

async function loadSummary() {
  try {
    summary.value = await api.summary();
    error.value = '';
  } catch (e) {
    error.value = e.message;
  }
}

function switchTo(key) {
  view.value = key;
  if (window.location.hash !== '#' + key) {
    // 让每个视图都有自己的地址，刷新或分享时能回到同一页
    history.replaceState(null, '', '#' + key);
  }
  loadSummary();
}

onMounted(() => {
  view.value = viewFromHash();
  window.addEventListener('hashchange', () => {
    const key = viewFromHash();
    if (key !== view.value) {
      view.value = key;
      loadSummary();
    }
  });
  loadSummary();
});
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">yuuu<span>^</span></span>
        <span class="brand-sub">Life Assistant</span>
      </div>

      <template v-for="group in navGroups" :key="group.label">
        <div v-if="group.label" class="nav-group-label">{{ group.label }}</div>
        <button
          v-for="tab in group.items"
          :key="tab.key"
          class="nav-item"
          :class="{ active: view === tab.key }"
          @click="switchTo(tab.key)"
        >
          <span class="nav-ico">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span v-if="tab.key === 'todos' && openTodos" class="nav-badge">{{ openTodos }}</span>
        </button>
      </template>

      <div class="sidebar-foot">
        <template v-if="summary">
          <div>{{ summary.today }}</div>
          <div>支出 ¥{{ todayExpense.toFixed(2) }}</div>
          <div>摄入 {{ todayCalories }} kcal</div>
          <div>本周运动 {{ weekMinutes }} 分钟</div>
          <div v-if="nextExam">距考试 {{ nextExam.daysLeft }} 天</div>
        </template>
        <div v-else>数据保存在本机</div>
      </div>
    </aside>

    <main class="main">
      <div class="page">
        <div v-if="error" class="alert">
          {{ error }}
          <button class="btn sm ghost" style="margin-left: 8px" @click="loadSummary">重试</button>
        </div>

        <component :is="current" :summary="summary" @changed="loadSummary" />
      </div>
    </main>
  </div>
</template>
