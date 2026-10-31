<script setup>
import { onMounted, ref } from 'vue';
import { api, today } from '../api.js';

const emit = defineEmits(['changed']);

const items = ref([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const keyword = ref('');
const expanded = ref(null);

const moods = ['', '不错', '平静', '疲惫', '开心', 'emo', '充实'];

const form = ref({ title: '', content: '', mood: '', entryDate: today() });

async function load() {
  loading.value = true;
  try {
    const params = {};
    if (keyword.value.trim()) params.q = keyword.value.trim();
    const res = await api.journal.list(params);
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
    await api.journal.create({
      title: form.value.title.trim(),
      content: form.value.content,
      mood: form.value.mood,
      entryDate: form.value.entryDate || today(),
    });
    form.value = { title: '', content: '', mood: '', entryDate: today() };
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function remove(entry) {
  try {
    await api.journal.remove(entry.id);
    if (expanded.value === entry.id) expanded.value = null;
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  }
}

function toggle(id) {
  expanded.value = expanded.value === id ? null : id;
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>日记</h1>
      <p>把今天留下一点痕迹，哪怕只有一句</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="card">
      <div class="card-title">写点什么</div>
      <div class="form-row">
        <div class="field" style="flex: 1">
          <label>标题</label>
          <input v-model="form.title" class="input" placeholder="今天的一句话总结" />
        </div>
        <div class="field" style="width: 140px">
          <label>日期</label>
          <input v-model="form.entryDate" type="date" class="input" />
        </div>
        <div class="field" style="width: 120px">
          <label>心情</label>
          <select v-model="form.mood" class="select">
            <option v-for="m in moods" :key="m" :value="m">{{ m || '不选' }}</option>
          </select>
        </div>
      </div>
      <div class="field" style="margin-top: 10px">
        <label>正文</label>
        <textarea v-model="form.content" class="textarea" placeholder="今天发生了什么？想到了什么？"></textarea>
      </div>
      <div class="row" style="margin-top: 12px">
        <span class="hint">{{ form.content.length }} 字</span>
        <span class="spacer"></span>
        <button class="btn primary" :disabled="saving || !form.title.trim()" @click="add">保存日记</button>
      </div>
    </div>

    <div class="filter-bar" style="margin-top: 18px">
      <input v-model="keyword" class="input" placeholder="搜索标题或正文…" style="width: 220px" @keyup.enter="load" />
      <button class="btn sm" @click="load">搜索</button>
      <span class="spacer"></span>
      <span class="hint">{{ items.length }} 篇</span>
    </div>

    <div class="card">
      <div v-if="loading" class="empty">读取中…</div>
      <div v-else-if="!items.length" class="empty">还没有日记，写下第一篇吧</div>
      <div v-else class="list">
        <div v-for="j in items" :key="j.id" class="list-item">
          <div class="item-main">
            <div class="item-title" style="cursor: pointer" @click="toggle(j.id)">{{ j.title }}</div>
            <div class="item-meta">
              <span>{{ j.entryDate }}</span>
              <span v-if="j.mood" class="tag">{{ j.mood }}</span>
              <span class="hint">{{ (j.content || '').length }} 字</span>
            </div>
            <div v-if="expanded === j.id" class="entry-detail">
              <div class="entry-body">{{ j.content || '（没有正文）' }}</div>
            </div>
            <div v-else-if="j.content" class="item-note">{{ j.content.slice(0, 60) }}{{ j.content.length > 60 ? '…' : '' }}</div>
          </div>
          <div class="item-actions">
            <button class="btn ghost" @click="toggle(j.id)">{{ expanded === j.id ? '收起' : '展开' }}</button>
            <button class="btn danger" @click="remove(j)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
