#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04/24.04 VM: Docker, swap, firewall.
# Run on the VM:  bash setup-vm.sh
set -euo pipefail

echo "== Installing Docker =="
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"

echo "== Adding 2 GB swap (n8n needs headroom on 1 GB machines) =="
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "== Opening ports 80 and 443 in the OS firewall =="
# Oracle's Ubuntu images ship with iptables rules that block everything except SSH.
if command -v iptables >/dev/null; then
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
  sudo apt-get install -y iptables-persistent >/dev/null 2>&1 || true
  sudo netfilter-persistent save || true
fi

echo "Done. Log out and back in (so the docker group applies), then:"
echo "  cp .env.example .env && nano .env && docker compose up -d"
