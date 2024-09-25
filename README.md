## Setup Instructions

Clone the repository locally and navigate to the project directory.

**Linux/Mac:** Run `source setup.sh` or `. setup.sh`

This will create a virtual environment, install dependencies, and start the bot automatically.

## Troubleshooting

`telegram.error.Conflict: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running`

To resolve this, stop the bot and run the following command to clear the pending updates:

https://api.telegram.org/bot<bot_token>/getUpdates?offset=-1