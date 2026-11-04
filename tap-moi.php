<?php
/* Đọc danh sách video mới nhất của một playlist YouTube rồi lưu lại 10 phút trên host.
   Trang phim dùng file này để tìm tập vừa ra mà dữ liệu chưa kịp cập nhật.
   Chỉ nhận playlist đang có trong data.js, nên không thể dùng để tải trang khác. */

const FEED_URL = 'https://www.youtube.com/feeds/videos.xml?playlist_id=';
const PLAYLIST_URL = 'https://www.youtube.com/playlist?hl=vi&list=';
const CACHE_DIR = __DIR__ . '/tap-moi-cache';
const CACHE_SECONDS = 600;
const FAILED_CACHE_SECONDS = 120;
const MAX_CACHED_FILES = 500;
const MAX_VIDEOS = 40;
const MAX_BYTES = 3145728;
const TIMEOUT_SECONDS = 6;

function respond($status, $data, $maxAge) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=' . $maxAge);
    header('X-Content-Type-Options: nosniff');
    echo $data;
    exit;
}

function download($url) {
    if (!function_exists('curl_init')) return false;
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => TIMEOUT_SECONDS,
        CURLOPT_USERAGENT => 'Mozilla/5.0 A4VFamily',
        CURLOPT_HTTPHEADER => ['Accept-Language: vi'],
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    return $status === 200 && is_string($body) && strlen($body) <= MAX_BYTES ? $body : false;
}

function videos_from_feed($xml) {
    if (!preg_match_all('~<entry>.*?<yt:videoId>([\w-]{11})</yt:videoId>.*?<title>(.*?)</title>~s', $xml, $matches, PREG_SET_ORDER)) return [];
    return array_map(fn($match) => ['id' => $match[1], 'title' => html_entity_decode($match[2], ENT_QUOTES | ENT_XML1, 'UTF-8')], $matches);
}

function videos_from_page($page) {
    $videos = [];
    $patterns = [
        '~"playlistVideoRenderer":\{"videoId":"([\w-]{11})".*?"title":\{"runs":\[\{"text":"((?:[^"\\\\]|\\\\.)*)"~s',
        '~"contentId":"([\w-]{11})".{0,4000}?"title":\{"content":"((?:[^"\\\\]|\\\\.)*)"~s',
    ];
    foreach ($patterns as $pattern) {
        if (!preg_match_all($pattern, $page, $matches, PREG_SET_ORDER)) continue;
        foreach ($matches as $match) {
            $videos[$match[1]] = ['id' => $match[1], 'title' => (string) json_decode('"' . $match[2] . '"')];
        }
        if ($videos) break;
    }
    return array_values($videos);
}

function load_videos($id) {
    $feed = download(FEED_URL . $id);
    if ($feed !== false && ($videos = videos_from_feed($feed))) return ['source' => 'feed', 'videos' => $videos];

    $page = download(PLAYLIST_URL . $id);
    if ($page !== false && ($videos = videos_from_page($page))) return ['source' => 'page', 'videos' => $videos];

    return ['source' => 'none', 'videos' => []];
}

function save_to_cache($path, $body) {
    if (!is_dir(CACHE_DIR) && !@mkdir(CACHE_DIR, 0755)) return;
    if (count(glob(CACHE_DIR . '/*')) >= MAX_CACHED_FILES) {
        foreach (glob(CACHE_DIR . '/*') as $file) {
            if (filemtime($file) < time() - CACHE_SECONDS) @unlink($file);
        }
    }
    $temporary = $path . '.' . getmypid() . '.tmp';
    if (@file_put_contents($temporary, $body) !== false) @rename($temporary, $path);
}

$id = isset($_GET['list']) ? (string) $_GET['list'] : '';
if (!preg_match('/^(PL|UU|OL)[A-Za-z0-9_-]{10,40}$/', $id)) respond(400, '{"videos":[]}', 60);

$path = CACHE_DIR . '/' . $id . '.json';
if (is_file($path)) {
    $age = time() - filemtime($path);
    $cached = file_get_contents($path);
    $empty = strpos($cached, '"videos":[]') !== false;
    if ($age < ($empty ? FAILED_CACHE_SECONDS : CACHE_SECONDS)) respond(200, $cached, 300);
}

$data = @file_get_contents(__DIR__ . '/data.js');
if ($data === false || !preg_match('/list=' . preg_quote($id, '/') . '(?![A-Za-z0-9_-])/', $data)) respond(404, '{"videos":[]}', 300);

$result = load_videos($id);
$result['videos'] = array_slice($result['videos'], 0, MAX_VIDEOS);
$body = json_encode($result, JSON_UNESCAPED_UNICODE);
save_to_cache($path, $body);
respond(200, $body, $result['videos'] ? 300 : 60);
