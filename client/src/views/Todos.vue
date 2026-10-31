<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api.js';

const emit = defineEmits(['changed']);

const items = ref([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);

const filter = ref('open');
const keyword = ref('');

const form = ref({ title: '', priority: 2, dueDate: '' });

const filters = [
  { key: 'open', label: '未完成' },
  { key: 'done', label: '已完成' },
  { key: 'all', label: '全部' },
];

async function load() {
  loading.value = true;
  try {
    const params = {};
    if (filter.value === 'open') params.done = '0';
    if (filter.value === 'done') params.done = '1';
    if (keyword.value.trim()) params.q = keyword.value.trim();
    const res = await api.todos.list(params);
    items.value = res.items;
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function add() {
  if (!form.value.title.trim() || saving.value) return;
  saving.value = true;
  try {
    await api.todos.create({
      title: form.value.title.trim(),
      priority: Number(form.value.priority),
      dueDate: form.value.dueDate || undefined,
    });
    form.value = { title: '', priority: 2, dueDate: '' };
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function toggle(todo) {
  try {
    await api.todos.update(todo.id, { done: !todo.done });
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

async function remove(todo) {
  try {
    await api.todos.remove(todo.id);
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

function setFilter(key) {
  filter.value = key;
  load();
}

const countText = computed(() => `${items.value.length} 条`);
const tagClass = (p) => (p === 1 ? 'high' : p === 2 ? 'mid' : 'low');

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>待办</h1>
      <p>按优先级和截止日期自动排序，逾期的会标出来</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="card">
      <div class="form-row">
        <div class="field grow" style="flex: 1">
          <label>要做什么</label>
          <input v-model="form.title" class="input grow" placeholder="例如：写周报" @keyup.enter="add" />
        </div>
        <div class="field">
          <label>优先级</label>
          <select v-model="form.priority" class="select">
            <option :value="1">高</option>
            <option :value="2">中</option>
            <option :value="3">低</option>
          </select>
        </div>
        <div class="field">
          <label>截止日期</label>
          <input v-model="form.dueDate" type="date" class="input" />
        </div>
        <button class="btn primary" :disabled="saving || !form.title.trim()" @click="add">添加</button>
      </div>
    </div>

    <div class="filter-bar" style="margin-top: 18px">
      <button v-for="f in filters" :key="f.key" class="chip" :class="{ active: filter === f.key }" @click="setFilter(f.key)">
        {{ f.label }}
      </button>
      <span class="spacer"></span>
      <input v-model="keyword" class="input" placeholder="搜索…" style="width: 180px" @keyup.enter="load" />
      <button class="btn sm" @click="load">搜索</button>
    </div>

    <div class="card">
      <div v-if="loading" class="empty">读取中…</div>
      <div v-else-if="!items.length" class="empty">没有符合条件的待办</div>
      <div v-else class="list">
        <div v-for="t in items" :key="t.id" class="list-item">
          <button class="check" :class="{ on: t.done }" :aria-label="'切换 ' + t.title" @click="toggle(t)"></button>
          <div class="item-main">
            <div class="item-title" :class="{ done: t.done }">{{ t.title }}</div>
            <div v-if="t.notes" class="item-note">{{ t.notes }}</div>
            <div class="item-meta">
              <span class="tag" :class="tagClass(t.priority)">{{ t.priorityLabel }}</span>
              <span v-if="t.dueDate">截止 {{ t.dueDate }}</span>
              <span v-if="t.overdue" class="tag late">逾期</span>
            </div>
          </div>
          <div class="item-actions">
            <button class="btn danger" @click="remove(t)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <p class="hint" style="margin-top: 12px">{{ countText }}</p>
  </div>
</template>
