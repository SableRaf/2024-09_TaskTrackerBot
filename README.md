# Task Tracker Bot

## Google App Script

### Step 1: Create the Google Sheet

   - Open the [provided template](https://docs.google.com/spreadsheets/d/1EE29NTNMOcg0yYRAXqDZPSOBJadOVLUY6OQPD0-0d2U/edit?gid=0#gid=0), make a copy (`File > Make a copy`) and save it in your Google Drive.
   - Rename the sheet to something meaningful (e.g., `Task Tracker`).
   - Note the Sheet ID from the URL (it will be needed for the bot setup). For example:
      `https://docs.google.com/spreadsheets/d/<sheet-id>/edit` where `<sheet-id>` is the unique identifier.

> [!NOTE]
> The App Script will be copied along with the sheet, so you don't need to create a new script.

### Step 2: Deploy the Google App Script

   - In the Google Apps Script editor, click on **Deploy > New deployment**.
   - Under **Select type**, choose **Web app**.
   - Fill out the required fields:
     - **Description**: Describe the deployment (e.g., `Task Tracker Bot Web App`).
     - **Execute as**: Choose **Me**.
     - **Who has access**: Choose **Anyone** to allow POST requests from your bot.
   - Click **Deploy**.

> [!IMPORTANT]
> If you make any changes to the script, you will need to create a new deployment for the changes to take effect.

**Authorize the App**:
   - The first time you deploy, you may be asked to **authorize the app**. Follow the prompts to grant the necessary permissions.

**Copy the Deployment URL**:
   - After deployment, you will receive a **Web App URL**. This is the URL you will use to connect to the Google App Script from your bot.
   - **Copy the URL** and save it for later use (it will be needed for the bot setup).

## OpenAI API

Go to the [OpenAI API](https://platform.openai.com/docs/guides/authentication) and create an account. Once you have an account, you can generate a Project API key from the dashboard. Note down your API key as it will be needed for the bot setup.

> [!WARNING]
> Make sure to save your API key in a secure place, treat it like a password and **do not share it with anyone**.

## Telegram Bot

### Requirements

- A linux server (a simple Raspberry Pi is fine)
- Telegram bot token ([how to obtain a Telegram bot token](https://core.telegram.org/bots/tutorial#obtain-your-bot-token))
- OpenAI API key (from the OpenAI dashboard)
- The ID of the target Sheet (from Google Sheets URL)
- The URL of the Google Apps Script web app (from the Apps Script editor)

### Setup Instructions

1. ssh into the server

2. **Clone the repository** and navigate to the project directory:

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

3. **Create a `.env` file** or copy the sample file

4. **Edit the `.env` file** and fill in the required values:

    - `GOOGLE_SHEET_ID`: The ID of the Google Sheet where tasks are tracked.
    - `OPENAI_API_KEY`: The OpenAI API key obtained from the OpenAI dashboard.
    - `TELEGRAM_BOT_TOKEN`: The Telegram bot token obtained from BotFather.
    - `GOOGLE_APP_SCRIPT_URL`: The URL of the Google Apps Script web app deployed in the previous section.

5. **Run the setup script** with arguments to configure the environment and/or auto-start the bot:

   ```bash
   bash ./setup.sh [-v] [-a]
   ```

   - `-v` : (Optional) Create and activate a Python virtual environment.
   - `-a` : (Optional) Set up the bot to start automatically after a reboot.

   Example for creating a virtual environment and enabling auto-start:

   ```bash
   bash ./setup.sh -v -a
   ```

   This script will set up the environment, install the required dependencies, and configure the bot to run as a service if the auto-start option is enabled.

## Managing the Bot Service

- Check the status of the bot service:

  ```bash
  sudo systemctl status telegrambot
  ```

- **Stop the bot service**:

  ```bash
  bash ./stop_bot_service.sh
  ```

  This script will stop the bot service and disable it from auto-starting on boot.

## Managing the Bot Instance(s)

### Check running instances

To check if instances of the bot are running:

```bash
ps aux | grep telegramBot.py
```

### Kill running instances

    To kill the bot:

```bash
sudo kill -9 $(ps aux | grep telegramBot.py | grep -v grep | awk '{print $2}')
```

Note: running the setup.sh script should also kill any running instances of the bot.

### Troubleshooting

#### Bot instance conflict

If you encounter the error `telegram.error.Conflict: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running`, it means there are multiple instances of the bot trying to fetch updates.

Make sure to stop any other instances of the bot running using the same Telegram bot token. If you are running the bot from multiple terminals, services, or physical machines, ensure that only one instance is active at a time.

To clear the pending updates from the Telegram server, you can use the following URL in your browser:

```
https://api.telegram.org/bot<bot_token>/getUpdates?offset=-1
```
Replace `<bot_token>` with your actual bot token.

This is normally handled by the `setup.sh` script, but if you encounter this error, you can manually clear the updates using the above URL.

#### Externally managed environment error

If you see the error `error: externally-managed-environment` during the installation of Python packages, it means your system has restricted package installations to protect the Python environment. To fix this, ensure that all dependencies are installed inside a virtual environment using the `-v` option:

```bash
source setup.sh -v
```

This will ensure that the virtual environment is used for installing Python packages and avoids conflicts with the system's package management.

#### PATH Warnings

If you see warnings like `The script xyz is installed in '/home/yourusername/.local/bin' which is not on PATH`, this means some executables were installed in a directory not included in your system’s global `PATH`. This is typically not an issue if you're running the bot inside a virtual environment, as the environment handles the paths internally and the warnings can safely be ignored.

However, if you need to use these commands outside the virtual environment, consider adding `/home/yourusername/.local/bin` to your `PATH` by modifying your `.bashrc` file:

```bash
export PATH=$PATH:/home/yourusername/.local/bin
```

This will ensure the executables are accessible globally.

#### Issues with the virtual environment

If you encounter issues inside the virtual environment, you can deactivate it using the command:

```bash
deactivate
```

This will return you to the system's default Python environment.

If you need to delete the virtual environment, you can simply remove the `env` directory:

```bash
rm -rf env
```