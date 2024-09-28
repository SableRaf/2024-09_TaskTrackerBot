import os
import logging
from telegram import Update, BotCommand, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext, CallbackQueryHandler
from google_app_script import send_task_to_google_script
from task_extraction import extract_task_data
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

def create_confirmation_buttons():
    keyboard = [
        [
            InlineKeyboardButton("Add Task", callback_data='add_task'),
            InlineKeyboardButton("Cancel", callback_data='cancel_task')
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

def start(update: Update, context: CallbackContext):
    update.message.reply_text(
        'Hello! I am your task management bot. Use /addtask to add a new task.',
    )

def add_task(update: Update, context: CallbackContext):
    update.message.reply_text('Please provide a task description:')
    context.user_data['awaiting_task'] = True

def cancel(update: Update, context: CallbackContext):
    if context.user_data.get('awaiting_task'):
        context.user_data['awaiting_task'] = False
        update.message.reply_text('Task creation has been cancelled.')

    elif context.user_data.get('task_data'):
        query = update.callback_query

        if query:
            query.edit_message_text(text="Task creation has been cancelled.")
        elif context.user_data.get('confirmation_message_id'):
            chat_id = update.effective_chat.id
            message_id = context.user_data['confirmation_message_id']
            context.bot.delete_message(chat_id=chat_id, message_id=message_id)
            update.message.reply_text("Task creation has been cancelled.")

        context.user_data.pop('task_data', None)
        context.user_data.pop('confirmation_message_id', None)

    else:
        update.message.reply_text('No ongoing task creation to cancel.')

def handle_task_input(update: Update, context: CallbackContext):
    if context.user_data.get('awaiting_task'):
        task_description = update.message.text
        task_data, error = extract_task_data(task_description)

        if task_data and task_data.get('dueDate'):
            due_date_str = task_data['dueDate']
            due_date_obj = datetime.strptime(due_date_str, '%Y-%m-%d')

            formatted_due_date = format_due_date(due_date_obj)

            task_summary = (
                f"*Task*: {task_data['task']}\n"
                f"*Estimate*: {task_data['estimate']}\n"
                f"*Priority*: {task_data['priority']}\n"
                f"*Status*: {task_data['status']}\n"
                f"*Due Date*: {formatted_due_date}"
            )

            confirmation_message = update.message.reply_text(
                f"Here is the task I understood:\n\n{task_summary}\n\nDo you want to add it?",
                reply_markup=create_confirmation_buttons(),
                parse_mode='Markdown'
            )
            context.user_data['task_data'] = task_data
            context.user_data['confirmation_message_id'] = confirmation_message.message_id

        elif error:
            update.message.reply_text(f"Sorry, I couldn't process your task description. Reason: {error}")
        else:
            update.message.reply_text("Sorry, the task description is required. Please provide it.")

        context.user_data['awaiting_task'] = False

def button_click_handler(update: Update, context: CallbackContext):
    query = update.callback_query
    task_data = context.user_data.get('task_data')

    if query.data == 'add_task' and task_data:
        send_task_to_google_script(query, task_data)
    elif query.data == 'cancel_task':
        query.edit_message_text(text="Task creation canceled.")

def format_due_date(due_date_obj):
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

def main():
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        logger.critical("TELEGRAM_BOT_TOKEN environment variable not set.")
        raise ValueError("TELEGRAM_BOT_TOKEN environment variable not set.")

    updater = Updater(bot_token, use_context=True)
    dp = updater.dispatcher

    updater.bot.set_my_commands([
        BotCommand("start", "Start interacting with the bot"),
        BotCommand("addtask", "Add a new task"),
        BotCommand("cancel", "Cancel the current operation")
    ])

    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(CommandHandler("addtask", add_task))
    dp.add_handler(CommandHandler("cancel", cancel))
    dp.add_handler(MessageHandler(Filters.text & ~Filters.command, handle_task_input))
    dp.add_handler(CallbackQueryHandler(button_click_handler))

    updater.start_polling()
    logger.info("Bot started polling.")
    updater.idle()

if __name__ == '__main__':
    main()