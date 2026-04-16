/**
 * V2 真实世界地点库
 * MVP 阶段内置 ~60 个代表性地点（V1 目标 350-600，后续扩充）
 * 意向词 → 地点标签匹配选择
 */

export interface LocationEntry {
  name: string
  region: string
  tags: string[]
  description: string
  visual_keywords: string[]
  /** 纬度 */
  lat: number
  /** 经度 */
  lng: number
  /** 代表性照片 URL (Unsplash) */
  image: string
}

/** MVP 地点库：覆盖 6 大区域 × ~10 个地点，含经纬度和代表性图片 */
export const LOCATION_DB: LocationEntry[] = [
  // === 中国 ===
  { name: '大理·洱海边的白族村', region: '中国·云南', tags: ['湖泊','安静','民族','田园'], description: '阳光下白墙青瓦的小村子，洱海波光粼粼', visual_keywords: ['湖','白墙','花田'], lat: 25.69, lng: 100.16, image: 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?w=800&q=80' },
  { name: '成都·锦里旁的小巷', region: '中国·四川', tags: ['美食','老城','热闹','怀旧'], description: '飘着火锅香的老巷子，墙上爬满了绿萝', visual_keywords: ['灯笼','青石板','绿萝'], lat: 30.65, lng: 104.05, image: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800&q=80' },
  { name: '青海·茶卡盐湖', region: '中国·青海', tags: ['天空之镜','高原','孤独','壮阔'], description: '天地间只有风和自己的倒影', visual_keywords: ['盐湖','倒影','蓝天'], lat: 36.77, lng: 99.11, image: 'https://images.unsplash.com/photo-1604147706283-d7119b5b822c?w=800&q=80' },
  { name: '苏州·拙政园的角落', region: '中国·江苏', tags: ['园林','古典','水','安静'], description: '荷叶下有锦鲤，廊下有微风', visual_keywords: ['荷花','回廊','假山'], lat: 31.33, lng: 120.63, image: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80' },
  { name: '厦门·曾厝垵的猫巷', region: '中国·福建', tags: ['海边','猫','文艺','小巷'], description: '拐角遇到一只橘猫在晒太阳', visual_keywords: ['猫','彩色房子','阳光'], lat: 24.44, lng: 118.10, image: 'https://images.unsplash.com/photo-1577922839784-01b79ee56800?w=800&q=80' },
  { name: '西藏·纳木错的岸边', region: '中国·西藏', tags: ['雪山','湖泊','神圣','孤独'], description: '海拔四千七百米的湛蓝，时间好像停了', visual_keywords: ['雪山','蓝湖','经幡'], lat: 30.70, lng: 90.50, image: 'https://images.unsplash.com/photo-1614093302611-8efc4de12964?w=800&q=80' },
  { name: '杭州·西湖断桥边', region: '中国·浙江', tags: ['湖泊','传说','浪漫','柳树'], description: '细雨中柳枝拂过湖面，远处有人在拉二胡', visual_keywords: ['柳树','拱桥','雨'], lat: 30.26, lng: 120.15, image: 'https://images.unsplash.com/photo-1599707367812-042632a07d58?w=800&q=80' },
  { name: '北京·胡同里的小院', region: '中国·北京', tags: ['胡同','怀旧','安静','老城'], description: '石榴树下放着一把竹椅，收音机里是京剧', visual_keywords: ['四合院','石榴','竹椅'], lat: 39.93, lng: 116.40, image: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80' },
  { name: '丽江·束河古镇的溪边', region: '中国·云南', tags: ['古镇','溪水','安静','花'], description: '溪水穿过石板路，两岸开满了三角梅', visual_keywords: ['溪水','石板路','花'], lat: 26.91, lng: 100.21, image: 'https://images.unsplash.com/photo-1528164344885-60e52e7e0e6e?w=800&q=80' },
  { name: '敦煌·鸣沙山月牙泉', region: '中国·甘肃', tags: ['沙漠','神秘','壮阔','远行'], description: '沙丘间藏着一弯清泉，像沙漠的眼睛', visual_keywords: ['沙丘','月牙泉','骆驼'], lat: 40.08, lng: 94.67, image: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80' },

  // === 日本 ===
  { name: '京都·下鸭神社附近的林子', region: '日本·京都', tags: ['樱花','森林','神社','安静'], description: '阳光透过树叶洒在苔藓上，鸟声细细碎碎', visual_keywords: ['鸟居','苔藓','树林'], lat: 35.04, lng: 135.77, image: 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=800&q=80' },
  { name: '镰仓·灌篮高手的那个路口', region: '日本·神奈川', tags: ['海边','怀旧','动漫','电车'], description: '电车叮叮驶过，海风吹来咸咸的味道', visual_keywords: ['电车','海','路口'], lat: 35.31, lng: 139.49, image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&q=80' },
  { name: '北海道·富良野的薰衣草田', region: '日本·北海道', tags: ['花田','紫色','夏天','田园'], description: '紫色一直蔓延到天际线', visual_keywords: ['薰衣草','丘陵','蓝天'], lat: 43.34, lng: 142.38, image: 'https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=800&q=80' },
  { name: '奈良·小鹿公园', region: '日本·奈良', tags: ['小鹿','动物','草地','治愈'], description: '小鹿歪着头看你，好像在等你鞠躬', visual_keywords: ['小鹿','草地','大佛'], lat: 34.68, lng: 135.84, image: 'https://images.unsplash.com/photo-1524413840807-0c3cb6fa808d?w=800&q=80' },
  { name: '东京·下町的澡堂旁', region: '日本·东京', tags: ['老城','温泉','怀旧','烟火气'], description: '蒸汽从老澡堂屋顶升起，巷口有卖关东煮的', visual_keywords: ['澡堂','烟囱','灯笼'], lat: 35.71, lng: 139.81, image: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=800&q=80' },
  { name: '箱根·温泉旅馆的露台', region: '日本·箱根', tags: ['温泉','山','安静','治愈'], description: '泡着温泉看远处的山，什么都不想', visual_keywords: ['温泉','山','蒸汽'], lat: 35.23, lng: 139.11, image: 'https://images.unsplash.com/photo-1553653924-39b70295f8da?w=800&q=80' },
  { name: '直岛·地中美术馆', region: '日本·直岛', tags: ['艺术','海岛','安静','光'], description: '光从天花板洒下来，照亮莫奈的睡莲', visual_keywords: ['美术馆','光','海'], lat: 34.46, lng: 133.99, image: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=800&q=80' },
  { name: '屋久岛·白谷云水峡', region: '日本·屋久岛', tags: ['森林','苔藓','神秘','幽灵公主'], description: '像走进了幽灵公主的世界，空气都是绿色的', visual_keywords: ['巨树','苔藓','溪流'], lat: 30.35, lng: 130.51, image: 'https://images.unsplash.com/photo-1440581572325-0bea30075d9d?w=800&q=80' },

  // === 东南亚 ===
  { name: '清迈·古城里的寺庙', region: '泰国·清迈', tags: ['寺庙','安静','金色','信仰'], description: '金色的塔尖在夕阳里发光，僧人缓缓走过', visual_keywords: ['金塔','僧人','夕阳'], lat: 18.79, lng: 98.98, image: 'https://images.unsplash.com/photo-1512553754250-b05e1f4e3860?w=800&q=80' },
  { name: '巴厘岛·乌布的稻田', region: '印尼·巴厘岛', tags: ['稻田','田园','绿色','宁静'], description: '层层梯田从山坡流下来，像绿色的瀑布', visual_keywords: ['梯田','棕榈','绿色'], lat: -8.51, lng: 115.26, image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80' },
  { name: '暹粒·吴哥窟的日出', region: '柬埔寨·暹粒', tags: ['古迹','日出','壮阔','历史'], description: '塔尖的剪影慢慢被朝霞点亮', visual_keywords: ['吴哥窟','日出','倒影'], lat: 13.41, lng: 103.87, image: 'https://images.unsplash.com/photo-1569242840510-9fe6f0112ceb?w=800&q=80' },
  { name: '会安·灯笼老街', region: '越南·会安', tags: ['灯笼','老街','夜晚','浪漫'], description: '五颜六色的灯笼倒映在河面上', visual_keywords: ['灯笼','河','夜色'], lat: 15.88, lng: 108.33, image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&q=80' },
  { name: '仙本那·海上吉普赛人的家', region: '马来西亚·仙本那', tags: ['海','透明','蓝色','漂浮'], description: '海水透明得像不存在，船漂浮在空中', visual_keywords: ['透明海','木屋','小船'], lat: 4.48, lng: 118.62, image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80' },

  // === 欧洲 ===
  { name: '布拉格·查理大桥的清晨', region: '捷克·布拉格', tags: ['老城','桥','清晨','浪漫'], description: '雾气还没散，桥上只有一个拉手风琴的人', visual_keywords: ['石桥','雕像','晨雾'], lat: 50.09, lng: 14.41, image: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&q=80' },
  { name: '圣托里尼·蓝顶教堂旁', region: '希腊·圣托里尼', tags: ['海岛','蓝白','夕阳','浪漫'], description: '蓝色圆顶和白色墙壁，大海铺满了金色', visual_keywords: ['蓝顶','白墙','夕阳'], lat: 36.39, lng: 25.46, image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80' },
  { name: '瑞士·因特拉肯的草地', region: '瑞士·因特拉肯', tags: ['雪山','草地','纯净','壮阔'], description: '躺在草地上，雪山近得好像伸手就能碰到', visual_keywords: ['雪山','草地','木屋'], lat: 46.69, lng: 7.86, image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800&q=80' },
  { name: '巴黎·塞纳河畔的旧书摊', region: '法国·巴黎', tags: ['书','河流','文艺','怀旧'], description: '翻开一本泛黄的书，里面夹着一片干叶子', visual_keywords: ['旧书摊','河','桥'], lat: 48.86, lng: 2.34, image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80' },
  { name: '冰岛·黑沙滩', region: '冰岛', tags: ['黑沙滩','孤独','壮阔','冷'], description: '黑色的沙滩、白色的浪花、灰色的天，世界尽头的感觉', visual_keywords: ['黑沙','巨浪','玄武岩'], lat: 63.40, lng: -19.05, image: 'https://images.unsplash.com/photo-1504233529578-6d46baba6d34?w=800&q=80' },
  { name: '挪威·罗弗敦群岛的渔村', region: '挪威·罗弗敦', tags: ['渔村','极光','海','安静'], description: '红色小木屋排成一排，远处是雪山和大海', visual_keywords: ['红木屋','海','雪山'], lat: 68.20, lng: 14.57, image: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&q=80' },
  { name: '阿马尔菲·悬崖边的柠檬园', region: '意大利·阿马尔菲', tags: ['悬崖','柠檬','海','阳光'], description: '柠檬树从悬崖上垂下来，空气里全是清香', visual_keywords: ['悬崖','柠檬','蓝海'], lat: 40.63, lng: 14.60, image: 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=800&q=80' },

  // === 自然/异域 ===
  { name: '摩洛哥·舍夫沙万的蓝色小巷', region: '摩洛哥·舍夫沙万', tags: ['蓝色','小巷','猫','异域'], description: '整个世界都被刷成了蓝色，猫在台阶上打盹', visual_keywords: ['蓝色','台阶','猫'], lat: 35.17, lng: -5.26, image: 'https://images.unsplash.com/photo-1553603227-2358aabe821e?w=800&q=80' },
  { name: '土耳其·卡帕多奇亚的热气球', region: '土耳其·卡帕多奇亚', tags: ['热气球','日出','梦幻','壮阔'], description: '上百个热气球在晨光中缓缓升起，像一场梦', visual_keywords: ['热气球','岩石','日出'], lat: 38.64, lng: 34.83, image: 'https://images.unsplash.com/photo-1641128324972-af3212f0f6bd?w=800&q=80' },
  { name: '新西兰·瓦纳卡的孤独树', region: '新西兰·瓦纳卡', tags: ['湖泊','孤独','安静','远行'], description: '湖心只有一棵树，安静地站在水中央', visual_keywords: ['孤树','湖','山'], lat: -44.70, lng: 169.13, image: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&q=80' },
  { name: '尼泊尔·博卡拉的费瓦湖', region: '尼泊尔·博卡拉', tags: ['湖泊','雪山','安静','信仰'], description: '雪山倒映在湖里，划船的人唱着歌', visual_keywords: ['费瓦湖','雪山','小船'], lat: 28.21, lng: 83.96, image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80' },
  { name: '马达加斯加·猴面包树大道', region: '马达加斯加', tags: ['猴面包树','日落','壮阔','奇异'], description: '巨大的树像倒插的扫帚，夕阳把一切染成金色', visual_keywords: ['猴面包树','日落','土路'], lat: -20.25, lng: 44.42, image: 'https://images.unsplash.com/photo-1580541631950-7282082b02f6?w=800&q=80' },
  { name: '肯尼亚·马赛马拉的草原', region: '肯尼亚', tags: ['草原','动物','壮阔','自由'], description: '地平线上走来一群长颈鹿，慢悠悠的', visual_keywords: ['草原','长颈鹿','金合欢树'], lat: -1.50, lng: 35.14, image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&q=80' },

  // === 北美 ===
  { name: '温哥华·斯坦利公园的海堤', region: '加拿大·温哥华', tags: ['海','森林','跑步','安静'], description: '一边是大海一边是雪松林，海鸥在头顶飞', visual_keywords: ['海堤','雪松','海鸥'], lat: 49.30, lng: -123.14, image: 'https://images.unsplash.com/photo-1559511260-66a68e0e45d7?w=800&q=80' },
  { name: '纽约·中央公园的草坪', region: '美国·纽约', tags: ['公园','城市','阳光','休息'], description: '高楼围起来的绿洲，有人在弹吉他', visual_keywords: ['草坪','高楼','吉他'], lat: 40.78, lng: -73.97, image: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80' },
  { name: '加州·大苏尔的悬崖公路', region: '美国·加州', tags: ['悬崖','海','公路','自由'], description: '公路沿着悬崖蜿蜒，太平洋在脚下', visual_keywords: ['悬崖','公路','大海'], lat: 36.24, lng: -121.79, image: 'https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?w=800&q=80' },
  { name: '夏威夷·威基基的黄昏', region: '美国·夏威夷', tags: ['海滩','日落','热带','放松'], description: '冲浪的人变成了黑色剪影，天空全是粉色', visual_keywords: ['海滩','日落','棕榈'], lat: 21.28, lng: -157.83, image: 'https://images.unsplash.com/photo-1507876466758-bc54f384809c?w=800&q=80' },
]

/** 意向词 → 地点标签的映射 */
const INTENT_TAG_MAP: Record<string, string[]> = {
  '失眠': ['温泉', '安静', '治愈'],
  '睡眠': ['温泉', '安静', '治愈'],
  '怀旧': ['老城', '怀旧', '古典'],
  '童年': ['老城', '怀旧', '田园'],
  '孤独': ['孤独', '安静', '湖泊'],
  '焦虑': ['安静', '田园', '治愈', '温泉'],
  '想逃': ['远行', '海', '壮阔', '自由'],
  '远方': ['远行', '壮阔', '异域'],
  '海': ['海', '海边', '海滩', '海岛'],
  '山': ['雪山', '山', '高原'],
  '花': ['花', '花田', '樱花'],
  '樱花': ['樱花'],
  '美食': ['美食', '热闹'],
  '动物': ['动物', '小鹿', '猫'],
  '猫': ['猫'],
  '艺术': ['艺术', '文艺'],
  '音乐': ['文艺'],
  '阅读': ['文艺', '书'],
  '星空': ['孤独', '壮阔', '高原'],
  '下雨': ['雨', '安静'],
  '阳光': ['阳光', '草地', '田园'],
  '神秘': ['神秘', '森林', '古迹'],
  '浪漫': ['浪漫', '夕阳', '灯笼'],
  '梦': ['梦幻', '热气球'],
  '自由': ['自由', '公路', '壮阔'],
  '信仰': ['寺庙', '信仰', '神圣'],
}

/**
 * 从意向词列表中选择一个地点
 * @param intents 最近对话提取的意向词
 * @param excludeNames 30天内去过的地点名（冷却期）
 * @returns 选中的地点，无匹配时随机
 */
export function selectLocation(
  intents: string[],
  excludeNames: string[] = []
): LocationEntry {
  const available = LOCATION_DB.filter((loc) => !excludeNames.includes(loc.name))
  if (available.length === 0) {
    // 全部冷却期内，随机从全库选
    return LOCATION_DB[Math.floor(Math.random() * LOCATION_DB.length)]
  }

  if (intents.length === 0) {
    return available[Math.floor(Math.random() * available.length)]
  }

  // 收集所有匹配的标签
  const targetTags = new Set<string>()
  for (const intent of intents) {
    for (const [key, tags] of Object.entries(INTENT_TAG_MAP)) {
      if (intent.includes(key)) {
        tags.forEach((t) => targetTags.add(t))
      }
    }
    // 直接用意向词本身也作为标签匹配
    targetTags.add(intent)
  }

  if (targetTags.size === 0) {
    return available[Math.floor(Math.random() * available.length)]
  }

  // 按标签命中数排序
  const scored = available.map((loc) => {
    const hits = loc.tags.filter((t) => targetTags.has(t)).length
    return { loc, hits }
  })
  scored.sort((a, b) => b.hits - a.hits)

  // 从 Top-5 中随机选一个（避免确定性）
  const top = scored.slice(0, Math.min(5, scored.length)).filter((s) => s.hits > 0)
  if (top.length === 0) {
    return available[Math.floor(Math.random() * available.length)]
  }
  return top[Math.floor(Math.random() * top.length)].loc
}

/**
 * 随机决定旅行天数
 * V2 设计：30% 一天、40% 2-3天、30% 4-5天
 */
export function randomTravelDuration(): number {
  const r = Math.random()
  if (r < 0.3) return 1
  if (r < 0.7) return Math.random() < 0.5 ? 2 : 3
  return Math.random() < 0.5 ? 4 : 5
}

// ============================================
// 多地点旅行：区域邻近 + 下一站选择
// ============================================

/**
 * 区域邻近关系映射 — 用于多地点旅行时优先选同区域/邻近区域的下一站
 */
const REGION_ADJACENCY: Record<string, string[]> = {
  '中国': ['日本', '泰国', '越南', '柬埔寨', '马来西亚', '印尼', '尼泊尔'],
  '日本': ['中国'],
  '泰国': ['越南', '柬埔寨', '马来西亚', '中国'],
  '越南': ['泰国', '柬埔寨', '中国'],
  '柬埔寨': ['泰国', '越南'],
  '马来西亚': ['泰国', '印尼'],
  '印尼': ['马来西亚'],
  '捷克': ['瑞士', '法国', '意大利', '挪威', '冰岛', '希腊'],
  '希腊': ['意大利', '土耳其', '捷克'],
  '瑞士': ['法国', '意大利', '捷克', '挪威'],
  '法国': ['瑞士', '意大利', '捷克'],
  '冰岛': ['挪威', '捷克'],
  '挪威': ['冰岛', '瑞士', '捷克'],
  '意大利': ['法国', '瑞士', '希腊', '捷克'],
  '摩洛哥': ['法国', '捷克'],
  '土耳其': ['希腊'],
  '新西兰': ['加拿大', '美国'],
  '尼泊尔': ['中国'],
  '马达加斯加': ['肯尼亚'],
  '肯尼亚': ['马达加斯加'],
  '加拿大': ['美国'],
  '美国': ['加拿大'],
}

function getRegionPrefix(region: string): string {
  return region.split('·')[0]
}

function isSameRegion(regionA: string, regionB: string): boolean {
  return getRegionPrefix(regionA) === getRegionPrefix(regionB)
}

function isAdjacentRegion(regionA: string, regionB: string): boolean {
  const prefA = getRegionPrefix(regionA)
  const prefB = getRegionPrefix(regionB)
  return REGION_ADJACENCY[prefA]?.includes(prefB) ?? false
}

/**
 * 为多地点旅行选择下一个地点
 *
 * @param currentRegion 当前地点的 region
 * @param intents 用户意向词（短期+长期加权合并后的 top 8）
 * @param excludeNames 本次旅行已去过的地点名
 * @param visitCounts 用户的历史访问次数 map（location_name → count）
 */
export function selectNextLocation(
  currentRegion: string,
  intents: string[],
  excludeNames: string[],
  visitCounts: Record<string, number>
): LocationEntry {
  const available = LOCATION_DB.filter((loc) => !excludeNames.includes(loc.name))
  if (available.length === 0) {
    return LOCATION_DB[Math.floor(Math.random() * LOCATION_DB.length)]
  }

  // 收集意向标签
  const targetTags = new Set<string>()
  for (const intent of intents) {
    for (const [key, tags] of Object.entries(INTENT_TAG_MAP)) {
      if (intent.includes(key)) {
        tags.forEach((t) => targetTags.add(t))
      }
    }
    targetTags.add(intent)
  }

  const scored = available.map((loc) => {
    const tagHits = targetTags.size > 0
      ? loc.tags.filter((t) => targetTags.has(t)).length / Math.max(targetTags.size, 1)
      : 0

    let regionBonus = 0
    if (isSameRegion(loc.region, currentRegion)) {
      regionBonus = 0.3
    } else if (isAdjacentRegion(loc.region, currentRegion)) {
      regionBonus = 0.15
    }

    const visits = visitCounts[loc.name] ?? 0
    const noveltyBonus = visits === 0 ? 0.2 : visits === 1 ? 0.1 : 0

    return { loc, score: tagHits + regionBonus + noveltyBonus }
  })

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, Math.min(5, scored.length))
  return top[Math.floor(Math.random() * top.length)].loc
}
