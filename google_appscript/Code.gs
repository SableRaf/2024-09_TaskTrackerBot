// Code.gs

// Create custom menu item(s)
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Task Manager')
      .addItem('Create New Task', 'openTaskDialog')
      .addItem('Focus on Selected', 'focusOnSelected')
      .addItem('Refresh Urgency', 'refreshUrgency')
      .addToUi();
  refreshUrgency(true);
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Log the incoming data to see if it is parsed correctly
  Logger.log("Incoming data: " + e.postData.contents);

  // Parse the incoming data and add a new row
  const parsedData = parseIncomingData(e.postData.contents);
  Logger.log("Parsed data: " + JSON.stringify(parsedData));
  
  createTask(parsedData);

  // Return a success message
  return ContentService.createTextOutput(`Success. Your task was added to the sheet.`);
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

// Function to set focus to the task input when the dialog opens
function setFocusToTaskInput() {
  const taskInput = document.getElementById('taskInput');
  if (taskInput) {
    taskInput.focus(); // Set focus on the input field
  }
}

// When the sheet gets edited
function onEdit(e) {
  var sheet = e ? e.source.getActiveSheet() : SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];  // Use the first sheet if no event
  
  // Get the headers from the first row
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Find the column indices for 'Status', 'Due date', 'Done date', and 'Added date'
  var statusColIndex = headers.indexOf('Status') + 1;
  var completionDateColIndex = headers.indexOf('Done date') + 1;
  var dueDateColIndex = headers.indexOf('Due date') + 1;
  var urgencyColIndex = headers.indexOf('Urgency') + 1;
  var addedDateColIndex = headers.indexOf('Added date') + 1;
  var activeTaskColIndex = headers.indexOf('Focus') + 1;
  
  // Get the column and row of the edited cell
  var col = e.range.getColumn();
  var row = e.range.getRow();

  // Detect if a checkbox is switched to TRUE and uncheck others (radio button behavior)
  if (col == activeTaskColIndex && e.oldValue === "false" && e.value === "TRUE") {
    uncheckOtherCheckboxes(row, sheet, activeTaskColIndex); // Uncheck other checkboxes in the "Focus" column
  }

  // Detect if a new row is added and update the "Added date" column
  if (row > 1 && col == 1 && sheet.getRange(row, 1).getValue() != "") { // Check if first column is filled (assumed new row)
    updateAddedDate_(sheet, addedDateColIndex, row);
  }

  // Call the updateDateCompleted function if the Status column is edited
  if (col == statusColIndex) {
    updateDateCompleted_(sheet, row, statusColIndex, completionDateColIndex);
  }

  // Call the updateUrgency function if the Status or Due Date columns are edited
  if (col == statusColIndex || col == dueDateColIndex) {
    updateUrgency_(sheet, headers, row);
  }
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

function updateDateCompleted_(sheet, row, statusColIndex, completionDateColIndex) {
  // Get the status and completion date for the given row
  var status = sheet.getRange(row, statusColIndex).getValue();
  var completionDateCell = sheet.getRange(row, completionDateColIndex);

  // If status is 'Completed' and there's no completion date, set the current date
  if (status == "Completed" && completionDateCell.getValue() == "") {
    var currentDate = new Date();
    var formattedDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "MM-dd-yyyy");
    completionDateCell.setValue(formattedDate);
  }
  // If status is changed away from 'Completed', clear the completion date
  else if (status != "Completed") {
    completionDateCell.setValue("");
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

// Optimized updateUrgency_ function to handle a single row
function updateUrgency_(sheet, headers, row) {
  var statusColIndex = headers.indexOf('Status') + 1;
  var dueDateColIndex = headers.indexOf('Due date') + 1;
  var urgencyColIndex = headers.indexOf('Urgency') + 1;

  var status = sheet.getRange(row, statusColIndex).getValue();
  var dueDate = sheet.getRange(row, dueDateColIndex).getValue();
  var urgency = calculateUrgency_(status, dueDate);

  // Set the calculated urgency
  sheet.getRange(row, urgencyColIndex).setValue(urgency);
}

// Optimized function to refresh urgency for all tasks
function refreshUrgency(hideAlert = false) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];  // Get the first sheet by default
  
  // Get the headers from the first row
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Get all data from the sheet at once
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    if (!hideAlert) SpreadsheetApp.getUi().alert('No tasks to refresh.');
    return;
  }
  var dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  var data = dataRange.getValues();
  
  // Find the column indices for 'Status', 'Due date', and 'Urgency'
  var statusColIndex = headers.indexOf('Status');
  var dueDateColIndex = headers.indexOf('Due date');
  var urgencyColIndex = headers.indexOf('Urgency');

  // Prepare an array to hold updated urgency values
  var updatedUrgency = [];

  // Loop through all rows in the data array
  for (var i = 0; i < data.length; i++) {
    var status = data[i][statusColIndex];
    var dueDate = data[i][dueDateColIndex];
    
    // Calculate urgency and update the data array
    updatedUrgency.push([calculateUrgency_(status, dueDate)]);
  }
  
  // Write the updated urgency values back to the sheet in one operation
  sheet.getRange(2, urgencyColIndex + 1, updatedUrgency.length, 1).setValues(updatedUrgency);
  
  // Show a message when refresh is complete
  if (!hideAlert) SpreadsheetApp.getUi().alert('Urgency has been refreshed for all tasks.');
}

