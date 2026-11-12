#!/usr/bin/env bash
# Builds a Sulu project with Primavista as the text editor, the way a project
# installs it: the Sulu skeleton from Packagist, the PHP bundle from a path
# repository, the npm packages as tarballs, then Sulu's own admin build.
#
# Needs PHP, Composer, Node, pnpm and a reachable MySQL. Run after `pnpm build`.
#
#   DATABASE_URL="mysql://root:root@127.0.0.1:3306/sulu?serverVersion=8.4&charset=utf8mb4" e2e-sulu/setup.sh
#
# SULU_VERSION (default 3.0.*, also 3.1.x-dev) picks the skeleton, SULU_APP (default .sulu-app)
# the folder.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${SULU_APP:-$ROOT/.sulu-app}"
SULU_VERSION="${SULU_VERSION:-3.0.*}"
: "${DATABASE_URL:?Set DATABASE_URL to a MySQL database Sulu may create}"

rm -rf "$APP"
STABILITY=()
case "$SULU_VERSION" in *dev*) STABILITY=(--stability=dev) ;; esac
composer create-project "sulu/skeleton:$SULU_VERSION" "$APP" "${STABILITY[@]}" --no-interaction --no-scripts --prefer-dist

cd "$APP"
cat > .env.local <<ENV
APP_ENV=dev
DATABASE_URL="$DATABASE_URL"
ENV

# PHP bundle and its sanitizer from the checkout.
composer config --json repositories.primavista-sulu-bundle "{\"type\":\"path\",\"url\":\"$ROOT/bundles/sulu-bundle\",\"options\":{\"symlink\":true}}"
composer config --json repositories.primavista-html-sanitizer "{\"type\":\"path\",\"url\":\"$ROOT/libs/html-sanitizer\",\"options\":{\"symlink\":true,\"versions\":{\"primavista/html-sanitizer\":\"0.1.0\"}}}"
composer require primavista/sulu-bundle:@dev --no-interaction --no-scripts --update-with-all-dependencies
php -r '
$file = "config/bundles.php";
$code = file_get_contents($file);
$code = str_replace("];", "    Primavista\\SuluBundle\\PrimavistaSuluBundle::class => [\"all\" => true],\n];", $code);
file_put_contents($file, $code);
'
cat > config/packages/primavista_sulu.yaml <<'YAML'
primavista_sulu:
    elements:
        - { tag: mark, class: yellow, label: Highlight }
        - { tag: abbr, attributes: [title], label: Abbreviation }
YAML

# Sulu 3.1 has text editor configs. An element is offered only when its tag is in the config of the field,
# the way a project allows it for any editor. Sulu 3.0 has no such config.
case "$SULU_VERSION" in
  3.1*)
    cat > config/packages/primavista_text_editor.yaml <<'YAML'
sulu_admin:
    text_editor:
        configs:
            default:
                tags:
                    mark: true
                    abbr: true
                attributes:
                    title: true
YAML
    ;;
esac

# npm packages as tarballs, a link to the package directories would pull in a second React.
mkdir -p primavista
(cd "$ROOT" && for package in core react sulu; do pnpm --filter "@primavista/$package" exec pnpm pack --pack-destination "$APP/primavista"; done)
node -e '
const fs = require("fs");
const file = "assets/admin/package.json";
const json = JSON.parse(fs.readFileSync(file, "utf8"));
json.dependencies = json.dependencies || {};
for (const name of fs.readdirSync("primavista")) {
  const package = name.replace(/^primavista-/, "").replace(/-\d.*$/, "");
  json.dependencies["@primavista/" + package] = "file:../../primavista/" + name;
}
json.dependencies["sulu-primavista-bundle"] = "file:../../vendor/primavista/sulu-bundle/assets/admin";
fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
'
echo "import 'sulu-primavista-bundle';" >> assets/admin/app.js

# Sulu's own admin build.
(cd assets/admin && npm install --install-links --legacy-peer-deps --no-audit --no-fund && npm run build)

composer dump-autoload --no-interaction
php bin/console cache:clear
php bin/console assets:install public
php bin/console sulu:build dev --no-interaction
# PHP's built-in server needs a router to serve the admin build next to Symfony.
cp "$ROOT/demo/public/router.php" public/router.php
echo "Sulu is ready in $APP"
