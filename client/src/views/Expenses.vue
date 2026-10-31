<script setup>
import { computed, onMounted, ref } from 'vue';
import { api, money, today } from '../api.js';

const emit = defineEmits(['changed']);

const items = ref([]);
const summary = ref(null);
const loading = ref(true);
const error = ref('');
const saving = ref(false);

const form = ref({ amount: '', category: '餐饮', note: '', spentAt: today() });
const categories = ['餐饮', '交通', '购物', '学习', '娱乐', '住房', '医疗', '其他'];

async function load() {
  loading.value = true;
  try {
    const [list, sum] = await Promise.all([api.expenses.list(), api.expenses.summary()]);
    items.value = list.items;
    summary.value = sum;
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function add() {
  const amount = Number(form.value.amount);
  if (!amount || amount <= 0 || saving.value) return;
  saving.value = true;
  try {
    await api.expenses.create({
      amount,
      category: form.value.category,
      note: form.value.note.trim(),
      spentAt: form.value.spentAt || today(),
    });
    form.value.amount = '';
    form.value.note = '';
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function remove(item) {
  try {
    await api.expenses.remove(item.id);
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

const maxCategory = computed(() => {
  const list = summary.value?.byCategory || [];
  return list.length ? list[0].total : 1;
});

function barWidth(total) {
  return Math.max(4, (total / (maxCategory.value || 1)) * 100) + '%';
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>记账</h1>
      <p>记录每一笔，看看钱都去哪了</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="stats" style="margin-bottom: 16px">
      <div class="stat accent">
        <div class="stat-label">本月支出</div>
        <div class="stat-value">{{ money(summary?.thisMonth?.total ?? 0) }}</div>
        <div class="stat-sub">{{ summary?.thisMonth?.month || '' }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">累计支出</div>
        <div class="stat-value">{{ money(summary?.total ?? 0) }}</div>
        <div class="stat-sub">共 {{ summary?.count ?? 0 }} 笔</div>
      </div>
      <div class="stat">
        <div class="stat-label">今日支出</div>
        <div class="stat-value">{{ money((summary?.byDay || []).find(d => d.date === today())?.total ?? 0) }}</div>
        <div class="stat-sub">今天</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">记一笔</div>
      <div class="form-row">
        <div class="field" style="width: 130px">
          <label>金额</label>
          <input v-model="form.amount" type="number" min="0.01" step="0.01" class="input" placeholder="0.00" @keyup.enter="add" />
        </div>
        <div class="field" style="width: 120px">
          <label>分类</label>
          <select v-model="form.category" class="select">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="field" style="flex: 1">
          <label>备注</label>
          <input v-model="form.note" class="input" placeholder="可选，例如：午饭" @keyup.enter="add" />
        </div>
        <div class="field" style="width: 150px">
          <label>日期</label>
          <input v-model="form.spentAt" type="date" class="input" />
        </div>
        <button class="btn primary" :disabled="saving || !(Number(form.amount) > 0)" @click="add">记录</button>
      </div>
    </div>

    <div class="card" v-if="summary?.byCategory?.length">
      <div class="card-title">分类占比</div>
      <div class="bars">
        <div v-for="c in summary.byCategory" :key="c.category" class="bar-row">
          <span>{{ c.category }}</span>
          <div class="bar-track"><div class="bar-fill" :style="{ width: barWidth(c.total) }"></div></div>
          <span class="bar-amount">{{ money(c.total) }}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">流水</div>
      <div v-if="loading" class="empty">读取中…</div>
      <div v-else-if="!items.length" class="empty">还没有记账</div>
      <div v-else class="list">
        <div v-for="e in items" :key="e.id" class="list-item">
          <div class="item-main">
            <div class="item-title">{{ e.note || e.category }}</div>
            <div class="item-meta">
              <span class="tag">{{ e.category }}</span>
              <span>{{ e.spentAt }}</span>
            </div>
          </div>
          <div style="font-weight: 650; font-variant-numeric: tabular-nums">{{ money(e.amount) }}</div>
          <div class="item-actions">
            <button class="btn danger" @click="remove(e)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
