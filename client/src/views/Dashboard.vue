<script setup>
import { computed, onMounted, ref } from 'vue';
import { api, money, prettyTime, today } from '../api.js';

const props = defineProps({ summary: { type: Object, default: null } });
const emit = defineEmits(['changed']);

const todos = ref([]);
const expenses = ref(null);
const events = ref([]);
const journals = ref([]);
const loading = ref(true);
const error = ref('');

const openTodos = computed(() => todos.value.filter((t) => !t.done).slice(0, 4));
const todayExpenses = computed(() => (expenses.value?.byDay || []).find((d) => d.date === today()));

async function load() {
  loading.value = true;
  try {
    const [t, e, ev, j] = await Promise.all([
      api.todos.list({ done: '0' }),
      api.expenses.summary(),
      api.events.list({ from: today() }),
      api.journal.list({ limit: 3 }),
    ]);
    todos.value = t.items;
    expenses.value = e;
    events.value = ev.items.slice(0, 4);
    journals.value = j.items;
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function toggle(todo) {
  try {
    await api.todos.update(todo.id, { done: true });
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>今天要做什么</h1>
      <p>{{ props.summary?.today || today() }} · 一眼看完待办、花销和安排</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="stats" style="margin-bottom: 16px">
      <div class="stat accent">
        <div class="stat-label">未完成待办</div>
        <div class="stat-value">{{ props.summary?.todos?.open ?? 0 }}</div>
        <div class="stat-sub">
          共 {{ props.summary?.todos?.total ?? 0 }} 项<template v-if="props.summary?.todos?.overdue"> · {{ props.summary.todos.overdue }} 项逾期</template>
        </div>
      </div>
      <div class="stat">
        <div class="stat-label">今日支出</div>
        <div class="stat-value">{{ money(props.summary?.expenses?.today ?? 0) }}</div>
        <div class="stat-sub">本月 {{ money(props.summary?.expenses?.thisMonth ?? 0) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">今日日程</div>
        <div class="stat-value">{{ props.summary?.eventsToday ?? 0 }}</div>
        <div class="stat-sub">个安排</div>
      </div>
      <div class="stat">
        <div class="stat-label">日记</div>
        <div class="stat-value">{{ props.summary?.journal?.total ?? 0 }}</div>
        <div class="stat-sub">{{ props.summary?.journal?.writtenToday ? '今天已写' : '今天还没写' }}</div>
      </div>
    </div>

    <div class="stats" style="margin-bottom: 16px">
      <div class="stat">
        <div class="stat-label">笔记</div>
        <div class="stat-value">{{ props.summary?.notes?.total ?? 0 }}</div>
        <div class="stat-sub">篇</div>
      </div>
      <div class="stat">
        <div class="stat-label">今日摄入</div>
        <div class="stat-value">{{ props.summary?.meals?.todayCalories ?? 0 }}</div>
        <div class="stat-sub">kcal · {{ props.summary?.meals?.todayCount ?? 0 }} 餐</div>
      </div>
      <div class="stat">
        <div class="stat-label">本周运动</div>
        <div class="stat-value">{{ props.summary?.workouts?.weekMinutes ?? 0 }}</div>
        <div class="stat-sub">分钟 · {{ props.summary?.workouts?.weekCount ?? 0 }} 次</div>
      </div>
      <div class="stat">
        <div class="stat-label">下一场考试</div>
        <div class="stat-value">
          {{ props.summary?.exams?.next ? props.summary.exams.next.daysLeft + ' 天' : '—' }}
        </div>
        <div class="stat-sub">{{ props.summary?.exams?.next?.name || '暂无安排' }}</div>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <div class="card-title">接下来要做</div>
        <div v-if="loading" class="empty">读取中…</div>
        <div v-else-if="!openTodos.length" class="empty">没有待办了，休息一下</div>
        <div v-else class="list">
          <div v-for="t in openTodos" :key="t.id" class="list-item">
            <button class="check" :aria-label="'完成 ' + t.title" @click="toggle(t)"></button>
            <div class="item-main">
              <div class="item-title">{{ t.title }}</div>
              <div class="item-meta">
                <span class="tag" :class="t.priority === 1 ? 'high' : t.priority === 2 ? 'mid' : 'low'">{{ t.priorityLabel }}</span>
                <span v-if="t.dueDate">{{ t.dueDate }}</span>
                <span v-if="t.overdue" class="tag late">逾期</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">最近的日程</div>
        <div v-if="loading" class="empty">读取中…</div>
        <div v-else-if="!events.length" class="empty">还没有安排</div>
        <div v-else class="list">
          <div v-for="ev in events" :key="ev.id" class="list-item">
            <div class="item-main">
              <div class="item-title">{{ ev.title }}</div>
              <div class="item-meta">
                <span>{{ prettyTime(ev.startsAt) }}</span>
                <span v-if="ev.location">· {{ ev.location }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="split" style="margin-top: 16px">
      <div class="card">
        <div class="card-title">花销去向</div>
        <div v-if="loading" class="empty">读取中…</div>
        <div v-else-if="!expenses?.byCategory?.length" class="empty">还没有记账</div>
        <div v-else class="bars">
          <div v-for="c in expenses.byCategory.slice(0, 5)" :key="c.category" class="bar-row">
            <span>{{ c.category }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: Math.max(4, (c.total / (expenses.byCategory[0].total || 1)) * 100) + '%' }"></div>
            </div>
            <span class="bar-amount">{{ money(c.total) }}</span>
          </div>
        </div>
        <div v-if="todayExpenses" class="hint" style="margin-top: 12px">今天花了 {{ money(todayExpenses.total) }}，{{ todayExpenses.count }} 笔</div>
      </div>

      <div class="card">
        <div class="card-title">最近写的</div>
        <div v-if="loading" class="empty">读取中…</div>
        <div v-else-if="!journals.length" class="empty">还没有日记</div>
        <div v-else class="list">
          <div v-for="j in journals" :key="j.id" class="list-item">
            <div class="item-main">
              <div class="item-title">{{ j.title }}</div>
              <div class="item-meta">
                <span>{{ j.entryDate }}</span>
                <span v-if="j.mood">· {{ j.mood }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
