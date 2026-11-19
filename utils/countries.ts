/**
 * QS Hub / 國際標準國家與地區名單 (Country or Territory)
 * 共 197 個標準項目，包含統一的 Taiwan SAR、China Mainland、Hong Kong SAR、Macau SAR 等。
 */

export const STANDARD_COUNTRIES: string[] = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Anguilla',
  'Antarctica',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Aruba',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'British Indian Ocean Territory',
  'Brunei Darussalam',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Cayman Islands',
  'Central African Republic',
  'Chad',
  'Chile',
  'China Mainland',
  'Colombia',
  'Comoros',
  'Costa Rica',
  'Crimea',
  'Croatia',
  'Cuba',
  'Curaçao',
  'Cyprus',
  'Czech Republic',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'French Guiana',
  'French Polynesia',
  'Gabon',
  'Georgia',
  'Germany',
  'Ghana',
  'Gibraltar',
  'Greece',
  'Greenland',
  'Grenada',
  'Guatemala',
  'Guernsey',
  'Guinea',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hong Kong SAR',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Macau SAR',
  'Macedonia',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Malta',
  'Mauritius',
  'Mayotte',
  'Mexico',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nepal',
  'Netherlands',
  'Netherlands Antilles',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'Norway',
  'Oman',
  'Pakistan',
  'Palestine (State of)',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Puerto Rico',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Barthelemy',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan SAR',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor - Leste',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Turks and Caicos Islands',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Venezuela',
  'Vietnam',
  'Virgin Islands [British]',
  'Yemen',
  'Zambia',
  'Zimbabwe',
  'Other'
];

// 建立小寫索引以利快速精準比對
const STANDARD_MAP = new Map<string, string>();
STANDARD_COUNTRIES.forEach(c => {
  STANDARD_MAP.set(c.toLowerCase(), c);
});

