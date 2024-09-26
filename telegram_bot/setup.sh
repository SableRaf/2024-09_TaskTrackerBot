#!/bin/bash

# Help message
show_help() {
    echo "Usage: source setup.sh [-v] [-a]"
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

# Check for updates from the remote repository
echo "Checking for updates from the remote repository..."
git fetch origin

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "Updates are available from the remote repository."

    echo    # Move to a new line
    # Show how many commits behind the local branch is
    COMMITS_BEHIND=$(git rev-list --count $LOCAL..$REMOTE)
    echo "You are $COMMITS_BEHIND commits behind the remote branch."

    # Show the last few commits from the remote
    echo    # Move to a new line
    echo "Showing the latest of $COMMITS_BEHIND new commits:"
    echo    # Move to a new line
    git log --oneline $LOCAL..$REMOTE -n 3

    # Ask the user if they want to pull the latest changes
    echo    # Move to a new line
    read -p "Do you want to pull the latest changes? (y/n): " -n 1 -r
    echo    # Move to a new line
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Pulling the latest changes..."
        git pull origin
        if [ $? -ne 0 ]; then
            echo "Failed to pull the latest changes. Exiting."
            return 1
        fi
    else
        echo "Continuing without pulling the changes."
    fi
else
    echo "No updates available. You are up to date."
fi

# Check for running bot instances and stop them
echo "Checking for existing running instances of the bot..."
PIDS=$(pgrep -f "telegramBot.py")

if [ -n "$PIDS" ]; then
    echo "Stopping existing bot instances: $PIDS"
    kill $PIDS
else
    echo "No existing bot instances found."
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

  # Install pip3 in the virtual environment if not present
  echo "Ensuring pip is available in the virtual environment..."
  curl https://bootstrap.pypa.io/get-pip.py | python3
fi

# Install dependencies
if [ -f "requirements.txt" ]; then
  echo "Installing dependencies from requirements.txt..."
  pip3 install --break-system-packages -r requirements.txt
else
  echo "No requirements.txt found. Make sure the necessary dependencies are installed."
fi

# Start the bot
echo "Starting the Telegram bot..."
python3 telegramBot.py &

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
      return 1
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