#!/bin/bash

# Check for running bot instances and stop them
echo "Checking for existing running instances of the bot..."
PIDS=$(pgrep -f "telegramBot.py")

if [ -n "$PIDS" ]; then
    echo "Stopping existing bot instances: $PIDS"
    sudo kill -9 $PIDS
    sleep 2
    # Check if any processes are still running
    PIDS=$(pgrep -f "telegramBot.py")
    if [ -n "$PIDS" ]; then
        echo "Failed to stop some instances. Exiting."
        exit 1
    else
        echo "All previous instances of the bot have been stopped."
    fi
else
    echo "No existing bot instances found."
fi