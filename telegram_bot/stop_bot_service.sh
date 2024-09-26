#!/bin/bash

echo "Stopping and disabling the telegrambot service..."
if sudo systemctl is-active --quiet telegrambot; then
    sudo systemctl stop telegrambot
    sudo systemctl disable telegrambot
    echo "Telegram bot service stopped and disabled."
else
    echo "No active telegrambot service found."
fi
