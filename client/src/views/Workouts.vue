<script setup>
import { computed, onMounted, ref } from 'vue';
import { api, today } from '../api.js';

const emit = defineEmits(['changed']);

const items = ref([]);
const summary = ref(null);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const filterKind = ref('');

const kinds = ['跑步', '力量', '球类', '游泳', '骑行', '拉伸', '其他'];
const form = ref({ kind: '跑步', durationMin: '', calories: '', note: '', doneAt: today() });

async function load() {
  loading.value = true;
  try {
    const [list, sum] = await Promise.all([
      api.workouts.list(filterKind.value ? { kind: filterKind.value } : {}),
      api.workouts.summary(),
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
  const dur = Number(form.value.durationMin);
  if (!dur || dur <= 0 || saving.value) return;
  saving.value = true;
  try {
    await api.workouts.create({
      kind: form.value.kind,
      durationMin: dur,
      calories: form.value.calories === '' ? 0 : Number(form.value.calories),
      note: form.value.note.trim(),
      doneAt: form.value.doneAt || today(),
    });
    form.value.durationMin = '';
    form.value.calories = '';
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
    await api.workouts.remove(item.id);
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

function setKind(k) {
  filterKind.value = filterKind.value === k ? '' : k;
  load();
}

const todayRow = computed(() => summary.value?.today || { minutes: 0, count: 0 });
const weekRow = computed(() => summary.value?.thisWeek || { minutes: 0, count: 0 });
const maxKind = computed(() => Math.max(1, ...(summary.value?.byKind || []).map((k) => k.minutes)));

function weekBars() {
  const list = summary.value?.last7Days || [];
  const byDate = new Map(list.map((d) => [d.date, d]));
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const pad = (n) => String(n).padStart(2, '0');
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    out.push({ date: key, label: `${d.getMonth() + 1}/${d.getDate()}`, minutes: byDate.get(key)?.minutes || 0 });
  }
  return out;
}

const maxWeekMinutes = computed(() => Math.max(1, ...weekBars().map((d) => d.minutes)));

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>运动</h1>
      <p>跑了多少、练了多久，都记下来</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="stats" style="margin-bottom: 16px">
      <div class="stat accent">
        <div class="stat-label">本周运动</div>
        <div class="stat-value">{{ weekRow.minutes }} 分钟</div>
        <div class="stat-sub">{{ weekRow.count }} 次 · 自 {{ weekRow.since }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">今日</div>
        <div class="stat-value">{{ todayRow.minutes }} 分钟</div>
        <div class="stat-sub">{{ todayRow.count }} 次</div>
      </div>
      <div class="stat">
        <div class="stat-label">连续打卡</div>
        <div class="stat-value">{{ summary?.streakDays ?? 0 }} 天</div>
        <div class="stat-sub">有记录即算</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">记一次运动</div>
      <div class="form-row">
        <div class="field" style="width: 120px">
          <label>类型</label>
          <select v-model="form.kind" class="select">
            <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
          </select>
        </div>
        <div class="field" style="width: 120px">
          <label>时长（分钟）</label>
          <input v-model="form.durationMin" type="number" min="1" class="input" placeholder="30" @keyup.enter="add" />
        </div>
        <div class="field" style="width: 110px">
          <label>消耗</label>
          <input v-model="form.calories" type="number" min="0" class="input" placeholder="kcal" />
        </div>
        <div class="field" style="flex: 1">
          <label>备注</label>
          <input v-model="form.note" class="input" placeholder="可选" />
        </div>
        <div class="field" style="width: 150px">
          <label>日期</label>
          <input v-model="form.doneAt" type="date" class="input" />
        </div>
        <button class="btn primary" :disabled="saving || !(Number(form.durationMin) > 0)" @click="add">记录</button>
      </div>
    </div>

    <div class="split" style="margin-top: 16px">
      <div class="card">
        <div class="card-title">近 7 天时长</div>
        <div class="week-bars">
          <div v-for="d in weekBars()" :key="d.date" class="week-col">
            <span class="week-value">{{ d.minutes || '' }}</span>
            <div class="week-fill" :style="{ height: Math.max(3, (d.minutes / maxWeekMinutes) * 76) + 'px' }"></div>
            <span class="week-label">{{ d.label }}</span>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">本周类型分布</div>
        <div v-if="!(summary?.byKind || []).length" class="empty">本周还没有运动</div>
        <div v-else class="bars">
          <div v-for="k in summary.byKind" :key="k.kind" class="bar-row">
            <span>{{ k.kind }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: Math.max(3, (k.minutes / maxKind) * 100) + '%' }"></div>
            </div>
            <span class="bar-amount">{{ k.minutes }} 分钟</span>
          </div>
        </div>
      </div>
    </div>

    <div class="filter-bar" style="margin-top: 18px">
      <button class="chip" :class="{ active: filterKind === '' }" @click="setKind('')">全部</button>
      <button v-for="k in kinds" :key="k" class="chip" :class="{ active: filterKind === k }" @click="setKind(k)">{{ k }}</button>
    </div>

    <div class="card">
      <div v-if="loading" class="empty">读取中…</div>
      <div v-else-if="!items.length" class="empty">还没有运动记录</div>
      <div v-else class="list">
        <div v-for="w in items" :key="w.id" class="list-item">
          <div class="item-main">
            <div class="item-title">{{ w.kind }} · {{ w.durationMin }} 分钟</div>
            <div class="item-meta">
              <span>{{ w.doneAt }}</span>
              <span v-if="w.calories">· {{ w.calories }} kcal</span>
              <span v-if="w.note">· {{ w.note }}</span>
            </div>
          </div>
          <div class="item-actions">
            <button class="btn danger" @click="remove(w)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
