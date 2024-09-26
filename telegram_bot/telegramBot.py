import requests
from openai import OpenAI
import os
import json
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext, CallbackQueryHandler
import logging
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Define the function schema for function calling
task_function = {
    "name": "extract_task",
    "description": "Extracts task details from the user's input.",
    "parameters": {
        "type": "object",
        "properties": {
            "task": {
                "type": "string",
                "description": "The description of the task"
            },
            "estimate": {
                "type": "string",
                "enum": ["small", "medium", "large", "break it down"],
                "description": "Estimated effort for the task"
            },
            "priority": {
                "type": "string",
                "enum": ["P0", "P1", "P2", "P3"],
                "description": "Priority level of the task"
            },
            "status": {
                "type": "string",
                "enum": ["Not started", "In progress", "Blocked", "Completed"],
                "description": "Current status of the task"
            },
            "dueDate": {
                "type": "string",
                "description": "Due date for the task in YYYY-MM-DD format"
            }
        },
        "required": ["task", "estimate", "priority", "status", "dueDate"]
    }
}

def extract_task_data(task_description):
    today = datetime.today().strftime('%Y-%m-%d')
    system_message = {
        "role": "system",
        "content": f"You are a task extraction assistant. Extract the task details from the user's input according to the provided schema. Today's date is {today}. If the due date is not explicitly mentioned, it might be implied or related to today's date."
    }
    user_message = {
        "role": "user",
        "content": task_description
    }

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[system_message, user_message],
            functions=[task_function],
            function_call={"name": "extract_task"}
        )

        message = response.choices[0].message
        function_call = getattr(message, "function_call", None)

        if function_call:
            function_args = json.loads(function_call.arguments)
            logger.info(f"Extracted task data: {function_args}")
            return function_args, None
        else:
            logger.error("No function call found in the response.")
            return None, "No task data could be extracted."

    except openai.APIConnectionError as e:
        logger.error(f"APIConnectionError: {str(e)}")
        return None, "API connection error occurred."
    except openai.RateLimitError as e:
        logger.error(f"RateLimitError: {str(e)}")
        return None, "Rate limit exceeded. Please wait and try again."
    except openai.APIStatusError as e:
        logger.error(f"APIStatusError: {e.status_code} - {e.response}")
        return None, f"API error: {e.status_code}."
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return None, f"Unexpected error: {str(e)}"

