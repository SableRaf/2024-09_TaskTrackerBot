import requests
from openai import OpenAI
import os
import json
from telegram import Update
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext
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

    # Get today's date
    today = datetime.today().strftime('%Y-%m-%d')

    # Modify the system message to include today's date
    system_message = {
        "role": "system",
        "content": f"You are a task extraction assistant. Extract the task details from the user's input according to the provided schema. Today's date is {today}. If the due date is not explicitly mentioned, it might be implied or related to today's date."
    }
    user_message = {
        "role": "user",
        "content": task_description
    }

    try:
        # Call the OpenAI API
        response = client.chat.completions.create(
            model="gpt-4",
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

# Define the start function to greet the user
def start(update: Update, context: CallbackContext):
    update.message.reply_text('Hello! I am your task management bot. Use /addtask to create a new task.')

# Function to handle adding a new task
def add_task(update: Update, context: CallbackContext):
    update.message.reply_text('Please provide a task description:')
    context.user_data['awaiting_task'] = True

# Handle user input and gather task details from the LLM
def handle_task_input(update: Update, context: CallbackContext):
    if context.user_data.get('awaiting_task'):
        task_description = update.message.text

        # Extract structured data using the LLM
        task_data, error = extract_task_data(task_description)

        if task_data and task_data.get('task'):
            # Send the data to the Google App Script
            send_task_to_google_script(update, task_data)
        elif error:
            update.message.reply_text(f"Sorry, I couldn't process your task description. Reason: {error}")
        else:
            update.message.reply_text("Sorry, the task description is required. Please provide it.")

        context.user_data['awaiting_task'] = False

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

        # Print the full response text for debugging
        logger.info(f"Response status code: {response.status_code}")
        logger.info(f"Response text: {response.text}")  # This prints the full response body

    except Exception as e:
        # Print any error that occurs
        logger.info(f"Error: {str(e)}")
        update.message.reply_text(f"Error: {str(e)}")

# Function to handle errors globally
def error_handler(update: Update, context: CallbackContext):
    """Log the error and send a message to the user."""
    logger.error(msg="Exception while handling an update:", exc_info=context.error)
    update.message.reply_text('An unexpected error occurred. Please try again later.')

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
    dp.add_error_handler(error_handler)  # Register the error handler

    updater.start_polling()
    logger.info("Bot started polling.")
    updater.idle()

if __name__ == '__main__':
    main()