// Gom các phim cùng một bộ từ quan hệ trên AniList: phần trước, phần sau, movie, OVA và ngoại truyện.
const RELATION_TYPES = new Set(["PREQUEL", "SEQUEL", "PARENT", "SIDE_STORY", "SPIN_OFF"]);
const FORMATS = new Set(["TV", "TV_SHORT", "ONA", "OVA", "MOVIE", "SPECIAL"]);
const MAX_HOPS = 3; // đi xuyên qua các mục không có trong Sheet, ví dụ Re:Zero 2nd Season Part 2
const MAX_NODES = 2500;
const PAGE_SIZE = 50;
const QUERY = `query($ids:[Int],$page:Int){Page(page:$page,perPage:${PAGE_SIZE}){pageInfo{hasNextPage}
  media(id_in:$ids,type:ANIME){id startDate{year month day} relations{edges{relationType node{id type format}}}}}}`;

const dateKey = ({ year, month, day } = {}) => (year || 9999) * 10000 + (month || 12) * 100 + (day || 28);

/** fetchPage(query, variables) trả về { media, pageInfo } của một trang AniList. */
export async function loadRelations(ids, fetchPage, delay = () => Promise.resolve()) {
  const neighbors = new Map(), dates = new Map();
  let frontier = [...new Set(ids)];
  for (let hop = 0; hop <= MAX_HOPS && frontier.length; hop += 1) {
    const found = new Set();
    for (let start = 0; start < frontier.length; start += PAGE_SIZE) {
      const { media } = await fetchPage(QUERY, { ids: frontier.slice(start, start + PAGE_SIZE), page: 1 });
      for (const { id, startDate, relations } of media) {
        const linked = relations.edges
          .filter(({ relationType, node }) => RELATION_TYPES.has(relationType) && node.type === "ANIME" && FORMATS.has(node.format))
          .map(({ node }) => node.id);
        neighbors.set(id, linked);
        dates.set(id, dateKey(startDate));
        linked.forEach((other) => found.add(other));
      }
      await delay();
    }
    frontier = [...found].filter((id) => !neighbors.has(id));
    if (neighbors.size + frontier.length > MAX_NODES) break;
  }
  return { neighbors, dates };
}

/** Trả về Map id -> danh sách id cùng bộ theo ngày phát hành. Chỉ gồm các id trong `listed`. */
export function groupSeries(listed, { neighbors, dates }) {
  const parent = new Map();
  const find = (id) => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    parent.set(id, root);
    return root;
  };
  for (const [id, linked] of neighbors) {
    for (const other of linked) parent.set(find(id), find(other));
  }
  const groups = new Map();
  for (const id of listed) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  const series = new Map();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = group.sort((a, b) => (dates.get(a) ?? 99999999) - (dates.get(b) ?? 99999999) || a - b);
    for (const id of ordered) series.set(id, ordered);
  }
  return series;
}
