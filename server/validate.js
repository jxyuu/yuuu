'use strict';

/**
 * 通用校验与响应辅助
 */

/** 400 错误：带字段说明 */
class BadRequest extends Error {
  constructor(message, field) {
    super(message);
    this.status = 400;
    this.field = field;
  }
}

/** 404 错误 */
class NotFound extends Error {
  constructor(message = '记录不存在') {
    super(message);
    this.status = 404;
  }
}

/** 必须是字符串并去掉首尾空白 */
function requireString(value, field, { max = 500, allowEmpty = false } = {}) {
  if (typeof value !== 'string') {
    throw new BadRequest(`${field} 必须是字符串`, field);
  }
  const v = value.trim();
  if (!allowEmpty && v === '') {
    throw new BadRequest(`${field} 不能为空`, field);
  }
  if (v.length > max) {
    throw new BadRequest(`${field} 不能超过 ${max} 个字符`, field);
  }
  return v;
}

/** 可选字符串：undefined/null 返回默认值 */
function optionalString(value, field, fallback = '', opts = {}) {
  if (value === undefined || value === null) return fallback;
  return requireString(value, field, { ...opts, allowEmpty: true });
}

/** 必须是数字 */
function requireNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new BadRequest(`${field} 必须是数字`, field);
  }
  if (n < min) throw new BadRequest(`${field} 不能小于 ${min}`, field);
  if (n > max) throw new BadRequest(`${field} 不能大于 ${max}`, field);
  return n;
}

/** 整数 */
function requireInt(value, field, opts = {}) {
  const n = requireNumber(value, field, opts);
  if (!Number.isInteger(n)) {
    throw new BadRequest(`${field} 必须是整数`, field);
  }
  return n;
}

/** 日期 YYYY-MM-DD */
function requireDate(value, field) {
  const v = requireString(value, field, { max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new BadRequest(`${field} 必须是 YYYY-MM-DD 格式`, field);
  }
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequest(`${field} 不是有效日期`, field);
  }
  return v;
}

/** 可选日期 */
function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return requireDate(value, field);
}

/** 时间：接受 YYYY-MM-DD 或 ISO 8601 */
function requireDateTime(value, field) {
  const v = requireString(value, field, { max: 40 });
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequest(`${field} 必须是 YYYY-MM-DD 或 ISO 8601 时间`, field);
  }
  return d.toISOString();
}

/** 路径参数 id */
function requireId(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequest('id 必须是正整数', 'id');
  }
  return n;
}

/** 今天（本地时区）的 YYYY-MM-DD */
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

module.exports = {
  BadRequest,
  NotFound,
  requireString,
  optionalString,
  requireNumber,
  requireInt,
  requireDate,
  optionalDate,
  requireDateTime,
  requireId,
  today,
};
