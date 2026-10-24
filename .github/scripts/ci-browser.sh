#!/usr/bin/env bash
# The test browser (Playwright's Chromium) and the system packages it needs, for the browser jobs in
# .github/workflows/apps-check.yml. Both come from caches the default branch keeps warm (the `warm`
# job), when they are there:
#   ~/.cache/ms-playwright   the browser, so it isn't downloaded again
#   ~/apt-archives           apt's .deb files (fonts, xvfb...), so a slow Ubuntu mirror can't hold
#                            a job up for minutes; apt still checks each is the newest
#   .github/scripts/ci-browser.sh [hit]    hit: the browser came from the cache
set -euo pipefail
sudo mkdir -p "$HOME/apt-archives/partial"
printf 'Dir::Cache::Archives "%s/apt-archives";\nBinary::apt::APT::Keep-Downloaded-Packages "true";\nAPT::Keep-Downloaded-Packages "true";\n' "$HOME" \
  | sudo tee /etc/apt/apt.conf.d/90aos-ci > /dev/null
npm install --global playwright@1.56.1
if [ "${1:-}" = hit ]; then npx --yes playwright@1.56.1 install-deps chromium
else npx --yes playwright@1.56.1 install --with-deps chromium; fi
# so the cache can read what apt (as root) downloaded
sudo chown -R "$(id -u):$(id -g)" "$HOME/apt-archives"
