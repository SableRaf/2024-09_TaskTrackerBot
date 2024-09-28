import os
import json
import logging
from openai import OpenAI
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Load task extraction schema from external file
with open('task_schema.json', 'r') as schema_file:
    task_function = json.load(schema_file)

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