<?php
// Packages a WordPress plugin of this repository for WordPress's updater, and writes the index of
// template sets a site's settings page reads (docs/default-templates.md, "Installing and updating").
//
//   php clients/wordpress/release.php package <dir> <package name> <out dir> <channel url>
//       <out dir>/<package name>.zip, the plugin folder inside it named <package name>, and
//       <out dir>/<package name>.json, {"version", "package"}, the version from the plugin header
//       and the package address <channel url><package name>/<package name>-<version>.zip. The
//       client plugin's zip also carries channel.json, so a fresh install knows its channel.
//   php clients/wordpress/release.php index <out dir> <channel url> <slug>=<dir> ...
//       <out dir>/sets.json: one entry per set, {"slug", "name", "version", "package"}.

declare(strict_types=1);

$command = $argv[1] ?? '';
$arguments = array_slice($argv, 2);

function core_release_fail(string $message): never
{
    fwrite(STDERR, $message . "\n");
    exit(1);
}

/** @return array{name: string, version: string} */
function core_release_header(string $dir): array
{
    // The main file is the one with a plugin header, whatever the folder is called.
    $main = null;
    foreach (array_merge(glob("$dir/*.php") ?: [], glob("$dir/style.css") ?: []) as $candidate) {
        $contents = (string) file_get_contents($candidate);
        // A set plugin's main file, or a theme's style.css: the header names the package.
        if (str_contains($contents, 'Plugin Name:') || str_contains($contents, 'Theme Name:')) {
            $main = $candidate;
            break;
        }
    }
    if ($main === null) {
        core_release_fail("no plugin file in $dir");
    }
    $header = (string) file_get_contents($main);
    if (preg_match('/^\s*\*?\s*Version:\s*(\S+)/m', $header, $version) !== 1) {
        core_release_fail("no Version in the header of $main");
    }
    preg_match('/^\s*\*?\s*(?:Plugin|Theme) Name:\s*(.+?)\s*$/m', $header, $name);
    return ['name' => $name[1] ?? basename($dir), 'version' => $version[1]];
}

function core_release_out(string $out): string
{
    $out = rtrim($out, '/');
    if (!is_dir($out) && !mkdir($out, 0777, true)) {
        core_release_fail("cannot create $out");
    }
    return $out;
}

if ($command === 'package') {
    [$dir, $package, $out, $channel] = $arguments + ['', '', '', ''];
    if ($dir === '' || $package === '' || $out === '' || $channel === '') {
        core_release_fail('usage: release.php package <dir> <package name> <out dir> <channel url>');
    }
    $dir = rtrim($dir, '/');
    $channel = rtrim($channel, '/') . '/';
    $header = core_release_header($dir);
    $out = core_release_out($out);
    $zip = new ZipArchive();
    if ($zip->open("$out/$package.zip", ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        core_release_fail("cannot write $out/$package.zip");
    }
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($files as $file) {
        $zip->addFile($file->getPathname(), "$package/" . substr($file->getPathname(), strlen($dir) + 1));
    }
    if ($package === 'core-client') {
        $zip->addFromString("$package/channel.json", json_encode(['channel' => $channel], JSON_UNESCAPED_SLASHES) . "\n");
    }
    $zip->close();
    file_put_contents(
        "$out/$package.json",
        json_encode(['version' => $header['version'], 'package' => "$channel$package/$package-{$header['version']}.zip"], JSON_UNESCAPED_SLASHES) . "\n",
    );
    echo "$package {$header['version']} packaged in $out\n";
    exit(0);
}

if ($command === 'index') {
    [$out, $channel] = $arguments + ['', ''];
    if ($out === '' || $channel === '') {
        core_release_fail('usage: release.php index <out dir> <channel url> <slug>=<dir> ...');
    }
    $channel = rtrim($channel, '/') . '/';
    $sets = [];
    foreach (array_slice($arguments, 2) as $pair) {
        [$slug, $dir] = explode('=', $pair, 2) + ['', ''];
        $header = core_release_header(rtrim($dir, '/'));
        $package = "core-client-templates-$slug";
        $sets[] = [
            'slug' => $slug,
            'name' => $header['name'],
            'version' => $header['version'],
            'package' => "$channel$package/$package-{$header['version']}.zip",
        ];
    }
    $out = core_release_out($out);
    file_put_contents("$out/sets.json", json_encode($sets, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
    echo count($sets) . " sets indexed in $out\n";
    exit(0);
}

core_release_fail('usage: release.php package|index ...');