function updateAddedDate_(sheet, addedDateColIndex, row) {
  var addedDateCell = sheet.getRange(row, addedDateColIndex);

  // If the "Added date" cell is empty, set the current date
  if (addedDateCell.getValue() == "") {
    var currentDate = new Date();
    var formattedDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "MM-dd-yyyy");
    addedDateCell.setValue(formattedDate);
  }
}

function createDummyTask(){
  var dummyData = {
    task: "Test Task",      // Dummy task
    estimate: "small",      // Dummy estimate
    priority: "P3",         // Dummy priority
    status: "Blocked",      // Dummy status
    dueDate: "12/31/2024"   // Dummy due date
  };

  createTask(dummyData);
}

// Optimized createTask function (as defined above)
function createTask(data) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow() + 1; // Add to the next row

    // Get the headers to find the column indices
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Column indices (add +1 because JavaScript arrays are 0-based, and Google Sheets are 1-based)
    var taskCol = headers.indexOf('Task') + 1;
    var estimateCol = headers.indexOf('Estimate') + 1;
    var priorityCol = headers.indexOf('Priority') + 1;
    var statusCol = headers.indexOf('Status') + 1;
    var dueDateCol = headers.indexOf('Due date') + 1;
    var urgencyCol = headers.indexOf('Urgency') + 1;
    var addedDateCol = headers.indexOf('Added date') + 1;
    var doneDateCol = headers.indexOf('Done date') + 1;

    // Automatically add today's date in the "Added date" column
    var currentDate = new Date();
    var formattedDate = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), "MM-dd-yyyy");

    // Determine if the task is completed to set the "Done date"
    var doneDate = (data.status === "Completed") ? formattedDate : '';

    // Calculate urgency based on status and due date
    var urgency = calculateUrgency_(data.status, data.dueDate);

    // Create an array corresponding to the order of columns in the sheet
    var rowData = [];
    rowData[taskCol - 1] = data.task || '';           // Set task or empty string
    rowData[estimateCol - 1] = data.estimate || '';   // Set estimate or empty string
    rowData[priorityCol - 1] = data.priority || '';   // Set priority or empty string
    rowData[statusCol - 1] = data.status || '';       // Set status or empty string
    rowData[dueDateCol - 1] = data.dueDate || '';     // Set due date or empty string
    rowData[urgencyCol - 1] = urgency;                // Set calculated urgency
    rowData[addedDateCol - 1] = formattedDate;        // Set added date
    rowData[doneDateCol - 1] = doneDate;              // Set done date if applicable

    // Ensure all columns are filled to match the sheet's structure
    for (var i = 0; i < headers.length; i++) {
      if (rowData[i] === undefined) {
        rowData[i] = '';
      }
    }

    // Write the entire row of data in one operation
    sheet.getRange(lastRow, 1, 1, headers.length).setValues([rowData]);

    return "Success"; // Return success for the client-side success handler
  } catch (error) {
    Logger.log("Error in createTask: " + error.message);
    throw new Error('Failed to create task: ' + error.message);
  }
}

// Function to focus on the selected row by toggling the "Focus" checkbox
function focusOnSelected() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
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