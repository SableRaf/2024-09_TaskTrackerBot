#!/bin/bash

# Check for updates from the remote repository
echo "Checking for updates from the remote repository at $(git remote get-url origin)"
git fetch origin

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "WARNING: Updates are available from the remote repository."

    echo    # Move to a new line
    # Show how many commits behind the local branch is
    COMMITS_BEHIND=$(git rev-list --count $LOCAL..$REMOTE)
    echo "You are $COMMITS_BEHIND commits behind the remote branch."

    # Show the last few commits from the remote
    echo    # Move to a new line
    echo "Showing the latest of $COMMITS_BEHIND new commits:"
    echo    # Move to a new line
    git log --oneline $LOCAL..$REMOTE -n 3

    echo    # Move to a new line
    # Tell the user what to do next
    echo "To update your local repository, run the following command:"
    echo "$ git pull"
    echo    # Move to a new line

else
    echo "No updates available. You are up to date."
fi