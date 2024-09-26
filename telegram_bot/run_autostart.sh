#!/bin/bash

# Get the current directory where the script is located
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
