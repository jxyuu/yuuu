<script setup>
import { computed, onMounted, ref } from 'vue';
import { api, prettyTime } from '../api.js';

const emit = defineEmits(['changed']);

const all = ref([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const filter = ref('upcoming');

function defaultExamAt() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(9, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const form = ref({ name: '', subject: '', examAt: defaultExamAt(), location: '', seat: '' });

async function load() {
  loading.value = true;
  try {
    // 一次取全部，筛选在本地做，这样统计卡片不会被筛选影响
    all.value = (await api.exams.list({})).items;
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function add() {
  if (!form.value.name.trim() || !form.value.examAt || saving.value) return;
  saving.value = true;
  try {
    await api.exams.create({
      name: form.value.name.trim(),
      subject: form.value.subject.trim(),
      examAt: new Date(form.value.examAt).toISOString(),
      location: form.value.location.trim(),
      seat: form.value.seat.trim(),
    });
    form.value = { name: '', subject: '', examAt: defaultExamAt(), location: '', seat: '' };
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(exam) {
  try {
    await api.exams.update(exam.id, { status: exam.status === 'done' ? 'planned' : 'done' });
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

async function saveScore(exam, value) {
  const raw = String(value ?? '').trim();
  try {
    await api.exams.update(exam.id, { score: raw === '' ? null : Number(raw) });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function remove(exam) {
  try {
    await api.exams.remove(exam.id);
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

const upcoming = computed(() => all.value.filter((e) => e.status !== 'done' && e.daysLeft !== null && e.daysLeft >= 0));
const doneCount = computed(() => all.value.filter((e) => e.status === 'done').length);
const nearest = computed(() => (upcoming.value.length ? upcoming.value[0] : null));

const items = computed(() => {
  if (filter.value === 'upcoming') return upcoming.value;
  if (filter.value === 'done') return all.value.filter((e) => e.status === 'done');
  return all.value;
});

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>考试</h1>
      <p>把考试时间、地点、座位记下来，出分后补成绩</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="stats" style="margin-bottom: 16px">
      <div class="stat accent">
        <div class="stat-label">下一场考试</div>
        <div class="stat-value">{{ nearest ? nearest.daysLeft + ' 天' : '—' }}</div>
        <div class="stat-sub">{{ nearest ? nearest.name : '暂无安排' }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">待考</div>
        <div class="stat-value">{{ upcoming.length }}</div>
        <div class="stat-sub">场</div>
      </div>
      <div class="stat">
        <div class="stat-label">已考</div>
        <div class="stat-value">{{ doneCount }}</div>
        <div class="stat-sub">场</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">新增考试</div>
      <div class="form-row">
        <div class="field" style="flex: 1">
          <label>名称</label>
          <input v-model="form.name" class="input" placeholder="例如：中国历史导论 期末" />
        </div>
        <div class="field" style="width: 130px">
          <label>科目</label>
          <input v-model="form.subject" class="input" placeholder="可选" />
        </div>
        <div class="field" style="width: 200px">
          <label>时间</label>
          <input v-model="form.examAt" type="datetime-local" class="input" />
        </div>
      </div>
      <div class="form-row" style="margin-top: 10px">
        <div class="field" style="flex: 1">
          <label>地点</label>
          <input v-model="form.location" class="input" placeholder="例如：B203" />
        </div>
        <div class="field" style="width: 130px">
          <label>座位</label>
          <input v-model="form.seat" class="input" placeholder="可选" />
        </div>
        <button class="btn primary" :disabled="saving || !form.name.trim()" @click="add">添加</button>
      </div>
    </div>

    <div class="filter-bar" style="margin-top: 18px">
      <button class="chip" :class="{ active: filter === 'upcoming' }" @click="filter = 'upcoming'">待考</button>
      <button class="chip" :class="{ active: filter === 'done' }" @click="filter = 'done'">已考</button>
      <button class="chip" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
      <span class="spacer"></span>
      <span class="hint">{{ items.length }} 场</span>
    </div>

    <div class="card">
      <div v-if="loading" class="empty">读取中…</div>
      <div v-else-if="!items.length" class="empty">这里还没有考试</div>
      <div v-else class="list">
        <div v-for="e in items" :key="e.id" class="list-item">
          <button class="check" :class="{ on: e.status === 'done' }" aria-label="切换考试状态" @click="toggleStatus(e)"></button>
          <div class="item-main">
            <div class="item-title" :class="{ done: e.status === 'done' }">{{ e.name }}</div>
            <div class="item-meta">
              <span v-if="e.subject" class="tag">{{ e.subject }}</span>
              <span>{{ prettyTime(e.examAt) }}</span>
              <span v-if="e.location">· {{ e.location }}</span>
              <span v-if="e.seat">· 座位 {{ e.seat }}</span>
              <span v-if="e.status !== 'done' && e.daysLeft !== null" class="tag" :class="e.daysLeft <= 3 ? 'high' : 'mid'">
                {{ e.daysLeft >= 0 ? e.daysLeft + ' 天后' : '已过期' }}
              </span>
            </div>
            <div v-if="e.status === 'done'" class="item-meta">
              <label class="hint" :for="'score-' + e.id">成绩</label>
              <input
                :id="'score-' + e.id"
                :value="e.score ?? ''"
                class="input"
                style="width: 90px; padding: 4px 10px"
                type="number"
                min="0"
                step="0.5"
                placeholder="—"
                @change="saveScore(e, $event.target.value)"
              />
            </div>
          </div>
          <div class="item-actions">
            <button class="btn danger" @click="remove(e)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
