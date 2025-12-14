/**
 * Timezone utilities
 */

/**
 * Convert a Date to client timezone
 * @param {Date} date - The date to convert
 * @param {number|null} tzOffset - Timezone offset in minutes from UTC (e.g., -540 for JST/UTC+9)
 * @returns {Date} Date adjusted to client timezone
 */
function toClientTime(date, tzOffset) {
  if (tzOffset === null || tzOffset === undefined) {
    return date;
  }
  var utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc - tzOffset * 60000);
}

/**
 * Format date as "M月D日 (曜日)" in client timezone
 * @param {Date} date - The date (already in client timezone)
 * @returns {string} Formatted date string
 */
function formatDateJapanese(date) {
  var days = ['日', '月', '火', '水', '木', '金', '土'];
  var month = date.getMonth() + 1;
  var day = date.getDate();
  var weekday = days[date.getDay()];
  return month + '月' + day + '日 (' + weekday + ')';
}

module.exports = {
  toClientTime: toClientTime,
  formatDateJapanese: formatDateJapanese
};
