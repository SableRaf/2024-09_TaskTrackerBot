#!/bin/bash

# Help message
show_help() {
    echo "Usage: source setup.sh [-v] [-a]"
    echo "-v  Create and activate virtual environment"
    echo "-a  Set bot to autostart on reboot"
}

# Default values for flags
USE_VENV=false
AUTOSTART=false

# Parse command-line arguments
while getopts "va" opt; do
  case ${opt} in
    v )
      USE_VENV=true
      ;;
    a )
      AUTOSTART=true
      ;;
    \? )
      show_help
      return 1
      ;;
  esac
done

# Check if the script is sourced
if [[ "$0" == "$BASH_SOURCE" ]]; then
    echo "You must source this script for the virtual environment to remain activated."
    echo "Run: source setup.sh [-v] [-a]"
    return 1
fi

# Install pip3 if not found
if ! command -v pip3 &> /dev/null; then
    echo "pip3 could not be found, installing..."
    sudo apt update && sudo apt install -y python3-pip
else
    echo "pip3 is already installed."
fi

# Virtual environment setup
if $USE_VENV; then
  if [ ! -d "env" ]; then
    echo "Creating virtual environment..."
    python3 -m venv env
  else
    echo "Virtual environment already exists."
  fi

  # Activate the virtual environment
  echo "Activating virtual environment..."
  source env/bin/activate
fi

# Install dependencies
if [ -f "requirements.txt" ]; then
  echo "Installing dependencies from requirements.txt..."
  pip3 install -r requirements.txt
else
  echo "No requirements.txt found. Make sure the necessary dependencies are installed."
fi

# Start the bot
echo "Starting the Telegram bot..."
python3 telegramBot.py &

# Autostart setup
if $AUTOSTART; then
  echo "Setting up autostart for the Telegram bot..."

  WORKING_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  USER="pi"

  # Create systemd service file
  SERVICE_FILE="/etc/systemd/system/telegrambot.service"

  sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Telegram Bot
After=network.target

[Service]
User=$USER
WorkingDirectory=$WORKING_DIR
ExecStart=/bin/bash -c 'source $WORKING_DIR/env/bin/activate && python3 $WORKING_DIR/telegramBot.py'
Restart=always

[Install]
WantedBy=multi-user.target
EOL

  # Reload systemd, enable and start the service
  sudo systemctl daemon-reload
  sudo systemctl enable telegrambot
  sudo systemctl start telegrambot

  echo "Telegram bot service setup and started."
fi