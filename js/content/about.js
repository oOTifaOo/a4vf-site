/* Nội dung trang Giới thiệu, lấy từ hồ sơ năng lực của nhóm. Sửa số liệu, dự án hoặc liên hệ ở file này. */

export const ABOUT_PAGE = {
  tagline: 'Nhóm dịch thuật anime bản quyền',
  intro: 'A4VFamily là nhóm dịch anime từ tiếng Nhật sang tiếng Việt với 20 năm kinh nghiệm và gần 1000 dự án đã hoàn thành, đồng hành cùng các nền tảng phát hành anime bản quyền trong và ngoài Việt Nam.',
  stats: [
    { value: '20', label: 'năm kinh nghiệm' },
    { value: '~1000', label: 'dự án đã hoàn thành' },
    { value: '6', label: 'đối tác tiêu biểu' },
    { value: '24h', label: 'hoàn thiện khi dự án cần gấp' },
  ],
  journey: [
    { year: '2006', title: 'Bắt đầu từ đam mê', text: 'Nhóm ra đời với công việc dịch anime từ tiếng Nhật và tiếng Anh sang tiếng Việt, rồi nhanh chóng được cộng đồng fan Việt biết đến nhờ chất lượng và sự am hiểu anime.' },
    { year: '2016', title: 'Trở thành công ty', text: 'A4VFamily chính thức hoạt động như một công ty, mở ra chặng đường hợp tác với các đối tác trong và ngoài Việt Nam.' },
    { year: '2026', title: 'Đồng hành cùng anime bản quyền', text: 'Nhóm đã hoàn thành gần 1000 dự án và tiếp tục giúp khán giả Việt tìm đến anime chính thống qua website, Facebook và kênh tin tức.' },
  ],
  services: [
    { kana: '翻訳', icon: 'translate', title: 'Dịch thuật', text: 'Dịch thuật từ các ngôn ngữ: Nhật, Anh sang tiếng Việt. Dịch thuật các thể loại như Anime, Manga, Game, Light Novel. Có thể dịch thuật từ Nhật sang Anh.', tags: ['Anime', 'Manga', 'Game', 'Light Novel'] },
    { kana: '吹替', icon: 'mic', title: 'Lồng tiếng', text: 'Phối hợp cùng các Studio Lồng tiếng uy tín tại Việt Nam để thổi hồn vào các nhân vật Anime qua tiếng Việt.' },
    { kana: '宣伝', icon: 'campaign', title: 'Marketing', text: 'Quản lý Facebook Fanpage, Instagram, kênh YouTube và sáng tạo nội dung quảng bá anime bản quyền đến đúng khán giả Việt.', tags: ['Facebook', 'Instagram'] },
  ],
  reasons: [
    { title: 'Đội ngũ dịch chuyên nghiệp', text: 'Am hiểu anime để truyền tải đúng tinh thần và sắc thái của tác phẩm đến khán giả.' },
    { title: 'Quy mô lớn, tiến độ nhanh', text: 'Đủ sức xử lý khối lượng công việc lớn và kịp tiến độ gấp, trong 24 giờ nếu cần.' },
    { title: 'Quen làm việc với các nền tảng OTT', text: 'Đáp ứng yêu cầu định dạng của khách hàng trong nước và quốc tế, có kinh nghiệm xử lý tài liệu bản quyền.' },
    { title: 'Ủng hộ cộng đồng anime bản quyền', text: 'Ngoài dịch thuật, nhóm còn chủ động quảng bá sản phẩm anime bản quyền của đối tác.' },
  ],
  partners: [
    { name: 'Muse Việt Nam', file: 'muse' },
    { name: 'Bilibili', file: 'bilibili' },
    { name: 'Medialink (Ani-One)', file: 'ani-one' },
    { name: 'Remow', file: 'remow' },
    { name: 'Tropics Entertainment', file: 'tropics' },
    { name: 'iQIYI', file: 'iqiyi' },
  ],
  series: [
    { title: 'Alya Sometimes Hides Her Feelings in Russian', file: 'alya', platforms: 'Crunchyroll, Netflix, YouTube' },
    { title: 'Re:Zero - Starting Life in Another World', note: 'Mùa 1-3', file: 're-zero', platforms: 'FPT Play, YouTube, Netflix' },
    { title: 'Attack on Titan', note: 'Mùa 1-4', file: 'attack-on-titan', platforms: 'FPT Play, iQIYI, Netflix' },
    { title: 'Sword Art Online', note: 'Mùa 1-3', file: 'sword-art-online', platforms: 'FPT Play, iQIYI, YouTube' },
    { title: 'Black Butler', note: 'Mùa 1-4', file: 'black-butler', platforms: 'FPT Play, iQIYI' },
    { title: "Frieren: Beyond Journey's End", file: 'frieren', platforms: 'Crunchyroll, FPT Play, iQIYI, Netflix' },
    { title: 'My Deer Friend Nokotan', file: 'nokotan', platforms: 'iQIYI, YouTube' },
    { title: 'Dan Da Dan', file: 'dan-da-dan', platforms: 'YouTube, Netflix, FPT Play' },
    { title: 'Thất Nghiệp Chuyển Sinh (Mushoku Tensei)', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx108465-1ANspF1EWyFx.jpg' },
    { title: 'Ouran Highschool Host Club', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx853-fiUtW8yohsSF.jpg' },
    { title: 'Boruto: Naruto Next Generations', file: 'boruto', platforms: 'Bilibili' },
    { title: 'One Piece', file: 'one-piece', platforms: 'Bilibili' },
  ],
  movies: [
    { title: 'Your Name', note: '2016', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21519-SUo3ZQuCbYhJ.png' },
    { title: 'Quốc Bảo (Kokuho)', note: '2025', file: 'quoc-bao' },
    { title: '5cm trên giây', note: '2007', image: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1689-rJKhjLEjQHSy.jpg' },
    { title: 'Haikyu: The Dumpster Battle', note: '2024', file: 'haikyu' },
    { title: 'Spy x Family Code: White', note: '2024', file: 'spy-family' },
    { title: "My Hero Academia: You're Next", note: '2024', file: 'my-hero-academia' },
    { title: 'Attack on Titan: Final Attack', note: '2025', file: 'titan-final-attack' },
    { title: "Colorful Stage! The Movie: A Miku Who Can't Sing", note: '2025', file: 'miku' },
  ],
  sources: [
    { title: 'Nền tảng, link xem, giờ chiếu tại Việt Nam:', text: 'nhóm tự kiểm tra trên kênh và ứng dụng chính thức.' },
    { title: 'Tên gốc, thể loại, poster, số tập:', text: 'lấy từ AniList.' },
    { title: 'Mô tả nội dung:', text: 'viết tiếng Việt khi có, phim chưa có bản Việt sẽ hiện tóm tắt tiếng Anh từ AniList.' },
  ],
  contact: {
    email: 'a4vtranslation@gmail.com',
    facebook: 'https://www.facebook.com/a4vfamily',
  },
};
