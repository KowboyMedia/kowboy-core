<?php
// Packages the plugin for WordPress's updater: core-client.zip, with the plugin directory inside
// it, and core-client.json, {"version", "package"}, from the version in the plugin header.
//
//   php clients/wordpress/release.php <output dir> <url the zip will be served from>

declare(strict_types=1);

$out = rtrim($argv[1] ?? '', '/');
$package = $argv[2] ?? '';
if ($out === '' || $package === '') {
    fwrite(STDERR, "usage: release.php <output dir> <package url>\n");
    exit(1);
}

$plugin = __DIR__ . '/core-client';
$header = (string) file_get_contents("$plugin/core-client.php");
if (preg_match('/^\s*\*\s*Version:\s*(\S+)/m', $header, $match) !== 1) {
    fwrite(STDERR, "no Version in the plugin header\n");
    exit(1);
}
$version = $match[1];

if (!is_dir($out) && !mkdir($out, 0777, true)) {
    fwrite(STDERR, "cannot create $out\n");
    exit(1);
}
$zip = new ZipArchive();
if ($zip->open("$out/core-client.zip", ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    fwrite(STDERR, "cannot write $out/core-client.zip\n");
    exit(1);
}
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($plugin, FilesystemIterator::SKIP_DOTS));
foreach ($files as $file) {
    $zip->addFile($file->getPathname(), 'core-client/' . substr($file->getPathname(), strlen($plugin) + 1));
}
$zip->close();

file_put_contents(
    "$out/core-client.json",
    json_encode(['version' => $version, 'package' => $package], JSON_UNESCAPED_SLASHES) . "\n",
);
echo "core-client $version packaged in $out\n";
