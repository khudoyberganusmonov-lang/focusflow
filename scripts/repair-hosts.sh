#!/bin/bash
# Restores macOS system /etc/hosts entries removed by a bad FocusFlow write.
set -e
REPAIR_FILE="$(mktemp /tmp/focusflow-hosts-repair.XXXXXX)"
cat > "$REPAIR_FILE" <<'EOF'
##
# Host Database
#
# localhost is used to configure the loopback interface
# when the system is booting.  Do not change this entry.
##
127.0.0.1	localhost
255.255.255.255	broadcasthost
::1             localhost
EOF
osascript -e "do shell script \"cp '${REPAIR_FILE//\'/\'\\\'\'}' /etc/hosts && chmod 644 /etc/hosts\" with administrator privileges"
rm -f "$REPAIR_FILE"
echo "Repaired /etc/hosts — localhost entries restored."
