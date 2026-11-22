/**
 * Charbagh Ice Cream — Google Apps Script Backend (Code.gs)
 * ---------------------------------------------------------
 * Connects Google Sheets (Menu, Orders, Admins tabs) to the
 * Charbagh Ice Cream Kiosk & POS Web Application.
 *
 * Sheet Tabs Required:
 * 1. Menu   -> ID | Name | Category | Price | ImageURL | Status | Description
 * 2. Orders -> OrderID | Timestamp | ItemsJSON | Total | PaymentType | OrderType | Status | AdminID
 * 3. Admins -> AdminID | Name | Passcode | Role
 */

const SHEET_NAMES = {
  MENU: 'Menu',
  ORDERS: 'Orders',
  ADMINS: 'Admins',
};

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheetWithHeaders(ss, SHEET_NAMES.MENU, [
    'ID',
    'Name',
    'Category',
    'Price',
    'ImageURL',
    'Status',
    'Description',
  ]);

  ensureSheetWithHeaders(ss, SHEET_NAMES.ORDERS, [
    'OrderID',
    'Timestamp',
    'ItemsJSON',
    'Total',
    'PaymentType',
    'OrderType',
    'Status',
    'AdminID',
  ]);

  const adminSheet = ensureSheetWithHeaders(ss, SHEET_NAMES.ADMINS, [
    'AdminID',
    'Name',
    'Passcode',
    'Role',
  ]);

  if (adminSheet.getLastRow() <= 1) {
    adminSheet.appendRow(['ADM-01', 'Tariq Mahmood', '1122', 'Owner']);
    adminSheet.appendRow(['ADM-02', 'Sanaullah Khan', '3344', 'Manager']);
  }

  return jsonResponse({ ok: true, message: 'Charbagh database initialized.' });
}

function ensureSheetWithHeaders(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'syncAll';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping') {
      return jsonResponse({ ok: true, brand: 'Charbagh Ice Cream', time: new Date().toISOString() });
    }

    if (action === 'getMenu') {
      return jsonResponse({ ok: true, menu: readSheetAsObjects(ss, SHEET_NAMES.MENU) });
    }

    if (action === 'getOrders') {
      return jsonResponse({ ok: true, orders: readSheetAsObjects(ss, SHEET_NAMES.ORDERS) });
    }

    if (action === 'getAdmins') {
      const admins = readSheetAsObjects(ss, SHEET_NAMES.ADMINS).map(function (a) {
        return {
          AdminID: a.AdminID,
          Name: a.Name,
          Role: a.Role,
          Passcode: String(a.Passcode || ''),
        };
      });
      return jsonResponse({ ok: true, admins: admins });
    }

    return jsonResponse({
      ok: true,
      menu: readSheetAsObjects(ss, SHEET_NAMES.MENU),
      orders: readSheetAsObjects(ss, SHEET_NAMES.ORDERS),
      admins: readSheetAsObjects(ss, SHEET_NAMES.ADMINS),
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const payload = JSON.parse(raw);
    const action = payload.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'createOrder') {
      const sheet = ensureSheetWithHeaders(ss, SHEET_NAMES.ORDERS, [
        'OrderID',
        'Timestamp',
        'ItemsJSON',
        'Total',
        'PaymentType',
        'OrderType',
        'Status',
        'AdminID',
      ]);
      const o = payload.order;
      sheet.appendRow([
        o.OrderID,
        o.Timestamp || new Date().toISOString(),
        typeof o.ItemsJSON === 'string' ? o.ItemsJSON : JSON.stringify(o.ItemsJSON || []),
        Number(o.Total || 0),
        o.PaymentType || 'Cash',
        o.OrderType || 'Dine-in',
        o.Status || 'Pending',
        o.AdminID || 'KIOSK',
      ]);
      return jsonResponse({ ok: true, orderId: o.OrderID });
    }

    if (action === 'updateOrderStatus') {
      const sheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
      if (!sheet) return jsonResponse({ ok: false, error: 'Orders sheet missing' });
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(payload.orderId)) {
          sheet.getRange(i + 1, 7).setValue(payload.status);
          return jsonResponse({ ok: true, orderId: payload.orderId, status: payload.status });
        }
      }
      return jsonResponse({ ok: false, error: 'Order not found' });
    }

    if (action === 'upsertMenuItem') {
      const sheet = ensureSheetWithHeaders(ss, SHEET_NAMES.MENU, [
        'ID',
        'Name',
        'Category',
        'Price',
        'ImageURL',
        'Status',
        'Description',
      ]);
      const item = payload.item;
      const data = sheet.getDataRange().getValues();
      const rowValues = [
        item.ID,
        item.Name,
        item.Category,
        Number(item.Price || 0),
        item.ImageURL || '',
        item.Status || 'In Stock',
        item.Description || '',
      ];

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(item.ID)) {
          sheet.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
          return jsonResponse({ ok: true, updated: item.ID });
        }
      }

      sheet.appendRow(rowValues);
      return jsonResponse({ ok: true, created: item.ID });
    }

    if (action === 'deleteMenuItem') {
      const sheet = ss.getSheetByName(SHEET_NAMES.MENU);
      if (!sheet) return jsonResponse({ ok: false, error: 'Menu sheet missing' });
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(payload.id)) {
          sheet.deleteRow(i + 1);
          return jsonResponse({ ok: true, deleted: payload.id });
        }
      }
      return jsonResponse({ ok: false, error: 'Item not found' });
    }

    if (action === 'seedMenu') {
      const sheet = ensureSheetWithHeaders(ss, SHEET_NAMES.MENU, [
        'ID',
        'Name',
        'Category',
        'Price',
        'ImageURL',
        'Status',
        'Description',
      ]);
      const items = payload.items || [];
      if (sheet.getLastRow() > 1) {
        sheet.deleteRows(2, sheet.getLastRow() - 1);
      }
      items.forEach(function (item) {
        sheet.appendRow([
          item.ID,
          item.Name,
          item.Category,
          Number(item.Price || 0),
          item.ImageURL || '',
          item.Status || 'In Stock',
          item.Description || '',
        ]);
      });
      return jsonResponse({ ok: true, count: items.length });
    }

    if (action === 'verifyAdmin') {
      const admins = readSheetAsObjects(ss, SHEET_NAMES.ADMINS);
      const match = admins.find(function (a) {
        return (
          String(a.AdminID) === String(payload.adminId) &&
          String(a.Passcode) === String(payload.passcode)
        );
      });
      if (!match) return jsonResponse({ ok: false, error: 'Invalid credentials' });
      return jsonResponse({
        ok: true,
        admin: { AdminID: match.AdminID, Name: match.Name, Role: match.Role },
      });
    }

    return jsonResponse({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function readSheetAsObjects(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    const obj = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      const key = String(headers[j]).trim();
      if (!key) continue;
      obj[key] = values[i][j];
      if (values[i][j] !== '' && values[i][j] !== null) hasData = true;
    }
    if (hasData) rows.push(obj);
  }
  return rows;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}