# Function to create buttons for confirmation
def create_confirmation_buttons():
    keyboard = [
        [
            InlineKeyboardButton("Add Task", callback_data='add_task'),
            InlineKeyboardButton("Cancel", callback_data='cancel_task')
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

# Define the start function to greet the user
def start(update: Update, context: CallbackContext):
    update.message.reply_text('Hello! I am your task management bot. Use /addtask to create a new task.')

# Function to handle adding a new task
def add_task(update: Update, context: CallbackContext):
    update.message.reply_text('Please provide a task description:')
    context.user_data['awaiting_task'] = True

# Helper function to format the due date with special cases for today, tomorrow, and past dates
def format_due_date(due_date_obj):
    today = datetime.today()
    days_difference = (due_date_obj - today).days

    if days_difference == 0:
        return due_date_obj.strftime('%a, %b %d %Y') + " (Today)"
    elif days_difference == 1:
        return due_date_obj.strftime('%a, %b %d %Y') + " (Tomorrow)"
    elif days_difference > 1:
        return due_date_obj.strftime('%a, %b %d %Y') + f" ({days_difference} days from now)"
    else:
        return due_date_obj.strftime('%a, %b %d %Y') + f" ({abs(days_difference)} days ago)"

# Handle user input and gather task details from the LLM
def handle_task_input(update: Update, context: CallbackContext):
    if context.user_data.get('awaiting_task'):
        task_description = update.message.text

        # Extract structured data using the LLM
        task_data, error = extract_task_data(task_description)

        if task_data and task_data.get('dueDate'):
            # Parse the due date from the task data
            due_date_str = task_data['dueDate']
            due_date_obj = datetime.strptime(due_date_str, '%Y-%m-%d')

            # Format the due date using the helper function
            formatted_due_date = format_due_date(due_date_obj)

            # Format task details in a human-readable way
            task_summary = (
                f"*Task*: {task_data['task']}\n"
                f"*Estimate*: {task_data['estimate']}\n"
                f"*Priority*: {task_data['priority']}\n"
                f"*Status*: {task_data['status']}\n"
                f"*Due Date*: {formatted_due_date}"
            )

            # Ask for confirmation with buttons
            update.message.reply_text(
                f"Here is the task I understood:\n\n{task_summary}\n\nDo you want to add it?",
                reply_markup=create_confirmation_buttons(),
                parse_mode='Markdown'
            )

            # Save the task data to context for later confirmation
            context.user_data['task_data'] = task_data
        elif error:
            update.message.reply_text(f"Sorry, I couldn't process your task description. Reason: {error}")
        else:
            update.message.reply_text("Sorry, the task description is required. Please provide it.")

        context.user_data['awaiting_task'] = False


# Function to handle button clicks
def button_click_handler(update: Update, context: CallbackContext):
    query = update.callback_query
    task_data = context.user_data.get('task_data')

    if query.data == 'add_task' and task_data:
        # If the user confirmed, add the task to Google Sheet
        send_task_to_google_script(query, task_data)
    elif query.data == 'cancel_task':
        # If the user canceled
        query.edit_message_text(text="Task creation canceled.")

# Function to send task data to Google App Script
def send_task_to_google_script(update, task_data):
    google_app_script_url = os.getenv('GOOGLE_APP_SCRIPT_URL')

    try:
        # Send the request to the Google Apps Script
        response = requests.post(google_app_script_url, json=task_data)

        # Log the status code and full response text
        if response.status_code == 200:
            update.message.reply_text('Task has been successfully added to the Google Sheet.')
        else:
            update.message.reply_text(f"Failed to add the task. Server responded with status: {response.status_code}")

        logger.info(f"Response status code: {response.status_code}")
        logger.info(f"Response text: {response.text}")  # This prints the full response body

    except Exception as e:
        # Print any error that occurs
        logger.info(f"Error: {str(e)}")
        update.message.reply_text(f"Error: {str(e)}")

# Function to handle errors globally
def error_handler(update: Update, context: CallbackContext):
    logger.error(msg="Exception while handling an update:", exc_info=context.error)
    update.message.reply_text('An unexpected error occurred. Please try again later.')

def format_due_date(due_date_obj):
    # Normalize both dates to midnight to avoid time differences
    today = datetime.today().replace(hour=0, minute=0, second=0, microsecond=0)
    due_date_obj = due_date_obj.replace(hour=0, minute=0, second=0, microsecond=0)

    days_difference = (due_date_obj - today).days

    if days_difference == 0:
        return due_date_obj.strftime('%a, %b %d %Y') + " (Today)"
    elif days_difference == 1:
        return due_date_obj.strftime('%a, %b %d %Y') + " (Tomorrow)"
    elif days_difference > 1:
        return due_date_obj.strftime('%a, %b %d %Y') + f" ({days_difference} days from now)"
    else:
        return due_date_obj.strftime('%a, %b %d %Y') + f" ({abs(days_difference)} days ago)"


# Modify the main function to include the new command handler and error handler
def main():
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        logger.critical("TELEGRAM_BOT_TOKEN environment variable not set.")
        raise ValueError("TELEGRAM_BOT_TOKEN environment variable not set.")

    updater = Updater(bot_token, use_context=True)

    dp = updater.dispatcher
    dp.add_handler(CommandHandler("start", start))  # Register the /start command
    dp.add_handler(CommandHandler("addtask", add_task))  # Register the /addtask command
    dp.add_handler(MessageHandler(Filters.text & ~Filters.command, handle_task_input))  # Handle user input for task description
    dp.add_handler(CallbackQueryHandler(button_click_handler))  # Handle button clicks for confirmation
    dp.add_error_handler(error_handler)  # Register the error handler

    updater.start_polling()
    logger.info("Bot started polling.")
    updater.idle()

if __name__ == '__main__':
    main()