// 常見別名、繁簡中文、縮寫與異體字對照表
const COUNTRY_SYNONYMS: Record<string, string> = {
  // --- 台灣相關 (全部統一收斂為 Taiwan SAR，避免出現多個 Taiwan) ---
  'taiwan': 'Taiwan SAR',
  'taiwan sar': 'Taiwan SAR',
  'taiwan, roc': 'Taiwan SAR',
  'taiwan roc': 'Taiwan SAR',
  'taiwan, r.o.c.': 'Taiwan SAR',
  'taiwan r.o.c.': 'Taiwan SAR',
  'taiwan, r.o.c': 'Taiwan SAR',
  'taiwan (roc)': 'Taiwan SAR',
  'taiwan (r.o.c.)': 'Taiwan SAR',
  'taiwan(roc)': 'Taiwan SAR',
  'taiwan(r.o.c.)': 'Taiwan SAR',
  'roc': 'Taiwan SAR',
  'r.o.c.': 'Taiwan SAR',
  'r.o.c': 'Taiwan SAR',
  'republic of china': 'Taiwan SAR',
  'republic of china (taiwan)': 'Taiwan SAR',
  'taiwan, province of china': 'Taiwan SAR',
  'chinese taipei': 'Taiwan SAR',
  '台灣': 'Taiwan SAR',
  '臺灣': 'Taiwan SAR',
  '中華民國': 'Taiwan SAR',
  '中華民國(台灣)': 'Taiwan SAR',
  '中華民國（台灣）': 'Taiwan SAR',
  '台灣省': 'Taiwan SAR',
  '臺灣省': 'Taiwan SAR',
  'tw': 'Taiwan SAR',
  'twn': 'Taiwan SAR',
  'taipei': 'Taiwan SAR',
  'taichung': 'Taiwan SAR',
  'kaohsiung': 'Taiwan SAR',
  'tainan': 'Taiwan SAR',
  'hsinchu': 'Taiwan SAR',

  // --- 中國大陸 ---
  'china': 'China Mainland',
  'china mainland': 'China Mainland',
  'prc': 'China Mainland',
  "people's republic of china": 'China Mainland',
  'peoples republic of china': 'China Mainland',
  'mainland china': 'China Mainland',
  '中國': 'China Mainland',
  '中国': 'China Mainland',
  '中國大陸': 'China Mainland',
  '中国大陆': 'China Mainland',
  '大陸': 'China Mainland',
  '大陆': 'China Mainland',
  'cn': 'China Mainland',
  'chn': 'China Mainland',

  // --- 香港 ---
  'hong kong': 'Hong Kong SAR',
  'hong kong sar': 'Hong Kong SAR',
  'hongkong': 'Hong Kong SAR',
  'hk': 'Hong Kong SAR',
  'hkg': 'Hong Kong SAR',
  '香港': 'Hong Kong SAR',
  '香港特別行政區': 'Hong Kong SAR',

  // --- 澳門 ---
  'macau': 'Macau SAR',
  'macao': 'Macau SAR',
  'macau sar': 'Macau SAR',
  'macao sar': 'Macau SAR',
  'mo': 'Macau SAR',
  'mac': 'Macau SAR',
  '澳門': 'Macau SAR',
  '澳门': 'Macau SAR',

  // --- 美國 ---
  'united states': 'United States',
  'united states of america': 'United States',
  'usa': 'United States',
  'u.s.a.': 'United States',
  'u.s.': 'United States',
  'us': 'United States',
  'america': 'United States',
  '美國': 'United States',
  '美国': 'United States',

  // --- 英國 ---
  'united kingdom': 'United Kingdom',
  'uk': 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  'britain': 'United Kingdom',
  'england': 'United Kingdom',
  'scotland': 'United Kingdom',
  'wales': 'United Kingdom',
  '英國': 'United Kingdom',
  '英国': 'United Kingdom',

  // --- 日本 ---
  'japan': 'Japan',
  'jp': 'Japan',
  'jpn': 'Japan',
  '日本': 'Japan',
  'tokyo': 'Japan',
  'osaka': 'Japan',

  // --- 韓國 ---
  'south korea': 'South Korea',
  'korea': 'South Korea',
  'republic of korea': 'South Korea',
  'rok': 'South Korea',
  'kr': 'South Korea',
  'kor': 'South Korea',
  '韓國': 'South Korea',
  '韩国': 'South Korea',
  '南韓': 'South Korea',
  '南韩': 'South Korea',

  // --- 新加坡 ---
  'singapore': 'Singapore',
  'sg': 'Singapore',
  'sgp': 'Singapore',
  '新加坡': 'Singapore',
  '星加坡': 'Singapore',

  // --- 澳洲 ---
  'australia': 'Australia',
  'au': 'Australia',
  'aus': 'Australia',
  '澳洲': 'Australia',
  '澳大利亞': 'Australia',
  '澳大利亚': 'Australia',

  // --- 加拿大 ---
  'canada': 'Canada',
  'ca': 'Canada',
  'can': 'Canada',
  '加拿大': 'Canada',

  // --- 德國 ---
  'germany': 'Germany',
  'deutschland': 'Germany',
  'de': 'Germany',
  'deu': 'Germany',
  '德國': 'Germany',
  '德国': 'Germany',

  // --- 法國 ---
  'france': 'France',
  'fr': 'France',
  'fra': 'France',
  '法國': 'France',
  '法国': 'France',

  // --- 義大利 ---
  'italy': 'Italy',
  'italia': 'Italy',
  'it': 'Italy',
  'ita': 'Italy',
  '義大利': 'Italy',
  '意大利': 'Italy',

  // --- 西班牙 ---
  'spain': 'Spain',
  'españa': 'Spain',
  'es': 'Spain',
  'esp': 'Spain',
  '西班牙': 'Spain',

  // --- 荷蘭 ---
  'netherlands': 'Netherlands',
  'holland': 'Netherlands',
  'nl': 'Netherlands',
  'nld': 'Netherlands',
  '荷蘭': 'Netherlands',
  '荷兰': 'Netherlands',

  // --- 瑞士 ---
  'switzerland': 'Switzerland',
  'ch': 'Switzerland',
  'che': 'Switzerland',
  '瑞士': 'Switzerland',

  // --- 越南 ---
  'vietnam': 'Vietnam',
  'viet nam': 'Vietnam',
  'vn': 'Vietnam',
  'vnm': 'Vietnam',
  '越南': 'Vietnam',

  // --- 泰國 ---
  'thailand': 'Thailand',
  'th': 'Thailand',
  'tha': 'Thailand',
  '泰國': 'Thailand',
  '泰国': 'Thailand',

  // --- 馬來西亞 ---
  'malaysia': 'Malaysia',
  'my': 'Malaysia',
  'mys': 'Malaysia',
  '馬來西亞': 'Malaysia',
  '马来西亚': 'Malaysia',

  // --- 印尼 ---
  'indonesia': 'Indonesia',
  'id': 'Indonesia',
  'idn': 'Indonesia',
  '印尼': 'Indonesia',
  '印度尼西亞': 'Indonesia',

  // --- 菲律賓 ---
  'philippines': 'Philippines',
  'ph': 'Philippines',
  'phl': 'Philippines',
  '菲律賓': 'Philippines',
  '菲律宾': 'Philippines',

  // --- 印度 ---
  'india': 'India',
  'in': 'India',
  'ind': 'India',
  '印度': 'India',

  // --- 紐西蘭 ---
  'new zealand': 'New Zealand',
  'nz': 'New Zealand',
  'nzl': 'New Zealand',
  '紐西蘭': 'New Zealand',
  '新西蘭': 'New Zealand',

  // --- 捷克 ---
  'czech republic': 'Czech Republic',
  'czechia': 'Czech Republic',
  'cz': 'Czech Republic',
  'cze': 'Czech Republic',
  '捷克': 'Czech Republic',

  // --- 波蘭 ---
  'poland': 'Poland',
  'pl': 'Poland',
  'pol': 'Poland',
  '波蘭': 'Poland',

  // --- 俄羅斯 ---
  'russia': 'Russia',
  'russian federation': 'Russia',
  'ru': 'Russia',
  'rus': 'Russia',
  '俄羅斯': 'Russia',
  '俄罗斯': 'Russia',

  // --- 阿聯酋 ---
  'united arab emirates': 'United Arab Emirates',
  'uae': 'United Arab Emirates',
  'u.a.e.': 'United Arab Emirates',
  'ae': 'United Arab Emirates',
  'are': 'United Arab Emirates',
  '阿聯酋': 'United Arab Emirates',
  '阿拉伯聯合大公國': 'United Arab Emirates',

  // --- 沙烏地阿拉伯 ---
  'saudi arabia': 'Saudi Arabia',
  'ksa': 'Saudi Arabia',
  'sa': 'Saudi Arabia',
  'sau': 'Saudi Arabia',
  '沙烏地阿拉伯': 'Saudi Arabia',
  '沙特阿拉伯': 'Saudi Arabia'
};

