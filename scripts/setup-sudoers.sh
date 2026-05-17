#!/bin/bash
set -e
# osascript runs this as root; whoami would be "root" — use console login or env from app.
USER_NAME="${FOCUSFLOW_USER:-$(stat -f '%Su' /dev/console)}"
RULE="${USER_NAME} ALL=(ALL) NOPASSWD: /bin/cp * /etc/hosts, /bin/chmod 644 /etc/hosts"
if [ "$(id -u)" -eq 0 ]; then
  printf '%s\n' "$RULE" > /etc/sudoers.d/focusflow
  chmod 440 /etc/sudoers.d/focusflow
else
  printf '%s\n' "$RULE" | sudo tee /etc/sudoers.d/focusflow > /dev/null
  sudo chmod 440 /etc/sudoers.d/focusflow
fi
