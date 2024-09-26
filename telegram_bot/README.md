# Telegram Bot

## Requirements

- A linux server (a simple Raspberry Pi is fine)
- Python 3
- `python3-venv` for creating virtual environments
- Telegram bot token (from BotFather)
- OpenAI API key

## Setup Instructions

1. **Clone the repository** and navigate to the project directory:

   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Run the setup script** to install dependencies and create a virtual environment:

   ```bash
   source setup.sh
   ```

   This script will:
   - Create a Python virtual environment if one doesn't exist.
   - Activate the virtual environment.
   - Install the required Python dependencies from `requirements.txt`.
   - Start the Telegram bot.

3. **Optional: Set up auto-start on boot**

   If you're running this bot on a Raspberry Pi and want it to start automatically after a reboot, you can run the `setup_autostart.sh` script:

   ```bash
   bash setup_autostart.sh
   ```

   This will:
   - Create a `systemd` service to manage the bot.
   - Enable and start the service, ensuring the bot runs on boot.

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

## Troubleshooting

`telegram.error.Conflict: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running`

To resolve this, stop the bot and run the following command to clear the pending updates:

https://api.telegram.org/bot<bot_token>/getUpdates?offset=-1