/**
 * 地点探索内容库：每个地点/区域对应的探索图片 + 文学引用
 * MVP 阶段使用本地数据；后续迁移到 Supabase location_content 表
 * 支持按地点名精确匹配 → 区域模糊匹配 → 全局兜底
 */

export interface LocationContentEntry {
  /** 精确匹配地点名（可选） */
  location_name?: string
  /** 模糊匹配区域关键词（可选） */
  region_keyword?: string
  /** 探索图片 URL */
  image_url: string
  /** 图片标题/描述 */
  image_caption: string
  /** 文学/艺术引用 */
  quote: string
  /** 引用来源（作品名 + 作者） */
  quote_source: string
  /** 标签，用于未来按用户偏好个性化 */
  tags: string[]
}

/**
 * 本地内容种子数据
 * 每个条目对应一条「探索图片 + 文案」
 * 一个地点/区域可以有多条，随机选取
 */
export const LOCATION_CONTENT_DB: LocationContentEntry[] = [
  // === 中国 ===
  {
    location_name: '北京·胡同里的小院',
    image_url: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=80',
    image_caption: '老北京胡同的四合院',
    quote: '一个人只拥有此生此世是不够的，他还应该拥有诗意的世界。',
    quote_source: '王小波《黄金时代》',
    tags: ['文学', '怀旧', '城市'],
  },
  {
    region_keyword: '北京',
    image_url: 'https://images.unsplash.com/photo-1599571234909-29ed5d1321d6?w=800&q=80',
    image_caption: '故宫角楼的黄昏',
    quote: '人生到处知何似，应似飞鸿踏雪泥。',
    quote_source: '苏轼《和子由渑池怀旧》',
    tags: ['诗词', '历史'],
  },
  {
    location_name: '大理·洱海边的白族村',
    image_url: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?w=800&q=80',
    image_caption: '洱海边的宁静午后',
    quote: '我来到这个世界，为了看太阳和蔚蓝色的原野。',
    quote_source: '巴尔蒙特《为了看太阳》',
    tags: ['诗歌', '自然', '安静'],
  },
  {
    location_name: '成都·锦里旁的小巷',
    image_url: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800&q=80',
    image_caption: '成都巷子里的烟火气',
    quote: '晓看红湿处，花重锦官城。',
    quote_source: '杜甫《春夜喜雨》',
    tags: ['诗词', '美食', '生活'],
  },
  {
    region_keyword: '四川',
    image_url: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800&q=80',
    image_caption: '川西的烟火与安逸',
    quote: '人间烟火气，最抚凡人心。',
    quote_source: '《有匪》紫微流年',
    tags: ['烟火', '治愈'],
  },
  {
    location_name: '杭州·西湖断桥边',
    image_url: 'https://images.unsplash.com/photo-1599707367812-042632a07d58?w=800&q=80',
    image_caption: '西湖烟雨中的断桥',
    quote: '水光潋滟晴方好，山色空蒙雨亦奇。',
    quote_source: '苏轼《饮湖上初晴后雨》',
    tags: ['诗词', '湖泊', '浪漫'],
  },
  {
    location_name: '苏州·拙政园的角落',
    image_url: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80',
    image_caption: '拙政园的回廊与荷塘',
    quote: '庭有枇杷树，吾妻死之年所手植也，今已亭亭如盖矣。',
    quote_source: '归有光《项脊轩志》',
    tags: ['文学', '古典', '园林'],
  },
  {
    location_name: '西藏·纳木错的岸边',
    image_url: 'https://images.unsplash.com/photo-1614093302611-8efc4de12964?w=800&q=80',
    image_caption: '纳木错圣湖',
    quote: '世界上任何书籍都不能带给你好运，但是它们能让你悄悄成为你自己。',
    quote_source: '赫尔曼·黑塞《德米安》',
    tags: ['哲学', '孤独', '神圣'],
  },
  {
    location_name: '青海·茶卡盐湖',
    image_url: 'https://images.unsplash.com/photo-1604147706283-d7119b5b822c?w=800&q=80',
    image_caption: '天空之镜',
    quote: '在一回首间，才忽然发现，原来，我一生的种种努力，不过只为了周遭的人对我满意而已。',
    quote_source: '席慕蓉《独白》',
    tags: ['诗歌', '孤独', '壮阔'],
  },
  {
    location_name: '厦门·曾厝垵的猫巷',
    image_url: 'https://images.unsplash.com/photo-1577922839784-01b79ee56800?w=800&q=80',
    image_caption: '猫巷里的午后阳光',
    quote: '我荒废了时间，时间便把我荒废了。',
    quote_source: '莎士比亚《理查二世》',
    tags: ['文学', '猫', '慵懒'],
  },
  {
    region_keyword: '云南',
    image_url: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?w=800&q=80',
    image_caption: '云南的风花雪月',
    quote: '生活不是我们活过的日子，而是我们记住的日子。',
    quote_source: '加西亚·马尔克斯',
    tags: ['文学', '田园'],
  },
  {
    region_keyword: '中国',
    image_url: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80',
    image_caption: '山水之间',
    quote: '采菊东篱下，悠然见南山。',
    quote_source: '陶渊明《饮酒·其五》',
    tags: ['诗词', '田园', '隐逸'],
  },

  // === 日本 ===
  {
    location_name: '京都·下鸭神社附近',
    image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
    image_caption: '京都的千本鸟居',
    quote: '物の哀れ——万物都会消逝，正因如此才让人觉得美。',
    quote_source: '本居宣长《紫文要领》',
    tags: ['美学', '古典', '神社'],
  },
  {
    location_name: '东京·下北泽的唱片店',
    image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
    image_caption: '东京街头的霓虹',
    quote: '如果我爱你，我就会理解你，通过你的眼来看世界。',
    quote_source: '村上春树《挪威的森林》',
    tags: ['文学', '城市', '音乐'],
  },
  {
    location_name: '奈良·东大寺旁的鹿苑',
    image_url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80',
    image_caption: '奈良的小鹿',
    quote: '纵有疾风起，人生不言弃。',
    quote_source: '保罗·瓦雷里（宫崎骏《起风了》引用）',
    tags: ['动画', '治愈', '动物'],
  },
  {
    location_name: '北海道·富良野花田',
    image_url: 'https://images.unsplash.com/photo-1570459027562-4a916cc6113f?w=800&q=80',
    image_caption: '薰衣草花田',
    quote: '我们仰望着同一片天空，却看着不同的地方。',
    quote_source: '新海诚《秒速五厘米》',
    tags: ['动画', '花', '自然'],
  },
  {
    region_keyword: '日本',
    image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80',
    image_caption: '日本的四季之美',
    quote: '春有百花秋有月，夏有凉风冬有雪。若无闲事挂心头，便是人间好时节。',
    quote_source: '无门慧开《无门关》',
    tags: ['禅', '四季'],
  },

  // === 东南亚 ===
  {
    location_name: '巴厘岛·乌布稻田边',
    image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
    image_caption: '巴厘岛的梯田',
    quote: '旅行的意义不在于新的风景，而在于新的眼光。',
    quote_source: '马塞尔·普鲁斯特《追忆似水年华》',
    tags: ['文学', '旅行', '田园'],
  },
  {
    location_name: '清迈·古城寺庙旁',
    image_url: 'https://images.unsplash.com/photo-1512553733578-61e2734d3797?w=800&q=80',
    image_caption: '清迈寺庙的金色塔尖',
    quote: '真正的平静不是远离喧嚣，而是在心中修篱种菊。',
    quote_source: '林清玄《心的菩提》',
    tags: ['佛教', '安静', '哲学'],
  },
  {
    region_keyword: '东南亚',
    image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
    image_caption: '热带的绿与蓝',
    quote: '我们都是阴沟里的虫子，但总还是得有人仰望星空。',
    quote_source: '奥斯卡·王尔德',
    tags: ['文学', '热带'],
  },

  // === 欧洲 ===
  {
    location_name: '巴黎·塞纳河左岸咖啡馆',
    image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
    image_caption: '埃菲尔铁塔与塞纳河',
    quote: '如果你足够幸运，年轻时在巴黎生活过，那么此后无论你到哪里，巴黎都将与你同在。',
    quote_source: '海明威《流动的盛宴》',
    tags: ['文学', '浪漫', '咖啡'],
  },
  {
    region_keyword: '巴黎',
    image_url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80',
    image_caption: '巴黎街头',
    quote: '我思故我在。',
    quote_source: '勒内·笛卡尔《方法论》',
    tags: ['哲学', '法国'],
  },
  {
    location_name: '冰岛·黑沙滩的尽头',
    image_url: 'https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=800&q=80',
    image_caption: '冰岛黑沙滩的孤独',
    quote: '在世界尽头与冷酷仙境之间，存在着某种温柔。',
    quote_source: '村上春树《世界尽头与冷酷仙境》',
    tags: ['文学', '孤独', '极地'],
  },
  {
    location_name: '瑞士·因特拉肯的雪山下',
    image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    image_caption: '阿尔卑斯山下的小镇',
    quote: '攀登之路虽然艰辛，但望到山顶的那一刻，一切都值得。',
    quote_source: '加缪《西西弗神话》',
    tags: ['哲学', '雪山', '自然'],
  },
  {
    location_name: '希腊·圣托里尼的蓝顶教堂',
    image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80',
    image_caption: '爱琴海的蓝与白',
    quote: '认识你自己。',
    quote_source: '德尔斐神庙箴言',
    tags: ['哲学', '海', '古希腊'],
  },
  {
    region_keyword: '欧洲',
    image_url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80',
    image_caption: '欧洲的老城与教堂',
    quote: '所有的大人都曾经是小孩，虽然，只有少数的人记得。',
    quote_source: '圣埃克苏佩里《小王子》',
    tags: ['文学', '童话', '治愈'],
  },

  // === 非洲 ===
  {
    location_name: '马达加斯加·猴面包树大道',
    image_url: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=800&q=80',
    image_caption: '猴面包树的黄昏',
    quote: '你要记住那些大雨中为你撑伞的人。',
    quote_source: '村上春树',
    tags: ['文学', '自然', '非洲'],
  },
  {
    location_name: '肯尼亚·马赛马拉的草原',
    image_url: 'https://images.unsplash.com/photo-1516426122078-c23e76b4c128?w=800&q=80',
    image_caption: '非洲大草原的日落',
    quote: '我有一个梦想。',
    quote_source: '马丁·路德·金',
    tags: ['草原', '动物', '自由'],
  },
  {
    region_keyword: '非洲',
    image_url: 'https://images.unsplash.com/photo-1516426122078-c23e76b4c128?w=800&q=80',
    image_caption: '非洲的壮阔',
    quote: '你无法控制风向，但你可以调整风帆。',
    quote_source: '非洲谚语',
    tags: ['智慧', '自然'],
  },

  // === 美洲 ===
  {
    location_name: '纽约·中央公园的长椅',
    image_url: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
    image_caption: '中央公园的秋色',
    quote: '我愿做麦田里的守望者。',
    quote_source: '塞林格《麦田里的守望者》',
    tags: ['文学', '城市', '孤独'],
  },
  {
    location_name: '秘鲁·马丘比丘的云端',
    image_url: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=800&q=80',
    image_caption: '云中的马丘比丘',
    quote: '如果你把所有的错误都关在门外，真理也将被拒之门外。',
    quote_source: '泰戈尔《飞鸟集》',
    tags: ['诗歌', '遗迹', '云'],
  },
  {
    region_keyword: '美洲',
    image_url: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
    image_caption: '美洲的多彩',
    quote: '生命中真正重要的不是你遭遇了什么，而是你记住了哪些事，又是如何铭记的。',
    quote_source: '加西亚·马尔克斯《百年孤独》',
    tags: ['文学', '记忆'],
  },

  // === 全局兜底 ===
  {
    image_url: 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=800&q=80',
    image_caption: '远方的路',
    quote: '世界是一本书，不旅行的人只读了一页。',
    quote_source: '圣奥古斯丁',
    tags: ['旅行', '通用'],
  },
  {
    image_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
    image_caption: '旅途中的风景',
    quote: '不是所有流浪的人都迷了路。',
    quote_source: '托尔金《指环王》',
    tags: ['文学', '旅行', '通用'],
  },
  {
    image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
    image_caption: '山与湖',
    quote: '每一个不曾起舞的日子，都是对生命的辜负。',
    quote_source: '尼采',
    tags: ['哲学', '通用'],
  },
]

/**
 * 根据地点名和区域查找匹配的内容
 * 优先级：地点名精确匹配 → 区域关键词匹配 → 全局兜底
 * 同优先级内随机选取一条
 */
export function findLocationContent(
  locationName: string,
  region: string
): LocationContentEntry {
  // 1. 精确匹配地点名
  const nameMatches = LOCATION_CONTENT_DB.filter(
    (c) => c.location_name && locationName.includes(c.location_name)
  )
  if (nameMatches.length > 0) {
    return nameMatches[Math.floor(Math.random() * nameMatches.length)]
  }

  // 2. 区域关键词匹配
  const regionMatches = LOCATION_CONTENT_DB.filter(
    (c) => c.region_keyword && (region.includes(c.region_keyword) || locationName.includes(c.region_keyword))
  )
  if (regionMatches.length > 0) {
    return regionMatches[Math.floor(Math.random() * regionMatches.length)]
  }

  // 3. 全局兜底（无 location_name 且无 region_keyword 的条目）
  const fallbacks = LOCATION_CONTENT_DB.filter(
    (c) => !c.location_name && !c.region_keyword
  )
  return fallbacks[Math.floor(Math.random() * fallbacks.length)]
}
