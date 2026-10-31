<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api.js';

const emit = defineEmits(['changed']);

const items = ref([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);
const keyword = ref('');
const expanded = ref(null);

const form = ref({ title: '', content: '', tags: '' });

async function load() {
  loading.value = true;
  try {
    const params = {};
    if (keyword.value.trim()) params.q = keyword.value.trim();
    items.value = (await api.notes.list(params)).items;
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
    await api.notes.create({
      title: form.value.title.trim(),
      content: form.value.content,
      tags: form.value.tags,
    });
    form.value = { title: '', content: '', tags: '' };
    await load();
    emit('changed');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function togglePin(note) {
  try {
    await api.notes.update(note.id, { pinned: !note.pinned });
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function remove(note) {
  try {
    await api.notes.remove(note.id);
    if (expanded.value === note.id) expanded.value = null;
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
      <h1>笔记</h1>
      <p>随手记下想法、摘录和待整理的东西</p>
    </div>

    <div v-if="error" class="alert">{{ error }}</div>

    <div class="card">
      <div class="card-title">新笔记</div>
      <div class="form-row">
        <div class="field" style="flex: 1">
          <label>标题</label>
          <input v-model="form.title" class="input" placeholder="例如：读书摘录 · 《xxx》" />
        </div>
        <div class="field" style="width: 220px">
          <label>标签</label>
          <input v-model="form.tags" class="input" placeholder="逗号分隔，如：读书,摘录" />
        </div>
      </div>
      <div class="field" style="margin-top: 10px">
        <label>内容</label>
        <textarea v-model="form.content" class="textarea" placeholder="正文…"></textarea>
      </div>
      <div class="row" style="margin-top: 12px">
        <span class="hint">{{ form.content.length }} 字</span>
        <span class="spacer"></span>
        <button class="btn primary" :disabled="saving || !form.title.trim()" @click="add">保存笔记</button>
      </div>
    </div>

    <div class="filter-bar" style="margin-top: 18px">
      <input v-model="keyword" class="input" placeholder="搜索标题、正文或标签…" style="width: 240px" @keyup.enter="load" />
      <button class="btn sm" @click="load">搜索</button>
      <span class="spacer"></span>
      <span class="hint">{{ items.length }} 篇</span>
    </div>

    <div class="card">
      <div v-if="loading" class="empty">读取中…</div>
      <div v-else-if="!items.length" class="empty">还没有笔记</div>
      <div v-else class="list">
        <div v-for="n in items" :key="n.id" class="list-item">
          <div class="item-main">
            <div class="item-title" style="cursor: pointer" @click="toggle(n.id)">
              <span v-if="n.pinned" title="已置顶" style="color: var(--accent)">★</span>
              {{ n.title }}
            </div>
            <div class="item-meta">
              <span v-for="t in n.tags" :key="t" class="tag">{{ t }}</span>
              <span>{{ n.updatedAt.slice(0, 10) }}</span>
              <span class="hint">{{ (n.content || '').length }} 字</span>
            </div>
            <div v-if="expanded === n.id" class="entry-detail">
              <div class="entry-body">{{ n.content || '（没有内容）' }}</div>
            </div>
            <div v-else-if="n.content" class="item-note">{{ n.content.slice(0, 70) }}{{ n.content.length > 70 ? '…' : '' }}</div>
          </div>
          <div class="item-actions">
            <button class="btn ghost" @click="togglePin(n)">{{ n.pinned ? '取消置顶' : '置顶' }}</button>
            <button class="btn ghost" @click="toggle(n.id)">{{ expanded === n.id ? '收起' : '展开' }}</button>
            <button class="btn danger" @click="remove(n)">删除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
