#!/bin/bash
set -e

# Configuration
SCOPE="@anthropic-meta-dreamer"  # Change this to your npm scope

echo "=== Better Auth Fork Publisher ==="
echo "Publishing packages under scope: $SCOPE"
echo ""

# Check if logged in to npm
if ! npm whoami &>/dev/null; then
  echo "Error: Not logged in to npm. Run 'npm login' first."
  exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to update package name
update_package_name() {
  local pkg_json="$1"
  local old_name=$(jq -r '.name' "$pkg_json")
  local new_name

  if [[ "$old_name" == "better-auth" ]]; then
    new_name="${SCOPE}/better-auth"
  elif [[ "$old_name" == @better-auth/* ]]; then
    # Replace @better-auth with our scope
    new_name="${SCOPE}/${old_name#@better-auth/}"
  else
    echo "Skipping unknown package: $old_name"
    return
  fi

  echo -e "${YELLOW}Renaming:${NC} $old_name -> $new_name"

  # Update the package name
  jq --arg name "$new_name" '.name = $name' "$pkg_json" > "${pkg_json}.tmp" && mv "${pkg_json}.tmp" "$pkg_json"
}

# Function to update workspace dependencies
update_workspace_deps() {
  local pkg_json="$1"

  # Update dependencies that reference @better-auth/* or better-auth
  jq --arg scope "$SCOPE" '
    def update_deps:
      if . then
        to_entries | map(
          if .key == "better-auth" then
            .key = ($scope + "/better-auth")
          elif .key | startswith("@better-auth/") then
            .key = ($scope + "/" + (.key | sub("@better-auth/"; "")))
          else
            .
          end
        ) | from_entries
      else
        .
      end;

    .dependencies = (.dependencies | update_deps) |
    .devDependencies = (.devDependencies | update_deps) |
    .peerDependencies = (.peerDependencies | update_deps)
  ' "$pkg_json" > "${pkg_json}.tmp" && mv "${pkg_json}.tmp" "$pkg_json"
}

echo "Step 1: Updating package names..."
for pkg_json in packages/*/package.json; do
  update_package_name "$pkg_json"
done

echo ""
echo "Step 2: Updating workspace dependencies..."
for pkg_json in packages/*/package.json; do
  update_workspace_deps "$pkg_json"
done

echo ""
echo "Step 3: Reinstalling dependencies..."
pnpm install

echo ""
echo "Step 4: Building all packages..."
pnpm build

echo ""
echo "Step 5: Publishing packages..."
# Publish in dependency order
PACKAGES=(
  "core"
  "telemetry"
  "kysely-adapter"
  "drizzle-adapter"
  "prisma-adapter"
  "mongo-adapter"
  "memory-adapter"
  "better-auth"
  "passkey"
)

for pkg in "${PACKAGES[@]}"; do
  pkg_dir="packages/$pkg"
  if [[ -d "$pkg_dir" ]]; then
    echo -e "${GREEN}Publishing:${NC} $pkg"
    cd "$pkg_dir"
    pnpm publish --access public --no-git-checks || echo -e "${RED}Failed to publish $pkg${NC}"
    cd ../..
  fi
done

echo ""
echo -e "${GREEN}Done!${NC}"
echo ""
echo "To use in your project:"
echo "  pnpm add ${SCOPE}/better-auth ${SCOPE}/passkey"
