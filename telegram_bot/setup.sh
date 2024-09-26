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
BOT_PROCESS_NAME="telegramBot.py"

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

# Load .env file to get BOT_PROCESS_NAME
if [ -f ".env" ]; then
    echo "Loading .env file..."
    export $(grep -v '^#' .env | xargs)

    # Use the identifier if defined in the .env file
    if [ -n "$BOT_ID" ]; then
        BOT_PROCESS_NAME="telegramBot.py-$BOT_ID"
    fi
fi

# Check for running bot instances and stop them
echo "Checking for existing running instances of the bot..."
PIDS=$(pgrep -f $BOT_PROCESS_NAME)

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
  echo "Installing dependencies from requirements.txt in the virtual environment..."
  pip3 install --break-system-packages -r requirements.txt
else
  echo "No requirements.txt found. Make sure the necessary dependencies are installed."
fi

# Start the bot with the unique identifier
echo "Starting the Telegram bot with process name: $BOT_PROCESS_NAME"
python3 $BOT_PROCESS_NAME &

# Autostart setup
if $AUTOSTART; then
  echo "Setting up autostart for the Telegram bot..."

  WORKING_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
  USER="pi"

  # Create systemd service file
  SERVICE_FILE="/etc/systemd/system/$BOT_PROCESS_NAME.service"

  sudo bash -c "cat > $SERVICE_FILE" <<EOL
[Unit]
Description=Telegram Bot ($BOT_PROCESS_NAME)
After=network.target

[Service]
User=$USER
WorkingDirectory=$WORKING_DIR
ExecStart=/bin/bash -c 'source $WORKING_DIR/env/bin/activate && python3 $WORKING_DIR/$BOT_PROCESS_NAME'
Restart=always

[Install]
WantedBy=multi-user.target
EOL

  # Reload systemd, enable and start the service
  sudo systemctl daemon-reload
  sudo systemctl enable $BOT_PROCESS_NAME
  sudo systemctl start $BOT_PROCESS_NAME

  echo "Telegram bot service setup and started."
fi