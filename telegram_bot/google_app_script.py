import os
import requests
import logging

# Initialize logging
logger = logging.getLogger(__name__)

def send_task_to_google_script(query, task_data):
    google_app_script_url = os.getenv('GOOGLE_APP_SCRIPT_URL')

    try:
        response = requests.post(google_app_script_url, json=task_data)

        if response.status_code == 200:
            # Check response content to see if it indicates success or failure
            if "Success" in response.text:
                query.edit_message_text('Task has been successfully added to the Google Sheet.')
            else:
                query.edit_message_text("Failed to add the task. \n\n Server responded with: \n\n"
                                        f"`{response.text}`", parse_mode='Markdown')
        else:
            query.edit_message_text(f"Failed to add the task. Server responded with status: {response.status_code}")

        logger.info(f"Response status code: {response.status_code}")
        logger.info(f"Response text: {response.text}")

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        query.edit_message_text(f"Error: {str(e)}")
