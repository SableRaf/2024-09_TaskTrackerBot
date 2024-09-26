# Task Tracker Bot

## Google App Script

TBD

## Telegram Bot

### Requirements

- A linux server (a simple Raspberry Pi is fine)
- Telegram bot token (from BotFather)
- OpenAI API key (from the OpenAI dashboard)
- The ID of the target Sheet (from Google Sheets URL)
- The URL of the Google Apps Script web app (from the Apps Script editor)

### Setup Instructions

1. **Create a `.env` file** in the project directory based on the `.evn-template` file and fill in the required values.

2. **Clone the repository** and navigate to the project directory:

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

3. **Run the setup script** with arguments to configure the environment and/or auto-start the bot:

   ```bash
   source setup.sh [-v] [-a]
   ```

   - `-v` : (Optional) Create and activate a Python virtual environment.
   - `-a` : (Optional) Set up the bot to start automatically after a reboot.

   Example for creating a virtual environment and enabling auto-start:

   ```bash
   source setup.sh -v -a
   ```

   This script will:
   - Ensure `pip3` is installed.
   - Create a Python virtual environment if one doesn't exist (when `-v` is provided).
   - Activate the virtual environment.
   - Install the required Python dependencies from `requirements.txt`.
   - Optionally, set up the bot to auto-start on boot via `systemd` (when `-a` is provided).
   - Start the Telegram bot.

4. **Managing the bot service (if auto-start is enabled)**

   If the auto-start option (`-a`) was used, the bot will run as a `systemd` service.

## Managing the Bot Service

- **View service logs**:

  To check the logs of the bot running as a service:

  ```bash
  sudo journalctl -u telegrambot.service
  ```

  To follow logs in real-time:

  ```bash
  sudo journalctl -u telegrambot.service -f
  ```

- **Stop the bot service**:

  To stop the bot:

  ```bash
  sudo systemctl stop telegrambot
  ```

- **Disable the bot from auto-starting on boot**:

  To prevent the bot from automatically starting after a reboot:

  ```bash
  sudo systemctl disable telegrambot
  ```

### Managing the Bot Service

- **View service logs**:

  To check the logs of the bot running as a service:

  ```bash
  sudo journalctl -u telegrambot.service
  ```

  To follow logs in real-time:

  ```bash
  sudo journalctl -u telegrambot.service -f
  ```

- **Stop the bot service**:

  To stop the bot:

  ```bash
  sudo systemctl stop telegrambot
  ```

- **Disable the bot from auto-starting on boot**:

  To prevent the bot from automatically starting after a reboot:

  ```bash
  sudo systemctl disable telegrambot
  ```

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