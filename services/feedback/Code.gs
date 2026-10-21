// Deploy separately as a Google Apps Script web app. Never deploy credentials in src/.
var FEEDBACK_HEADERS = ['回報編號', '接收時間 UTC', 'App 版本', '主旨', '內容'];

// Run once in the Apps Script editor, then authorize your own account.
function setupFeedback() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('FEEDBACK_SHEET_ID')) {
    throw new Error('已設定試算表；請從指令碼屬性查看 FEEDBACK_SHEET_ID，不重複建立。');
  }
  var book = SpreadsheetApp.create('Workout Calendar 問題回報');
  var sheet = book.getSheets()[0];
  sheet.setName('Reports');
  sheet.appendRow(FEEDBACK_HEADERS);
  sheet.setFrozenRows(1);
  props.setProperty('FEEDBACK_SHEET_ID', book.getId());
  console.log(book.getUrl());
}

function doGet() {
  return feedbackJson_({ service: 'workout-feedback', protocol: 1 });
}

function doPost(e) {
  var lock;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || raw.length > 12000) return feedbackJson_({ ok: false, code: 'INVALID' });
    var request;
    try { request = JSON.parse(raw); } catch (_) { throw new Error('Invalid'); }
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Invalid');
    if (Object.keys(request).some(function (key) { return ['id', 'title', 'body', 'version'].indexOf(key) < 0; })) throw new Error('Invalid');
    var id = feedbackText_(request.id, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid');
    var title = feedbackText_(request.title, 80);
    var body = feedbackText_(request.body, 2000);
    var version = feedbackText_(request.version, 60);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return feedbackJson_({ ok: false, code: 'BUSY' });
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty('FEEDBACK_SHEET_ID');
    if (!sheetId) return feedbackJson_({ ok: false, code: 'UNAVAILABLE' });
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Reports');
    if (!sheet || sheet.getRange(1, 1, 1, 5).getValues()[0].join('|') !== FEEDBACK_HEADERS.join('|')) {
      return feedbackJson_({ ok: false, code: 'UNAVAILABLE' });
    }
    var count = sheet.getLastRow() - 1;
    // Idempotency lives in the sheet: a retry after a lost response does not create another row.
    if (count > 0) {
      var ids = sheet.getRange(2, 1, count, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === id) {
          var existing = sheet.getRange(i + 2, 3, 1, 3).getValues()[0];
          if (existing[0] !== feedbackCell_(version) || existing[1] !== feedbackCell_(title) || existing[2] !== feedbackCell_(body)) {
            return feedbackJson_({ ok: false, code: 'ID_CONFLICT' });
          }
          return feedbackJson_({ ok: true, id: id });
        }
      }
    }
    // Small-service guardrails, not protection against a determined attacker.
    if (count >= 5000) return feedbackJson_({ ok: false, code: 'FULL' });
    var now = new Date();
    var day = now.toISOString().slice(0, 10);
    var quota = JSON.parse(props.getProperty('FEEDBACK_DAILY') || '{}');
    if (quota.day !== day) quota = { day: day, count: 0 };
    if (quota.count >= 100) return feedbackJson_({ ok: false, code: 'LIMIT' });
    // Reserve before writing: failures may consume a slot, but never report false success.
    props.setProperty('FEEDBACK_DAILY', JSON.stringify({ day: day, count: quota.count + 1 }));
    sheet.appendRow([id, now.toISOString(), feedbackCell_(version), feedbackCell_(title), feedbackCell_(body)]);
    SpreadsheetApp.flush();
    return feedbackJson_({ ok: true, id: id });
  } catch (error) {
    // No submitted text, sheet ID, stack or account information is exposed to clients.
    return feedbackJson_({ ok: false, code: error && error.message === 'Invalid' ? 'INVALID' : 'UNAVAILABLE' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function feedbackText_(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /\u0000/.test(value)) throw new Error('Invalid');
  return value.trim();
}
function feedbackCell_(value) {
  // Prefix formula-like text to prevent Sheets from executing user input as a formula.
  return /^[=+@-]/.test(value) ? '\u200b' + value : value;
}
function feedbackJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
