<?php
// Chuyển ảnh poster AniList về cùng tên miền để trang Tier list vẽ được ra ảnh tải về.
// Chỉ nhận đường dẫn poster của AniList, có lưu đệm trên host.
$path = (string) ($_GET['p'] ?? '');
if (!preg_match('#^/file/anilistcdn/media/anime/cover/(small|medium|large)/[A-Za-z0-9_-]+\.(png|jpe?g|webp)$#', $path, $match)) {
  http_response_code(400);
  exit;
}
$types = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp'];
$cacheDir = __DIR__ . '/anh-cache';
$cacheFile = $cacheDir . '/' . sha1($path);

if (!is_file($cacheFile)) {
  $curl = curl_init('https://s4.anilist.co' . $path);
  curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_FOLLOWLOCATION => false]);
  $image = curl_exec($curl);
  $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
  curl_close($curl);
  if ($status !== 200 || !$image || strlen($image) > 2000000) {
    http_response_code(502);
    exit;
  }
  if (!is_dir($cacheDir)) mkdir($cacheDir, 0755);
  file_put_contents($cacheFile, $image);
}

header('Content-Type: ' . $types[$match[2]]);
header('Cache-Control: public, max-age=2592000');
readfile($cacheFile);
