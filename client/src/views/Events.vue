<script setup>
import { onMounted, ref } from 'vue';
import { api, prettyTime } from '../api.js';

const emit = defineEmits(['changed']);

const items = ref([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const showAll = ref(false);

const form = ref({ title: '', startsAt: '', endsAt: '', location: '', note: '' });

function defaultStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function load() {
  loading.value = true;
  try {
    const params = showAll.value ? {} : { upcoming: true };
    const res = await api.events.list(params);
    items.value = res.items;
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function add() {
  if (!form.value.title.trim() || !form.value.startsAt || saving.value) return;
  saving.value = true;
  try {
    await api.events.create({
      title: form.value.title.trim(),
      startsAt: new Date(form.value.startsAt).toISOString(),
      endsAt: form.value.endsAt ? new Date(form.value.endsAt).toISOString() : undefined,
      location: form.value.location.trim(),
      note: form.value.note.trim(),
    });
    form.value = { title: '', startsAt: defaultStart(), endsAt: '', location: '', note: '' };
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function remove(ev) {
  try {
    await api.events.remove(ev.id);
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

function toggleAll() {
  showAll.value = !showAll.value;
  load();
}

onMounted(() => {
  form.value.startsAt = defaultStart();
  load();
});
</script>

<template>
  <div>
    <div class="page-head">
      <h1>日程</h1>
      <p>把要赴的约、要做的事排进时间里</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="card">
      <div class="card-title">新安排</div>
      <div class="form-row">
        <div class="field" style="flex: 1">
          <label>标题</label>
          <input v-model="form.title" class="input" placeholder="例如：社团例会" @keyup.enter="add" />
        </div>
        <div class="field" style="width: 200px">
          <label>开始</label>
          <input v-model="form.startsAt" type="datetime-local" class="input" />
        </div>
        <div class="field" style="width: 200px">
          <label>结束（可选）</label>
          <input v-model="form.endsAt" type="datetime-local" class="input" />
        </div>
      </div>
      <div class="form-row" style="margin-top: 10px">
        <div class="field" style="width: 200px">
          <label>地点</label>
          <input v-model="form.location" class="input" placeholder="可选" />
        </div>
        <div class="field" style="flex: 1">
          <label>备注</label>
          <input v-model="form.note" class="input" placeholder="可选" />
        </div>
        <button class="btn primary" :disabled="saving || !form.title.trim() || !form.startsAt" @click="add">添加到日程</button>
      </div>
    </div>

    <div class="filter-bar" style="margin-top: 18px">
      <button class="chip" :class="{ active: !showAll }" @click="toggleAll">即将到来</button>
      <button class="chip" :class="{ active: showAll }" @click="toggleAll">全部</button>
    </div>

    <div class="card">
      <div v-if="loading" class="empty">读取中…</div>
      <div v-else-if="!items.length" class="empty">这段时间没有安排</div>
      <div v-else class="list">
        <div v-for="ev in items" :key="ev.id" class="list-item">
          <div class="item-main">
            <div class="item-title">{{ ev.title }}</div>
            <div class="item-meta">
              <span>{{ prettyTime(ev.startsAt) }}</span>
              <span v-if="ev.endsAt">→ {{ prettyTime(ev.endsAt) }}</span>
              <span v-if="ev.location" class="tag">{{ ev.location }}</span>
            </div>
            <div v-if="ev.note" class="item-note">{{ ev.note }}</div>
          </div>
          <div class="item-actions">
            <button class="btn danger" @click="remove(ev)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
