// Code.gs

const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

// Create custom menu item(s)
function onOpen() {
  var start_time = new Date().getTime();
  var ui = SpreadsheetApp.getUi();
  Logger.log('Step: "Get UI" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

  // Create the Task Manager menu
  var taskManagerMenu = ui.createMenu('Task Manager')
    .addItem('Create New Task', 'openTaskDialog')

  // Create the Developer Features submenu
  var developerSubMenu = ui.createMenu('Developer Features')
    .addItem('Refresh Urgency', 'refreshUrgency')
    .addItem('Refresh Cached Headers', 'clearCachedHeaders');

  // Add Developer Features submenu to Task Manager menu
  taskManagerMenu.addSubMenu(developerSubMenu).addToUi();
  Logger.log('Step: "Add Menu Items" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

  // Refresh urgency on opening the sheet
  refreshUrgency(true);
  Logger.log('Step: "Refresh Urgency" Execution time: ' + (new Date().getTime() - start_time) + ' ms');
}

function doPost(e) {
  var start_time = new Date().getTime();

  if (!e || !e.postData || !e.postData.contents) {
    Logger.log("Missing post data.");
    return ContentService.createTextOutput("Error: Missing post data.");
  }

  Logger.log("Incoming data: " + e.postData.contents);
  Logger.log('Step: "Log Incoming Data" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

  try {
    const parsedData = parseIncomingData(e.postData.contents);
    Logger.log("Parsed data: " + JSON.stringify(parsedData));
    Logger.log('Step: "Parse Incoming Data" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

    createTask(parsedData);
    Logger.log('Step: "Create Task" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

    return ContentService.createTextOutput(`Success. Your task was added to the sheet.`);
  } catch (error) {
    Logger.log("Error in doPost: " + error.message);
    return ContentService.createTextOutput("Error: " + error.message);
  }
}

function getCachedHeaders(sheet) {
  var start_time = new Date().getTime();
  var cache = CacheService.getScriptCache();
  var cachedHeaders = cache.get("headerIndices");

  if (cachedHeaders) {
    Logger.log('Step: "Retrieve Cached Headers" Execution time: ' + (new Date().getTime() - start_time) + ' ms');
    return JSON.parse(cachedHeaders);
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('Step: "Get Headers" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

  var headerIndices = {};
  headers.forEach(function (header, index) {
    headerIndices[header] = index + 1;
  });
  Logger.log('Step: "Create Header Indices" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

  cache.put("headerIndices", JSON.stringify(headerIndices), 7200);
  Logger.log('Step: "Cache Header Indices" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

  return headerIndices;
}

function clearCachedHeaders() {
  var cache = CacheService.getScriptCache();
  cache.remove("headerIndices");
  Logger.log("Header cache cleared.");
  SpreadsheetApp.getUi().alert("Header cache has been refreshed.");
}


function parseIncomingData(data) {
  const jsonData = JSON.parse(data);

  return {
    task: jsonData.task || "No task provided",
    estimate: jsonData.estimate || "No estimate",
    priority: jsonData.priority || "No priority",
    status: jsonData.status || "No status",
    dueDate: jsonData.dueDate || "No due date"
  };
}

function testParsingAndAppendTask() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Simulate incoming JSON data as a string (similar to e.postData.contents)
  const jsonDataString = JSON.stringify({
    task: 'Talk to Chris about the shader tutorial',
    estimate: 'small',
    priority: 'P2',
    status: 'Not started',
    dueDate: '2023-10-02'
  });

  // Parse the incoming data and append it to the sheet
  const parsedData = parseIncomingData(jsonDataString);
  createTask(parsedData);
}

// Custom server-side include() function
// See https://developers.google.com/apps-script/guides/html/best-practices#separate_html_css_and_javascript
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function openTaskDialog() {
  var template = HtmlService.createTemplateFromFile('TaskDialog');
  var html = template.evaluate()
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'New Task');
}

// When the sheet gets edited
function onEdit(e) {
  // Retrieve cached header indices
  var headerIndices = getCachedHeaders(sheet);

  var col = e.range.getColumn();
  var row = e.range.getRow();

  // Detect if a checkbox is switched to TRUE and uncheck others (radio button behavior)
  if (col == headerIndices['Focus'] && e.oldValue === "false" && e.value === "TRUE") {
    uncheckOtherCheckboxes(row, sheet, headerIndices['Focus']);
  }

  // Detect if a new row is added and update the "Added date" column
  if (row > 1 && col == 1 && sheet.getRange(row, 1).getValue() != "") {
    updateAddedDate_(sheet, headerIndices['Added date'], row);
  }

  // Call the updateDateCompleted function if the Status column is edited
  if (col == headerIndices['Status']) {
    updateDateCompleted_(sheet, row, headerIndices['Status'], headerIndices['Done date'], headerIndices['Focus'], headerIndices['Done timestamp']);
  }

  // Call the updateUrgency function if the Status or Due Date columns are edited
  if (col == headerIndices['Status'] || col == headerIndices['Due date']) {
    updateUrgency_(sheet, headerIndices, row);
  }
}

// Function to focus on the selected row by toggling the "Focus" checkbox
function focusOnSelected() {
  var selection = sheet.getActiveRange();

  if (!selection) {
    SpreadsheetApp.getUi().alert('Please select a row to focus on.');
    return;
  }

  var row = selection.getRow();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var activeTaskColIndex = headers.indexOf('Focus') + 1;

  // Toggle the "Focus" checkbox for the selected row
  sheet.getRange(row, activeTaskColIndex).setValue(true);

  // Uncheck other rows
  uncheckOtherCheckboxes(row, sheet, activeTaskColIndex);
}

function uncheckOtherCheckboxes(rowToIgnore, sheet, activeTaskColIndex) {
  var range = sheet.getRange(2, activeTaskColIndex, sheet.getLastRow() - 1); // All rows in the "Focus" column
  var values = range.getValues();
  var updates = [];

  values.forEach(function(row, index) {
    if (index + 2 !== rowToIgnore && row[0] === true) {
      updates.push([false]);  // Set to false if it's not the current row
    } else {
      updates.push([row[0]]); // Leave the value unchanged
    }
  });

  range.setValues(updates); // Write back only the modified checkboxes
}

function updateDateCompleted_(sheet, row, statusColIndex, completionDateColIndex, focusColIndex) {
  // Get the status, completion date, and focus status for the given row
function updateDateCompleted_(sheet, row, statusColIndex, completionDateColIndex, focusColIndex, doneTimestampColIndex) {
  // Get the status, completion date, focus status, and timestamp for the given row
  var status = sheet.getRange(row, statusColIndex).getValue();
  var completionDateCell = sheet.getRange(row, completionDateColIndex);
  var focusCell = sheet.getRange(row, focusColIndex);
  var doneTimestampCell = sheet.getRange(row, doneTimestampColIndex);

  // If status is 'Completed' and there's no completion date, set the current date and time
  if (status == "Completed" && completionDateCell.getValue() == "") {
    var currentDate = new Date();
    var doneDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "MM-dd-yyyy");
    var doneTimestamp = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "MM-dd-yyyy HH:mm:ss");
    completionDateCell.setValue(doneDate);
    doneTimestampCell.setValue(doneTimestamp);

    // Set focus to false
    focusCell.setValue(false);
  }
  // If status is changed away from 'Completed', clear the completion date and timestamp
  else if (status != "Completed") {
    completionDateCell.setValue("");
    doneTimestampCell.setValue("");
  }
}

// Refactored function to calculate urgency for a single row
function calculateUrgency_(status, dueDate) {
  var today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight for accurate comparison

  if (status === "Completed") {
    return ""; // Clear urgency if status is "Completed"
  }

  var dueDateObj = new Date(dueDate);
  if (isNaN(dueDateObj)) {
    return ""; // If the date is empty or invalid, leave it blank
  }

  dueDateObj.setHours(0, 0, 0, 0); // Normalize to midnight

  var timeDiff = dueDateObj.getTime() - today.getTime();
  var dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)); // Difference in days

  if (dayDiff < 0) {
    return "U0 Critical";
  } else if (dayDiff === 0) {
    return "U1 Urgent";
  } else if (dayDiff <= 3) {
    return "U2 High";
  } else if (dayDiff <= 7) {
    return "U3 Medium";
  } else {
    return "U4 Low";
  }
}

function updateUrgency_(sheet, headerIndices, row) {
  var status = sheet.getRange(row, headerIndices['Status']).getValue();
  var dueDate = sheet.getRange(row, headerIndices['Due date']).getValue();
  var urgency = calculateUrgency_(status, dueDate);

  // Set the calculated urgency
  sheet.getRange(row, headerIndices['Urgency']).setValue(urgency);
}

// Optimized function to refresh urgency for all tasks
function refreshUrgency(hideAlert = false) {
  var headerIndices = getCachedHeaders(sheet);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    if (!hideAlert) SpreadsheetApp.getUi().alert('No tasks to refresh.');
    return;
  }
  var dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  var data = dataRange.getValues();

  var updatedUrgency = [];

  // Loop through all rows in the data array
  for (var i = 0; i < data.length; i++) {
    var status = data[i][headerIndices['Status'] - 1];
    var dueDate = data[i][headerIndices['Due date'] - 1];

    // Calculate urgency and update the data array
    updatedUrgency.push([calculateUrgency_(status, dueDate)]);
  }

  // Write the updated urgency values back to the sheet in one operation
  sheet.getRange(2, headerIndices['Urgency'], updatedUrgency.length, 1).setValues(updatedUrgency);

  if (!hideAlert) SpreadsheetApp.getUi().alert('Urgency has been refreshed for all tasks.');
}

function createDummyTask(){
  var dummyData = {
    task: "Test task made with createDummyTask()", // Dummy task
    estimate: "small",      // Dummy estimate
    priority: "P3",         // Dummy priority
    status: "Blocked",      // Dummy status
    dueDate: "12/31/2024"   // Dummy due date
  };

  createTask(dummyData);
}

function createTask(data) {
  var start_time = new Date().getTime();
  try {
    var lastRow = sheet.getLastRow() + 1;
    Logger.log('Step: "Get Last Row" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

    var headerIndices = getCachedHeaders(sheet);
    Logger.log('Step: "Get Cached Headers" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

    var currentDate = new Date();
    var addedDate = data.addedDate || Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "MM-dd-yyyy");
    var addedDatetime = data.formattedDatetime || Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "MM-dd-yyyy HH:mm:ss");
    var doneDate = data.doneDate || (data.status === "Completed" ? addedDate : '');
    Logger.log('Step: "Format Dates" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

    var urgency = data.urgency || calculateUrgency_(data.status, data.dueDate);
    Logger.log('Step: "Calculate Urgency" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

    Logger.log(`  data.uuid: ${data.uuid}`)

    var uuid = data.uuid || Utilities.getUuid();

    Logger.log('Header Indices: ' + JSON.stringify(headerIndices));

    var rowData = [];
    rowData[headerIndices['Task'] - 1] = data.task || '';
    rowData[headerIndices['Estimate'] - 1] = data.estimate || '';
    rowData[headerIndices['Priority'] - 1] = data.priority || '';
    rowData[headerIndices['Status'] - 1] = data.status || '';
    rowData[headerIndices['Due date'] - 1] = data.dueDate || '';
    rowData[headerIndices['Urgency'] - 1] = urgency;
    rowData[headerIndices['Added date'] - 1] = addedDate;
    rowData[headerIndices['Done date'] - 1] = doneDate;
    rowData[headerIndices['Timestamp'] - 1] = addedDatetime;
    rowData[headerIndices['Unique identifier'] - 1] = uuid;
    Logger.log('Step: "Prepare Row Data" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

    // Ensure that all columns are filled, default to empty strings if undefined
    for (var i = 0; i < Object.keys(headerIndices).length; i++) {
      if (rowData[i] === undefined) {
        rowData[i] = '';
      }
    }

    sheet.getRange(lastRow, 1, 1, Object.keys(headerIndices).length).setValues([rowData]);
    Logger.log('Step: "Write Data to Sheet" Execution time: ' + (new Date().getTime() - start_time) + ' ms');

    return "Success";
  } catch (error) {
    Logger.log("Error in createTask: " + error.message);
    throw new Error('Failed to create task: ' + error.message);
  }
}