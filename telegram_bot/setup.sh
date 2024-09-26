#!/bin/bash

# Help message
show_help() {
    echo "Usage: ./setup.sh [-v] [-a]"
    echo "-v  (Optional) Create and activate virtual environment"
    echo "-a  (Optional) Set bot to autostart on reboot"
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
      exit 1
      ;;
  esac
done

# Make the kill_bot_instances.sh script executable if it is not
if [ ! -x "kill_bot_instances.sh" ]; then
    echo "Making kill_bot_instances.sh executable..."
    chmod +x kill_bot_instances.sh
fi

# Stop and cleanup existing bot service and instances
./kill_bot_instances.sh

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

  # Check if pip is installed and up-to-date
  CURRENT_PIP_VERSION=$(pip --version | awk '{print $2}')
  LATEST_PIP_VERSION=$(curl -s https://pypi.org/pypi/pip/json | python3 -c "import sys, json; print(json.load(sys.stdin)['info']['version'])")

  if [ "$CURRENT_PIP_VERSION" == "$LATEST_PIP_VERSION" ]; then
    echo "The latest version of pip ($CURRENT_PIP_VERSION) is already installed."
  else
    echo "Updating pip to the latest version..."
    python3 -m pip install --upgrade pip
  fi
fi

# Install dependencies
if [ -f "requirements.txt" ]; then
  echo "Installing dependencies from requirements.txt..."
  pip3 install --break-system-packages -r requirements.txt
else
  echo "No requirements.txt found. Make sure the necessary dependencies are installed."
fi

# Start the bot only if autostart is not enabled
if ! $AUTOSTART; then
  echo "Starting the Telegram bot manually..."
  python3 telegramBot.py &
fi

# Autostart setup
if $AUTOSTART; then
  echo "Setting up autostart for the Telegram bot..."

  # Determine the user who invoked sudo, if any
  USER="${SUDO_USER:-$(whoami)}"

  # Verify that the user exists
  if id "$USER" &>/dev/null; then
      echo "Using user: $USER"
  else
      echo "User $USER does not exist. Exiting."
      exit 1
  fi

  # Define working directory
  WORKING_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

  # Create systemd service file in the current directory
  SERVICE_FILE="telegrambot.service"

  cat > $SERVICE_FILE <<EOL
[Unit]
Description=Telegram Bot
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKING_DIR
ExecStart=$WORKING_DIR/env/bin/python3 $WORKING_DIR/telegramBot.py
Restart=always
RestartSec=5
StandardOutput=append:$WORKING_DIR/telegrambot.log
StandardError=append:$WORKING_DIR/telegrambot.log
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOL

  # Move the service file to /etc/systemd/system/
  echo "Moving the service file to /etc/systemd/system/"
  sudo mv $SERVICE_FILE /etc/systemd/system/

  # Reload systemd to recognize the new service
  echo "Reloading systemd daemon..."
  sudo systemctl daemon-reload

  # Enable the service to start on boot
  echo "Enabling telegrambot service to start on boot..."
  sudo systemctl enable telegrambot

  # Start the telegrambot service
  echo "Starting telegrambot service..."
  sudo systemctl start telegrambot

  # Check the status of the service
  echo "Checking the status of telegrambot service..."
  sudo systemctl status telegrambot
fi