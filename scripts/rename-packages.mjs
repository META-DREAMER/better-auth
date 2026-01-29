#!/usr/bin/env node
/**
 * Renames all better-auth packages to a custom npm scope.
 * Usage: node scripts/rename-packages.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";

const SCOPE = "@hammadj";
const PACKAGES_DIR = "packages";

// First, discover all workspace package names from packages/
const workspacePackages = new Set();
const packageDirs = readdirSync(PACKAGES_DIR);
for (const dir of packageDirs) {
	const pkgPath = join(PACKAGES_DIR, dir, "package.json");
	if (existsSync(pkgPath)) {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		workspacePackages.add(pkg.name);
	}
}

console.log(`Found ${workspacePackages.size} workspace packages to rename\n`);

// Map old names to new names (only for workspace packages)
function getNewName(oldName) {
	// Only rename if it's a workspace package
	if (!workspacePackages.has(oldName)) {
		return oldName;
	}

	if (oldName === "better-auth") {
		return `${SCOPE}/better-auth`;
	}
	if (oldName.startsWith("@better-auth/")) {
		return `${SCOPE}/better-auth-${oldName.replace("@better-auth/", "")}`;
	}
	return oldName;
}

// Update dependencies object
function updateDeps(deps) {
	if (!deps) return deps;

	const updated = {};
	for (const [name, version] of Object.entries(deps)) {
		const newName = getNewName(name);
		updated[newName] = version;
	}
	return updated;
}

// Process a single package.json (update deps only, optionally rename)
function processPackage(pkgPath, shouldRename = false) {
	const content = readFileSync(pkgPath, "utf-8");
	const pkg = JSON.parse(content);
	const oldName = pkg.name;

	let changed = false;

	// Rename the package itself if it's in packages/
	if (shouldRename && workspacePackages.has(oldName)) {
		const newName = getNewName(oldName);
		console.log(`  Renaming: ${oldName} -> ${newName}`);
		pkg.name = newName;
		changed = true;

		// Update repository URL
		if (pkg.repository?.url) {
			pkg.repository.url =
				"git+https://github.com/META-DREAMER/better-auth.git";
		}
	}

	// Update dependencies
	const origDeps = JSON.stringify(pkg.dependencies);
	const origDevDeps = JSON.stringify(pkg.devDependencies);
	const origPeerDeps = JSON.stringify(pkg.peerDependencies);

	pkg.dependencies = updateDeps(pkg.dependencies);
	pkg.devDependencies = updateDeps(pkg.devDependencies);
	pkg.peerDependencies = updateDeps(pkg.peerDependencies);

	if (
		origDeps !== JSON.stringify(pkg.dependencies) ||
		origDevDeps !== JSON.stringify(pkg.devDependencies) ||
		origPeerDeps !== JSON.stringify(pkg.peerDependencies)
	) {
		if (!shouldRename) {
			console.log(`  Updating deps in: ${pkgPath}`);
		}
		changed = true;
	}

	if (changed) {
		writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n");
	}
}

console.log("Step 1: Renaming packages in packages/...\n");

// Process packages/ (rename + update deps)
for (const dir of packageDirs) {
	const pkgPath = join(PACKAGES_DIR, dir, "package.json");
	if (existsSync(pkgPath)) {
		processPackage(pkgPath, true);
	}
}

console.log("\nStep 2: Updating dependencies in other workspace projects...\n");

// Find all other package.json files and update their deps
const allPkgJsons = execSync(
	'find . -name "package.json" -not -path "./node_modules/*" -not -path "./packages/*"',
	{ encoding: "utf-8" },
)
	.trim()
	.split("\n")
	.filter(Boolean);

for (const pkgPath of allPkgJsons) {
	processPackage(pkgPath, false);
}

console.log("\nDone! Now run:");
console.log("  1. pnpm install");
console.log("  2. pnpm build");
console.log("  3. pnpm -r publish --access public --no-git-checks");
