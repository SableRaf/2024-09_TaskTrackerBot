#!/bin/bash

if [[ "$0" == "$BASH_SOURCE" ]]; then
    echo "You must source this script for the virtual environment to remain activated."
    echo "Run: source setup.sh or . setup.sh"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "env" ]; then
  echo "Creating virtual environment..."
  python3 -m venv env
else
  echo "Virtual environment already exists."
fi

# Activate the virtual environment
echo "Activating virtual environment..."
source env/bin/activate

# Install dependencies
echo "Installing dependencies from requirements.txt..."
pip3 install -r requirements.txt

# Provide feedback that the bot is starting
echo "Starting the Telegram bot..."
python3 telegramBot.py