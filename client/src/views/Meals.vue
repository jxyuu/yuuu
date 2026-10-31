<script setup>
import { computed, onMounted, ref } from 'vue';
import { api, today } from '../api.js';

const emit = defineEmits(['changed']);

const items = ref([]);
const summary = ref(null);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const filterType = ref('');

const mealTypes = ['早餐', '午餐', '晚餐', '加餐'];
const form = ref({ name: '', mealType: '午餐', calories: '', eatenAt: today() });

async function load() {
  loading.value = true;
  try {
    const [list, sum] = await Promise.all([
      api.meals.list(filterType.value ? { type: filterType.value } : {}),
      api.meals.summary(),
    ]);
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
  if (!form.value.name.trim() || saving.value) return;
  saving.value = true;
  try {
    await api.meals.create({
      name: form.value.name.trim(),
      mealType: form.value.mealType,
      calories: form.value.calories === '' ? 0 : Number(form.value.calories),
      eatenAt: form.value.eatenAt || today(),
    });
    form.value.name = '';
    form.value.calories = '';
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
    await api.meals.remove(item.id);
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

function setType(t) {
  filterType.value = filterType.value === t ? '' : t;
  load();
}

const maxWeek = computed(() => Math.max(1, ...(summary.value?.last7Days || []).map((d) => d.calories)));
const todayRow = computed(() => summary.value?.today || { calories: 0, count: 0 });
const maxType = computed(() => Math.max(1, ...(summary.value?.byType || []).map((t) => t.calories)));

function weekBars() {
  const list = summary.value?.last7Days || [];
  const byDate = new Map(list.map((d) => [d.date, d]));
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const pad = (n) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    out.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, kcal: byDate.get(key)?.calories || 0 });
  }
  return out;
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>饮食</h1>
      <p>记录每天吃了什么，看看热量大概在什么范围</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="stats" style="margin-bottom: 16px">
      <div class="stat accent">
        <div class="stat-label">今日摄入</div>
        <div class="stat-value">{{ todayRow.calories }} kcal</div>
        <div class="stat-sub">{{ todayRow.count }} 餐记录</div>
      </div>
      <div class="stat">
        <div class="stat-label">近 7 天总计</div>
        <div class="stat-value">{{ (summary?.last7Days || []).reduce((s, d) => s + d.calories, 0) }} kcal</div>
        <div class="stat-sub">有记录的天数 {{ (summary?.last7Days || []).length }} 天</div>
      </div>
      <div class="stat">
        <div class="stat-label">累计记录</div>
        <div class="stat-value">{{ summary?.total?.count ?? 0 }}</div>
        <div class="stat-sub">顿</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">记一顿</div>
      <div class="form-row">
        <div class="field" style="flex: 1">
          <label>吃了什么</label>
          <input v-model="form.name" class="input" placeholder="例如：番茄牛腩饭" @keyup.enter="add" />
        </div>
        <div class="field" style="width: 110px">
          <label>餐次</label>
          <select v-model="form.mealType" class="select">
            <option v-for="t in mealTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="field" style="width: 110px">
          <label>热量</label>
          <input v-model="form.calories" type="number" min="0" class="input" placeholder="kcal" />
        </div>
        <div class="field" style="width: 150px">
          <label>日期</label>
          <input v-model="form.eatenAt" type="date" class="input" />
        </div>
        <button class="btn primary" :disabled="saving || !form.name.trim()" @click="add">记录</button>
      </div>
    </div>

    <div class="split" style="margin-top: 16px">
      <div class="card">
        <div class="card-title">近 7 天摄入</div>
        <div class="week-bars">
          <div v-for="d in weekBars()" :key="d.date" class="week-col">
            <span class="week-value">{{ d.kcal || '' }}</span>
            <div class="week-fill" :style="{ height: Math.max(3, (d.kcal / maxWeek) * 76) + 'px' }"></div>
            <span class="week-label">{{ d.label }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">今日餐次分布</div>
        <div class="bars">
          <div v-for="t in summary?.byType || []" :key="t.mealType" class="bar-row">
            <span>{{ t.mealType }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: t.calories > 0 ? Math.max(3, (t.calories / maxType) * 100) + '%' : '0' }"></div>
            </div>
            <span class="bar-amount">{{ t.calories }} kcal</span>
          </div>
        </div>
      </div>
    </div>

    <div class="filter-bar" style="margin-top: 18px">
      <button class="chip" :class="{ active: filterType === '' }" @click="setType('')">全部</button>
      <button v-for="t in mealTypes" :key="t" class="chip" :class="{ active: filterType === t }" @click="setType(t)">{{ t }}</button>
    </div>

    <div class="card">
      <div v-if="loading" class="empty">读取中…</div>
      <div v-else-if="!items.length" class="empty">还没有饮食记录</div>
      <div v-else class="list">
        <div v-for="m in items" :key="m.id" class="list-item">
          <div class="item-main">
            <div class="item-title">{{ m.name }}</div>
            <div class="item-meta">
              <span class="tag">{{ m.mealType }}</span>
              <span>{{ m.eatenAt }}</span>
              <span v-if="m.note">· {{ m.note }}</span>
            </div>
          </div>
          <div style="font-weight: 650; font-variant-numeric: tabular-nums; color: var(--ink-soft)">
            {{ m.calories ? m.calories + ' kcal' : '—' }}
          </div>
          <div class="item-actions">
            <button class="btn danger" @click="remove(m)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
