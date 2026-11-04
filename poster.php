<?php
/* Lấy poster từ CDN của AniList rồi lưu lại trên host.
   Trang Tier List cần đọc được ảnh để vẽ ra file PNG, mà đọc thẳng từ CDN thì rất chậm.
   Chỉ nhận tên file poster, không nhận địa chỉ tuỳ ý, nên không thể dùng để tải trang khác. */

const POSTER_BASE = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/';
const CACHE_DIR = __DIR__ . '/poster-cache';
const MAX_BYTES = 3145728;
const MAX_CACHED_FILES = 3000;
const TIMEOUT_SECONDS = 10;
const CACHE_SECONDS = 2592000;

function fail($status) {
    http_response_code($status);
    header('Cache-Control: no-store');
    exit;
}

function download($url) {
    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_TIMEOUT => TIMEOUT_SECONDS,
            CURLOPT_USERAGENT => 'A4VFamily poster cache',
        ]);
        $body = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        return $status === 200 ? $body : false;
    }

    $context = stream_context_create(['http' => [
        'timeout' => TIMEOUT_SECONDS,
        'follow_location' => 0,
        'user_agent' => 'A4VFamily poster cache',
    ]]);
    return @file_get_contents($url, false, $context, 0, MAX_BYTES + 1);
}

function send_image($type, $body) {
    header('Content-Type: ' . $type);
    header('Cache-Control: public, max-age=' . CACHE_SECONDS);
    header('X-Content-Type-Options: nosniff');
    echo $body;
    exit;
}

function save_to_cache($path, $body) {
    if (!is_dir(CACHE_DIR) && !@mkdir(CACHE_DIR, 0755)) return;
    if (count(glob(CACHE_DIR . '/*')) >= MAX_CACHED_FILES) return;

    $temporary = $path . '.' . getmypid() . '.tmp';
    if (@file_put_contents($temporary, $body) !== false) @rename($temporary, $path);
}

$types = ['jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'gif' => 'image/gif'];

$name = isset($_GET['f']) ? (string) $_GET['f'] : '';
if (!preg_match('/^[A-Za-z0-9_-]{1,80}\.(jpg|jpeg|png|webp|gif)$/', $name, $match)) fail(400);

$type = $types[$match[1]];
$path = CACHE_DIR . '/' . $name;

if (is_file($path)) send_image($type, file_get_contents($path));

$body = download(POSTER_BASE . $name);
if ($body === false || $body === '' || strlen($body) > MAX_BYTES || !@getimagesizefromstring($body)) fail(502);

save_to_cache($path, $body);
send_image($type, $body);