/**
 * 檢查是否為台灣的任何變形
 */
export function isTaiwan(raw?: string | null): boolean {
  if (!raw) return false;
  const s = raw.trim().toLowerCase();
  return (
    s === 'taiwan' ||
    s === 'taiwan sar' ||
    s.includes('taiwan') ||
    s.includes('台灣') ||
    s.includes('臺灣') ||
    s.includes('中華民國') ||
    s === 'roc' ||
    s === 'r.o.c.' ||
    s === 'r.o.c' ||
    s === 'tw' ||
    s === 'twn' ||
    s === 'republic of china'
  );
}

/**
 * 核心正規化函式：
 * 將任何輸入的國家字串，轉換為標準 197 國名單中的精準名稱。
 * 特別防止出現「Taiwan」、「Taiwan, ROC」、「台灣」等多種不同版本，全部強制收斂為「Taiwan SAR」。
 */
export function normalizeCountry(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // 1. 優先判斷 Taiwan 各式變體（徹底杜絕好幾個 Taiwan）
  if (isTaiwan(trimmed)) {
    return 'Taiwan SAR';
  }

  const lower = trimmed.toLowerCase();

  // 2. 精準符合標準名單 (忽略大小寫)
  if (STANDARD_MAP.has(lower)) {
    return STANDARD_MAP.get(lower)!;
  }

  // 3. 別名 / 縮寫 / 中文比對
  if (COUNTRY_SYNONYMS[lower]) {
    return COUNTRY_SYNONYMS[lower];
  }

  // 4. 清理常見標點符號後再比對一次
  const stripped = lower.replace(/[,.()（）[\]'"]/g, ' ').replace(/\s+/g, ' ').trim();
  if (STANDARD_MAP.has(stripped)) {
    return STANDARD_MAP.get(stripped)!;
  }
  if (COUNTRY_SYNONYMS[stripped]) {
    return COUNTRY_SYNONYMS[stripped];
  }

  // 5. 特殊前綴或包含關鍵字比對
  if (stripped.includes('hong kong') || stripped.includes('香港')) return 'Hong Kong SAR';
  if (stripped.includes('macau') || stripped.includes('macao') || stripped.includes('澳門')) return 'Macau SAR';
  if (stripped.includes('mainland') || stripped.includes('大陸') || stripped === 'china' || stripped.includes('prc')) return 'China Mainland';
  if (stripped.includes('united states') || stripped.includes('america') || stripped === 'usa') return 'United States';
  if (stripped.includes('united kingdom') || stripped.includes('great britain') || stripped === 'uk') return 'United Kingdom';

  // 6. 尋找標準名單內的部分包含 (例如 "Kingdom of Saudi Arabia" -> "Saudi Arabia")
  for (const std of STANDARD_COUNTRIES) {
    if (std === 'Other') continue;
    const stdLower = std.toLowerCase();
    if (stripped.includes(stdLower)) {
      return std;
    }
  }

  // 7. 若完全無法辨識，若首字母為小寫則將開頭轉大寫，否則保留原字
  return trimmed;
}

/**
 * 國家標準繁體中文對照表
 */
export const COUNTRY_NAMES_ZH: Record<string, string> = {
  "Afghanistan": "阿富汗",
  "Albania": "阿爾巴尼亞",
  "Algeria": "阿爾及利亞",
  "Andorra": "安道爾",
  "Angola": "安哥拉",
  "Anguilla": "安圭拉",
  "Antarctica": "南極洲",
  "Antigua and Barbuda": "安地卡及巴布達",
  "Argentina": "阿根廷",
  "Armenia": "亞美尼亞",
  "Aruba": "阿魯巴",
  "Australia": "澳洲",
  "Austria": "奧地利",
  "Azerbaijan": "亞塞拜然",
  "Bahamas": "巴哈馬",
  "Bahrain": "巴林",
  "Bangladesh": "孟加拉",
  "Barbados": "巴貝多",
  "Belarus": "白俄羅斯",
  "Belgium": "比利時",
  "Belize": "貝里斯",
  "Benin": "貝南",
  "Bhutan": "不丹",
  "Bolivia": "玻利維亞",
  "Bosnia and Herzegovina": "波士尼亞與赫塞哥維納",
  "Botswana": "波札那",
  "Brazil": "巴西",
  "British Indian Ocean Territory": "英屬印度洋領地",
  "Brunei Darussalam": "汶萊",
  "Bulgaria": "保加利亞",
  "Burkina Faso": "布吉納法索",
  "Burundi": "蒲隆地",
  "Cambodia": "柬埔寨",
  "Cameroon": "喀麥隆",
  "Canada": "加拿大",
  "Cape Verde": "維德角",
  "Cayman Islands": "開曼群島",
  "Central African Republic": "中非共和國",
  "Chad": "查德",
  "Chile": "智利",
  "China Mainland": "中國大陸",
  "Colombia": "哥倫比亞",
  "Comoros": "葛摩",
  "Costa Rica": "哥斯大黎加",
  "Crimea": "克里米亞",
  "Croatia": "克羅埃西亞",
  "Cuba": "古巴",
  "Curaçao": "庫拉索",
  "Cyprus": "賽普勒斯",
  "Czech Republic": "捷克",
  "Democratic Republic of the Congo": "剛果民主共和國",
  "Denmark": "丹麥",
  "Djibouti": "吉布地",
  "Dominica": "多米尼克",
  "Dominican Republic": "多明尼加",
  "Ecuador": "厄瓜多",
  "Egypt": "埃及",
  "El Salvador": "薩爾瓦多",
  "Equatorial Guinea": "赤道幾內亞",
  "Estonia": "愛沙尼亞",
  "Eswatini": "史瓦帝尼",
  "Ethiopia": "衣索比亞",
  "Fiji": "斐濟",
  "Finland": "芬蘭",
  "France": "法國",
  "French Guiana": "法屬圭亞那",
  "French Polynesia": "法屬玻里尼西亞",
  "Gabon": "加彭",
  "Georgia": "喬治亞",
  "Germany": "德國",
  "Ghana": "迦納",
  "Gibraltar": "直布羅陀",
  "Greece": "希臘",
  "Greenland": "格陵蘭",
  "Grenada": "格瑞那達",
  "Guatemala": "瓜地馬拉",
  "Guernsey": "根西島",
  "Guinea": "幾內亞",
  "Guyana": "蓋亞那",
  "Haiti": "海地",
  "Honduras": "宏都拉斯",
  "Hong Kong SAR": "香港",
  "Hungary": "匈牙利",
  "Iceland": "冰島",
  "India": "印度",
  "Indonesia": "印尼",
  "Iran": "伊朗",
  "Iraq": "伊拉克",
  "Ireland": "愛爾蘭",
  "Israel": "以色列",
  "Italy": "義大利",
  "Ivory Coast": "象牙海岸",
  "Jamaica": "牙買加",
  "Japan": "日本",
  "Jordan": "約旦",
  "Kazakhstan": "哈薩克",
  "Kenya": "肯亞",
  "Kosovo": "科索沃",
  "Kuwait": "科威特",
  "Kyrgyzstan": "吉爾吉斯",
  "Laos": "寮國",
  "Latvia": "拉脫維亞",
  "Lebanon": "黎巴嫩",
  "Liberia": "賴比瑞亞",
  "Libya": "利比亞",
  "Liechtenstein": "列支敦斯登",
  "Lithuania": "立陶宛",
  "Luxembourg": "盧森堡",
  "Macau SAR": "澳門",
  "Macedonia": "北馬其頓",
  "Madagascar": "馬達加斯加",
  "Malawi": "馬拉威",
  "Malaysia": "馬來西亞",
  "Maldives": "馬爾地夫",
  "Malta": "馬爾他",
  "Mauritius": "模里西斯",
  "Mayotte": "馬約特",
  "Mexico": "墨西哥",
  "Moldova": "摩爾多瓦",
  "Monaco": "摩納哥",
  "Mongolia": "蒙古",
  "Montenegro": "蒙特內哥羅",
  "Morocco": "摩洛哥",
  "Mozambique": "莫三比克",
  "Myanmar": "緬甸",
  "Namibia": "納米比亞",
  "Nepal": "尼泊爾",
  "Netherlands": "荷蘭",
  "Netherlands Antilles": "荷屬安地列斯",
  "New Zealand": "紐西蘭",
  "Nicaragua": "尼加拉瓜",
  "Niger": "尼日",
  "Nigeria": "奈及利亞",
  "North Korea": "北韓",
  "Norway": "挪威",
  "Oman": "阿曼",
  "Pakistan": "巴基斯坦",
  "Palestine (State of)": "巴勒斯坦",
  "Panama": "巴拿馬",
  "Papua New Guinea": "巴布亞紐幾內亞",
  "Paraguay": "巴拉圭",
  "Peru": "秘魯",
  "Philippines": "菲律賓",
  "Poland": "波蘭",
  "Portugal": "葡萄牙",
  "Puerto Rico": "波多黎各",
  "Qatar": "卡達",
  "Romania": "羅馬尼亞",
  "Russia": "俄羅斯",
  "Rwanda": "盧安達",
  "Saint Barthelemy": "聖巴瑟米",
  "Saint Kitts and Nevis": "聖克里斯多福及尼維斯",
  "Saint Lucia": "聖露西亞",
  "Saint Vincent and the Grenadines": "聖文森及格瑞那丁",
  "Samoa": "薩摩亞",
  "Saudi Arabia": "沙烏地阿拉伯",
  "Senegal": "塞內加爾",
  "Serbia": "塞爾維亞",
  "Sierra Leone": "獅子山",
  "Singapore": "新加坡",
  "Slovakia": "斯洛伐克",
  "Slovenia": "斯洛維尼亞",
  "Somalia": "索馬利亞",
  "South Africa": "南非",
  "South Korea": "韓國",
  "South Sudan": "南蘇丹",
  "Spain": "西班牙",
  "Sri Lanka": "斯里蘭卡",
  "Sudan": "蘇丹",
  "Sweden": "瑞典",
  "Switzerland": "瑞士",
  "Syria": "敘利亞",
  "Taiwan SAR": "台灣",
  "Tajikistan": "塔吉克",
  "Tanzania": "坦尚尼亞",
  "Thailand": "泰國",
  "Timor - Leste": "東帝汶",
  "Tonga": "東加",
  "Trinidad and Tobago": "千里達及托巴哥",
  "Tunisia": "突尼西亞",
  "Turkey": "土耳其",
  "Turkmenistan": "土庫曼",
  "Turks and Caicos Islands": "特克斯與凱科斯群島",
  "Uganda": "烏干達",
  "Ukraine": "烏克蘭",
  "United Arab Emirates": "阿拉伯聯合大公國",
  "United Kingdom": "英國",
  "United States": "美國",
  "Uruguay": "烏拉圭",
  "Uzbekistan": "烏茲別克",
  "Venezuela": "委內瑞拉",
  "Vietnam": "越南",
  "Virgin Islands [British]": "英屬維京群島",
  "Yemen": "葉門",
  "Zambia": "尚比亞",
  "Zimbabwe": "辛巴威",
  "Other": "其他"
};

/**
 * 取得國家中英文雙語標籤
 * 範例："Taiwan SAR (台灣)"、"United States (美國)"、"Japan (日本)"
 */
export function getCountryBilingualLabel(country?: string | null): string {
  if (!country) return "";
  const trimmed = country.trim();
  if (!trimmed || trimmed === "all") return "全部國家";
  if (trimmed === "__empty__") return "未標註國家";
  
  const normalized = normalizeCountry(trimmed);
  const zh = COUNTRY_NAMES_ZH[normalized] || COUNTRY_NAMES_ZH[trimmed] || "";
  if (zh) {
    return normalized + " (" + zh + ")";
  }
  return normalized || trimmed;
}

/**
 * 取得國家標準中文名稱
 */
export function getCountryChineseName(country?: string | null): string {
  if (!country) return "";
  const normalized = normalizeCountry(country);
  return COUNTRY_NAMES_ZH[normalized] || COUNTRY_NAMES_ZH[country.trim()] || "";
}

/**
 * 下拉選單專用的中英雙語選項陣列
 */
export const STANDARD_COUNTRY_OPTIONS = STANDARD_COUNTRIES.map(c => ({
  value: c,
  label: getCountryBilingualLabel(c)
}));
